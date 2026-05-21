import type { DataGridRowId, DataGridViewportRange } from "../rowModel.js"
import type {
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
} from "./dataSourceProtocol.js"
import {
  createDataSourceRuntimeLifecycle,
  type DataSourceRuntimeLifecycle,
} from "./dataSourceRuntimeLifecycle.js"

export type DataSourcePullSettledStatus = "completed" | "failed" | "aborted" | "dropped"
export type DataSourceOptimisticMutationSettledStatus = "committed" | "rejected" | "failed"

export interface DataSourceRuntimeSignalPayloads {
  pullStarted: {
    readonly requestId: number
    readonly range: DataGridViewportRange
    readonly priority: DataGridDataSourcePullPriority
    readonly reason: DataGridDataSourcePullReason
  }
  pullSettled: {
    readonly requestId: number
    readonly range: DataGridViewportRange
    readonly priority: DataGridDataSourcePullPriority
    readonly reason: DataGridDataSourcePullReason
    readonly status: DataSourcePullSettledStatus
    readonly error?: Error
  }
  cacheInvalidated: {
    readonly kind: "range" | "rows" | "all" | "replace"
    readonly removedRows: number
    readonly range?: DataGridViewportRange
    readonly rowIds?: readonly DataGridRowId[]
    readonly preserveRange?: DataGridViewportRange | null
    readonly reason?: string
  }
  viewportCoverageChanged: {
    readonly sourceViewport: DataGridViewportRange
    readonly visibleRowCount: number
    readonly hitRows: number
    readonly missRows: number
    readonly hitRatio: number
    readonly blankViewportActive: boolean
  }
  optimisticMutationStarted: {
    readonly transactionId: number
    readonly rowIds: readonly DataGridRowId[]
  }
  optimisticMutationSettled: {
    readonly transactionId: number
    readonly rowIds: readonly DataGridRowId[]
    readonly status: DataSourceOptimisticMutationSettledStatus
    readonly error?: Error
  }
}

export type DataSourceRuntimeSignalType = keyof DataSourceRuntimeSignalPayloads
export type DataSourceRuntimeSignalListener<T extends DataSourceRuntimeSignalType> = (
  payload: DataSourceRuntimeSignalPayloads[T],
) => void

export interface DataSourceRuntimeSignals extends DataSourceRuntimeLifecycle {
  subscribe<T extends DataSourceRuntimeSignalType>(
    type: T,
    listener: DataSourceRuntimeSignalListener<T>,
  ): () => void
  emit<T extends DataSourceRuntimeSignalType>(
    type: T,
    payload: DataSourceRuntimeSignalPayloads[T],
  ): void
}

export function createDataSourceRuntimeSignals(): DataSourceRuntimeSignals {
  const listeners = new Map<DataSourceRuntimeSignalType, Set<(payload: never) => void>>()
  const lifecycle = createDataSourceRuntimeLifecycle({
    service: "signals",
    onDispose() {
      listeners.clear()
    },
  })

  return {
    ...lifecycle,
    subscribe(type, listener) {
      if (lifecycle.isDisposed()) {
        return () => {}
      }
      const bucket = listeners.get(type) ?? new Set<(payload: never) => void>()
      bucket.add(listener as (payload: never) => void)
      listeners.set(type, bucket)
      return () => {
        bucket.delete(listener as (payload: never) => void)
        if (bucket.size === 0) {
          listeners.delete(type)
        }
      }
    },
    emit(type, payload) {
      if (lifecycle.isDisposed()) {
        return
      }
      const bucket = listeners.get(type)
      if (!bucket) {
        return
      }
      for (const listener of Array.from(bucket)) {
        listener(payload as never)
      }
    },
  }
}
