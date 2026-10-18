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
