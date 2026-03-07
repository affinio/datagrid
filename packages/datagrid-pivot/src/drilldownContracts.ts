import type { DataGridAggOp } from "./contracts.js"
import type {
  DataGridRowId,
  DataGridRowNode,
} from "./coreTypes.js"

export interface DataGridPivotCellDrilldownInput {
  rowId: DataGridRowId
  columnId: string
  limit?: number
}

export interface DataGridPivotCellDrilldown<T = unknown> {
  rowId: DataGridRowId
  columnId: string
  valueField: string
  agg: DataGridAggOp
  cellValue: unknown
  matchCount: number
  truncated: boolean
  rows: readonly DataGridRowNode<T>[]
}
