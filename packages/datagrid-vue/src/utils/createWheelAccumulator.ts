type RequestFrame = (callback: FrameRequestCallback) => number

type CancelFrame = (handle: number) => void

export interface WheelAccumulatorOptions {
  apply: (delta: { deltaX: number; deltaY: number }) => void
  requestFrame?: RequestFrame | null
  cancelFrame?: CancelFrame | null
}

export interface WheelAccumulator {
  queue(deltaX: number, deltaY: number): void
  flush(): void
  cancel(): void
  pending(): { deltaX: number; deltaY: number }
}

export function createWheelAccumulator(options: WheelAccumulatorOptions): WheelAccumulator {
  const fallbackRequestFrame: RequestFrame | null = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : null
  const fallbackCancelFrame: CancelFrame | null = typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function"
    ? window.cancelAnimationFrame.bind(window)
    : typeof globalThis.cancelAnimationFrame === "function"
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : null

  const requestFrame = options.requestFrame ?? fallbackRequestFrame
  const cancelFrame = options.cancelFrame ?? fallbackCancelFrame

  let pendingX = 0
  let pendingY = 0
  let frameId: number | null = null

  const resetPending = () => {
    pendingX = 0
    pendingY = 0
  }

  const flushInternal = () => {
    const deltaX = pendingX
    const deltaY = pendingY
    frameId = null
    resetPending()
    if (deltaX === 0 && deltaY === 0) {
      return
    }
    options.apply({ deltaX, deltaY })
  }

  const schedule = () => {
    if (frameId !== null) {
      return
    }
    if (typeof requestFrame === "function") {
      frameId = requestFrame(() => {
        flushInternal()
      })
      return
    }
    flushInternal()
  }

  return {
    queue(deltaX: number, deltaY: number) {
      if (deltaX === 0 && deltaY === 0) {
        return
      }
      pendingX += deltaX
      pendingY += deltaY
      schedule()
    },
    flush() {
      if (frameId !== null && typeof cancelFrame === "function") {
        cancelFrame(frameId)
        frameId = null
      }
      flushInternal()
    },
    cancel() {
      if (frameId !== null && typeof cancelFrame === "function") {
        cancelFrame(frameId)
      }
      frameId = null
      resetPending()
    },
    pending() {
      return { deltaX: pendingX, deltaY: pendingY }
    },
  }
}
