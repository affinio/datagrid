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

  const resolveContainers = (): HTMLElement[] => {
    return options.resolveScrollContainers().filter((value): value is HTMLElement => value instanceof HTMLElement)
  }

  const resolveContainerForTarget = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Node)) {
      return resolveContainers()[0] ?? null
    }
    for (const container of resolveContainers()) {
      if (container.contains(target)) {
        return container
      }
    }
    return resolveContainers()[0] ?? null
  }

  const resetGesture = (): void => {
    activeGesture = null
  }

  const handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) {
      resetGesture()
      return
    }
    const touch = event.touches[0]
    if (!touch) {
      resetGesture()
      return
    }
    activeGesture = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      container: resolveContainerForTarget(event.target),
      startScrollLeft: 0,
      startScrollTop: 0,
      lockedAxis: null,
    }
    if (activeGesture.container) {
      activeGesture.startScrollLeft = activeGesture.container.scrollLeft
      activeGesture.startScrollTop = activeGesture.container.scrollTop
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

    const container = activeGesture.container?.isConnected
      ? activeGesture.container
      : resolveContainerForTarget(event.target)
    if (!container) {
      return
    }

    const deltaX = touch.clientX - activeGesture.startX
    const deltaY = touch.clientY - activeGesture.startY
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)

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
    }

    event.preventDefault()

    if (activeGesture.lockedAxis === "x" && maxScrollLeft > EDGE_TOLERANCE_PX) {
      container.scrollLeft = clampScroll(activeGesture.startScrollLeft - deltaX, maxScrollLeft)
    }
    if (activeGesture.lockedAxis === "y" && maxScrollTop > EDGE_TOLERANCE_PX) {
      container.scrollTop = clampScroll(activeGesture.startScrollTop - deltaY, maxScrollTop)
    }
  }

  options.root.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true })
  options.root.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false })
  options.root.addEventListener("touchend", resetGesture, true)
  options.root.addEventListener("touchcancel", resetGesture, true)

  return () => {
    options.root.removeEventListener("touchstart", handleTouchStart, true)
    options.root.removeEventListener("touchmove", handleTouchMove, true)
    options.root.removeEventListener("touchend", resetGesture, true)
    options.root.removeEventListener("touchcancel", resetGesture, true)
  }
}