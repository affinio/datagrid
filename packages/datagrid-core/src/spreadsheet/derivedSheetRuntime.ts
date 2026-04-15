import type { DataGridRowId } from "../models/rowModel.js"
import type { DataGridSpreadsheetStyle } from "./sheet.js"

export interface DataGridSpreadsheetDerivedSheetRuntimeColumn {
  key: string
  title: string
  formulaAlias: string
  style: DataGridSpreadsheetStyle | null
}

export interface DataGridSpreadsheetDerivedSheetRuntimeRow {
  id: DataGridRowId
  values: readonly unknown[]
}

export interface DataGridSpreadsheetDerivedSheetRuntimeDiagnostic {
  code: string
  message: string
  relatedSheetId?: string | null
}

export interface DataGridSpreadsheetDerivedSheetRuntime {
  revision: number
  columns: readonly DataGridSpreadsheetDerivedSheetRuntimeColumn[]
  rows: readonly DataGridSpreadsheetDerivedSheetRuntimeRow[]
  diagnostics: readonly DataGridSpreadsheetDerivedSheetRuntimeDiagnostic[]
}

export function createDataGridSpreadsheetDerivedSheetRuntime(
  options: {
    columns: readonly DataGridSpreadsheetDerivedSheetRuntimeColumn[]
    rows: readonly DataGridSpreadsheetDerivedSheetRuntimeRow[]
    diagnostics?: readonly DataGridSpreadsheetDerivedSheetRuntimeDiagnostic[] | null
    revision?: number
  },
): DataGridSpreadsheetDerivedSheetRuntime {
  return Object.freeze({
    revision: options.revision ?? 0,
    columns: Object.freeze(options.columns.map(column => Object.freeze({
      key: column.key,
      title: column.title,
      formulaAlias: column.formulaAlias,
      style: column.style,
    }))),
    rows: Object.freeze(options.rows.map(row => Object.freeze({
      id: row.id,
      values: Object.freeze([...row.values]),
    }))),
    diagnostics: Object.freeze((options.diagnostics ?? []).map(diagnostic => Object.freeze({
      code: diagnostic.code,
      message: diagnostic.message,
      relatedSheetId: diagnostic.relatedSheetId ?? null,
    }))),
  })
}
