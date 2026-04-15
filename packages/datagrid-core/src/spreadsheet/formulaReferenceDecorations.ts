import { normalizeFormulaReference } from "../models/formula/formulaEngine.js"
import type { DataGridSpreadsheetFormulaReferenceSpan } from "./formulaEditorModel.js"

export interface DataGridSpreadsheetFormulaReferenceSheetColumn {
  key: string
  formulaAlias?: string | null
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

function normalizeFormulaReferenceLookupName(referenceName: unknown): string {
  const normalized = String(referenceName ?? "").trim()
  if (normalized.length === 0) {
    return ""
  }
  const normalizedReference = normalizeFormulaReference(normalized)
  if (
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(normalizedReference)
    || normalizedReference.includes(".")
    || normalizedReference.includes("[")
    || normalizedReference.includes('"')
  ) {
    return normalizedReference
  }
  return normalizeFormulaReference(`"${normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
}

function buildSpreadsheetColumnReferenceLookup(
  columns: readonly DataGridSpreadsheetFormulaReferenceSheetColumn[],
): ReadonlyMap<string, string> {
  const keyByReferenceName = new Map<string, string>()
  const aliasCandidates = new Map<string, Set<string>>()

  for (const column of columns) {
    const normalizedKeyReferenceName = normalizeFormulaReferenceLookupName(column.key)
    if (normalizedKeyReferenceName.length > 0) {
      keyByReferenceName.set(normalizedKeyReferenceName, column.key)
    }
  }

  for (const column of columns) {
    const normalizedFormulaAlias = String(column.formulaAlias ?? "").trim()
    const normalizedAliasReferenceName = normalizeFormulaReferenceLookupName(
      normalizedFormulaAlias.length > 0 ? normalizedFormulaAlias : column.key,
    )
    const normalizedKeyReferenceName = normalizeFormulaReferenceLookupName(column.key)
    if (
      normalizedAliasReferenceName.length === 0
      || normalizedAliasReferenceName === normalizedKeyReferenceName
      || keyByReferenceName.has(normalizedAliasReferenceName)
    ) {
      continue
    }
    const candidates = aliasCandidates.get(normalizedAliasReferenceName) ?? new Set<string>()
    candidates.add(column.key)
    aliasCandidates.set(normalizedAliasReferenceName, candidates)
  }

  for (const [referenceName, candidateKeys] of aliasCandidates.entries()) {
    if (candidateKeys.size !== 1) {
      continue
    }
    const [columnKey] = candidateKeys
    if (columnKey) {
      keyByReferenceName.set(referenceName, columnKey)
    }
  }

  return keyByReferenceName
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
  const columnLookup = buildSpreadsheetColumnReferenceLookup(referencedSheet.columns)
  const startColumnKey = columnLookup.get(normalizeFormulaReferenceLookupName(reference.referenceName)) ?? null
  const requestedEndColumnKey = reference.rangeReferenceName && reference.rangeReferenceName !== reference.referenceName
    ? columnLookup.get(normalizeFormulaReferenceLookupName(reference.rangeReferenceName)) ?? null
    : startColumnKey
  const startColumnIndex = startColumnKey
    ? referencedSheet.columns.findIndex(column => column.key === startColumnKey)
    : -1
  const requestedEndColumnIndex = requestedEndColumnKey
    ? referencedSheet.columns.findIndex(column => column.key === requestedEndColumnKey)
    : -1
  if (startColumnIndex < 0 || requestedEndColumnIndex < 0) {
    return null
  }

  const [fromColumnIndex, toColumnIndex] = startColumnIndex <= requestedEndColumnIndex
    ? [startColumnIndex, requestedEndColumnIndex]
    : [requestedEndColumnIndex, startColumnIndex]
  const resolvedStartColumnKey = referencedSheet.columns[fromColumnIndex]?.key
  const endColumnKey = referencedSheet.columns[toColumnIndex]?.key
  if (!resolvedStartColumnKey || !endColumnKey) {
    return null
  }

  return Object.freeze({
    referenceKey: reference.key,
    referencedSheetId: referencedSheet.id,
    startRowIndex,
    endRowIndex,
    startColumnIndex: fromColumnIndex,
    endColumnIndex: toColumnIndex,
    startColumnKey: resolvedStartColumnKey,
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