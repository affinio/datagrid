import {
  evaluateColumnPredicateFilter,
  serializeColumnValueToToken,
  type DataGridColumnPredicateFilter,
  type DataGridFilterSnapshot,
} from "@affino/datagrid-core"

export type DataGridColumnFilterKind = "text" | "enum" | "number"

export interface DataGridAppliedColumnFilter {
  kind: DataGridColumnFilterKind
  operator: string
  value: string
  value2?: string
  valueTokens?: string[]
}

export interface DataGridColumnFilterDraft {
  columnKey: string
  kind: DataGridColumnFilterKind
  operator: string
  value: string
  value2: string
  valueTokens: string[]
}

export interface DataGridFilterOperatorOption {
  value: string
  label: string
}

export interface DataGridColumnFilterSnapshot {
  activeFilterColumnKey: string | null
  columnFilterDraft: DataGridColumnFilterDraft | null
  appliedColumnFilters: Record<string, DataGridAppliedColumnFilter>
  activeColumnFilterCount: number
  hasColumnFilters: boolean
  activeFilterColumnLabel: string
  columnFilterOperatorOptions: readonly DataGridFilterOperatorOption[]
  activeColumnFilterEnumOptions: string[]
  canApplyActiveColumnFilter: boolean
}

export interface UseDataGridColumnFilterOrchestrationOptions<TRow> {
  resolveColumnFilterKind: (columnKey: string) => DataGridColumnFilterKind
  resolveEnumFilterOptions: (columnKey: string) => string[]
  resolveColumnLabel: (columnKey: string) => string | null | undefined
  resolveCellValue: (row: TRow, columnKey: string) => unknown
  isFilterableColumn?: (columnKey: string) => boolean
  setLastAction?: (message: string) => void
  initialAppliedFilters?: Record<string, DataGridAppliedColumnFilter>
  resolveInputValue?: (value: unknown) => string
}

export interface UseDataGridColumnFilterOrchestrationResult<TRow> {
  getSnapshot: () => DataGridColumnFilterSnapshot
  subscribe: (listener: (snapshot: DataGridColumnFilterSnapshot) => void) => () => void
  isColumnFilterActive: (columnKey: string) => boolean
  openColumnFilter: (columnKey: string) => void
  onHeaderFilterTriggerClick: (columnKey: string) => void
  closeColumnFilterPanel: () => void
  onFilterOperatorChange: (value: string | number) => void
  onFilterEnumValueChange: (value: string | number) => void
  onFilterValueInput: (value: unknown) => void
  onFilterSecondValueInput: (value: unknown) => void
  setActiveValueSetTokens: (tokens: readonly string[], options?: { operator?: "in-list" | "not-in-list" }) => void
  doesOperatorNeedSecondValue: (kind: DataGridColumnFilterKind, operator: string) => boolean
  doesFilterDraftHaveRequiredValues: (draft: DataGridColumnFilterDraft) => boolean
  applyActiveColumnFilter: () => void
  resetActiveColumnFilter: () => void
  clearAllColumnFilters: () => void
  buildFilterSnapshot: (filters: Record<string, DataGridAppliedColumnFilter>) => DataGridFilterSnapshot | null
  rowMatchesColumnFilters: (row: TRow, filters: Record<string, DataGridAppliedColumnFilter>) => boolean
}

export const DATA_GRID_TEXT_FILTER_OPERATOR_OPTIONS: readonly DataGridFilterOperatorOption[] = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "starts-with", label: "Starts with" },
  { value: "in-list", label: "In list" },
  { value: "not-in-list", label: "Not in list" },
] as const

export const DATA_GRID_ENUM_FILTER_OPERATOR_OPTIONS: readonly DataGridFilterOperatorOption[] = [
  { value: "is", label: "Is" },
  { value: "is-not", label: "Is not" },
  { value: "in-list", label: "In list" },
  { value: "not-in-list", label: "Not in list" },
] as const

export const DATA_GRID_NUMBER_FILTER_OPERATOR_OPTIONS: readonly DataGridFilterOperatorOption[] = [
  { value: "equals", label: "=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "between", label: "Between" },
] as const

function defaultFilterOperator(kind: DataGridColumnFilterKind): string {
  if (kind === "number") return "equals"
  if (kind === "enum") return "is"
  return "contains"
}

function resolveDefaultInputValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }
  if (value && typeof value === "object") {
    const target = (value as { target?: { value?: unknown } }).target
    if (target && typeof target.value !== "undefined") {
      return String(target.value ?? "")
    }
  }
  return ""
}

function normalizeTokenList(tokens: readonly string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const token of tokens) {
    const value = String(token ?? "")
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    normalized.push(value)
  }
  return normalized
}

function mapOperatorToPredicateOperator(
  operator: string,
): "contains" | "startsWith" | "equals" | "notEquals" | "gt" | "gte" | "lt" | "lte" | "between" | null {
  if (operator === "contains") return "contains"
  if (operator === "starts-with") return "startsWith"
  if (operator === "equals" || operator === "is") return "equals"
  if (operator === "is-not") return "notEquals"
  if (operator === "between") return "between"
  if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") return operator
  return null
}

function createPredicateFilterFromAppliedFilter(
  filter: DataGridAppliedColumnFilter,
): DataGridColumnPredicateFilter | null {
  const predicateOperator = mapOperatorToPredicateOperator(filter.operator)
  if (!predicateOperator) {
    return null
  }
  return {
    kind: "predicate",
    operator: predicateOperator,
    value: filter.value,
    value2: filter.value2,
  }
}

export function useDataGridColumnFilterOrchestration<TRow>(
  options: UseDataGridColumnFilterOrchestrationOptions<TRow>,
): UseDataGridColumnFilterOrchestrationResult<TRow> {
  let activeFilterColumnKey: string | null = null
  let columnFilterDraft: DataGridColumnFilterDraft | null = null
  let appliedColumnFilters: Record<string, DataGridAppliedColumnFilter> = {
    ...(options.initialAppliedFilters ?? {}),
  }

  const listeners = new Set<(snapshot: DataGridColumnFilterSnapshot) => void>()
  const resolveInputValue = options.resolveInputValue ?? resolveDefaultInputValue

  function doesOperatorNeedSecondValue(kind: DataGridColumnFilterKind, operator: string): boolean {
    return kind === "number" && operator === "between"
  }

  function doesFilterDraftHaveRequiredValues(draft: DataGridColumnFilterDraft): boolean {
    if (draft.operator === "in-list" || draft.operator === "not-in-list") {
      return draft.valueTokens.length > 0
    }
    if (!draft.value.trim()) {
      return false
    }
    if (doesOperatorNeedSecondValue(draft.kind, draft.operator) && !draft.value2.trim()) {
      return false
    }
    return true
  }

  function resolveOperatorOptions(draft: DataGridColumnFilterDraft | null): readonly DataGridFilterOperatorOption[] {
    if (!draft) {
      return []
    }
    if (draft.kind === "number") {
      return DATA_GRID_NUMBER_FILTER_OPERATOR_OPTIONS
    }
    if (draft.kind === "enum") {
      return DATA_GRID_ENUM_FILTER_OPERATOR_OPTIONS
    }
    return DATA_GRID_TEXT_FILTER_OPERATOR_OPTIONS
  }

  function createSnapshot(): DataGridColumnFilterSnapshot {
    const activeColumnFilterCount = Object.keys(appliedColumnFilters).length
    return {
      activeFilterColumnKey,
      columnFilterDraft,
      appliedColumnFilters,
      activeColumnFilterCount,
      hasColumnFilters: activeColumnFilterCount > 0,
      activeFilterColumnLabel: activeFilterColumnKey
        ? (options.resolveColumnLabel(activeFilterColumnKey) ?? activeFilterColumnKey)
        : "none",
      columnFilterOperatorOptions: resolveOperatorOptions(columnFilterDraft),
      activeColumnFilterEnumOptions: columnFilterDraft?.kind === "enum"
        ? options.resolveEnumFilterOptions(columnFilterDraft.columnKey)
        : [],
      canApplyActiveColumnFilter: columnFilterDraft ? doesFilterDraftHaveRequiredValues(columnFilterDraft) : false,
    }
  }

  function emit() {
    const snapshot = createSnapshot()
    listeners.forEach(listener => listener(snapshot))
  }

  function subscribe(listener: (snapshot: DataGridColumnFilterSnapshot) => void): () => void {
    listeners.add(listener)
    listener(createSnapshot())
    return () => {
      listeners.delete(listener)
    }
  }

  function closeColumnFilterPanel() {
    activeFilterColumnKey = null
    columnFilterDraft = null
    emit()
  }

  function openColumnFilter(columnKey: string) {
    if (options.isFilterableColumn && !options.isFilterableColumn(columnKey)) {
      return
    }
    const kind = options.resolveColumnFilterKind(columnKey)
    const current = appliedColumnFilters[columnKey]
    const enumOptions = kind === "enum" ? options.resolveEnumFilterOptions(columnKey) : []
    columnFilterDraft = {
      columnKey,
      kind,
      operator: current?.operator ?? defaultFilterOperator(kind),
      value: current?.value ?? (enumOptions[0] ?? ""),
      value2: current?.value2 ?? "",
      valueTokens: [...(current?.valueTokens ?? [])],
    }
    activeFilterColumnKey = columnKey
    emit()
  }

  function onHeaderFilterTriggerClick(columnKey: string) {
    if (activeFilterColumnKey === columnKey) {
      closeColumnFilterPanel()
      return
    }
    openColumnFilter(columnKey)
  }

  function onFilterOperatorChange(value: string | number) {
    if (!columnFilterDraft) {
      return
    }
    const nextOperator = String(value)
    columnFilterDraft = {
      ...columnFilterDraft,
      operator: nextOperator,
      value2: doesOperatorNeedSecondValue(columnFilterDraft.kind, nextOperator) ? columnFilterDraft.value2 : "",
      valueTokens: (nextOperator === "in-list" || nextOperator === "not-in-list")
        ? columnFilterDraft.valueTokens
        : [],
    }
    emit()
  }

  function onFilterEnumValueChange(value: string | number) {
    if (!columnFilterDraft) {
      return
    }
    columnFilterDraft = {
      ...columnFilterDraft,
      value: String(value),
      valueTokens: [],
    }
    emit()
  }

  function onFilterValueInput(value: unknown) {
    if (!columnFilterDraft) {
      return
    }
    columnFilterDraft = {
      ...columnFilterDraft,
      value: resolveInputValue(value),
      valueTokens: [],
    }
    emit()
  }

  function onFilterSecondValueInput(value: unknown) {
    if (!columnFilterDraft) {
      return
    }
    columnFilterDraft = {
      ...columnFilterDraft,
      value2: resolveInputValue(value),
    }
    emit()
  }

  function setActiveValueSetTokens(
    tokens: readonly string[],
    options: { operator?: "in-list" | "not-in-list" } = {},
  ) {
    if (!columnFilterDraft) {
      return
    }
    columnFilterDraft = {
      ...columnFilterDraft,
      operator: options.operator ?? "in-list",
      valueTokens: normalizeTokenList(tokens),
      value: "",
      value2: "",
    }
    emit()
  }

  function applyActiveColumnFilter() {
    if (!columnFilterDraft) {
      return
    }
    const draft = columnFilterDraft
    const next = { ...appliedColumnFilters }
    if (!doesFilterDraftHaveRequiredValues(draft)) {
      delete next[draft.columnKey]
      appliedColumnFilters = next
      options.setLastAction?.(`Cleared filter for ${draft.columnKey}`)
      closeColumnFilterPanel()
      return
    }
    next[draft.columnKey] = {
      kind: draft.kind,
      operator: draft.operator,
      value: draft.value.trim(),
      value2: draft.value2.trim() || undefined,
      valueTokens: [...draft.valueTokens],
    }
    appliedColumnFilters = next
    options.setLastAction?.(`Filter applied: ${draft.columnKey}`)
    closeColumnFilterPanel()
  }

  function resetActiveColumnFilter() {
    if (!columnFilterDraft) {
      return
    }
    const next = { ...appliedColumnFilters }
    delete next[columnFilterDraft.columnKey]
    appliedColumnFilters = next
    options.setLastAction?.(`Filter reset: ${columnFilterDraft.columnKey}`)
    closeColumnFilterPanel()
  }

  function clearAllColumnFilters() {
    if (!Object.keys(appliedColumnFilters).length) {
      closeColumnFilterPanel()
      return
    }
    appliedColumnFilters = {}
    options.setLastAction?.("All column filters cleared")
    closeColumnFilterPanel()
  }

  function isColumnFilterActive(columnKey: string): boolean {
    return Boolean(appliedColumnFilters[columnKey])
  }

  function buildFilterSnapshot(filters: Record<string, DataGridAppliedColumnFilter>): DataGridFilterSnapshot | null {
    const keys = Object.keys(filters)
    if (!keys.length) {
      return null
    }
    const columnFilterEntries: Array<[string, DataGridFilterSnapshot["columnFilters"][string]]> = []
    for (const key of keys) {
      const filter = filters[key]
      if (!filter) {
        continue
      }
      if (filter.operator === "in-list") {
        const tokens = normalizeTokenList(filter.valueTokens ?? [])
        if (tokens.length > 0) {
          columnFilterEntries.push([key, { kind: "valueSet", tokens }])
        }
        continue
      }
      const predicateOperator = mapOperatorToPredicateOperator(filter.operator)
      if (!predicateOperator) {
        continue
      }
      columnFilterEntries.push([
        key,
        {
          kind: "predicate",
          operator: predicateOperator,
          value: filter.value,
          value2: filter.value2,
        },
      ])
    }

    return {
      columnFilters: Object.fromEntries(columnFilterEntries),
      advancedFilters: Object.fromEntries(
        keys.flatMap(key => {
          const filter = filters[key]
          if (!filter || filter.operator === "in-list") {
            return []
          }
          const type = filter.kind === "number" ? "number" : "text"
          return [[
            key,
            {
              type,
              clauses: [
                {
                  operator: filter.operator,
                  value: filter.value,
                  value2: filter.value2,
                },
              ],
            },
          ]]
        }),
      ),
    }
  }

  function rowMatchesColumnFilters(row: TRow, filters: Record<string, DataGridAppliedColumnFilter>): boolean {
    for (const [columnKey, filter] of Object.entries(filters)) {
      const value = options.resolveCellValue(row, columnKey)

      if (
        (filter.operator === "in-list" || filter.operator === "not-in-list")
        && Array.isArray(filter.valueTokens)
        && filter.valueTokens.length > 0
      ) {
        const token = serializeColumnValueToToken(value)
        const contains = filter.valueTokens.includes(token)
        if (filter.operator === "in-list" && !contains) {
          return false
        }
        if (filter.operator === "not-in-list" && contains) {
          return false
        }
        continue
      }

      const predicateFilter = createPredicateFilterFromAppliedFilter(filter)
      if (predicateFilter) {
        if (!evaluateColumnPredicateFilter(predicateFilter, value)) {
          return false
        }
        continue
      }

      // Unknown operator for current contract — treat as non-match for deterministic behavior.
      if (filter.operator) {
        return false
      }
    }
    return true
  }

  return {
    getSnapshot: createSnapshot,
    subscribe,
    isColumnFilterActive,
    openColumnFilter,
    onHeaderFilterTriggerClick,
    closeColumnFilterPanel,
    onFilterOperatorChange,
    onFilterEnumValueChange,
    onFilterValueInput,
    onFilterSecondValueInput,
    setActiveValueSetTokens,
    doesOperatorNeedSecondValue,
    doesFilterDraftHaveRequiredValues,
    applyActiveColumnFilter,
    resetActiveColumnFilter,
    clearAllColumnFilters,
    buildFilterSnapshot,
    rowMatchesColumnFilters,
  }
}
