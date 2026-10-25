import type { DataGridApiLifecycleNamespace } from "./gridApiContracts"
import type { DataGridCore } from "./gridCore"

export interface DataGridApiLifecycleRuntime {
  namespace: DataGridApiLifecycleNamespace
  dispose(): void
  runExclusiveSync<TResult>(operation: string, fn: () => TResult): TResult
  runExclusiveAsync<TResult>(operation: string, fn: () => TResult | Promise<TResult>): Promise<TResult>
}

export interface CreateDataGridApiLifecycleRuntimeInput {
  coreLifecycle: DataGridCore["lifecycle"]
}

function createBusyError(operation: string): Error {
  return new Error(
    `[DataGridApi] cannot run "${operation}" while another exclusive lifecycle operation is in flight.`,
  )
}

function createDisposedError(): Error {
  return new Error("[DataGridApi] cannot run an exclusive lifecycle operation after disposal.")
}

export function createDataGridApiLifecycleRuntime(
  input: CreateDataGridApiLifecycleRuntimeInput,
): DataGridApiLifecycleRuntime {
  const { coreLifecycle } = input
  let active = 0
  let queued = 0
  let disposed = false
  const queue: Array<{ start: () => void; cancel: () => void }> = []
  let taskScheduled = false
  const idleWaiters = new Set<() => void>()

  const flushIdleWaiters = (): void => {
    if (active !== 0 || queued !== 0) {
      return
    }
    for (const resolve of idleWaiters) {
      resolve()
    }
    idleWaiters.clear()
  }

  const markEnter = (): void => {
    active += 1
  }

  const markExit = (): void => {
    active = Math.max(0, active - 1)
    flushIdleWaiters()
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    while (queue.length > 0) {
      queue.shift()?.cancel()
    }
    flushIdleWaiters()
  }

  const scheduleNext = (): void => {
    if (coreLifecycle.state === "disposed") {
      dispose()
      return
    }
    if (disposed || active !== 0 || taskScheduled || queue.length === 0) {
      return
    }
    taskScheduled = true
    queueMicrotask(() => {
      taskScheduled = false
      if (coreLifecycle.state === "disposed") {
        dispose()
        return
      }
      if (disposed || active !== 0) return
      queue.shift()?.start()
    })
  }

  const queueExclusive = <TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult> => {
    if (disposed || coreLifecycle.state === "disposed") {
      dispose()
      return Promise.reject(createDisposedError())
    }
    queued += 1
    const task = new Promise<TResult>((resolve, reject) => {
      queue.push({
        start() {
          queued = Math.max(0, queued - 1)
          if (disposed || coreLifecycle.state === "disposed") {
            reject(createDisposedError())
            flushIdleWaiters()
            return
          }
          markEnter()
          let result: TResult | Promise<TResult>
          try {
            result = fn()
          } catch (error) {
            reject(error)
            markExit()
            scheduleNext()
            return
          }
          Promise.resolve(result)
            .then(resolve, reject)
            .finally(() => {
              markExit()
              scheduleNext()
            })
        },
        cancel() {
          queued = Math.max(0, queued - 1)
          reject(createDisposedError())
        },
      })
    })
    scheduleNext()
    return task
  }

  return {
    namespace: {
      get state() {
        return coreLifecycle.state
      },
      get startupOrder() {
        return coreLifecycle.startupOrder
      },
      isBusy() {
        return active !== 0 || queued !== 0
      },
      whenIdle() {
        if (active === 0 && queued === 0) {
          return Promise.resolve()
        }
        return new Promise<void>((resolve) => {
          idleWaiters.add(resolve)
        })
      },
      runExclusive<TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult> {
        return queueExclusive(fn)
      },
    },
    dispose,
    runExclusiveSync<TResult>(operation: string, fn: () => TResult): TResult {
      if (disposed || coreLifecycle.state === "disposed") {
        throw createDisposedError()
      }
      if (active !== 0 || queued !== 0) {
        throw createBusyError(operation)
      }
      markEnter()
      try {
        return fn()
      } finally {
        markExit()
      }
    },
    runExclusiveAsync<TResult>(_operation: string, fn: () => TResult | Promise<TResult>): Promise<TResult> {
      return queueExclusive(fn)
    },
  }
}
