export type OverlayUpdatePriority = "user-blocking" | "background"
export type OverlayScheduleMode = "frame" | "idle"

export interface SelectionOverlayUpdateSchedulerEnvironment {
  request: (callback: () => void, options?: { mode?: "frame" | "idle"; timeout?: number }) => number
  cancel: (handle: number) => void
  flush: () => void
  queueMicrotask?: (callback: () => void) => void
  backgroundTimeout?: number
}

export interface SelectionOverlayUpdateScheduler {
  schedule(options?: { priority?: OverlayUpdatePriority; timeout?: number }): void
  cancel(): void
}

const OVERLAY_MICROTASK_HANDLE = -1

const defaultQueueMicrotask = (callback: () => void) => {
  if (typeof globalThis.queueMicrotask === "function") {
    globalThis.queueMicrotask(callback)
    return
  }
  void Promise.resolve().then(callback)
}

export function createSelectionOverlayUpdateScheduler(
  environment: SelectionOverlayUpdateSchedulerEnvironment,
): SelectionOverlayUpdateScheduler {
  const queueMicrotask = environment.queueMicrotask ?? defaultQueueMicrotask
  const backgroundTimeout = environment.backgroundTimeout ?? 160

  let handle: number | null = null
  let mode: OverlayScheduleMode | null = null
  let microtaskScheduled = false

  const runFlush = () => {
    if (!microtaskScheduled) {
      return
    }
    microtaskScheduled = false
    handle = null
    mode = null
    environment.flush()
  }

  const cancel = () => {
    if (handle === null) {
      return
    }
    if (handle === OVERLAY_MICROTASK_HANDLE) {
      microtaskScheduled = false
    } else {
      environment.cancel(handle)
    }
    handle = null
    mode = null
  }

  const schedule = (options?: { priority?: OverlayUpdatePriority; timeout?: number }) => {
    const priority = options?.priority ?? "user-blocking"
    const nextMode: OverlayScheduleMode = priority === "background" ? "idle" : "frame"
    const timeout = options?.timeout ?? backgroundTimeout

    if (handle !== null) {
      if (mode === nextMode) {
        return
      }
      cancel()
    }

    if (nextMode === "frame") {
      mode = nextMode
      handle = OVERLAY_MICROTASK_HANDLE
      microtaskScheduled = true
      queueMicrotask(runFlush)
      return
    }

    mode = nextMode
    handle = environment.request(() => {
      handle = null
      mode = null
      environment.flush()
    }, { mode: "idle", timeout })
  }

  return {
    schedule,
    cancel,
  }
}
