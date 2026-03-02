import type {
  DataGridColumnModel,
  DataGridColumnPin,
  DataGridRowId,
  DataGridRowModel,
} from "../models"

export interface DataGridCellRefreshOptions {
  immediate?: boolean
  reason?: string
}

export interface DataGridCellRefreshRange {
  rowKey: DataGridRowId
  columnKeys: readonly string[]
}

export interface DataGridCellRefreshEntry {
  rowKey: DataGridRowId
  rowIndex: number
  columnKey: string
  columnIndex: number
  pin: DataGridColumnPin
}

export interface DataGridCellsRefreshBatch {
  timestamp: number
  reason?: string
  cells: readonly DataGridCellRefreshEntry[]
}

export type DataGridCellsRefreshListener = (batch: DataGridCellsRefreshBatch) => void

interface DataGridDeferredHandle {
  id: number
}

type DataGridDeferredScheduler = (callback: () => void) => DataGridDeferredHandle
type DataGridDeferredCanceler = (handle: DataGridDeferredHandle) => void

interface PendingRefreshRow {
  rowKey: DataGridRowId
  columnKeys: Set<string>
}

function normalizeRowRefreshKey(rowKey: DataGridRowId): string {
  if (typeof rowKey === "number") {
    return `n:${rowKey}`
  }
  return `s:${rowKey}`
}

function normalizeRefreshColumnKey(columnKey: string): string | null {
  if (typeof columnKey !== "string") {
    return null
  }
  const normalized = columnKey.trim()
  return normalized.length > 0 ? normalized : null
}

function createDeferredScheduler(): {
  schedule: DataGridDeferredScheduler
  cancel: DataGridDeferredCanceler
} {
  let nextHandleId = 1
  const cancelledHandles = new Set<number>()

  return {
    schedule(callback) {
      const handle: DataGridDeferredHandle = { id: nextHandleId }
      nextHandleId += 1
      Promise.resolve().then(() => {
        if (cancelledHandles.has(handle.id)) {
          cancelledHandles.delete(handle.id)
          return
        }
        callback()
      })
      return handle
    },
    cancel(handle) {
      cancelledHandles.add(handle.id)
    },
  }
}

class DataGridCellRefreshRegistry {
  private readonly listeners = new Set<DataGridCellsRefreshListener>()
  private readonly pendingRowsByKey = new Map<string, PendingRefreshRow>()
  private scheduledHandle: DataGridDeferredHandle | null = null
  private pendingReason: string | undefined
  private nextBatchSequence = 1

  constructor(
    private readonly resolveVisibleEntries: (
      pendingRows: readonly PendingRefreshRow[],
    ) => readonly DataGridCellRefreshEntry[],
    private readonly scheduleFrame: DataGridDeferredScheduler,
    private readonly cancelFrame: DataGridDeferredCanceler,
  ) {}

  queueByRowKeys(
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ): void {
    this.queueByRanges(
      rowKeys.map(rowKey => ({ rowKey, columnKeys })),
      options,
    )
  }

  queueByRanges(
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ): void {
    for (const range of ranges) {
      const normalizedRowKey = normalizeRowRefreshKey(range.rowKey)
      const pendingRow = this.pendingRowsByKey.get(normalizedRowKey) ?? {
        rowKey: range.rowKey,
        columnKeys: new Set<string>(),
      }

      for (const rawColumnKey of range.columnKeys) {
        const columnKey = normalizeRefreshColumnKey(rawColumnKey)
        if (!columnKey) {
          continue
        }
        pendingRow.columnKeys.add(columnKey)
      }

      if (pendingRow.columnKeys.size > 0) {
        this.pendingRowsByKey.set(normalizedRowKey, pendingRow)
      }
    }

    if (typeof options?.reason === "string" && options.reason.trim().length > 0) {
      this.pendingReason = options.reason
    }

    if (options?.immediate) {
      this.flush()
      return
    }

    this.schedule()
  }

  subscribe(listener: DataGridCellsRefreshListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    if (this.scheduledHandle != null) {
      this.cancelFrame(this.scheduledHandle)
      this.scheduledHandle = null
    }
    this.pendingRowsByKey.clear()
    this.listeners.clear()
    this.pendingReason = undefined
  }

  private schedule(): void {
    if (this.scheduledHandle != null || this.pendingRowsByKey.size === 0) {
      return
    }
    this.scheduledHandle = this.scheduleFrame(() => {
      this.scheduledHandle = null
      this.flush()
    })
  }

  private flush(): void {
    if (this.pendingRowsByKey.size === 0) {
      return
    }

    const timestamp = this.nextBatchSequence
    this.nextBatchSequence += 1

    const pendingRows = Array.from(this.pendingRowsByKey.values())
    this.pendingRowsByKey.clear()

    const cells = this.resolveVisibleEntries(pendingRows)
    const reason = this.pendingReason
    this.pendingReason = undefined

    if (cells.length === 0 || this.listeners.size === 0) {
      return
    }

    const batch: DataGridCellsRefreshBatch = {
      timestamp,
      reason,
      cells,
    }

    for (const listener of this.listeners) {
      listener(batch)
    }
  }
}

export interface DataGridCellRefreshRegistryApi {
  queueByRowKeys: (
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ) => void
  queueByRanges: (
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ) => void
  subscribe: (listener: DataGridCellsRefreshListener) => () => void
  dispose: () => void
}

export function createDataGridCellRefreshRegistry<TRow = unknown>(
  rowModel: DataGridRowModel<TRow>,
  columnModel: DataGridColumnModel,
): DataGridCellRefreshRegistryApi {
  const deferredScheduler = createDeferredScheduler()
  const resolveVisibleCellRefreshEntries = (
    pendingRows: readonly PendingRefreshRow[],
  ): readonly DataGridCellRefreshEntry[] => {
    if (pendingRows.length === 0) {
      return []
    }

    const rowSnapshot = rowModel.getSnapshot()
    const viewportRows = rowModel.getRowsInRange(rowSnapshot.viewportRange)
    if (viewportRows.length === 0) {
      return []
    }

    const visibleRowIndexByKey = new Map<string, number>()
    for (const row of viewportRows) {
      visibleRowIndexByKey.set(normalizeRowRefreshKey(row.rowId), row.displayIndex)
    }

    const columnSnapshot = columnModel.getSnapshot()
    const visibleColumnMetaByKey = new Map<string, { columnIndex: number; pin: DataGridColumnPin }>()
    for (let index = 0; index < columnSnapshot.visibleColumns.length; index += 1) {
      const column = columnSnapshot.visibleColumns[index]
      if (!column) {
        continue
      }
      visibleColumnMetaByKey.set(column.key, {
        columnIndex: index,
        pin: column.pin,
      })
    }

    const dedupe = new Set<string>()
    const cells: DataGridCellRefreshEntry[] = []
    for (const pendingRow of pendingRows) {
      const rowIndex = visibleRowIndexByKey.get(normalizeRowRefreshKey(pendingRow.rowKey))
      if (typeof rowIndex !== "number") {
        continue
      }

      for (const columnKey of pendingRow.columnKeys) {
        const columnMeta = visibleColumnMetaByKey.get(columnKey)
        if (!columnMeta) {
          continue
        }

        const dedupeKey = `${normalizeRowRefreshKey(pendingRow.rowKey)}|${columnKey}`
        if (dedupe.has(dedupeKey)) {
          continue
        }
        dedupe.add(dedupeKey)

        cells.push({
          rowKey: pendingRow.rowKey,
          rowIndex,
          columnKey,
          columnIndex: columnMeta.columnIndex,
          pin: columnMeta.pin,
        })
      }
    }

    cells.sort((left, right) => {
      if (left.rowIndex !== right.rowIndex) {
        return left.rowIndex - right.rowIndex
      }
      return left.columnIndex - right.columnIndex
    })

    return cells
  }

  const registry = new DataGridCellRefreshRegistry(
    resolveVisibleCellRefreshEntries,
    deferredScheduler.schedule,
    deferredScheduler.cancel,
  )

  return {
    queueByRowKeys: (rowKeys, columnKeys, options) => {
      registry.queueByRowKeys(rowKeys, columnKeys, options)
    },
    queueByRanges: (ranges, options) => {
      registry.queueByRanges(ranges, options)
    },
    subscribe: listener => registry.subscribe(listener),
    dispose: () => registry.dispose(),
  }
}
