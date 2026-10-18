import type { DataGridRowId } from "../models/rowModel.js"
import type { DataGridSpreadsheetStyle } from "./sheet.js"

export interface SpreadsheetViewColumnState {
  key: string
  title: string
  formulaAlias: string
  style: DataGridSpreadsheetStyle | null
}

export interface SpreadsheetViewRowState {
  id: DataGridRowId
  values: Record<string, unknown>
}

export interface SpreadsheetViewDataset {
  columns: readonly SpreadsheetViewColumnState[]
  rows: readonly SpreadsheetViewRowState[]
}

export function createSpreadsheetViewDatasetFromSheetModel(
  sheetModel: import("./sheet.js").DataGridSpreadsheetViewSourceSheet,
): SpreadsheetViewDataset {
  const columns = sheetModel.getColumns().map(column => ({
    key: column.key,
    title: column.title,
    formulaAlias: column.formulaAlias,
    style: column.style,
  }))
  const tableSource = sheetModel.getTableSource()
  const hasRowsResolver = !Array.isArray(tableSource)
    && typeof tableSource === "object"
    && tableSource !== null
    && "rows" in tableSource
  const sourceRows = hasRowsResolver ? tableSource.rows : tableSource
  const resolveRow = hasRowsResolver && typeof tableSource.resolveRow === "function"
    ? tableSource.resolveRow
    : ((row: unknown) => row as Record<string, unknown>)
  const rows = sheetModel.getRows().map((row, rowIndex) => {
    const sourceRow = sourceRows[rowIndex]
    return {
      id: row.id,
      values: sourceRow ? resolveRow(sourceRow, rowIndex) as Record<string, unknown> : {},
    }
  })
  return { columns, rows }
}
