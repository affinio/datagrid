import type { DataGridColumnSnapshot, DataGridRowId } from "@affino/datagrid-vue"

export interface DataGridCellEditablePredicateContext<TRow> {
  row: TRow
  rowId: DataGridRowId
  rowIndex: number
  column: DataGridColumnSnapshot["column"]
  columnKey: string
}

export type DataGridCellEditablePredicate<TRow> = (
  ctx: DataGridCellEditablePredicateContext<TRow>,
) => boolean