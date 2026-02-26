export type DataGridManagedScrollAxisLockMode = "off" | "dominant" | "vertical-preferred" | "horizontal-preferred"
export type DataGridManagedScrollPropagationMode = "retain" | "release-at-boundary-when-unconsumed" | "release-when-unconsumed"

export interface DataGridManagedScrollAxisPolicy {
  applyX: boolean
  applyY: boolean
}

export interface DataGridManagedScrollBodyViewport {
  readonly scrollTop: number
  readonly scrollHeight: number
  readonly clientHeight: number
}

export interface DataGridManagedScrollMainViewport {
  readonly scrollLeft: number
  readonly scrollWidth: number
  readonly clientWidth: number
}

export interface DataGridManagedScrollConsumptionResult {
  handled: boolean
  handledX: boolean
  handledY: boolean
  consumed: boolean
  consumedX: boolean
  consumedY: boolean
  atBoundaryX: boolean
  atBoundaryY: boolean
}

export interface DataGridManagedScrollDeltaPipelineOptions {
  resolveAxisLockMode?: () => DataGridManagedScrollAxisLockMode
  resolveMinDeltaToApply?: () => number
  resolveBodyViewport: () => DataGridManagedScrollBodyViewport | null
  resolveMainViewport?: () => DataGridManagedScrollMainViewport | null
  setHandledScrollTop: (value: number) => void
  setHandledScrollLeft?: (value: number) => void
  syncLinkedScroll?: (scrollTop: number) => void
  scheduleLinkedScrollSyncLoop?: () => void
  isLinkedScrollSyncLoopScheduled?: () => boolean
}

export interface DataGridManagedScrollDeltaPipeline {
  applyDeltaToViewports: (deltaX: number, deltaY: number) => DataGridManagedScrollConsumptionResult
  reset: () => void
}

const AXIS_LOCK_RATIO = 1.1

function emptyResult(): DataGridManagedScrollConsumptionResult {
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

export function resolveDataGridManagedScrollAxisPolicy(
  deltaX: number,
  deltaY: number,
  mode: DataGridManagedScrollAxisLockMode,
): DataGridManagedScrollAxisPolicy {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (absX === 0 && absY === 0) {
    return { applyX: false, applyY: false }
  }

  if (mode === "off") {
    return { applyX: absX > 0, applyY: absY > 0 }
  }

  let dominantAxis: "x" | "y"
  if (absX === 0) {
    dominantAxis = "y"
  } else if (absY === 0) {
    dominantAxis = "x"
  } else if (absX > absY * AXIS_LOCK_RATIO) {
    dominantAxis = "x"
  } else if (absY > absX * AXIS_LOCK_RATIO) {
    dominantAxis = "y"
  } else if (mode === "horizontal-preferred") {
    dominantAxis = "x"
  } else {
    dominantAxis = "y"
  }

  return {
    applyX: dominantAxis === "x" && absX > 0,
    applyY: dominantAxis === "y" && absY > 0,
  }
}

export function resolveDataGridManagedScrollPropagationDecision(
  result: DataGridManagedScrollConsumptionResult,
  mode: DataGridManagedScrollPropagationMode,
): boolean {
  if (mode === "retain") {
    return false
  }
  if (mode === "release-when-unconsumed") {
    return !result.handled
  }
  return !result.handled && (result.atBoundaryX || result.atBoundaryY)
}

export function createDataGridManagedScrollDeltaPipeline(
  options: DataGridManagedScrollDeltaPipelineOptions,
): DataGridManagedScrollDeltaPipeline {
  const resolveAxisLock = options.resolveAxisLockMode ?? (() => "dominant" as const)
  const resolveMinDeltaToApply = options.resolveMinDeltaToApply ?? (() => 0)
  const isLinkedScrollSyncLoopScheduled = options.isLinkedScrollSyncLoopScheduled ?? (() => false)

  let pendingDeltaX = 0
  let pendingDeltaY = 0

  function reset(): void {
    pendingDeltaX = 0
    pendingDeltaY = 0
  }

  function resetPendingDelta(axis: "x" | "y"): void {
    if (axis === "x") {
      pendingDeltaX = 0
      return
    }
    pendingDeltaY = 0
  }

  function consumeSmoothedDelta(rawDelta: number, axis: "x" | "y"): number {
    const minDelta = Math.max(0, Number.isFinite(resolveMinDeltaToApply()) ? resolveMinDeltaToApply() : 0)
    const pending = axis === "x" ? pendingDeltaX : pendingDeltaY
    const hasSignFlip = pending !== 0 && rawDelta !== 0 && Math.sign(pending) !== Math.sign(rawDelta)
    const basePending = hasSignFlip ? 0 : pending
    const merged = basePending + rawDelta

    if (minDelta <= 0 || Math.abs(merged) >= minDelta) {
      if (axis === "x") {
        pendingDeltaX = 0
      } else {
        pendingDeltaY = 0
      }
      return merged
    }

    if (axis === "x") {
      pendingDeltaX = merged
    } else {
      pendingDeltaY = merged
    }
    return 0
  }

  function applyDeltaToViewports(deltaX: number, deltaY: number): DataGridManagedScrollConsumptionResult {
    const bodyViewport = options.resolveBodyViewport()
    if (!bodyViewport) {
      reset()
      return emptyResult()
    }

    let consumedX = false
    let consumedY = false
    let handledX = false
    let handledY = false
    let atBoundaryX = false
    let atBoundaryY = false

    const mainViewport = options.resolveMainViewport?.() ?? null
    const { applyX, applyY } = resolveDataGridManagedScrollAxisPolicy(deltaX, deltaY, resolveAxisLock())

    if (!applyY) {
      resetPendingDelta("y")
    }
    if (!applyX) {
      resetPendingDelta("x")
    }

    if (applyY) {
      const effectiveDeltaY = consumeSmoothedDelta(deltaY, "y")
      const maxTop = Math.max(0, bodyViewport.scrollHeight - bodyViewport.clientHeight)
      const currentTop = bodyViewport.scrollTop
      if (deltaY < 0 && currentTop <= 0) {
        atBoundaryY = true
      } else if (deltaY > 0 && currentTop >= maxTop) {
        atBoundaryY = true
      }
      const nextTop = Math.max(0, Math.min(maxTop, currentTop + effectiveDeltaY))
      if (nextTop !== currentTop) {
        options.setHandledScrollTop(nextTop)
        options.syncLinkedScroll?.(nextTop)
        if (!isLinkedScrollSyncLoopScheduled()) {
          options.scheduleLinkedScrollSyncLoop?.()
        }
        consumedY = true
        handledY = true
      } else if (deltaY !== 0 && !atBoundaryY) {
        handledY = true
      }
    }

    if (applyX && mainViewport) {
      const effectiveDeltaX = consumeSmoothedDelta(deltaX, "x")
      const maxLeft = Math.max(0, mainViewport.scrollWidth - mainViewport.clientWidth)
      const currentLeft = mainViewport.scrollLeft
      if (deltaX < 0 && currentLeft <= 0) {
        atBoundaryX = true
      } else if (deltaX > 0 && currentLeft >= maxLeft) {
        atBoundaryX = true
      }
      const nextLeft = Math.max(0, Math.min(maxLeft, currentLeft + effectiveDeltaX))
      if (nextLeft !== currentLeft) {
        options.setHandledScrollLeft?.(nextLeft)
        consumedX = true
        handledX = true
      } else if (deltaX !== 0 && !atBoundaryX) {
        handledX = true
      }
    }

    return {
      handled: handledX || handledY,
      handledX,
      handledY,
      consumed: consumedX || consumedY,
      consumedX,
      consumedY,
      atBoundaryX,
      atBoundaryY,
    }
  }

  return {
    applyDeltaToViewports,
    reset,
  }
}
