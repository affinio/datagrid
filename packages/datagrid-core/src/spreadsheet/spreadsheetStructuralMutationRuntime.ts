import type { DataGridFormulaReferenceParserOptions } from "../models/formula/formulaEngine.js"
import {
  mapDataGridSpreadsheetCellFormulaRuntimeModelBindings,
  renderDataGridSpreadsheetCellFormulaRuntimeModel,
  rewriteDataGridSpreadsheetFormulaReferences,
  rewriteDataGridSpreadsheetFormulaStringLiterals,
  type DataGridSpreadsheetCellFormulaModel,
  type DataGridSpreadsheetCellFormulaRuntimeModel,
} from "./formulaEditorModel.js"
import { normalizeSpreadsheetSheetReferenceAlias } from "./spreadsheetReferenceRuntime.js"

export interface SpreadsheetStructuralMutationFormulaOptions {
  referenceParserOptions?: DataGridFormulaReferenceParserOptions
  isCurrentSheetReference: (sheetReference: string | null | undefined) => boolean
}

export function rewriteSpreadsheetFormulaRuntimeForInsertedRows(
  runtimeModel: DataGridSpreadsheetCellFormulaRuntimeModel,
  presentationModel: DataGridSpreadsheetCellFormulaModel,
  rowIndex: number,
  insertIndex: number,
  insertedRowCount: number,
  options: SpreadsheetStructuralMutationFormulaOptions,
): string {
  const nextRuntimeModel = mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(runtimeModel, binding => {
    if (binding.kind !== "reference") {
      return null
    }
    const reference = binding
    if (!options.isCurrentSheetReference(reference.sheetReference)) {
      return null
    }
    if (reference.rowSelector.kind === "absolute") {
      if (reference.rowSelector.rowIndex < insertIndex) {
        return null
      }
      return {
        sheetReference: reference.sheetReference,
        referenceName: reference.referenceName,
        rangeReferenceName: reference.rangeReferenceName,
        rowSelector: {
          kind: "absolute",
          rowIndex: reference.rowSelector.rowIndex + insertedRowCount,
        },
      }
    }
    if (reference.rowSelector.kind !== "absolute-window") {
      return null
    }
    if (reference.rowSelector.endRowIndex < insertIndex) {
      return null
    }
    const shiftWholeRange = reference.rowSelector.startRowIndex >= insertIndex
    return {
      sheetReference: reference.sheetReference,
      referenceName: reference.referenceName,
      rangeReferenceName: reference.rangeReferenceName,
      rowSelector: {
        kind: "absolute-window",
        startRowIndex: shiftWholeRange
          ? reference.rowSelector.startRowIndex + insertedRowCount
          : reference.rowSelector.startRowIndex,
        endRowIndex: reference.rowSelector.endRowIndex + insertedRowCount,
      },
    }
  }, {
    currentRowIndex: rowIndex,
  })
  return renderDataGridSpreadsheetCellFormulaRuntimeModel(nextRuntimeModel, presentationModel, {
    currentRowIndex: rowIndex,
    referenceParserOptions: options.referenceParserOptions,
  })
}

export function rewriteSpreadsheetFormulaRuntimeForRemovedRows(
  runtimeModel: DataGridSpreadsheetCellFormulaRuntimeModel,
  presentationModel: DataGridSpreadsheetCellFormulaModel,
  rowIndex: number,
  removeIndex: number,
  removedRowCount: number,
  options: SpreadsheetStructuralMutationFormulaOptions,
): string {
  const nextRuntimeModel = mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(runtimeModel, binding => {
    if (binding.kind !== "reference") {
      return null
    }
    const reference = binding
    if (!options.isCurrentSheetReference(reference.sheetReference)) {
      return null
    }
    if (reference.rowSelector.kind === "absolute") {
      if (reference.rowSelector.rowIndex < removeIndex) {
        return null
      }
      if (reference.rowSelector.rowIndex >= removeIndex + removedRowCount) {
        return {
          sheetReference: reference.sheetReference,
          referenceName: reference.referenceName,
          rangeReferenceName: reference.rangeReferenceName,
          rowSelector: {
            kind: "absolute",
            rowIndex: reference.rowSelector.rowIndex - removedRowCount,
          },
        }
      }
      return {
        kind: "invalid",
      }
    }
    if (reference.rowSelector.kind !== "absolute-window") {
      return null
    }
    const survivingIndexes: number[] = []
    for (
      let targetRowIndex = reference.rowSelector.startRowIndex;
      targetRowIndex <= reference.rowSelector.endRowIndex;
      targetRowIndex += 1
    ) {
      if (targetRowIndex < removeIndex) {
        survivingIndexes.push(targetRowIndex)
        continue
      }
      if (targetRowIndex >= removeIndex + removedRowCount) {
        survivingIndexes.push(targetRowIndex - removedRowCount)
      }
    }
    if (survivingIndexes.length === 0) {
      return {
        kind: "invalid",
      }
    }
    if (survivingIndexes.length === 1) {
      return {
        sheetReference: reference.sheetReference,
        referenceName: reference.referenceName,
        rangeReferenceName: reference.rangeReferenceName,
        rowSelector: {
          kind: "absolute",
          rowIndex: survivingIndexes[0]!,
        },
      }
    }
    return {
      sheetReference: reference.sheetReference,
      referenceName: reference.referenceName,
      rangeReferenceName: reference.rangeReferenceName,
      rowSelector: {
        kind: "absolute-window",
        startRowIndex: survivingIndexes[0]!,
        endRowIndex: survivingIndexes[survivingIndexes.length - 1]!,
      },
    }
  }, {
    currentRowIndex: rowIndex,
  })
  return renderDataGridSpreadsheetCellFormulaRuntimeModel(nextRuntimeModel, presentationModel, {
    currentRowIndex: rowIndex,
    referenceParserOptions: options.referenceParserOptions,
  })
}

export function rewriteSpreadsheetColumnRenameFormulaLiterals(
  rawInput: string,
  rowIndex: number,
  previousColumnKey: string,
  nextColumnKey: string,
  sheetAliases: ReadonlySet<string>,
  referenceParserOptions?: DataGridFormulaReferenceParserOptions,
): string {
  return rewriteDataGridSpreadsheetFormulaStringLiterals(rawInput, (literalText, context) => {
    const functionName = context.callName?.trim().toUpperCase()
    const argumentIndex = context.argumentIndex
    if (!functionName || typeof argumentIndex !== "number") {
      return null
    }

    const tableNameNode = context.callArgs?.[0]
    if (!tableNameNode || tableNameNode.kind !== "literal" || typeof tableNameNode.value !== "string") {
      return null
    }

    const normalizedTableAlias = normalizeSpreadsheetSheetReferenceAlias(tableNameNode.value)
    if (normalizedTableAlias.length === 0 || !sheetAliases.has(normalizedTableAlias)) {
      return null
    }

    const shouldRewrite = (
      (functionName === "TABLE" && argumentIndex === 1)
      || (functionName === "RELATED" && (argumentIndex === 2 || argumentIndex === 3))
      || (functionName === "ROLLUP" && (argumentIndex === 1 || argumentIndex === 3))
    )

    return shouldRewrite && literalText === previousColumnKey
      ? nextColumnKey
      : null
  }, {
    currentRowIndex: rowIndex,
    referenceParserOptions,
  })
}

export function rewriteStoredSpreadsheetFormulaColumnReferences(
  formulas: readonly {
    rowIndex: number
    columnKey: string
    rawInput: string
  }[],
  previousColumnKey: string,
  nextColumnKey: string,
  sheetAliases: ReadonlySet<string>,
  options: SpreadsheetStructuralMutationFormulaOptions & {
    setStoredRawInput: (rowIndex: number, columnKey: string, rawInput: string) => void
  },
): boolean {
  let changed = false

  for (const formula of formulas) {
    const targetColumnKey = formula.columnKey === previousColumnKey
      ? nextColumnKey
      : formula.columnKey
    const rewrittenReferences = rewriteDataGridSpreadsheetFormulaReferences(formula.rawInput, reference => {
      if (!options.isCurrentSheetReference(reference.sheetReference)) {
        return null
      }
      const nextReferenceName = reference.referenceName === previousColumnKey
        ? nextColumnKey
        : reference.referenceName
      const nextRangeReferenceName = reference.rangeReferenceName === previousColumnKey
        ? nextColumnKey
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
    }, {
      currentRowIndex: formula.rowIndex,
      referenceParserOptions: options.referenceParserOptions,
    })
    const rewrittenRawInput = rewriteSpreadsheetColumnRenameFormulaLiterals(
      rewrittenReferences,
      formula.rowIndex,
      previousColumnKey,
      nextColumnKey,
      sheetAliases,
      options.referenceParserOptions,
    )
    if (rewrittenRawInput === formula.rawInput) {
      continue
    }
    changed = true
    options.setStoredRawInput(formula.rowIndex, targetColumnKey, rewrittenRawInput)
  }

  return changed
}

export function hasCurrentSheetAbsoluteReferencesAtOrAfter(
  runtimeModel: DataGridSpreadsheetCellFormulaRuntimeModel,
  rowIndex: number,
  isCurrentSheetReference: (sheetReference: string | null | undefined) => boolean,
): boolean {
  return runtimeModel.bindings.some(binding => (
    binding.kind === "reference"
    && isCurrentSheetReference(binding.sheetReference)
    && (
      (binding.rowSelector.kind === "absolute" && binding.rowSelector.rowIndex >= rowIndex)
      || (binding.rowSelector.kind === "absolute-window" && binding.rowSelector.endRowIndex >= rowIndex)
    )
  ))
}
