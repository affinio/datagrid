import {
  createDataGridManagedScrollDeltaPipeline,
  resolveDataGridManagedScrollAxisPolicy,
  resolveDataGridManagedScrollPropagationDecision,
  type DataGridManagedScrollAxisLockMode,
  type DataGridManagedScrollAxisPolicy,
  type DataGridManagedScrollBodyViewport,
  type DataGridManagedScrollConsumptionResult,
  type DataGridManagedScrollMainViewport,
  type DataGridManagedScrollPropagationMode,
} from "./dataGridManagedScrollPipeline"

export type DataGridWheelMode = "managed" | "native"
export type DataGridWheelAxisLockMode = DataGridManagedScrollAxisLockMode
export type DataGridWheelPropagationMode = DataGridManagedScrollPropagationMode

export type DataGridWheelAxisPolicy = DataGridManagedScrollAxisPolicy

export type DataGridManagedWheelBodyViewport = DataGridManagedScrollBodyViewport

export type DataGridManagedWheelMainViewport = DataGridManagedScrollMainViewport

export type DataGridWheelConsumptionResult = DataGridManagedScrollConsumptionResult

export interface UseDataGridManagedWheelScrollOptions {
  resolveWheelMode?: () => DataGridWheelMode
  resolveWheelAxisLockMode?: () => DataGridWheelAxisLockMode
  resolvePreventDefaultWhenHandled?: () => boolean
  resolveStopImmediatePropagation?: () => boolean
  resolveWheelPropagationMode?: () => DataGridWheelPropagationMode
  resolveShouldPropagateWheelEvent?: (result: DataGridWheelConsumptionResult) => boolean
  /** @deprecated Use resolvePreventDefaultWhenHandled */
  resolvePreventDefaultWhenConsumed?: () => boolean
  resolveMinDeltaToApply?: () => number
  resolveWheelPageSizeY?: () => number
  resolveWheelPageSizeX?: () => number
  resolveBodyViewport: () => DataGridManagedWheelBodyViewport | null
  resolveMainViewport?: () => DataGridManagedWheelMainViewport | null
  setHandledScrollTop: (value: number) => void
  setHandledScrollLeft?: (value: number) => void
  syncLinkedScroll?: (scrollTop: number) => void
  scheduleLinkedScrollSyncLoop?: () => void
  isLinkedScrollSyncLoopScheduled?: () => boolean
  onWheelConsumed?: () => void
}

export interface UseDataGridManagedWheelScrollResult {
  applyWheelToViewports: (event: WheelEvent) => DataGridWheelConsumptionResult
  onLinkedViewportWheel: (event: WheelEvent) => void
  onBodyViewportWheel: (event: WheelEvent) => void
  reset: () => void
}

export function normalizeDataGridWheelDelta(delta: number, deltaMode: number, pageSize: number): number {
  if (!Number.isFinite(delta)) return 0
  if (deltaMode === 1) return delta * 16
  if (deltaMode === 2) return delta * Math.max(1, pageSize)
  return delta
}

export function resolveDataGridWheelAxisPolicy(
  deltaX: number,
  deltaY: number,
  mode: DataGridWheelAxisLockMode,
): DataGridWheelAxisPolicy {
  return resolveDataGridManagedScrollAxisPolicy(deltaX, deltaY, mode)
}

export function resolveDataGridWheelPropagationDecision(
  result: DataGridWheelConsumptionResult,
  mode: DataGridWheelPropagationMode,
): boolean {
  return resolveDataGridManagedScrollPropagationDecision(result, mode)
}

export function useDataGridManagedWheelScroll(
  options: UseDataGridManagedWheelScrollOptions,
): UseDataGridManagedWheelScrollResult {
  const resolveWheelMode = options.resolveWheelMode ?? (() => "managed" as const)
  const resolveAxisLock = options.resolveWheelAxisLockMode ?? (() => "dominant" as const)
  const resolvePreventDefaultWhenHandled = options.resolvePreventDefaultWhenHandled
    ?? options.resolvePreventDefaultWhenConsumed
    ?? (() => true)
  const resolveStopImmediatePropagation = options.resolveStopImmediatePropagation ?? (() => false)
  const resolveWheelPropagationMode = options.resolveWheelPropagationMode ?? (() => "retain" as const)
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

  function applyWheelToViewports(event: WheelEvent): DataGridWheelConsumptionResult {
    if (resolveWheelMode() === "native") {
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

    const bodyViewport = options.resolveBodyViewport()
    if (!bodyViewport) {
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
    const mainViewport = options.resolveMainViewport?.() ?? null
    const pageSizeY = event.deltaMode === 2
      ? (options.resolveWheelPageSizeY?.() ?? bodyViewport.clientHeight)
      : 0
    const pageSizeX = event.deltaMode === 2
      ? (options.resolveWheelPageSizeX?.() ?? mainViewport?.clientWidth ?? 0)
      : 0
    const deltaY = normalizeDataGridWheelDelta(event.deltaY, event.deltaMode, pageSizeY)
    const deltaX = normalizeDataGridWheelDelta(event.deltaX, event.deltaMode, pageSizeX)
    const result = deltaPipeline.applyDeltaToViewports(deltaX, deltaY)
    if (result.consumed) {
      options.onWheelConsumed?.()
    }
    return result
  }

  function handleWheelCommon(event: WheelEvent): void {
    const result = applyWheelToViewports(event)
    const shouldPropagateByMode = resolveDataGridWheelPropagationDecision(result, resolveWheelPropagationMode())
    const shouldPropagateByOverride = options.resolveShouldPropagateWheelEvent?.(result) ?? false
    const shouldPropagate = shouldPropagateByMode || shouldPropagateByOverride
    if (result.handled && resolvePreventDefaultWhenHandled() && !shouldPropagate) {
      event.preventDefault()
      if (resolveStopImmediatePropagation() && typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation()
      } else {
        event.stopPropagation()
      }
    }
  }

  return {
    applyWheelToViewports,
    onLinkedViewportWheel: handleWheelCommon,
    onBodyViewportWheel: handleWheelCommon,
    reset: deltaPipeline.reset,
  }
}
