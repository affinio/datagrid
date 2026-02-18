export interface UseDataGridScrollIdleGateOptions {
  resolveIdleDelayMs?: () => number
  setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof globalThis.setTimeout>
  clearTimeout?: (handle: ReturnType<typeof globalThis.setTimeout>) => void
}

export interface UseDataGridScrollIdleGateResult {
  markScrollActivity: () => void
  isScrollActive: () => boolean
  runWhenScrollIdle: (callback: () => void) => void
  dispose: () => void
}

const DEFAULT_IDLE_DELAY_MS = 80

export function useDataGridScrollIdleGate(
  options: UseDataGridScrollIdleGateOptions = {},
): UseDataGridScrollIdleGateResult {
  const resolveIdleDelayMs = options.resolveIdleDelayMs ?? (() => DEFAULT_IDLE_DELAY_MS)
  const scheduleTimeout = options.setTimeout ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
  const clearScheduledTimeout = options.clearTimeout ?? (handle => globalThis.clearTimeout(handle))

  let active = false
  let idleTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let flushingDeferredCallbacks = false
  const deferredCallbacks: Array<() => void> = []

  function normalizeDelayMs(): number {
    const raw = resolveIdleDelayMs()
    if (!Number.isFinite(raw)) {
      return DEFAULT_IDLE_DELAY_MS
    }
    return Math.max(0, Math.trunc(raw))
  }

  function flushDeferredCallbacks(): void {
    while (!active && deferredCallbacks.length > 0) {
      const callbacks = deferredCallbacks.splice(0, deferredCallbacks.length)
      flushingDeferredCallbacks = true
      try {
        callbacks.forEach(callback => callback())
      } finally {
        flushingDeferredCallbacks = false
      }
    }
  }

  function clearIdleTimer(): void {
    if (idleTimer === null) {
      return
    }
    clearScheduledTimeout(idleTimer)
    idleTimer = null
  }

  function markScrollActivity(): void {
    active = true
    clearIdleTimer()
    idleTimer = scheduleTimeout(() => {
      idleTimer = null
      active = false
      flushDeferredCallbacks()
    }, normalizeDelayMs())
  }

  function runWhenScrollIdle(callback: () => void): void {
    if (!active && !flushingDeferredCallbacks) {
      callback()
      return
    }
    deferredCallbacks.push(callback)
  }

  function dispose(): void {
    clearIdleTimer()
    active = false
    flushingDeferredCallbacks = false
    deferredCallbacks.splice(0, deferredCallbacks.length)
  }

  return {
    markScrollActivity,
    isScrollActive: () => active,
    runWhenScrollIdle,
    dispose,
  }
}
