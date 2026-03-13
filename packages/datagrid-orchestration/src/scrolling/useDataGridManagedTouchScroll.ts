import {
  createDataGridManagedScrollDeltaPipeline,
  resolveDataGridManagedScrollPropagationDecision,
  type DataGridManagedScrollAxisLockMode,
  type DataGridManagedScrollBodyViewport,
  type DataGridManagedScrollConsumptionResult,
  type DataGridManagedScrollMainViewport,
  type DataGridManagedScrollPropagationMode,
} from "./dataGridManagedScrollPipeline"

export type DataGridTouchPanMode = "managed" | "native"
export type DataGridTouchAxisLockMode = DataGridManagedScrollAxisLockMode
export type DataGridTouchPropagationMode = DataGridManagedScrollPropagationMode
export type DataGridTouchConsumptionResult = DataGridManagedScrollConsumptionResult
export type DataGridManagedTouchBodyViewport = DataGridManagedScrollBodyViewport
export type DataGridManagedTouchMainViewport = DataGridManagedScrollMainViewport

export interface UseDataGridManagedTouchScrollOptions {
  resolveTouchMode?: () => DataGridTouchPanMode
  resolveTouchAxisLockMode?: () => DataGridTouchAxisLockMode
  resolvePreventDefaultWhenHandled?: () => boolean
  resolveStopImmediatePropagation?: () => boolean
  resolveTouchPropagationMode?: () => DataGridTouchPropagationMode
  resolveShouldPropagateTouchEvent?: (result: DataGridTouchConsumptionResult) => boolean
  resolveMinDeltaToApply?: () => number
  resolveBodyViewport: () => DataGridManagedTouchBodyViewport | null
  resolveMainViewport?: () => DataGridManagedTouchMainViewport | null
  setHandledScrollTop: (value: number) => void
  setHandledScrollLeft?: (value: number) => void
  syncLinkedScroll?: (scrollTop: number) => void
  scheduleLinkedScrollSyncLoop?: () => void
  isLinkedScrollSyncLoopScheduled?: () => boolean
  onPanConsumed?: () => void
}

export interface UseDataGridManagedTouchScrollResult {
  applyPanDeltaToViewports: (deltaX: number, deltaY: number) => DataGridTouchConsumptionResult
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerCancel: (event: PointerEvent) => void
  onTouchStart: (event: TouchEvent) => void
  onTouchMove: (event: TouchEvent) => void
  onTouchEnd: (event: TouchEvent) => void
  onTouchCancel: (event: TouchEvent) => void
  reset: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  const editableHost = target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")
  return editableHost !== null
}

function findTouchByIdentifier(touches: TouchList, identifier: number): Touch | null {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index)
    if (touch && touch.identifier === identifier) {
      return touch
    }
  }
  return null
}

export function useDataGridManagedTouchScroll(
  options: UseDataGridManagedTouchScrollOptions,
): UseDataGridManagedTouchScrollResult {
  const resolveTouchMode = options.resolveTouchMode ?? (() => "managed" as const)
  const resolveAxisLock = options.resolveTouchAxisLockMode ?? (() => "dominant" as const)
  const resolvePreventDefaultWhenHandled = options.resolvePreventDefaultWhenHandled ?? (() => true)
  const resolveStopImmediatePropagation = options.resolveStopImmediatePropagation ?? (() => false)
  const resolveTouchPropagationMode = options.resolveTouchPropagationMode ?? (() => "retain" as const)

  const deltaPipeline = createDataGridManagedScrollDeltaPipeline({
    resolveAxisLockMode: resolveAxisLock,
    resolveMinDeltaToApply: options.resolveMinDeltaToApply,
    resolveBodyViewport: options.resolveBodyViewport,
    resolveMainViewport: options.resolveMainViewport,
    setHandledScrollTop: options.setHandledScrollTop,
    setHandledScrollLeft: options.setHandledScrollLeft,
    syncLinkedScroll: options.syncLinkedScroll,
    scheduleLinkedScrollSyncLoop: options.scheduleLinkedScrollSyncLoop,
    isLinkedScrollSyncLoopScheduled: options.isLinkedScrollSyncLoopScheduled,
  })

  let activePointerId: number | null = null
  let activeTouchId: number | null = null
  let lastClientX = 0
  let lastClientY = 0

  function resetGestureState(): void {
    activePointerId = null
    activeTouchId = null
    lastClientX = 0
    lastClientY = 0
  }

  function reset(): void {
    deltaPipeline.reset()
    resetGestureState()
  }

  function applyPanDeltaToViewports(deltaX: number, deltaY: number): DataGridTouchConsumptionResult {
    if (resolveTouchMode() === "native") {
      deltaPipeline.reset()
      return {
        handled: false,
        handledX: false,
        handledY: false,
        consumed: false,
        consumedX: false,
        consumedY: false,
        atBoundaryX: false,
        atBoundaryY: false,
      }
    }
    const result = deltaPipeline.applyDeltaToViewports(deltaX, deltaY)
    if (result.consumed) {
      options.onPanConsumed?.()
    }
    return result
  }

  function shouldPreventDefaultForResult(result: DataGridTouchConsumptionResult): boolean {
    const shouldPropagateByMode = resolveDataGridManagedScrollPropagationDecision(result, resolveTouchPropagationMode())
    const shouldPropagateByOverride = options.resolveShouldPropagateTouchEvent?.(result) ?? false
    const shouldPropagate = shouldPropagateByMode || shouldPropagateByOverride
    return result.handled && resolvePreventDefaultWhenHandled() && !shouldPropagate
  }

  function applyPanWithEvent(deltaX: number, deltaY: number, event: Event): DataGridTouchConsumptionResult {
    const result = applyPanDeltaToViewports(deltaX, deltaY)
    if (!shouldPreventDefaultForResult(result)) {
      return result
    }

    event.preventDefault()
    if (resolveStopImmediatePropagation() && typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation()
    } else {
      event.stopPropagation()
    }

    return result
  }

  function onPointerDown(event: PointerEvent): void {
    if (resolveTouchMode() === "native") {
      reset()
      return
    }
    if (event.pointerType !== "touch") {
      return
    }
    if (!event.isPrimary) {
      activePointerId = null
      return
    }
    if (isEditableTarget(event.target)) {
      return
    }

    activePointerId = event.pointerId
    activeTouchId = null
    lastClientX = event.clientX
    lastClientY = event.clientY
  }

  function onPointerMove(event: PointerEvent): void {
    if (activePointerId === null || event.pointerId !== activePointerId) {
      return
    }
    const deltaX = lastClientX - event.clientX
    const deltaY = lastClientY - event.clientY
    lastClientX = event.clientX
    lastClientY = event.clientY
    applyPanWithEvent(deltaX, deltaY, event)
  }

  function onPointerUp(event: PointerEvent): void {
    if (activePointerId !== null && event.pointerId === activePointerId) {
      activePointerId = null
      deltaPipeline.reset()
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (activePointerId !== null && event.pointerId === activePointerId) {
      reset()
    }
  }

  function onTouchStart(event: TouchEvent): void {
    if (resolveTouchMode() === "native") {
      reset()
      return
    }
    if (event.touches.length !== 1) {
      activeTouchId = null
      return
    }
    if (isEditableTarget(event.target)) {
      return
    }

    const touch = event.touches.item(0)
    if (!touch) {
      return
    }

    activeTouchId = touch.identifier
    activePointerId = null
    lastClientX = touch.clientX
    lastClientY = touch.clientY
  }

  function onTouchMove(event: TouchEvent): void {
    if (activeTouchId === null) {
      return
    }
    if (event.touches.length !== 1) {
      activeTouchId = null
      deltaPipeline.reset()
      return
    }

    const touch = findTouchByIdentifier(event.touches, activeTouchId)
    if (!touch) {
      return
    }
    const deltaX = lastClientX - touch.clientX
    const deltaY = lastClientY - touch.clientY
    lastClientX = touch.clientX
    lastClientY = touch.clientY
    applyPanWithEvent(deltaX, deltaY, event)
  }

  function onTouchEnd(event: TouchEvent): void {
    if (activeTouchId === null) {
      return
    }
    const endedTouch = findTouchByIdentifier(event.changedTouches, activeTouchId)
    if (!endedTouch) {
      return
    }
    activeTouchId = null
    deltaPipeline.reset()
  }

  function onTouchCancel(event: TouchEvent): void {
    if (activeTouchId === null) {
      return
    }
    const canceledTouch = findTouchByIdentifier(event.changedTouches, activeTouchId)
    if (!canceledTouch) {
      return
    }
    reset()
  }

  return {
    applyPanDeltaToViewports,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    reset,
  }
}
