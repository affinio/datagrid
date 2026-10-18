export type DataGridSpreadsheetViewMaterializationDiagnosticCode =
  | "cycle"
  | "source-missing"
  | "join-sheet-missing"
  | "join-ambiguous-match"
  | "materialization-failed"

export class DataGridSpreadsheetViewMaterializationError extends Error {
  readonly code: DataGridSpreadsheetViewMaterializationDiagnosticCode
  readonly relatedSheetId: string | null

  constructor(
    code: DataGridSpreadsheetViewMaterializationDiagnosticCode,
    message: string,
    relatedSheetId: string | null = null,
  ) {
    super(message)
    this.name = "DataGridSpreadsheetViewMaterializationError"
    this.code = code
    this.relatedSheetId = relatedSheetId
  }
}
