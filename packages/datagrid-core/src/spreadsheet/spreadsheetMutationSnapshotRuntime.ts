import type {
  DataGridSpreadsheetSheetColumnMutation,
  DataGridSpreadsheetSheetRowMutation,
} from "./sheetModel.js"

export function cloneSpreadsheetSheetRowMutation(
  mutation: DataGridSpreadsheetSheetRowMutation | null,
): DataGridSpreadsheetSheetRowMutation | null {
  return mutation
    ? {
      revision: mutation.revision,
      kind: mutation.kind,
      index: mutation.index,
      count: mutation.count,
    }
    : null
}

export function cloneSpreadsheetSheetColumnMutation(
  mutation: DataGridSpreadsheetSheetColumnMutation | null,
): DataGridSpreadsheetSheetColumnMutation | null {
  return mutation
    ? {
      revision: mutation.revision,
      kind: mutation.kind,
      previousKey: mutation.previousKey,
      nextKey: mutation.nextKey,
    }
    : null
}
