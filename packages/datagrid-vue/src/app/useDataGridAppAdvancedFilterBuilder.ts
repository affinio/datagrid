import { computed, ref, type ComputedRef } from "vue"
import type { DataGridAdvancedFilterExpression } from "@affino/datagrid-core"
import type {
  DataGridAppAdvancedFilterClauseDraft,
  DataGridAppAdvancedFilterClauseJoin,
  DataGridAppAdvancedFilterClausePatch,
  DataGridAppAdvancedFilterColumnOption,
} from "./advancedFilterPanel.types"

interface UseDataGridAppAdvancedFilterBuilderOptions {
  resolveColumns: () => readonly DataGridAppAdvancedFilterColumnOption[]
  numericFilterKeys?: readonly string[]
  numericFilterOperators?: readonly string[]
}

const DEFAULT_NUMERIC_FILTER_KEYS = ["id", "amount", "qty", "deals", "latencyMs", "retries"]
const DEFAULT_NUMERIC_FILTER_OPERATORS = ["gt", "gte", "lt", "lte"]

export interface UseDataGridAppAdvancedFilterBuilderResult {
  isAdvancedFilterPanelOpen: ComputedRef<boolean>
  advancedFilterDraftClauses: ComputedRef<readonly DataGridAppAdvancedFilterClauseDraft[]>
  advancedFilterColumns: ComputedRef<readonly DataGridAppAdvancedFilterColumnOption[]>
  appliedAdvancedFilterExpression: ComputedRef<DataGridAdvancedFilterExpression | null>
  openAdvancedFilterPanel: () => void
  addAdvancedFilterClause: () => void
  removeAdvancedFilterClause: (clauseId: number) => void
  updateAdvancedFilterClause: (patch: DataGridAppAdvancedFilterClausePatch) => void
  cancelAdvancedFilterPanel: () => void
  applyAdvancedFilterPanel: () => void
}

export function useDataGridAppAdvancedFilterBuilder(
  options: UseDataGridAppAdvancedFilterBuilderOptions,
): UseDataGridAppAdvancedFilterBuilderResult {
  const isPanelOpen = ref(false)
  const appliedClauses = ref<DataGridAppAdvancedFilterClauseDraft[]>([])
  const draftClauses = ref<DataGridAppAdvancedFilterClauseDraft[]>([])
  const numericFilterKeys = new Set(options.numericFilterKeys ?? DEFAULT_NUMERIC_FILTER_KEYS)
  const numericFilterOperators = new Set(options.numericFilterOperators ?? DEFAULT_NUMERIC_FILTER_OPERATORS)
  let nextClauseId = 0

  const advancedFilterColumns = computed<readonly DataGridAppAdvancedFilterColumnOption[]>(() => {
    return options.resolveColumns()
  })

  const resolveDefaultColumnKey = (): string => {
    return advancedFilterColumns.value[0]?.key ?? ""
  }

  const createClause = (
    seed?: Partial<Pick<DataGridAppAdvancedFilterClauseDraft, "join" | "columnKey" | "operator" | "value">>,
  ): DataGridAppAdvancedFilterClauseDraft => {
    const id = nextClauseId
    nextClauseId += 1
    return {
      id,
      join: seed?.join ?? "and",
      columnKey: seed?.columnKey ?? resolveDefaultColumnKey(),
      operator: seed?.operator ?? "contains",
      value: seed?.value ?? "",
    }
  }

  const cloneClauses = (
    clauses: readonly DataGridAppAdvancedFilterClauseDraft[],
  ): DataGridAppAdvancedFilterClauseDraft[] => {
    if (!clauses.length) {
      return [createClause()]
    }
    return clauses.map(clause => createClause({
      join: clause.join,
      columnKey: clause.columnKey,
      operator: clause.operator,
      value: clause.value,
    }))
  }

  const buildAdvancedFilterExpressionFromClauses = (
    clauses: readonly DataGridAppAdvancedFilterClauseDraft[],
  ): DataGridAdvancedFilterExpression | null => {
    const normalizedClauses = clauses
      .map(clause => ({
        ...clause,
        columnKey: clause.columnKey.trim(),
        operator: clause.operator.trim(),
        value: clause.value.trim(),
      }))
      .filter(clause => clause.columnKey && clause.operator && clause.value)

    if (!normalizedClauses.length) {
      return null
    }

    let expression: DataGridAdvancedFilterExpression | null = null
    for (let index = 0; index < normalizedClauses.length; index += 1) {
      const clause = normalizedClauses[index]
      if (!clause) {
        continue
      }
      const shouldUseNumeric = numericFilterKeys.has(clause.columnKey) || numericFilterOperators.has(clause.operator)
      const numericValue = Number(clause.value)
      const conditionValue = shouldUseNumeric && Number.isFinite(numericValue)
        ? numericValue
        : clause.value
      const condition: DataGridAdvancedFilterExpression = {
        kind: "condition",
        key: clause.columnKey,
        type: shouldUseNumeric ? "number" : "text",
        operator: clause.operator,
        value: conditionValue,
      }
      if (!expression) {
        expression = condition
        continue
      }
      expression = {
        kind: "group",
        operator: clause.join,
        children: [expression, condition],
      }
    }

    return expression
  }

  const appliedAdvancedFilterExpression = computed<DataGridAdvancedFilterExpression | null>(() => {
    return buildAdvancedFilterExpressionFromClauses(appliedClauses.value)
  })

  const openAdvancedFilterPanel = (): void => {
    draftClauses.value = cloneClauses(appliedClauses.value)
    isPanelOpen.value = true
  }

  const addAdvancedFilterClause = (): void => {
    draftClauses.value = [...draftClauses.value, createClause()]
  }

  const removeAdvancedFilterClause = (clauseId: number): void => {
    const nextClauses = draftClauses.value.filter(clause => clause.id !== clauseId)
    draftClauses.value = nextClauses.length ? nextClauses : [createClause()]
  }

  const updateAdvancedFilterClause = (patch: DataGridAppAdvancedFilterClausePatch): void => {
    draftClauses.value = draftClauses.value.map(clause => {
      if (clause.id !== patch.clauseId) {
        return clause
      }
      if (patch.field === "join") {
        const joinValue: DataGridAppAdvancedFilterClauseJoin = patch.value === "or" ? "or" : "and"
        return {
          ...clause,
          join: joinValue,
        }
      }
      return {
        ...clause,
        [patch.field]: patch.value,
      }
    })
  }

  const cancelAdvancedFilterPanel = (): void => {
    draftClauses.value = cloneClauses(appliedClauses.value)
    isPanelOpen.value = false
  }

  const applyAdvancedFilterPanel = (): void => {
    appliedClauses.value = cloneClauses(draftClauses.value)
    isPanelOpen.value = false
  }

  return {
    isAdvancedFilterPanelOpen: computed(() => isPanelOpen.value),
    advancedFilterDraftClauses: computed(() => draftClauses.value),
    advancedFilterColumns,
    appliedAdvancedFilterExpression,
    openAdvancedFilterPanel,
    addAdvancedFilterClause,
    removeAdvancedFilterClause,
    updateAdvancedFilterClause,
    cancelAdvancedFilterPanel,
    applyAdvancedFilterPanel,
  }
}
