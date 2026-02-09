export type DataGridEditableValueStrategy<TRow> =
  | {
      kind: "text"
      apply: (row: TRow, draft: string) => void
      canPaste?: (draft: string) => boolean
      clearable?: boolean
      clear?: (row: TRow) => boolean
    }
  | {
      kind: "enum"
      isAllowed: (draft: string) => boolean
      apply: (row: TRow, draft: string) => void
      clearable?: boolean
      clear?: (row: TRow) => boolean
    }
  | {
      kind: "number"
      parse?: (draft: string) => number | null
      apply: (row: TRow, numericValue: number) => void
      clearable?: boolean
      clear?: (row: TRow) => boolean
    }

export interface UseDataGridEditableValuePolicyOptions<TRow, TColumnKey extends string> {
  strategies: Readonly<Record<TColumnKey, DataGridEditableValueStrategy<TRow>>>
  defaultClearable?: boolean
}

export interface UseDataGridEditableValuePolicyResult<TRow, TColumnKey extends string> {
  hasEditablePolicy: (columnKey: string) => columnKey is TColumnKey
  applyEditedValue: (row: TRow, columnKey: TColumnKey, draft: string) => void
  canApplyPastedValue: (columnKey: TColumnKey, draft: string) => boolean
  isColumnClearableForCut: (columnKey: TColumnKey) => boolean
  clearEditedValue: (row: TRow, columnKey: TColumnKey) => boolean
}

function parseFiniteNumber(draft: string): number | null {
  const value = Number(draft)
  return Number.isFinite(value) ? value : null
}

export function useDataGridEditableValuePolicy<TRow, TColumnKey extends string>(
  options: UseDataGridEditableValuePolicyOptions<TRow, TColumnKey>,
): UseDataGridEditableValuePolicyResult<TRow, TColumnKey> {
  const policyKeys = new Set(Object.keys(options.strategies) as TColumnKey[])
  const defaultClearable = options.defaultClearable ?? true

  function hasEditablePolicy(columnKey: string): columnKey is TColumnKey {
    return policyKeys.has(columnKey as TColumnKey)
  }

  function resolveStrategy(columnKey: TColumnKey): DataGridEditableValueStrategy<TRow> | null {
    return options.strategies[columnKey] ?? null
  }

  function applyEditedValue(row: TRow, columnKey: TColumnKey, draft: string): void {
    const strategy = resolveStrategy(columnKey)
    if (!strategy) {
      return
    }
    if (strategy.kind === "text") {
      strategy.apply(row, draft)
      return
    }
    if (strategy.kind === "enum") {
      if (!strategy.isAllowed(draft)) {
        return
      }
      strategy.apply(row, draft)
      return
    }
    const parsed = strategy.parse ? strategy.parse(draft) : parseFiniteNumber(draft)
    if (parsed === null) {
      return
    }
    strategy.apply(row, parsed)
  }

  function canApplyPastedValue(columnKey: TColumnKey, draft: string): boolean {
    const strategy = resolveStrategy(columnKey)
    if (!strategy) {
      return false
    }
    if (strategy.kind === "text") {
      return strategy.canPaste ? strategy.canPaste(draft) : draft.trim().length > 0
    }
    if (strategy.kind === "enum") {
      return strategy.isAllowed(draft)
    }
    const parsed = strategy.parse ? strategy.parse(draft) : parseFiniteNumber(draft)
    return parsed !== null
  }

  function isColumnClearableForCut(columnKey: TColumnKey): boolean {
    const strategy = resolveStrategy(columnKey)
    if (!strategy || typeof strategy.clearable === "undefined") {
      return defaultClearable
    }
    return strategy.clearable
  }

  function clearEditedValue(row: TRow, columnKey: TColumnKey): boolean {
    const strategy = resolveStrategy(columnKey)
    if (!strategy) {
      return false
    }
    if (strategy.clear) {
      return strategy.clear(row)
    }
    if (!isColumnClearableForCut(columnKey)) {
      return false
    }
    if (strategy.kind === "text") {
      const record = row as unknown as Record<string, unknown>
      const current = record[columnKey]
      if (current == null || String(current) === "") {
        return false
      }
      record[columnKey] = ""
      return true
    }
    if (strategy.kind === "number") {
      const record = row as unknown as Record<string, unknown>
      const current = record[columnKey]
      if (typeof current !== "number" || current === 0) {
        return false
      }
      record[columnKey] = 0
      return true
    }
    return false
  }

  return {
    hasEditablePolicy,
    applyEditedValue,
    canApplyPastedValue,
    isColumnClearableForCut,
    clearEditedValue,
  }
}
