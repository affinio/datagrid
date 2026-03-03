import type { DataGridApiLifecycleNamespace } from "./gridApiContracts"
import type { DataGridCore } from "./gridCore"

export interface DataGridApiLifecycleRuntime {
  namespace: DataGridApiLifecycleNamespace
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

export function createDataGridApiLifecycleRuntime(
  input: CreateDataGridApiLifecycleRuntimeInput,
): DataGridApiLifecycleRuntime {
  const { coreLifecycle } = input
  let active = 0
  let queued = 0
  let chain: Promise<void> = Promise.resolve()
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

  const queueExclusive = <TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult> => {
    queued += 1
    const task = chain.then(async () => {
      queued = Math.max(0, queued - 1)
      markEnter()
      try {
        return await fn()
      } finally {
        markExit()
      }
    })
    chain = task.then(() => undefined, () => undefined)
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
    runExclusiveSync<TResult>(operation: string, fn: () => TResult): TResult {
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
      return queueExclusive(async () => {
        try {
          return await fn()
        } catch (error) {
          throw error
        }
      })
    },
  }
}
