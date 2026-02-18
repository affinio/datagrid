export type DataGridScrollPerfQuality = "unknown" | "good" | "degraded"

export interface DataGridScrollPerfSnapshot {
  active: boolean
  frameCount: number
  droppedFrames: number
  longTaskFrames: number
  avgFrameMs: number
  fps: number
  quality: DataGridScrollPerfQuality
}

export interface UseDataGridScrollPerfTelemetryOptions {
  resolveIdleDelayMs?: () => number
  resolveDroppedFrameThresholdMs?: () => number
  resolveLongTaskThresholdMs?: () => number
  resolveGoodFpsThreshold?: () => number
  resolveMaxDropRate?: () => number
  resolveMinFrameSample?: () => number
  onSnapshotChange?: (snapshot: DataGridScrollPerfSnapshot) => void
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
  setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof globalThis.setTimeout>
  clearTimeout?: (handle: ReturnType<typeof globalThis.setTimeout>) => void
}

export interface UseDataGridScrollPerfTelemetryResult {
  markScrollActivity: () => void
  getSnapshot: () => DataGridScrollPerfSnapshot
  dispose: () => void
}

const DEFAULT_IDLE_DELAY_MS = 120
const DEFAULT_DROPPED_FRAME_THRESHOLD_MS = 20
const DEFAULT_LONG_TASK_THRESHOLD_MS = 50
const DEFAULT_GOOD_FPS_THRESHOLD = 55
const DEFAULT_MAX_DROP_RATE = 0.08
const DEFAULT_MIN_FRAME_SAMPLE = 20

export function useDataGridScrollPerfTelemetry(
  options: UseDataGridScrollPerfTelemetryOptions = {},
): UseDataGridScrollPerfTelemetryResult {
  const resolveIdleDelayMs = options.resolveIdleDelayMs ?? (() => DEFAULT_IDLE_DELAY_MS)
  const resolveDroppedFrameThresholdMs = options.resolveDroppedFrameThresholdMs ?? (() => DEFAULT_DROPPED_FRAME_THRESHOLD_MS)
  const resolveLongTaskThresholdMs = options.resolveLongTaskThresholdMs ?? (() => DEFAULT_LONG_TASK_THRESHOLD_MS)
  const resolveGoodFpsThreshold = options.resolveGoodFpsThreshold ?? (() => DEFAULT_GOOD_FPS_THRESHOLD)
  const resolveMaxDropRate = options.resolveMaxDropRate ?? (() => DEFAULT_MAX_DROP_RATE)
  const resolveMinFrameSample = options.resolveMinFrameSample ?? (() => DEFAULT_MIN_FRAME_SAMPLE)
  const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))
  const scheduleTimeout = options.setTimeout ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
  const clearScheduledTimeout = options.clearTimeout ?? (handle => globalThis.clearTimeout(handle))

  let active = false
  let frameHandle: number | null = null
  let idleTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let previousFrameTs: number | null = null
  let frameCount = 0
  let droppedFrames = 0
  let longTaskFrames = 0
  let totalFrameMs = 0

  let snapshot: DataGridScrollPerfSnapshot = {
    active: false,
    frameCount: 0,
    droppedFrames: 0,
    longTaskFrames: 0,
    avgFrameMs: 0,
    fps: 0,
    quality: "unknown",
  }

  function emitSnapshot(): void {
    options.onSnapshotChange?.(snapshot)
  }

  function normalizeInt(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback
    }
    return Math.max(0, Math.trunc(value))
  }

  function normalizeFloat(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback
    }
    return Math.max(0, value)
  }

  function computeQuality(nextFrameCount: number, nextFps: number, nextDroppedFrames: number, nextLongTaskFrames: number): DataGridScrollPerfQuality {
    const minFrameSample = normalizeInt(resolveMinFrameSample(), DEFAULT_MIN_FRAME_SAMPLE)
    if (nextFrameCount < minFrameSample) {
      return "unknown"
    }
    const maxDropRate = normalizeFloat(resolveMaxDropRate(), DEFAULT_MAX_DROP_RATE)
    const dropRate = nextFrameCount > 0 ? nextDroppedFrames / nextFrameCount : 0
    const minFps = normalizeFloat(resolveGoodFpsThreshold(), DEFAULT_GOOD_FPS_THRESHOLD)
    if (nextFps >= minFps && dropRate <= maxDropRate && nextLongTaskFrames === 0) {
      return "good"
    }
    return "degraded"
  }

  function refreshSnapshot(): void {
    const avgFrameMs = frameCount > 0 ? totalFrameMs / frameCount : 0
    const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0
    snapshot = {
      active,
      frameCount,
      droppedFrames,
      longTaskFrames,
      avgFrameMs,
      fps,
      quality: computeQuality(frameCount, fps, droppedFrames, longTaskFrames),
    }
    emitSnapshot()
  }

  function clearIdleTimer(): void {
    if (idleTimer === null) {
      return
    }
    clearScheduledTimeout(idleTimer)
    idleTimer = null
  }

  function stopFrameLoop(): void {
    if (frameHandle === null) {
      return
    }
    cancelFrame(frameHandle)
    frameHandle = null
  }

  function onFrame(timestamp: number): void {
    frameHandle = null
    if (!active) {
      return
    }
    if (previousFrameTs !== null) {
      const delta = Math.max(0, timestamp - previousFrameTs)
      frameCount += 1
      totalFrameMs += delta
      if (delta > normalizeFloat(resolveDroppedFrameThresholdMs(), DEFAULT_DROPPED_FRAME_THRESHOLD_MS)) {
        droppedFrames += 1
      }
      if (delta > normalizeFloat(resolveLongTaskThresholdMs(), DEFAULT_LONG_TASK_THRESHOLD_MS)) {
        longTaskFrames += 1
      }
      refreshSnapshot()
    }
    previousFrameTs = timestamp
    frameHandle = requestFrame(onFrame)
  }

  function ensureFrameLoop(): void {
    if (frameHandle !== null) {
      return
    }
    frameHandle = requestFrame(onFrame)
  }

  function markScrollActivity(): void {
    clearIdleTimer()
    if (!active) {
      active = true
      previousFrameTs = null
      frameCount = 0
      droppedFrames = 0
      longTaskFrames = 0
      totalFrameMs = 0
      refreshSnapshot()
      ensureFrameLoop()
    }
    idleTimer = scheduleTimeout(() => {
      idleTimer = null
      active = false
      previousFrameTs = null
      stopFrameLoop()
      refreshSnapshot()
    }, normalizeInt(resolveIdleDelayMs(), DEFAULT_IDLE_DELAY_MS))
  }

  function dispose(): void {
    clearIdleTimer()
    active = false
    previousFrameTs = null
    stopFrameLoop()
    refreshSnapshot()
  }

  return {
    markScrollActivity,
    getSnapshot: () => snapshot,
    dispose,
  }
}
