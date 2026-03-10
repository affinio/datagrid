import type {
  DataGridRowId,
  DataGridRowModel,
  DataGridViewportRange,
} from "../models/index.js"
import type {
  DataGridCellRefreshOptions,
  DataGridCellRefreshRange,
  DataGridCellsRefreshListener,
} from "./gridApiCellRefresh"
import type { DataGridCoreViewportService } from "./gridCore"

export interface DataGridApiCellRefreshQueue {
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
}

export interface DataGridApiViewMethods {
  setViewportRange: (range: DataGridViewportRange) => void
  setRowHeightMode: (mode: "fixed" | "auto") => void
  setBaseRowHeight: (height: number) => void
  measureRowHeight: () => void
  setRowHeightOverride: (rowIndex: number, height: number | null) => void
  getRowHeightOverride: (rowIndex: number) => number | null
  clearRowHeightOverrides: () => void
  refreshCellsByRowKeys: (
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ) => void
  refreshCellsByRanges: (
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ) => void
  onCellsRefresh: (listener: DataGridCellsRefreshListener) => () => void
}

export interface CreateDataGridApiViewMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getViewportService: () => DataGridCoreViewportService | null
  cellRefreshQueue: DataGridApiCellRefreshQueue
}

export function createDataGridApiViewMethods<TRow = unknown>(
  input: CreateDataGridApiViewMethodsInput<TRow>,
): DataGridApiViewMethods {
  const { rowModel, getViewportService, cellRefreshQueue } = input
  const rowHeightOverrideFallback = new Map<number, number>()
  const normalizeRowIndex = (value: number): number | null => {
    if (!Number.isFinite(value)) {
      return null
    }
    const normalized = Math.trunc(value)
    return normalized >= 0 ? normalized : null
  }

  const normalizeRowHeight = (value: number): number | null => {
    if (!Number.isFinite(value)) {
      return null
    }
    return Math.max(1, Math.trunc(value))
  }

  return {
    setViewportRange(range: DataGridViewportRange) {
      rowModel.setViewportRange(range)
      getViewportService()?.setViewportRange?.(range)
    },
    setRowHeightMode(mode: "fixed" | "auto") {
      getViewportService()?.setRowHeightMode?.(mode)
    },
    setBaseRowHeight(height: number) {
      const normalized = normalizeRowHeight(height)
      if (normalized == null) {
        return
      }
      getViewportService()?.setBaseRowHeight?.(normalized)
    },
    measureRowHeight() {
      getViewportService()?.measureRowHeight?.()
    },
    setRowHeightOverride(rowIndex: number, height: number | null) {
      const normalizedIndex = normalizeRowIndex(rowIndex)
      if (normalizedIndex == null) {
        return
      }
      const viewportService = getViewportService()
      if (typeof viewportService?.setRowHeightOverride === "function") {
        viewportService.setRowHeightOverride(normalizedIndex, height)
      }

      if (height == null) {
        rowHeightOverrideFallback.delete(normalizedIndex)
        return
      }

      const normalizedHeight = normalizeRowHeight(height)
      if (normalizedHeight == null) {
        return
      }
      rowHeightOverrideFallback.set(normalizedIndex, normalizedHeight)
    },
    getRowHeightOverride(rowIndex: number) {
      const normalizedIndex = normalizeRowIndex(rowIndex)
      if (normalizedIndex == null) {
        return null
      }
      const viewportService = getViewportService()
      if (typeof viewportService?.getRowHeightOverride === "function") {
        const value = viewportService.getRowHeightOverride(normalizedIndex)
        if (value != null) {
          return value
        }
      }
      return rowHeightOverrideFallback.get(normalizedIndex) ?? null
    },
    clearRowHeightOverrides() {
      rowHeightOverrideFallback.clear()
      getViewportService()?.clearRowHeightOverrides?.()
    },
    refreshCellsByRowKeys(
      rowKeys: readonly DataGridRowId[],
      columnKeys: readonly string[],
      options?: DataGridCellRefreshOptions,
    ) {
      cellRefreshQueue.queueByRowKeys(rowKeys, columnKeys, options)
    },
    refreshCellsByRanges(
      ranges: readonly DataGridCellRefreshRange[],
      options?: DataGridCellRefreshOptions,
    ) {
      cellRefreshQueue.queueByRanges(ranges, options)
    },
    onCellsRefresh(listener: DataGridCellsRefreshListener) {
      return cellRefreshQueue.subscribe(listener)
    },
  }
}
