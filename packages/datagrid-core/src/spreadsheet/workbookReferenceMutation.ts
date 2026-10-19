import type { DataGridSpreadsheetFormulaReferenceBinding } from "./formulaEditorModel.js"
import {
  rewriteDataGridSpreadsheetFormulaReferences,
  rewriteDataGridSpreadsheetFormulaStringLiterals,
} from "./formulaEditorModel.js"
import type { DataGridFormulaReferenceParserOptions } from "../models/formula/formulaEngine.js"
import type {
  DataGridSpreadsheetSheetColumnMutation,
  DataGridSpreadsheetSheetRowMutation,
} from "./sheetModel.js"
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

export function rewriteSpreadsheetWorkbookSheetAliasBinding(
  binding: DataGridSpreadsheetFormulaReferenceBinding,
  previousAlias: string,
  nextAlias: string,
): DataGridSpreadsheetFormulaReferenceBinding | null {
  if (
    binding.kind !== "reference"
    || normalizeSpreadsheetWorkbookAlias(binding.sheetReference) !== previousAlias
  ) {
    return null
  }
  return { ...binding, sheetReference: nextAlias }
}

export function rewriteSpreadsheetWorkbookColumnReferences(
  rawInput: string,
  rowIndex: number,
  sourceAliases: ReadonlySet<string>,
  mutation: DataGridSpreadsheetSheetColumnMutation,
  referenceParserOptions?: DataGridFormulaReferenceParserOptions,
): string {
  const rewrittenReferences = rewriteDataGridSpreadsheetFormulaReferences(rawInput, reference => {
    const normalizedAlias = normalizeSpreadsheetWorkbookAlias(reference.sheetReference)
    if (normalizedAlias.length === 0 || !sourceAliases.has(normalizedAlias)) {
      return null
    }
    const nextReferenceName = reference.referenceName === mutation.previousKey
      ? mutation.nextKey
      : reference.referenceName
    const nextRangeReferenceName = reference.rangeReferenceName === mutation.previousKey
      ? mutation.nextKey
      : reference.rangeReferenceName
    if (
      nextReferenceName === reference.referenceName
      && nextRangeReferenceName === reference.rangeReferenceName
    ) {
      return null
    }
    return {
      sheetReference: reference.sheetReference,
      referenceName: nextReferenceName,
      rangeReferenceName: nextRangeReferenceName,
      rowSelector: reference.rowSelector,
    }
  }, { currentRowIndex: rowIndex, referenceParserOptions })

  return rewriteDataGridSpreadsheetFormulaStringLiterals(rewrittenReferences, (literalText, context) => {
    const functionName = context.callName?.trim().toUpperCase()
    const argumentIndex = context.argumentIndex
    if (!functionName || typeof argumentIndex !== "number") {
      return null
    }
    const tableNameNode = context.callArgs?.[0]
    if (!tableNameNode || tableNameNode.kind !== "literal" || typeof tableNameNode.value !== "string") {
      return null
    }
    const normalizedTableAlias = normalizeSpreadsheetWorkbookAlias(tableNameNode.value)
    if (normalizedTableAlias.length === 0 || !sourceAliases.has(normalizedTableAlias)) {
      return null
    }
    const shouldRewrite = (
      (functionName === "TABLE" && argumentIndex === 1)
      || (functionName === "RELATED" && (argumentIndex === 2 || argumentIndex === 3))
      || (functionName === "ROLLUP" && (argumentIndex === 1 || argumentIndex === 3))
    )
    return shouldRewrite && literalText === mutation.previousKey ? mutation.nextKey : null
  }, { currentRowIndex: rowIndex, referenceParserOptions })
}

export function invalidateSpreadsheetWorkbookReferences(
  rawInput: string,
  references: readonly { sheetReference: string | null | undefined; span: { start: number; end: number } }[],
  removedAliases: ReadonlySet<string>,
): string {
  let nextRawInput = rawInput
  const matchingReferences = references
    .filter(reference => removedAliases.has(normalizeSpreadsheetWorkbookAlias(reference.sheetReference)))
    .sort((left, right) => right.span.start - left.span.start)
  for (const reference of matchingReferences) {
    nextRawInput = `${nextRawInput.slice(0, reference.span.start)}#REF!${nextRawInput.slice(reference.span.end)}`
  }
  return nextRawInput
}
