import type { DataGridColumn, VisibleRow } from "../types"
import type { DataGridColumnDef, DataGridColumnModel } from "../models/columnModel"
import type {
  DataGridRowModel,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridViewportRange,
} from "../models/rowModel"

const DEFAULT_ROW_ENTRY_CACHE_LIMIT = 1024
const CORE_COLUMN_KEYS = new Set(["key", "label", "width", "minWidth", "maxWidth", "visible", "pin", "meta"])

export interface TableViewportModelBridgeServiceOptions {
  initialRowModel?: DataGridRowModel<unknown> | null
  initialColumnModel?: DataGridColumnModel | null
  fallbackRowModel: DataGridRowModel<unknown>
  fallbackColumnModel: DataGridColumnModel
  onInvalidate: () => void
  rowEntryCacheLimit?: number
}

export interface TableViewportModelBridgeService {
  setRowModel(model: DataGridRowModel<unknown> | null | undefined): void
  setColumnModel(model: DataGridColumnModel | null | undefined): void
  getActiveRowModel(): DataGridRowModel<unknown>
  getActiveColumnModel(): DataGridColumnModel
  getRowCount(): number
  getRow(index: number): VisibleRow | undefined
  getRowsInRange(range: DataGridViewportRange): readonly VisibleRow[]
  materializeColumns(): DataGridColumn[]
  dispose(): void
}

export function createTableViewportModelBridgeService(
  options: TableViewportModelBridgeServiceOptions,
): TableViewportModelBridgeService {
  const { fallbackRowModel, fallbackColumnModel, onInvalidate } = options
  const rowEntryCacheLimit =
    Number.isFinite(options.rowEntryCacheLimit) && (options.rowEntryCacheLimit as number) > 0
      ? Math.max(1, Math.trunc(options.rowEntryCacheLimit as number))
      : DEFAULT_ROW_ENTRY_CACHE_LIMIT

  let activeRowModel: DataGridRowModel<unknown> = options.initialRowModel ?? fallbackRowModel
  let activeColumnModel: DataGridColumnModel = options.initialColumnModel ?? fallbackColumnModel
  let activeRowModelUnsubscribe: (() => void) | null = null
  let activeColumnModelUnsubscribe: (() => void) | null = null
  let lastRowModelSnapshot: DataGridRowModelSnapshot<unknown> | null = null

  let rowCountCache = 0
  let rowCountCacheDirty = true
  const rowEntryCache = new Map<number, VisibleRow | undefined>()
  let columnModelColumnsCache: DataGridColumn[] = []
  let columnModelCacheDirty = true

  const markRowModelCacheDirty = () => {
    rowCountCacheDirty = true
    rowEntryCache.clear()
  }

  const markColumnModelCacheDirty = () => {
    columnModelCacheDirty = true
  }

  const bindRowModel = (model: DataGridRowModel<unknown>) => {
    if (activeRowModel === model && activeRowModelUnsubscribe) {
      markRowModelCacheDirty()
      onInvalidate()
      return
    }
    activeRowModelUnsubscribe?.()
    activeRowModel = model
    lastRowModelSnapshot = activeRowModel.getSnapshot()
    activeRowModelUnsubscribe = activeRowModel.subscribe(snapshot => {
      const previous = lastRowModelSnapshot
      lastRowModelSnapshot = snapshot
      const isViewportOnlyUpdate = Boolean(previous) &&
        snapshot.rowCount === previous?.rowCount &&
        snapshot.loading === previous?.loading &&
        snapshot.error === previous?.error &&
        snapshot.sortModel === previous?.sortModel &&
        snapshot.filterModel === previous?.filterModel

      if (!isViewportOnlyUpdate) {
        markRowModelCacheDirty()
      }
      onInvalidate()
    })
    markRowModelCacheDirty()
    onInvalidate()
  }

  const bindColumnModel = (model: DataGridColumnModel) => {
    if (activeColumnModel === model && activeColumnModelUnsubscribe) {
      markColumnModelCacheDirty()
      onInvalidate()
      return
    }
    activeColumnModelUnsubscribe?.()
    activeColumnModel = model
    activeColumnModelUnsubscribe = activeColumnModel.subscribe(() => {
      markColumnModelCacheDirty()
      onInvalidate()
    })
    markColumnModelCacheDirty()
    onInvalidate()
  }

  const toVisibleRow = (node: DataGridRowNode<unknown>): VisibleRow => {
    const stickyTop = node.state.pinned === "top" ? true : undefined
    const stickyBottom = node.state.pinned === "bottom" ? true : undefined
    return {
      row: node.data,
      rowId: node.rowKey,
      originalIndex: node.sourceIndex,
      displayIndex: node.displayIndex,
      stickyTop,
      stickyBottom,
    }
  }

  const toDataGridColumn = (
    snapshotColumn: ReturnType<DataGridColumnModel["getSnapshot"]>["columns"][number],
  ): DataGridColumn => {
    const columnDef: DataGridColumnDef = snapshotColumn.column
    const legacyPassthrough = Object.fromEntries(
      Object.entries(columnDef as unknown as Record<string, unknown>)
        .filter(([key]) => !CORE_COLUMN_KEYS.has(key)),
    )
    const meta =
      columnDef.meta && typeof columnDef.meta === "object"
        ? (columnDef.meta as Record<string, unknown>)
        : undefined
    const label = typeof columnDef.label === "string" ? columnDef.label : snapshotColumn.key
    const widthValue = snapshotColumn.width == null ? columnDef.width : snapshotColumn.width
    const normalizedWidth = Number.isFinite(widthValue as number) ? (widthValue as number) : undefined

    return {
      ...legacyPassthrough,
      ...(meta ?? {}),
      key: snapshotColumn.key,
      label,
      visible: snapshotColumn.visible,
      pin: snapshotColumn.pin,
      width: normalizedWidth,
    }
  }

  const readRowCache = (index: number): VisibleRow | undefined => {
    if (!rowEntryCache.has(index)) {
      return undefined
    }
    const cached = rowEntryCache.get(index)
    // LRU touch: move to tail.
    rowEntryCache.delete(index)
    rowEntryCache.set(index, cached)
    return cached
  }

  const writeRowCache = (index: number, row: VisibleRow | undefined): void => {
    if (rowEntryCache.has(index)) {
      rowEntryCache.delete(index)
    }
    rowEntryCache.set(index, row)
    while (rowEntryCache.size > rowEntryCacheLimit) {
      const oldestKey = rowEntryCache.keys().next().value as number | undefined
      if (typeof oldestKey === "undefined") {
        break
      }
      rowEntryCache.delete(oldestKey)
    }
  }

  const getRowCount = (): number => {
    const nextCount = Math.max(0, activeRowModel.getRowCount())
    if (!rowCountCacheDirty && rowCountCache === nextCount) {
      return rowCountCache
    }

    if (rowCountCache !== nextCount) {
      rowEntryCache.clear()
    }

    rowCountCache = nextCount
    rowCountCacheDirty = false
    return rowCountCache
  }

  const getRow = (index: number): VisibleRow | undefined => {
    const rowCount = getRowCount()
    if (rowCount <= 0 || !Number.isFinite(index)) {
      return undefined
    }

    const normalizedIndex = Math.trunc(index)
    if (normalizedIndex < 0 || normalizedIndex >= rowCount) {
      return undefined
    }

    const cached = readRowCache(normalizedIndex)
    if (typeof cached !== "undefined" || rowEntryCache.has(normalizedIndex)) {
      return cached
    }

    const row = activeRowModel.getRow(normalizedIndex)
    const normalized = row ? toVisibleRow(row) : undefined
    writeRowCache(normalizedIndex, normalized)
    return normalized
  }

  const getRowsInRange = (range: DataGridViewportRange): readonly VisibleRow[] => {
    const rowCount = getRowCount()
    if (rowCount <= 0) {
      return []
    }

    const rawStart = Number.isFinite(range.start) ? Math.trunc(range.start) : 0
    const rawEnd = Number.isFinite(range.end) ? Math.trunc(range.end) : rawStart
    const start = Math.max(0, Math.min(rowCount - 1, rawStart))
    const end = Math.max(start, Math.min(rowCount - 1, rawEnd))
    const rows = activeRowModel.getRowsInRange({ start, end })
    if (!rows.length) {
      return []
    }

    const resolvedRows: VisibleRow[] = []
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const rowIndex = Number.isFinite(row.displayIndex)
        ? Math.trunc(row.displayIndex as number)
        : Math.trunc(row.originalIndex)
      const cached = readRowCache(rowIndex)
      if (typeof cached !== "undefined") {
        resolvedRows.push(cached)
        continue
      }

      const mapped = toVisibleRow(row)
      resolvedRows.push(mapped)
      if (rowIndex >= start && rowIndex <= end) {
        writeRowCache(rowIndex, mapped)
      }
    }
    return resolvedRows
  }

  const materializeColumns = (): DataGridColumn[] => {
    if (!columnModelCacheDirty) {
      return columnModelColumnsCache
    }
    const snapshot = activeColumnModel.getSnapshot()
    columnModelColumnsCache = snapshot.columns
      .filter(column => column.visible)
      .map(column => toDataGridColumn(column))
    columnModelCacheDirty = false
    return columnModelColumnsCache
  }

  bindRowModel(activeRowModel)
  bindColumnModel(activeColumnModel)

  return {
    setRowModel(model) {
      bindRowModel(model ?? fallbackRowModel)
    },
    setColumnModel(model) {
      bindColumnModel(model ?? fallbackColumnModel)
    },
    getActiveRowModel() {
      return activeRowModel
    },
    getActiveColumnModel() {
      return activeColumnModel
    },
    getRowCount,
    getRow,
    getRowsInRange,
    materializeColumns,
    dispose() {
      activeRowModelUnsubscribe?.()
      activeRowModelUnsubscribe = null
      activeColumnModelUnsubscribe?.()
      activeColumnModelUnsubscribe = null
      rowCountCache = 0
      rowCountCacheDirty = true
      rowEntryCache.clear()
      columnModelColumnsCache = []
      columnModelCacheDirty = true
    },
  }
}
