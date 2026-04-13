import type { DataGridSpreadsheetFormulaReferenceSpan } from "./formulaEditorModel.js"

export interface DataGridSpreadsheetFormulaReferenceSheetColumn {
  key: string
}

export interface DataGridSpreadsheetFormulaReferenceSheet {
  id: string
  columns: readonly DataGridSpreadsheetFormulaReferenceSheetColumn[]
}

export interface DataGridSpreadsheetFormulaReferenceBounds {
  referenceKey: string
  referencedSheetId: string
  startRowIndex: number
  endRowIndex: number
  startColumnIndex: number
  endColumnIndex: number
  startColumnKey: string
  endColumnKey: string
}

export interface ResolveDataGridSpreadsheetFormulaReferenceBoundsOptions {
  resolveSheet: (
    reference: Pick<DataGridSpreadsheetFormulaReferenceSpan, "sheetReference">,
  ) => DataGridSpreadsheetFormulaReferenceSheet | null
  activeSheetId?: string | null
  requireActiveSheet?: boolean
}

export interface CreateDataGridSpreadsheetFormulaReferenceDecorationsOptions
  extends ResolveDataGridSpreadsheetFormulaReferenceBoundsOptions {
  activeReferenceKey?: string | null
}

export interface DataGridSpreadsheetFormulaReferenceDecoration
  extends DataGridSpreadsheetFormulaReferenceBounds {
  colorIndex: number
  active: boolean
}

export function resolveDataGridSpreadsheetFormulaReferenceBounds(
  reference: Pick<
    DataGridSpreadsheetFormulaReferenceSpan,
    "key" | "sheetReference" | "referenceName" | "rangeReferenceName" | "targetRowIndexes"
  >,
  options: ResolveDataGridSpreadsheetFormulaReferenceBoundsOptions,
): DataGridSpreadsheetFormulaReferenceBounds | null {
  const referencedSheet = options.resolveSheet(reference)
  if (!referencedSheet) {
    return null
  }
  if (options.requireActiveSheet === true && referencedSheet.id !== options.activeSheetId) {
    return null
  }

  const rowIndexes = reference.targetRowIndexes.filter((rowIndex): rowIndex is number => (
    Number.isInteger(rowIndex) && rowIndex >= 0
  ))
  if (rowIndexes.length === 0) {
    return null
  }

  const startRowIndex = Math.min(...rowIndexes)
  const endRowIndex = Math.max(...rowIndexes)
  const startColumnIndex = referencedSheet.columns.findIndex(column => column.key === reference.referenceName)
  const requestedEndColumnKey = reference.rangeReferenceName && reference.rangeReferenceName !== reference.referenceName
    ? reference.rangeReferenceName
    : reference.referenceName
  const requestedEndColumnIndex = referencedSheet.columns.findIndex(column => column.key === requestedEndColumnKey)
  if (startColumnIndex < 0 || requestedEndColumnIndex < 0) {
    return null
  }

  const [fromColumnIndex, toColumnIndex] = startColumnIndex <= requestedEndColumnIndex
    ? [startColumnIndex, requestedEndColumnIndex]
    : [requestedEndColumnIndex, startColumnIndex]
  const startColumnKey = referencedSheet.columns[fromColumnIndex]?.key
  const endColumnKey = referencedSheet.columns[toColumnIndex]?.key
  if (!startColumnKey || !endColumnKey) {
    return null
  }

  return Object.freeze({
    referenceKey: reference.key,
    referencedSheetId: referencedSheet.id,
    startRowIndex,
    endRowIndex,
    startColumnIndex: fromColumnIndex,
    endColumnIndex: toColumnIndex,
    startColumnKey,
    endColumnKey,
  })
}

export function createDataGridSpreadsheetFormulaReferenceDecorations(
  references: readonly DataGridSpreadsheetFormulaReferenceSpan[],
  options: CreateDataGridSpreadsheetFormulaReferenceDecorationsOptions,
): readonly DataGridSpreadsheetFormulaReferenceDecoration[] {
  return Object.freeze(references
    .map(reference => {
      const bounds = resolveDataGridSpreadsheetFormulaReferenceBounds(reference, options)
      if (!bounds) {
        return null
      }
      return Object.freeze({
        ...bounds,
        colorIndex: reference.colorIndex,
        active: reference.key === options.activeReferenceKey,
      })
    })
    .filter((decoration): decoration is DataGridSpreadsheetFormulaReferenceDecoration => decoration != null))
}