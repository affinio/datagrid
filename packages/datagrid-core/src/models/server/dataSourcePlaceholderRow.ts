import type { DataGridRowNode } from "../rowModel.js"
import type { DataGridRangeCacheIndexState } from "./rangeCache.js"

const LOADING_ROW_ID_PREFIX = "__affino_datagrid_data_source_loading__:"
const LOADING_ROW_DATA_FLAG = "__affinoDataGridDataSourceLoadingRow"
const LOADING_ROW_STATUS_FIELD = "__affinoDataGridDataSourceRowStatus"

type DataSourceLoadingRowData = {
  [LOADING_ROW_DATA_FLAG]: true
  [LOADING_ROW_STATUS_FIELD]: DataGridRangeCacheIndexState
}

export type DataGridDataSourceLoadingRowNode<T> = DataGridRowNode<T> & {
  readonly __dataSourceLoadingRow: true
  readonly __placeholder: true
}

export function createDataSourcePlaceholderRow<T>(
  visibleIndex: number,
  sourceIndex: number,
  status: DataGridRangeCacheIndexState,
): DataGridDataSourceLoadingRowNode<T> {
  const rowId = `${LOADING_ROW_ID_PREFIX}${sourceIndex}`
  const row = {
    [LOADING_ROW_DATA_FLAG]: true,
    [LOADING_ROW_STATUS_FIELD]: status,
  } as DataSourceLoadingRowData as T
  return {
    __dataSourceLoadingRow: true,
    __placeholder: true,
    kind: "leaf",
    data: row,
    row,
    rowKey: rowId,
    rowId,
    sourceIndex,
    originalIndex: sourceIndex,
    displayIndex: visibleIndex,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
  }
}
