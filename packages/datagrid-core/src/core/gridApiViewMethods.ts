import type {
  DataGridRowId,
  DataGridRowModel,
  DataGridViewportRange,
} from "../models"
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
  return {
    setViewportRange(range: DataGridViewportRange) {
      rowModel.setViewportRange(range)
      getViewportService()?.setViewportRange?.(range)
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
