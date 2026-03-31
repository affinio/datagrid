import {
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  type DataGridFilterSnapshot,
} from "@affino/datagrid-vue"
import type {
  DataGridAppAdvancedFilterClauseDraft,
  DataGridAppAdvancedFilterClauseJoin,
} from "@affino/datagrid-vue/app"

type DataGridAdvancedExpressionEntry = NonNullable<DataGridFilterSnapshot["advancedExpression"]>

function normalizeAdvancedFilterClauseJoin(value: string | null | undefined): DataGridAppAdvancedFilterClauseJoin {
  return value === "or" ? "or" : "and"
}

function stringifyAdvancedFilterDraftValue(value: unknown): string {
  if (value == null) {
    return ""
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value
      .map(entry => stringifyAdvancedFilterDraftValue(entry))
      .filter(entry => entry.length > 0)
      .join(", ")
  }
  return String(value)
}

function stringifyColumnFilterToken(token: string): string {
  const separatorIndex = token.indexOf(":")
  if (separatorIndex > 0) {
    const prefix = token.slice(0, separatorIndex)
    if (/^[a-z-]+$/i.test(prefix)) {
      return token.slice(separatorIndex + 1)
    }
  }
  return token
}

function resolveAdvancedFilterDraftClausesFromColumnFilters(
  filterModel: DataGridFilterSnapshot,
): DataGridAppAdvancedFilterClauseDraft[] {
  const clauses: DataGridAppAdvancedFilterClauseDraft[] = []
  for (const [columnKey, filter] of Object.entries(filterModel.columnFilters ?? {})) {
    if (!filter) {
      continue
    }
    if (filter.kind === "valueSet") {
      const values = Array.from(new Set(
        (filter.tokens ?? [])
          .map(token => stringifyColumnFilterToken(String(token ?? "")))
          .map(value => value.trim())
          .filter(value => value.length > 0),
      ))
      if (values.length === 0) {
        continue
      }
      clauses.push({
        id: clauses.length,
        join: "and",
        columnKey,
        operator: "in",
        value: values.join(", "),
      })
      continue
    }
    const values = [filter.value, filter.value2]
      .map(value => stringifyAdvancedFilterDraftValue(value))
      .filter(value => value.length > 0)
    if (values.length === 0) {
      continue
    }
    clauses.push({
      id: clauses.length,
      join: "and",
      columnKey,
      operator: String(filter.operator ?? "contains"),
      value: values.join(", "),
    })
  }
  return clauses
}

export function resolveAdvancedFilterDraftClausesFromExpression(
  expression: DataGridAdvancedExpressionEntry | null | undefined,
): DataGridAppAdvancedFilterClauseDraft[] {
  if (!expression || expression.kind === "not") {
    return []
  }

  if (expression.kind === "condition") {
    return [{
      id: 0,
      join: "and",
      columnKey: String(expression.key ?? expression.field ?? ""),
      operator: String(expression.operator ?? "contains"),
      value: stringifyAdvancedFilterDraftValue(expression.value),
    }]
  }

  const clauses: DataGridAppAdvancedFilterClauseDraft[] = []
  for (let index = 0; index < expression.children.length; index += 1) {
    const child = expression.children[index]
    if (!child) {
      continue
    }
    const childClauses = resolveAdvancedFilterDraftClausesFromExpression(child)
    if (childClauses.length === 0) {
      continue
    }
    const firstClause = childClauses[0]
    if (index > 0 && firstClause) {
      childClauses[0] = {
        ...firstClause,
        id: firstClause.id,
        join: normalizeAdvancedFilterClauseJoin(expression.operator),
      }
    }
    clauses.push(...childClauses)
  }
  return clauses
}

export function resolveAdvancedFilterDraftClausesFromFilterModel(
  filterModel: DataGridFilterSnapshot | null | undefined,
): DataGridAppAdvancedFilterClauseDraft[] {
  if (!filterModel) {
    return []
  }
  const columnClauses = resolveAdvancedFilterDraftClausesFromColumnFilters(filterModel)
  const expression = filterModel.advancedExpression
    ?? buildDataGridAdvancedFilterExpressionFromLegacyFilters(filterModel.advancedFilters)
  const advancedClauses = resolveAdvancedFilterDraftClausesFromExpression(expression ?? null)
  const combinedClauses: DataGridAppAdvancedFilterClauseDraft[] = [
    ...columnClauses,
    ...advancedClauses.map<DataGridAppAdvancedFilterClauseDraft>((clause, index) => {
      if (columnClauses.length > 0 && index === 0) {
        return {
          ...clause,
          join: normalizeAdvancedFilterClauseJoin("and"),
        }
      }
      return clause
    }),
  ]
  return combinedClauses.map((clause, index) => ({
    ...clause,
    id: index,
    join: index === 0 ? normalizeAdvancedFilterClauseJoin("and") : clause.join,
  }))
}
