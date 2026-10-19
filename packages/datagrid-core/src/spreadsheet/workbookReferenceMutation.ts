import type { DataGridSpreadsheetFormulaReferenceBinding } from "./formulaEditorModel.js"
import type { DataGridSpreadsheetSheetRowMutation } from "./sheetModel.js"
import { normalizeSpreadsheetWorkbookAlias } from "./workbookFormulaDependencies.js"

/** Rewrites only absolute references into a source sheet after row structure changes. */
export function rewriteSpreadsheetWorkbookRowReference(
  binding: DataGridSpreadsheetFormulaReferenceBinding,
  sourceAliases: ReadonlySet<string>,
  mutation: DataGridSpreadsheetSheetRowMutation,
): DataGridSpreadsheetFormulaReferenceBinding | null {
  if (
    binding.kind !== "reference"
    || !sourceAliases.has(normalizeSpreadsheetWorkbookAlias(binding.sheetReference))
  ) {
    return null
  }

  const selector = binding.rowSelector
  if (mutation.kind === "insert") {
    if (selector.kind === "absolute") {
      return selector.rowIndex < mutation.index
        ? null
        : { ...binding, rowSelector: { kind: "absolute", rowIndex: selector.rowIndex + mutation.count } }
    }
    if (selector.kind !== "absolute-window" || selector.endRowIndex < mutation.index) {
      return null
    }
    const shiftWholeRange = selector.startRowIndex >= mutation.index
    return {
      ...binding,
      rowSelector: {
        kind: "absolute-window",
        startRowIndex: shiftWholeRange ? selector.startRowIndex + mutation.count : selector.startRowIndex,
        endRowIndex: selector.endRowIndex + mutation.count,
      },
    }
  }

  if (selector.kind === "absolute") {
    if (selector.rowIndex < mutation.index) {
      return null
    }
    if (selector.rowIndex >= mutation.index + mutation.count) {
      return { ...binding, rowSelector: { kind: "absolute", rowIndex: selector.rowIndex - mutation.count } }
    }
    return { key: binding.key, index: binding.index, kind: "invalid" }
  }
  if (selector.kind !== "absolute-window") {
    return null
  }

  const survivingIndexes: number[] = []
  for (let index = selector.startRowIndex; index <= selector.endRowIndex; index += 1) {
    if (index < mutation.index) {
      survivingIndexes.push(index)
    } else if (index >= mutation.index + mutation.count) {
      survivingIndexes.push(index - mutation.count)
    }
  }
  if (survivingIndexes.length === 0) {
    return { key: binding.key, index: binding.index, kind: "invalid" }
  }
  if (survivingIndexes.length === 1) {
    return {
      ...binding,
      rowSelector: { kind: "absolute", rowIndex: survivingIndexes[0]! },
    }
  }
  return {
    ...binding,
    rowSelector: {
      kind: "absolute-window",
      startRowIndex: survivingIndexes[0]!,
      endRowIndex: survivingIndexes[survivingIndexes.length - 1]!,
    },
  }
}
