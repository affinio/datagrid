export interface SelectionControllerStateSchedulerEnvironment<State> {
  applyState: (state: State) => void
  requestFrame: (callback: () => void) => number | ReturnType<typeof setTimeout>
  cancelFrame: (handle: number | ReturnType<typeof setTimeout>) => void
  scheduleNextTick: (callback: () => void) => void
}

export interface SelectionControllerStateScheduler<State> {
  schedule(state: State): void
  flush(): void
  cancel(): void
}

export function createSelectionControllerStateScheduler<State>(
  environment: SelectionControllerStateSchedulerEnvironment<State>,
): SelectionControllerStateScheduler<State> {
  let pendingState: State | null = null
  let frameHandle: number | ReturnType<typeof setTimeout> | null = null
  let nextTickPending = false

  const flush = () => {
    if (pendingState === null) {
      return
    }
    const stateToApply = pendingState
    pendingState = null
    environment.applyState(stateToApply)
  }

  const queueNextTick = () => {
    if (nextTickPending) {
      return
    }
    nextTickPending = true
    environment.scheduleNextTick(() => {
      nextTickPending = false
      flush()
    })
  }

  const schedule = (state: State) => {
    pendingState = state

    if (frameHandle !== null) {
      queueNextTick()
      return
    }

    frameHandle = environment.requestFrame(() => {
      frameHandle = null
      flush()
    })
    queueNextTick()
  }

  const cancel = () => {
    if (frameHandle !== null) {
      environment.cancelFrame(frameHandle)
      frameHandle = null
    }
    pendingState = null
    nextTickPending = false
  }

  return {
    schedule,
    flush,
    cancel,
  }
}
