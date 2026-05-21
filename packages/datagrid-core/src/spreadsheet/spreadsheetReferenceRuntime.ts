import { normalizeFormulaReference } from "../models/formula/formulaEngine.js"

const COMPILED_FORMULA_REFERENCE_TOKEN_PREFIX = "__spreadsheet_ref_"

export interface SpreadsheetColumnReferenceSource {
  key: string
  formulaAlias?: string | null
}

export function normalizeSheetIdentity(value: unknown): string | null {
  const normalized = String(value ?? "").trim()
  return normalized.length === 0 ? null : normalized
}

export function createCompiledFormulaReferenceToken(index: number): string {
  return `${COMPILED_FORMULA_REFERENCE_TOKEN_PREFIX}${index}`
}

export function resolveCompiledFormulaReferenceTokenIndex(token: string): number | null {
  if (!token.startsWith(COMPILED_FORMULA_REFERENCE_TOKEN_PREFIX)) {
    return null
  }
  const suffix = token.slice(COMPILED_FORMULA_REFERENCE_TOKEN_PREFIX.length)
  const index = Number.parseInt(suffix, 10)
  return Number.isInteger(index) && index >= 0 ? index : null
}

export function normalizeColumnKey(value: unknown): string {
  const normalized = String(value ?? "").trim()
  if (normalized.length === 0) {
    throw new Error("[DataGridSpreadsheetSheet] column key must be non-empty.")
  }
  return normalized
}

export function normalizeColumnTitle(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim()
  return normalized.length === 0 ? fallback : normalized
}

export function normalizeColumnFormulaAlias(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim()
  return normalized.length === 0 ? fallback : normalized
}

export function normalizeFormulaReferenceLookupName(referenceName: unknown): string {
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

export function resolveColumnFormulaReferenceName(column: SpreadsheetColumnReferenceSource): string {
  const normalizedFormulaAlias = String(column.formulaAlias ?? "").trim()
  return normalizedFormulaAlias.length > 0 ? normalizedFormulaAlias : column.key
}

export function buildSpreadsheetColumnReferenceLookup(
  availableColumns: readonly SpreadsheetColumnReferenceSource[],
): ReadonlyMap<string, string> {
  const keyByReferenceName = new Map<string, string>()
  const aliasCandidates = new Map<string, Set<string>>()

  for (const column of availableColumns) {
    const normalizedKeyReferenceName = normalizeFormulaReferenceLookupName(column.key)
    if (normalizedKeyReferenceName.length > 0) {
      keyByReferenceName.set(normalizedKeyReferenceName, column.key)
    }
  }

  for (const column of availableColumns) {
    const normalizedAliasReferenceName = normalizeFormulaReferenceLookupName(resolveColumnFormulaReferenceName(column))
    const normalizedKeyReferenceName = normalizeFormulaReferenceLookupName(column.key)
    if (
      normalizedAliasReferenceName.length === 0
      || normalizedAliasReferenceName === normalizedKeyReferenceName
    ) {
      continue
    }
    const candidates = aliasCandidates.get(normalizedAliasReferenceName) ?? new Set<string>()
    candidates.add(column.key)
    aliasCandidates.set(normalizedAliasReferenceName, candidates)
  }

  for (const [referenceName, candidateKeys] of aliasCandidates.entries()) {
    if (candidateKeys.size !== 1 || keyByReferenceName.has(referenceName)) {
      continue
    }
    const [columnKey] = candidateKeys
    if (columnKey) {
      keyByReferenceName.set(referenceName, columnKey)
    }
  }

  return keyByReferenceName
}

export function resolveSpreadsheetColumnReferenceKey(
  referenceName: string,
  availableColumns: readonly SpreadsheetColumnReferenceSource[],
  lookup: ReadonlyMap<string, string> = buildSpreadsheetColumnReferenceLookup(availableColumns),
): string | null {
  const normalizedReferenceName = normalizeFormulaReferenceLookupName(referenceName)
  if (normalizedReferenceName.length === 0) {
    return null
  }
  return lookup.get(normalizedReferenceName) ?? null
}

export function resolveSpreadsheetColumnKeysForReferenceRange(
  startReferenceName: string,
  endReferenceName: string | null | undefined,
  availableColumns: readonly SpreadsheetColumnReferenceSource[],
  lookup: ReadonlyMap<string, string> = buildSpreadsheetColumnReferenceLookup(availableColumns),
): readonly string[] {
  const startColumnKey = resolveSpreadsheetColumnReferenceKey(startReferenceName, availableColumns, lookup)
  if (!startColumnKey) {
    return Object.freeze([])
  }
  const endColumnKey = endReferenceName
    ? resolveSpreadsheetColumnReferenceKey(endReferenceName, availableColumns, lookup) ?? startColumnKey
    : startColumnKey
  if (endColumnKey === startColumnKey) {
    return Object.freeze([startColumnKey])
  }
  const startIndex = availableColumns.findIndex(column => column.key === startColumnKey)
  const endIndex = availableColumns.findIndex(column => column.key === endColumnKey)
  if (startIndex < 0 || endIndex < 0) {
    return Object.freeze([startColumnKey])
  }
  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
  return Object.freeze(availableColumns.slice(from, to + 1).map(column => column.key))
}

export function normalizeSpreadsheetSheetReferenceAlias(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}
