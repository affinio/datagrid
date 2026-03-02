import type { DataGridColumnModel, DataGridRowModel } from "../models"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import { createDataGridSelectionSummary } from "../selection/selectionSummary"
import type { DataGridSelectionSummaryApiOptions } from "./gridApiContracts"

export interface BuildDataGridSelectionSummaryInput<TRow = unknown> {
  selectionSnapshot: DataGridSelectionSnapshot
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  options?: DataGridSelectionSummaryApiOptions<TRow>
}

export function buildDataGridSelectionSummary<TRow = unknown>(
  input: BuildDataGridSelectionSummaryInput<TRow>,
) {
  const options = input.options ?? {}
  const columnSnapshot = input.columnModel.getSnapshot()
  const visibleColumns = columnSnapshot.visibleColumns
  const getColumnKeyByIndex = options.getColumnKeyByIndex ?? ((columnIndex: number) => {
    return visibleColumns[columnIndex]?.key ?? null
  })
  const scope = options.scope ?? "selected-loaded"
  const viewportRange = input.rowModel.getSnapshot().viewportRange
  const includeRowIndex = scope === "selected-visible"
    ? (rowIndex: number) => rowIndex >= viewportRange.start && rowIndex <= viewportRange.end
    : undefined

  return createDataGridSelectionSummary<TRow>({
    selection: input.selectionSnapshot,
    scope,
    rowCount: input.rowModel.getRowCount(),
    includeRowIndex,
    getRow: rowIndex => input.rowModel.getRow(rowIndex),
    getColumnKeyByIndex,
    columns: options.columns,
    defaultAggregations: options.defaultAggregations,
  })
}
