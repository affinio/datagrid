import type { DataGridRowNode } from "@affino/datagrid-vue"
import type { DataGridBivariantCallback } from "./types/bivariance"

export const DATAGRID_STRUCTURAL_ROW_ACTION_IDS = [
  "insert-row-above",
  "insert-row-below",
  "delete-selected-rows",
] as const

export type DataGridStructuralRowActionId = (typeof DATAGRID_STRUCTURAL_ROW_ACTION_IDS)[number]

export interface DataGridStructuralRowActionContext<TRow = unknown> {
  action: DataGridStructuralRowActionId
  rowId: string | number
  row: DataGridRowNode<TRow> | null
  rowIndex: number
  placeholderVisualRowIndex: number | null
  selectedRowIds: readonly (string | number)[]
}

export type DataGridStructuralRowActionHandler<TRow = unknown> = DataGridBivariantCallback<[
  context: DataGridStructuralRowActionContext<TRow>,
], boolean | void | Promise<boolean | void>>

export function defineDataGridStructuralRowActionHandler<TRow = unknown>() {
  return <THandler extends DataGridStructuralRowActionHandler<TRow>>(handler: THandler): THandler => handler
}
