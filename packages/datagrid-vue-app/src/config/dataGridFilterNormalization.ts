import {
  cloneDataGridFilterSnapshot,
  type DataGridFilterSnapshot,
  type DataGridUnifiedState,
} from "@affino/datagrid-vue"

type DataGridColumnFilterEntry = DataGridFilterSnapshot["columnFilters"][string]
type DataGridLegacyAdvancedFilterEntry = DataGridFilterSnapshot["advancedFilters"][string]
type DataGridAdvancedExpressionEntry = NonNullable<DataGridFilterSnapshot["advancedExpression"]>

export interface DataGridAppFilterValueNormalizationContext {
  columnKey: string
  value: unknown
  operator?: string
  source: "column" | "advanced" | "advancedExpression"
  role: "value" | "value2"
}

export interface DataGridAppColumnFilterOptions {
  valueSet?: boolean
  normalizeValue?: (context: DataGridAppFilterValueNormalizationContext) => unknown
}

type FilterColumnLike = {
  key: string
  filter?: DataGridAppColumnFilterOptions | null
}

function resolveColumnFilterOptions(
  columns: readonly FilterColumnLike[],
): ReadonlyMap<string, DataGridAppColumnFilterOptions> {
  const optionsByColumn = new Map<string, DataGridAppColumnFilterOptions>()
  for (const column of columns) {
    if (typeof column?.key !== "string" || !column.filter) {
      continue
    }
    optionsByColumn.set(column.key, column.filter)
  }
  return optionsByColumn
}

function normalizeValue(
  optionsByColumn: ReadonlyMap<string, DataGridAppColumnFilterOptions>,
  context: DataGridAppFilterValueNormalizationContext,
): unknown {
  const normalize = optionsByColumn.get(context.columnKey)?.normalizeValue
  return typeof normalize === "function" ? normalize(context) : context.value
}

function isValueSetAllowed(
  optionsByColumn: ReadonlyMap<string, DataGridAppColumnFilterOptions>,
  columnKey: string,
): boolean {
  return optionsByColumn.get(columnKey)?.valueSet !== false
}

function normalizeColumnFilterEntry(
  optionsByColumn: ReadonlyMap<string, DataGridAppColumnFilterOptions>,
  columnKey: string,
  entry: DataGridColumnFilterEntry,
): DataGridColumnFilterEntry | null {
  if (entry.kind === "valueSet") {
    return isValueSetAllowed(optionsByColumn, columnKey) ? entry : null
  }
  return {
    ...entry,
    value: normalizeValue(optionsByColumn, {
      columnKey,
      value: entry.value,
      operator: entry.operator,
      source: "column",
      role: "value",
    }),
    value2: normalizeValue(optionsByColumn, {
      columnKey,
      value: entry.value2,
      operator: entry.operator,
      source: "column",
      role: "value2",
    }),
  }
}

function normalizeLegacyAdvancedFilterEntry(
  optionsByColumn: ReadonlyMap<string, DataGridAppColumnFilterOptions>,
  columnKey: string,
  entry: DataGridLegacyAdvancedFilterEntry,
): DataGridLegacyAdvancedFilterEntry | null {
  if (entry.type === "set" && !isValueSetAllowed(optionsByColumn, columnKey)) {
    return null
  }
  return {
    ...entry,
    clauses: (entry.clauses ?? []).map(clause => ({
      ...clause,
      value: normalizeValue(optionsByColumn, {
        columnKey,
        value: clause.value,
        operator: clause.operator,
        source: "advanced",
        role: "value",
      }),
      value2: normalizeValue(optionsByColumn, {
        columnKey,
        value: clause.value2,
        operator: clause.operator,
        source: "advanced",
        role: "value2",
      }),
    })),
  }
}

function normalizeAdvancedExpression(
  optionsByColumn: ReadonlyMap<string, DataGridAppColumnFilterOptions>,
  expression: DataGridAdvancedExpressionEntry | null | undefined,
): DataGridAdvancedExpressionEntry | null {
  if (!expression) {
    return null
  }
  if (expression.kind === "condition") {
    const columnKey = expression.key
    if (expression.type === "set" && !isValueSetAllowed(optionsByColumn, columnKey)) {
      return null
    }
    return {
      ...expression,
      value: normalizeValue(optionsByColumn, {
        columnKey,
        value: expression.value,
        operator: expression.operator,
        source: "advancedExpression",
        role: "value",
      }),
      value2: normalizeValue(optionsByColumn, {
        columnKey,
        value: expression.value2,
        operator: expression.operator,
        source: "advancedExpression",
        role: "value2",
      }),
    }
  }
  if (expression.kind === "not") {
    const child = normalizeAdvancedExpression(optionsByColumn, expression.child)
    return child ? { ...expression, child } : null
  }
  const children = expression.children
    .map(child => normalizeAdvancedExpression(optionsByColumn, child))
    .filter((child): child is DataGridAdvancedExpressionEntry => child != null)
  return children.length > 0 ? { ...expression, children } : null
}

export function normalizeDataGridAppFilterModel(
  filterModel: DataGridFilterSnapshot | null | undefined,
  columns: readonly FilterColumnLike[] | null | undefined,
): DataGridFilterSnapshot | null {
  const cloned = cloneDataGridFilterSnapshot(filterModel ?? null)
  if (!cloned || !columns || columns.length === 0) {
    return cloned
  }
  const optionsByColumn = resolveColumnFilterOptions(columns)
  if (optionsByColumn.size === 0) {
    return cloned
  }
  const columnFilters: DataGridFilterSnapshot["columnFilters"] = {}
  for (const [columnKey, entry] of Object.entries(cloned.columnFilters ?? {})) {
    const normalized = normalizeColumnFilterEntry(optionsByColumn, columnKey, entry)
    if (normalized) {
      columnFilters[columnKey] = normalized
    }
  }
  const advancedFilters: DataGridFilterSnapshot["advancedFilters"] = {}
  for (const [columnKey, entry] of Object.entries(cloned.advancedFilters ?? {})) {
    const normalized = normalizeLegacyAdvancedFilterEntry(optionsByColumn, columnKey, entry)
    if (normalized) {
      advancedFilters[columnKey] = normalized
    }
  }
  return {
    ...cloned,
    columnFilters,
    advancedFilters,
    advancedExpression: normalizeAdvancedExpression(optionsByColumn, cloned.advancedExpression),
  }
}

export function normalizeDataGridAppUnifiedStateFilters<TRow = unknown>(
  state: DataGridUnifiedState<TRow>,
  columns: readonly FilterColumnLike[] | null | undefined,
): DataGridUnifiedState<TRow> {
  const normalizedFilterModel = normalizeDataGridAppFilterModel(state.rows?.snapshot?.filterModel ?? null, columns)
  return {
    ...state,
    rows: {
      ...state.rows,
      snapshot: {
        ...state.rows.snapshot,
        filterModel: normalizedFilterModel,
      },
    },
  }
}
