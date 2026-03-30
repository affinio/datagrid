import {
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  type DataGridFilterSnapshot,
} from "@affino/datagrid-vue"
import type { DataGridAppAdvancedFilterClauseDraft } from "@affino/datagrid-vue/app"

type DataGridAdvancedExpressionEntry = NonNullable<DataGridFilterSnapshot["advancedExpression"]>

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
        join: expression.operator,
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
  const expression = filterModel.advancedExpression
    ?? buildDataGridAdvancedFilterExpressionFromLegacyFilters(filterModel.advancedFilters)
  return resolveAdvancedFilterDraftClausesFromExpression(expression ?? null)
}