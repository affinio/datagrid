import type {
  DataGridPivotColumn,
  DataGridPivotSpec,
} from "./contracts.js"
import type {
  DataGridAggregationModel,
  DataGridColumnPin,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridRowNode,
  DataGridSortState,
} from "./coreTypes.js"

export interface DataGridPivotLayoutColumnState {
  order: readonly string[]
  visibility: Readonly<Record<string, boolean>>
  widths: Readonly<Record<string, number | null>>
  pins: Readonly<Record<string, DataGridColumnPin>>
}

export interface DataGridPivotLayoutSnapshot<TRow = unknown> {
  version: 1
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  pivotModel: DataGridPivotSpec | null
  aggregationModel: DataGridAggregationModel<TRow> | null
  groupExpansion: DataGridGroupExpansionSnapshot | null
  columnState: DataGridPivotLayoutColumnState
}

export interface DataGridPivotLayoutImportOptions {
  applyColumnState?: boolean
}

export interface DataGridPivotInteropSnapshot<TRow = unknown> {
  version: 1
  layout: DataGridPivotLayoutSnapshot<TRow>
  pivotColumns: readonly DataGridPivotColumn[]
  rows: readonly DataGridRowNode<TRow>[]
}
