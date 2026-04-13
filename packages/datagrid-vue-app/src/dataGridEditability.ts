import type { DataGridColumnSnapshot, DataGridRowId } from "@affino/datagrid-vue"
import type { DataGridBivariantCallback } from "./types/bivariance"

export interface DataGridCellEditablePredicateContext<TRow> {
  row: TRow
  rowId: DataGridRowId
  rowIndex: number
  column: DataGridColumnSnapshot["column"]
  columnKey: string
}

export type DataGridCellEditablePredicate<TRow> = DataGridBivariantCallback<[
  ctx: DataGridCellEditablePredicateContext<TRow>,
], boolean>