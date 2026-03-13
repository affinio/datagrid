export type DataGridAnimationFrameRequest = (callback: FrameRequestCallback) => number

export type DataGridAnimationFrameCancel = (handle: number) => void

export interface DataGridAnimationFrameDriver {
  requestAnimationFrame?: DataGridAnimationFrameRequest
  cancelAnimationFrame?: DataGridAnimationFrameCancel
}

export interface DataGridAnimationFrameScheduler {
  requestFrame: DataGridAnimationFrameRequest
  cancelFrame: DataGridAnimationFrameCancel
  usesAnimationFrame: boolean
}

function resolveGlobalRequestAnimationFrame(): DataGridAnimationFrameRequest | undefined {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return callback => globalThis.requestAnimationFrame(callback)
  }
  return undefined
}

function resolveGlobalCancelAnimationFrame(): DataGridAnimationFrameCancel | undefined {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    return handle => globalThis.cancelAnimationFrame(handle)
  }
  return undefined
}

export function resolveAnimationFrameScheduler(
  driver: DataGridAnimationFrameDriver = {},
): DataGridAnimationFrameScheduler {
  const requestFrame = driver.requestAnimationFrame ?? resolveGlobalRequestAnimationFrame()
  const cancelFrame = driver.cancelAnimationFrame ?? resolveGlobalCancelAnimationFrame()

  if (requestFrame && cancelFrame) {
    return {
      requestFrame,
      cancelFrame,
      usesAnimationFrame: true,
    }
  }

  return {
    requestFrame: callback => globalThis.setTimeout(() => callback(Date.now()), 16) as unknown as number,
    cancelFrame: handle => {
      globalThis.clearTimeout(handle)
    },
    usesAnimationFrame: false,
  }
}