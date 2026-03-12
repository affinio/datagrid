import type { DataGridSpreadsheetSheetState } from "./sheetModel.js"

export function isTypedPlainSpreadsheetSheetState(
  state: DataGridSpreadsheetSheetState,
): boolean {
  return state.rows.length > 0 && state.rows.every(row => row.cells.every(cell => (
    cell.style == null
    && typeof cell.resolvedValue !== "undefined"
    && !String(cell.rawInput ?? "").trimStart().startsWith("=")
  )))
}
