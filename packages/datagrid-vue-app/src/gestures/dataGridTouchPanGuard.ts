const MIN_TOUCH_PAN_LOCK_DISTANCE_PX = 6
const EDGE_TOLERANCE_PX = 0.5

export type DataGridTouchPanAxis = "x" | "y"

interface ActiveTouchGesture {
  identifier: number
  startX: number
  startY: number
  startScrollLeft: number
  startScrollTop: number
  container: HTMLElement | null
  containers: readonly HTMLElement[]
  lockedAxis: DataGridTouchPanAxis | null
}

export interface ResolveDataGridTouchPanAxisInput {
  deltaX: number
  deltaY: number
  maxScrollLeft: number
  maxScrollTop: number
}

export interface InstallDataGridTouchPanGuardOptions {
  root: HTMLElement
  resolveScrollContainers: () => readonly (HTMLElement | null | undefined)[]
  shouldHandleTarget?: (target: EventTarget | null) => boolean
  useAllScrollContainersForTarget?: boolean
}

function clampScroll(value: number, maxScroll: number): number {
  return Math.min(Math.max(0, value), Math.max(0, maxScroll))
}

export function resolveDataGridTouchPanAxis(
  input: ResolveDataGridTouchPanAxisInput,
): DataGridTouchPanAxis | null {
  const absDeltaX = Math.abs(input.deltaX)
  const absDeltaY = Math.abs(input.deltaY)
  const travel = Math.max(absDeltaX, absDeltaY)
  if (travel < MIN_TOUCH_PAN_LOCK_DISTANCE_PX) {
    return null
  }

  const hasHorizontalRange = input.maxScrollLeft > EDGE_TOLERANCE_PX
  const hasVerticalRange = input.maxScrollTop > EDGE_TOLERANCE_PX
  if (!hasHorizontalRange && !hasVerticalRange) {
    return null
  }
  if (hasHorizontalRange && !hasVerticalRange) {
    return "x"
  }
  if (hasVerticalRange && !hasHorizontalRange) {
    return "y"
  }
  return absDeltaX >= absDeltaY ? "x" : "y"
}

export function installDataGridTouchPanGuard(
  options: InstallDataGridTouchPanGuardOptions,
): () => void {
  let activeGesture: ActiveTouchGesture | null = null
  let touchMoveListening = false

  const resolveContainers = (): HTMLElement[] => {
    return options.resolveScrollContainers().filter((value): value is HTMLElement => value instanceof HTMLElement)
  }

  const resolveContainersForTarget = (target: EventTarget | null): HTMLElement[] => {
    const containers = resolveContainers()
    if (options.useAllScrollContainersForTarget || !(target instanceof Node)) {
      return containers
    }
    const containing = containers.filter(container => container.contains(target))
    return containing.length > 0 ? containing : containers
  }

  const resolveMaxScrollLeft = (container: HTMLElement): number => Math.max(0, container.scrollWidth - container.clientWidth)
  const resolveMaxScrollTop = (container: HTMLElement): number => Math.max(0, container.scrollHeight - container.clientHeight)

  const resolveContainerForAxis = (containers: readonly HTMLElement[], axis: DataGridTouchPanAxis): HTMLElement | null => {
    for (const container of containers) {
      const maxScroll = axis === "x" ? resolveMaxScrollLeft(container) : resolveMaxScrollTop(container)
      if (maxScroll > EDGE_TOLERANCE_PX) {
        return container
      }
    }
    return containers[0] ?? null
  }

  const addTouchMoveListener = (): void => {
    if (touchMoveListening) {
      return
    }
    options.root.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false })
    touchMoveListening = true
  }

  const removeTouchMoveListener = (): void => {
    if (!touchMoveListening) {
      return
    }
    options.root.removeEventListener("touchmove", handleTouchMove, true)
    touchMoveListening = false
  }

  const resetGesture = (): void => {
    activeGesture = null
    removeTouchMoveListener()
  }

  const handleTouchStart = (event: TouchEvent): void => {
    if (options.shouldHandleTarget && !options.shouldHandleTarget(event.target)) {
      resetGesture()
      return
    }
    if (event.touches.length !== 1) {
      resetGesture()
      return
    }
    const touch = event.touches[0]
    if (!touch) {
      resetGesture()
      return
    }
    const containers = resolveContainersForTarget(event.target)
    activeGesture = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      container: null,
      containers,
      startScrollLeft: 0,
      startScrollTop: 0,
      lockedAxis: null,
    }
    if (containers.length > 0) {
      addTouchMoveListener()
    }
  }

  const handleTouchMove = (event: TouchEvent): void => {
    if (!activeGesture || !event.cancelable) {
      return
    }

    const touch = Array.from(event.touches).find(candidate => candidate.identifier === activeGesture?.identifier)
    if (!touch) {
      return
    }

    const containers = activeGesture.containers
    if (containers.length === 0) {
      return
    }

    const deltaX = touch.clientX - activeGesture.startX
    const deltaY = touch.clientY - activeGesture.startY
    const maxScrollLeft = Math.max(0, ...containers.map(resolveMaxScrollLeft))
    const maxScrollTop = Math.max(0, ...containers.map(resolveMaxScrollTop))

    if (!activeGesture.lockedAxis) {
      activeGesture.lockedAxis = resolveDataGridTouchPanAxis({
        deltaX,
        deltaY,
        maxScrollLeft,
        maxScrollTop,
      })
      if (!activeGesture.lockedAxis) {
        return
      }
      activeGesture.container = resolveContainerForAxis(containers, activeGesture.lockedAxis)
      activeGesture.startScrollLeft = activeGesture.container?.scrollLeft ?? 0
      activeGesture.startScrollTop = activeGesture.container?.scrollTop ?? 0
    }

    const container = activeGesture.container?.isConnected
      ? activeGesture.container
      : resolveContainerForAxis(containers, activeGesture.lockedAxis)
    if (!container) {
      return
    }

    const targetMaxScrollLeft = resolveMaxScrollLeft(container)
    const targetMaxScrollTop = resolveMaxScrollTop(container)

    event.preventDefault()

    if (activeGesture.lockedAxis === "x" && targetMaxScrollLeft > EDGE_TOLERANCE_PX) {
      container.scrollLeft = clampScroll(activeGesture.startScrollLeft - deltaX, targetMaxScrollLeft)
    }
    if (activeGesture.lockedAxis === "y" && targetMaxScrollTop > EDGE_TOLERANCE_PX) {
      container.scrollTop = clampScroll(activeGesture.startScrollTop - deltaY, targetMaxScrollTop)
    }
  }

  options.root.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true })
  options.root.addEventListener("touchend", resetGesture, { capture: true, passive: true })
  options.root.addEventListener("touchcancel", resetGesture, { capture: true, passive: true })

  return () => {
    removeTouchMoveListener()
    options.root.removeEventListener("touchstart", handleTouchStart, true)
    options.root.removeEventListener("touchend", resetGesture, true)
    options.root.removeEventListener("touchcancel", resetGesture, true)
  }
}
