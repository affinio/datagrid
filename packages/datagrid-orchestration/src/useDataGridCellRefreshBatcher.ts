import type {
  DataGridRowId,
} from "@affino/datagrid-core"

export interface DataGridCellRefreshOptions {
  immediate?: boolean
  reason?: string
}

export interface DataGridCellRefreshRange {
  rowKey: DataGridRowId
  columnKeys: readonly string[]
}

export interface UseDataGridCellRefreshBatcherOptions {
  immediate?: boolean
  defaultOptions?: DataGridCellRefreshOptions
  maxBatchSize?: number
  frameBudgetMs?: number
  onBatchFlush?: (rangesCount: number, cellsCount: number) => void
}

export interface UseDataGridCellRefreshBatcherResult {
  queueByRowKeys: (
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ) => void
  queueByRanges: (
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ) => void
  flush: () => void
  dispose: () => void
}

interface RefreshApi {
  refreshCellsByRanges: (
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ) => void
}

type SchedulerHandle = number | ReturnType<typeof globalThis.setTimeout>

function createRafScheduler(): {
  schedule: (cb: () => void) => SchedulerHandle
  cancel: (handle: SchedulerHandle) => void
} {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return {
      schedule: cb => globalThis.requestAnimationFrame(() => cb()),
      cancel: handle => {
        if (typeof handle === "number") {
          globalThis.cancelAnimationFrame(handle)
        }
      },
    }
  }

  return {
    schedule: cb => globalThis.setTimeout(cb, 16),
    cancel: handle => globalThis.clearTimeout(handle),
  }
}

export function useDataGridCellRefreshBatcher(
  api: RefreshApi,
  options: UseDataGridCellRefreshBatcherOptions = {},
): UseDataGridCellRefreshBatcherResult {
  const scheduler = createRafScheduler()
  const pendingByRow = new Map<string, { rowKey: DataGridRowId; columnKeys: Set<string> }>()
  let frameHandle: SchedulerHandle | null = null
  const pendingReasons = new Set<string>()

  const normalizeReason = (value: string | undefined): string => {
    if (typeof value !== "string") {
      return ""
    }
    return value.trim()
  }

  const resolveCallReason = (
    refreshOptions: DataGridCellRefreshOptions | undefined,
  ): string => {
    return normalizeReason(refreshOptions?.reason) || normalizeReason(options.defaultOptions?.reason)
  }

  const resolvePendingFlushOptions = (): DataGridCellRefreshOptions | undefined => {
    if (pendingReasons.size === 0) {
      return undefined
    }
    return {
      reason: Array.from(pendingReasons).join(","),
    }
  }

  const resolvePositiveInteger = (value: number | undefined, fallback: number): number => {
    if (!Number.isFinite(value)) {
      return fallback
    }
    const normalized = Math.trunc(value ?? fallback)
    return normalized > 0 ? normalized : fallback
  }

  const resolveNonNegativeNumber = (value: number | undefined, fallback: number): number => {
    if (!Number.isFinite(value)) {
      return fallback
    }
    return Math.max(0, value ?? fallback)
  }

  const resolveNow = (): number => {
    if (typeof globalThis.performance?.now === "function") {
      return globalThis.performance.now()
    }
    return Date.now()
  }

  const maxBatchSize = resolvePositiveInteger(options.maxBatchSize, Number.POSITIVE_INFINITY)
  const frameBudgetMs = resolveNonNegativeNumber(options.frameBudgetMs, Number.POSITIVE_INFINITY)

  const normalizeRowKey = (rowKey: DataGridRowId): string => {
    if (typeof rowKey === "number") {
      return `n:${rowKey}`
    }
    return `s:${rowKey}`
  }

  const normalizeColumnKey = (columnKey: string): string | null => {
    if (typeof columnKey !== "string") {
      return null
    }
    const normalized = columnKey.trim()
    return normalized.length > 0 ? normalized : null
  }

  const doFlush = (): void => {
    frameHandle = null
    if (pendingByRow.size === 0) {
      pendingReasons.clear()
      return
    }

    const startedAt = resolveNow()
    const ranges: DataGridCellRefreshRange[] = []
    let cellsCount = 0
    for (const [pendingKey, pending] of pendingByRow.entries()) {
      if (pending.columnKeys.size === 0) {
        pendingByRow.delete(pendingKey)
        continue
      }

      ranges.push({
        rowKey: pending.rowKey,
        columnKeys: Array.from(pending.columnKeys),
      })
      cellsCount += pending.columnKeys.size
      pendingByRow.delete(pendingKey)

      if (ranges.length >= maxBatchSize) {
        break
      }
      if (resolveNow() - startedAt >= frameBudgetMs) {
        break
      }
    }

    if (ranges.length === 0) {
      pendingReasons.clear()
      return
    }

    const flushOptions = resolvePendingFlushOptions()
    api.refreshCellsByRanges(ranges, flushOptions)
    options.onBatchFlush?.(ranges.length, cellsCount)

    if (pendingByRow.size > 0) {
      scheduleFlush()
      return
    }

    pendingReasons.clear()
  }

  const scheduleFlush = (): void => {
    if (frameHandle != null) {
      return
    }
    frameHandle = scheduler.schedule(() => doFlush())
  }

  const queueByRanges = (
    ranges: readonly DataGridCellRefreshRange[],
    refreshOptions?: DataGridCellRefreshOptions,
  ): void => {
    const callReason = resolveCallReason(refreshOptions)
    if (callReason) {
      pendingReasons.add(callReason)
    }

    for (const range of ranges) {
      const pendingRowKey = normalizeRowKey(range.rowKey)
      const pending = pendingByRow.get(pendingRowKey) ?? {
        rowKey: range.rowKey,
        columnKeys: new Set<string>(),
      }
      for (const rawColumnKey of range.columnKeys) {
        const columnKey = normalizeColumnKey(rawColumnKey)
        if (!columnKey) {
          continue
        }
        pending.columnKeys.add(columnKey)
      }
      if (pending.columnKeys.size > 0) {
        pendingByRow.set(pendingRowKey, pending)
      }
    }

    const shouldFlushImmediate = refreshOptions?.immediate ?? options.immediate ?? false
    if (shouldFlushImmediate) {
      if (frameHandle != null) {
        scheduler.cancel(frameHandle)
        frameHandle = null
      }
      doFlush()
      return
    }
    scheduleFlush()
  }

  const queueByRowKeys = (
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    refreshOptions?: DataGridCellRefreshOptions,
  ): void => {
    queueByRanges(rowKeys.map(rowKey => ({ rowKey, columnKeys })), refreshOptions)
  }

  return {
    queueByRowKeys,
    queueByRanges,
    flush: doFlush,
    dispose() {
      pendingByRow.clear()
      pendingReasons.clear()
      if (frameHandle != null) {
        scheduler.cancel(frameHandle)
        frameHandle = null
      }
    },
  }
}
