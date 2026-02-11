import { ref, type Ref } from "vue"
import type {
  DataGridAdvancedFilterCondition,
  DataGridAdvancedFilterExpression,
  DataGridColumnDef,
} from "@affino/datagrid-core"
import type {
  AffinoDataGridFilteringHelpers,
  AffinoDataGridFilterMergeMode,
  AffinoDataGridHeaderFilterOperatorEntry,
  AffinoDataGridHeaderFilterValueEntry,
  AffinoDataGridSetFilterValueMode,
} from "../../useAffinoDataGrid.types"
import type { UseAffinoDataGridFeatureSuiteResult } from "./useAffinoDataGridFeatureSuite"

const DEFAULT_HEADER_FILTER_OPERATORS: Record<
  "text" | "number" | "date" | "set",
  readonly AffinoDataGridHeaderFilterOperatorEntry[]
> = {
  text: [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "startsWith", label: "Starts with" },
    { value: "endsWith", label: "Ends with" },
  ],
  number: [
    { value: "equals", label: "Equals" },
    { value: "notEquals", label: "Not equals" },
    { value: "gt", label: "Greater than" },
    { value: "gte", label: "Greater than or equal" },
    { value: "lt", label: "Less than" },
    { value: "lte", label: "Less than or equal" },
    { value: "between", label: "Between" },
  ],
  date: [
    { value: "equals", label: "Equals" },
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "between", label: "Between" },
  ],
  set: [
    { value: "in", label: "In list" },
    { value: "notIn", label: "Not in list" },
  ],
}

interface AffinoDataGridHeaderFilterState {
  open: boolean
  columnKey: string | null
  query: string
  operator: string
  type: "text" | "number" | "date" | "set"
}

export interface UseAffinoDataGridHeaderFiltersOptions<TRow> {
  enabled: boolean
  maxUniqueValues: number
  rows: Ref<readonly TRow[]>
  columns: Ref<readonly DataGridColumnDef[]>
  featureSuite: UseAffinoDataGridFeatureSuiteResult<TRow>
  filteringHelpers: AffinoDataGridFilteringHelpers
  stableSerialize: (value: unknown) => string
  findSetConditionValuesByKey: (
    expression: DataGridAdvancedFilterExpression | null | undefined,
    columnKeyRaw: string,
  ) => readonly unknown[]
  pushFeedback: (event: {
    source: "header-filter"
    action: string
    message: string
    ok?: boolean
  }) => void
}

export interface UseAffinoDataGridHeaderFiltersResult {
  enabled: Ref<boolean>
  state: Ref<AffinoDataGridHeaderFilterState>
  open: (columnKey: string) => boolean
  close: () => void
  toggle: (columnKey: string) => boolean
  setQuery: (query: string) => void
  setOperator: (operator: string) => void
  getOperators: (columnKey: string) => readonly AffinoDataGridHeaderFilterOperatorEntry[]
  getUniqueValues: (columnKey: string) => readonly AffinoDataGridHeaderFilterValueEntry[]
  setValueSelected: (
    columnKey: string,
    value: unknown,
    selected: boolean,
    options?: { mode?: AffinoDataGridSetFilterValueMode },
  ) => DataGridAdvancedFilterExpression | null
  selectOnlyValue: (columnKey: string, value: unknown) => DataGridAdvancedFilterExpression | null
  selectAllValues: (columnKey: string) => DataGridAdvancedFilterExpression | null
  clearValues: (columnKey: string) => DataGridAdvancedFilterExpression | null
  applyText: (
    columnKey: string,
    options: { operator?: string; value?: unknown; mergeMode?: AffinoDataGridFilterMergeMode },
  ) => DataGridAdvancedFilterExpression | null
  applyNumber: (
    columnKey: string,
    options: { operator?: string; value?: unknown; value2?: unknown; mergeMode?: AffinoDataGridFilterMergeMode },
  ) => DataGridAdvancedFilterExpression | null
  applyDate: (
    columnKey: string,
    options: { operator?: string; value?: unknown; value2?: unknown; mergeMode?: AffinoDataGridFilterMergeMode },
  ) => DataGridAdvancedFilterExpression | null
  clear: (columnKey: string) => DataGridAdvancedFilterExpression | null
}

function isRecordRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

export function useAffinoDataGridHeaderFilters<TRow>(
  options: UseAffinoDataGridHeaderFiltersOptions<TRow>,
): UseAffinoDataGridHeaderFiltersResult {
  const headerFiltersEnabled = ref(options.enabled)
  const headerFilterState = ref<AffinoDataGridHeaderFilterState>({
    open: false,
    columnKey: null,
    query: "",
    operator: "contains",
    type: "text",
  })

  const resolveColumnByKey = (columnKey: string): DataGridColumnDef | null => (
    options.columns.value.find(column => column.key === columnKey) ?? null
  )

  const resolveHeaderFilterType = (columnKey: string): "text" | "number" | "date" | "set" => {
    const column = resolveColumnByKey(columnKey)
    const meta = (column?.meta ?? {}) as Record<string, unknown>
    const explicitType = meta.filterType ?? meta.filterKind
    if (explicitType === "set" || explicitType === "enum") {
      return "set"
    }
    if (explicitType === "number") {
      return "number"
    }
    if (explicitType === "date") {
      return "date"
    }
    if (Array.isArray(meta.options)) {
      return "set"
    }
    for (const row of options.rows.value) {
      if (!isRecordRow(row)) {
        continue
      }
      const value = row[columnKey]
      if (typeof value === "number") {
        return "number"
      }
      if (value instanceof Date) {
        return "date"
      }
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return "date"
      }
    }
    return "text"
  }

  const resolveHeaderFilterOperators = (
    columnKey: string,
  ): readonly AffinoDataGridHeaderFilterOperatorEntry[] => {
    const type = resolveHeaderFilterType(columnKey)
    return DEFAULT_HEADER_FILTER_OPERATORS[type]
  }

  const setHeaderFilterQuery = (query: string): void => {
    headerFilterState.value = {
      ...headerFilterState.value,
      query,
    }
  }

  const setHeaderFilterOperator = (operator: string): void => {
    headerFilterState.value = {
      ...headerFilterState.value,
      operator,
    }
  }

  const openHeaderFilter = (columnKey: string): boolean => {
    if (!headerFiltersEnabled.value || !columnKey) {
      return false
    }
    const type = resolveHeaderFilterType(columnKey)
    const operators = resolveHeaderFilterOperators(columnKey)
    headerFilterState.value = {
      open: true,
      columnKey,
      query: "",
      operator: operators[0]?.value ?? "contains",
      type,
    }
    options.pushFeedback({
      source: "header-filter",
      action: "open",
      message: `Filter menu: ${columnKey}`,
      ok: true,
    })
    return true
  }

  const closeHeaderFilter = (): void => {
    if (!headerFilterState.value.open) {
      return
    }
    headerFilterState.value = {
      ...headerFilterState.value,
      open: false,
    }
  }

  const toggleHeaderFilter = (columnKey: string): boolean => {
    if (
      headerFilterState.value.open
      && headerFilterState.value.columnKey === columnKey
    ) {
      closeHeaderFilter()
      return false
    }
    return openHeaderFilter(columnKey)
  }

  const getHeaderFilterUniqueValues = (
    columnKey: string,
  ): readonly AffinoDataGridHeaderFilterValueEntry[] => {
    const counts = new Map<string, { value: unknown; count: number }>()
    for (const row of options.rows.value) {
      if (!isRecordRow(row)) {
        continue
      }
      const value = row[columnKey]
      const key = options.stableSerialize(value)
      const existing = counts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, { value, count: 1 })
      }
    }
    const selectedSet = new Set(options.findSetConditionValuesByKey(
      options.featureSuite.filterModel.value?.advancedExpression,
      columnKey,
    ).map(value => options.stableSerialize(value)))
    const query = headerFilterState.value.query.trim().toLowerCase()
    return Array.from(counts.entries())
      .map(([key, entry]) => ({
        key,
        value: entry.value,
        label: String(entry.value ?? ""),
        count: entry.count,
        selected: selectedSet.has(key),
      }))
      .filter(entry => {
        if (!query) {
          return true
        }
        return entry.label.toLowerCase().includes(query)
      })
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, options.maxUniqueValues)
  }

  const setHeaderFilterValueSelected = (
    columnKey: string,
    value: unknown,
    selected: boolean,
    valueOptions: { mode?: AffinoDataGridSetFilterValueMode } = {},
  ): DataGridAdvancedFilterExpression | null => {
    const mode = selected ? (valueOptions.mode ?? "append") : "remove"
    const next = options.filteringHelpers.setSet(columnKey, [value], {
      valueMode: mode,
      mergeMode: "merge-and",
    })
    options.pushFeedback({
      source: "header-filter",
      action: "set-value",
      message: `${selected ? "Selected" : "Unselected"} ${String(value ?? "")}`,
      ok: true,
    })
    return next
  }

  const clearHeaderFilterValues = (columnKey: string): DataGridAdvancedFilterExpression | null => {
    const next = options.filteringHelpers.clearByKey(columnKey)
    options.pushFeedback({
      source: "header-filter",
      action: "clear",
      message: `Filter cleared: ${columnKey}`,
      ok: true,
    })
    return next
  }

  const selectAllHeaderFilterValues = (columnKey: string): DataGridAdvancedFilterExpression | null => (
    clearHeaderFilterValues(columnKey)
  )

  const selectOnlyHeaderFilterValue = (
    columnKey: string,
    value: unknown,
  ): DataGridAdvancedFilterExpression | null => {
    const next = options.filteringHelpers.setSet(columnKey, [value], {
      valueMode: "replace",
      mergeMode: "merge-and",
    })
    options.pushFeedback({
      source: "header-filter",
      action: "select-only",
      message: `Filter only: ${String(value ?? "")}`,
      ok: true,
    })
    return next
  }

  const applyHeaderTextFilter = (
    columnKey: string,
    filterOptions: { operator?: string; value?: unknown; mergeMode?: AffinoDataGridFilterMergeMode },
  ): DataGridAdvancedFilterExpression | null => {
    const next = options.filteringHelpers.setText(columnKey, filterOptions)
    options.pushFeedback({
      source: "header-filter",
      action: "apply-text",
      message: `Text filter applied: ${columnKey}`,
      ok: true,
    })
    return next
  }

  const applyHeaderNumberFilter = (
    columnKey: string,
    filterOptions: {
      operator?: string
      value?: unknown
      value2?: unknown
      mergeMode?: AffinoDataGridFilterMergeMode
    },
  ): DataGridAdvancedFilterExpression | null => {
    const next = options.filteringHelpers.setNumber(columnKey, filterOptions)
    options.pushFeedback({
      source: "header-filter",
      action: "apply-number",
      message: `Number filter applied: ${columnKey}`,
      ok: true,
    })
    return next
  }

  const applyHeaderDateFilter = (
    columnKey: string,
    filterOptions: {
      operator?: string
      value?: unknown
      value2?: unknown
      mergeMode?: AffinoDataGridFilterMergeMode
    },
  ): DataGridAdvancedFilterExpression | null => {
    const next = options.filteringHelpers.setDate(columnKey, filterOptions)
    options.pushFeedback({
      source: "header-filter",
      action: "apply-date",
      message: `Date filter applied: ${columnKey}`,
      ok: true,
    })
    return next
  }

  return {
    enabled: headerFiltersEnabled,
    state: headerFilterState,
    open: openHeaderFilter,
    close: closeHeaderFilter,
    toggle: toggleHeaderFilter,
    setQuery: setHeaderFilterQuery,
    setOperator: setHeaderFilterOperator,
    getOperators: resolveHeaderFilterOperators,
    getUniqueValues: getHeaderFilterUniqueValues,
    setValueSelected: setHeaderFilterValueSelected,
    selectOnlyValue: selectOnlyHeaderFilterValue,
    selectAllValues: selectAllHeaderFilterValues,
    clearValues: clearHeaderFilterValues,
    applyText: applyHeaderTextFilter,
    applyNumber: applyHeaderNumberFilter,
    applyDate: applyHeaderDateFilter,
    clear: clearHeaderFilterValues,
  }
}
