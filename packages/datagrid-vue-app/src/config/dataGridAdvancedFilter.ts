export type DataGridAdvancedFilterOperatorLabelKey =
  | "contains"
  | "in"
  | "equals"
  | "not-equals"
  | "starts-with"
  | "ends-with"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is-empty"
  | "not-empty"
  | "is-null"
  | "not-null"

export interface DataGridAdvancedFilterLabels {
  buttonLabel?: string
  eyebrow?: string
  title?: string
  close?: string
  appliedEyebrow?: string
  appliedTitle?: string
  resetAllFilters?: string
  noFiltersApplied?: string
  joinLabel?: string
  joinAriaLabel?: string
  columnLabel?: string
  columnAriaLabel?: string
  operatorLabel?: string
  operatorAriaLabel?: string
  valueLabel?: string
  valuePlaceholder?: string
  valueAriaLabel?: string
  clearClause?: string
  removeClause?: string
  addClause?: string
  cancel?: string
  apply?: string
  activeSummaryPrefix?: string
  activeSummaryFallback?: string
  valuesSummaryLabel?: string
  blankValueLabel?: string
  betweenJoiner?: string
  notOperatorLabel?: string
  operators?: Partial<Record<DataGridAdvancedFilterOperatorLabelKey, string>>
  joins?: Partial<Record<"and" | "or", string>>
}

export interface DataGridResolvedAdvancedFilterLabels {
  buttonLabel: string
  eyebrow: string
  title: string
  close: string
  appliedEyebrow: string
  appliedTitle: string
  resetAllFilters: string
  noFiltersApplied: string
  joinLabel: string
  joinAriaLabel: string
  columnLabel: string
  columnAriaLabel: string
  operatorLabel: string
  operatorAriaLabel: string
  valueLabel: string
  valuePlaceholder: string
  valueAriaLabel: string
  clearClause: string
  removeClause: string
  addClause: string
  cancel: string
  apply: string
  activeSummaryPrefix: string
  activeSummaryFallback: string
  valuesSummaryLabel: string
  blankValueLabel: string
  betweenJoiner: string
  notOperatorLabel: string
  operators: Readonly<Record<DataGridAdvancedFilterOperatorLabelKey, string>>
  joins: Readonly<Record<"and" | "or", string>>
}

export interface DataGridAdvancedFilterOptions {
  enabled: boolean
  buttonLabel: string
  labels: DataGridResolvedAdvancedFilterLabels
}

export type DataGridAdvancedFilterProp =
  | boolean
  | {
      enabled?: boolean
      buttonLabel?: string
      labels?: DataGridAdvancedFilterLabels
    }
  | null

const DEFAULT_BUTTON_LABEL = "Advanced filter"

const DEFAULT_OPERATOR_LABELS: Readonly<Record<DataGridAdvancedFilterOperatorLabelKey, string>> = Object.freeze({
  contains: "Contains",
  in: "In",
  equals: "Equals",
  "not-equals": "Not equals",
  "starts-with": "Starts with",
  "ends-with": "Ends with",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  between: "between",
  "is-empty": "is empty",
  "not-empty": "is not empty",
  "is-null": "is null",
  "not-null": "is not null",
})

const DEFAULT_JOIN_LABELS: Readonly<Record<"and" | "or", string>> = Object.freeze({
  and: "AND",
  or: "OR",
})

export const DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS: DataGridResolvedAdvancedFilterLabels = Object.freeze({
  buttonLabel: DEFAULT_BUTTON_LABEL,
  eyebrow: "Advanced filter",
  title: "Build clause-based filter",
  close: "Close",
  appliedEyebrow: "Applied on table",
  appliedTitle: "Current filters",
  resetAllFilters: "Reset all filters",
  noFiltersApplied: "No filters applied",
  joinLabel: "Join",
  joinAriaLabel: "Join operator",
  columnLabel: "Column",
  columnAriaLabel: "Column",
  operatorLabel: "Operator",
  operatorAriaLabel: "Condition operator",
  valueLabel: "Value",
  valuePlaceholder: "Value",
  valueAriaLabel: "Condition value",
  clearClause: "Clear",
  removeClause: "Remove",
  addClause: "Add clause",
  cancel: "Cancel",
  apply: "Apply",
  activeSummaryPrefix: "Advanced",
  activeSummaryFallback: "active",
  valuesSummaryLabel: "values",
  blankValueLabel: "(Blanks)",
  betweenJoiner: "and",
  notOperatorLabel: "NOT",
  operators: DEFAULT_OPERATOR_LABELS,
  joins: DEFAULT_JOIN_LABELS,
})

function resolveLabel(value: string | undefined, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeOperatorLabels(
  input: DataGridAdvancedFilterLabels["operators"] | undefined,
): Readonly<Record<DataGridAdvancedFilterOperatorLabelKey, string>> {
  const labels = { ...DEFAULT_OPERATOR_LABELS }
  for (const key of Object.keys(DEFAULT_OPERATOR_LABELS) as DataGridAdvancedFilterOperatorLabelKey[]) {
    labels[key] = resolveLabel(input?.[key], labels[key])
  }
  return Object.freeze(labels)
}

function normalizeJoinLabels(
  input: DataGridAdvancedFilterLabels["joins"] | undefined,
): Readonly<Record<"and" | "or", string>> {
  return Object.freeze({
    and: resolveLabel(input?.and, DEFAULT_JOIN_LABELS.and),
    or: resolveLabel(input?.or, DEFAULT_JOIN_LABELS.or),
  })
}

function resolveAdvancedFilterLabels(
  input: DataGridAdvancedFilterLabels | undefined,
  legacyButtonLabel?: string,
): DataGridResolvedAdvancedFilterLabels {
  const buttonLabel = resolveLabel(legacyButtonLabel, resolveLabel(input?.buttonLabel, DEFAULT_BUTTON_LABEL))
  return Object.freeze({
    buttonLabel,
    eyebrow: resolveLabel(input?.eyebrow, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.eyebrow),
    title: resolveLabel(input?.title, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.title),
    close: resolveLabel(input?.close, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.close),
    appliedEyebrow: resolveLabel(input?.appliedEyebrow, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.appliedEyebrow),
    appliedTitle: resolveLabel(input?.appliedTitle, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.appliedTitle),
    resetAllFilters: resolveLabel(input?.resetAllFilters, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.resetAllFilters),
    noFiltersApplied: resolveLabel(input?.noFiltersApplied, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.noFiltersApplied),
    joinLabel: resolveLabel(input?.joinLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.joinLabel),
    joinAriaLabel: resolveLabel(input?.joinAriaLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.joinAriaLabel),
    columnLabel: resolveLabel(input?.columnLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.columnLabel),
    columnAriaLabel: resolveLabel(input?.columnAriaLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.columnAriaLabel),
    operatorLabel: resolveLabel(input?.operatorLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.operatorLabel),
    operatorAriaLabel: resolveLabel(input?.operatorAriaLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.operatorAriaLabel),
    valueLabel: resolveLabel(input?.valueLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.valueLabel),
    valuePlaceholder: resolveLabel(input?.valuePlaceholder, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.valuePlaceholder),
    valueAriaLabel: resolveLabel(input?.valueAriaLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.valueAriaLabel),
    clearClause: resolveLabel(input?.clearClause, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.clearClause),
    removeClause: resolveLabel(input?.removeClause, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.removeClause),
    addClause: resolveLabel(input?.addClause, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.addClause),
    cancel: resolveLabel(input?.cancel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.cancel),
    apply: resolveLabel(input?.apply, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.apply),
    activeSummaryPrefix: resolveLabel(input?.activeSummaryPrefix, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.activeSummaryPrefix),
    activeSummaryFallback: resolveLabel(input?.activeSummaryFallback, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.activeSummaryFallback),
    valuesSummaryLabel: resolveLabel(input?.valuesSummaryLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.valuesSummaryLabel),
    blankValueLabel: resolveLabel(input?.blankValueLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.blankValueLabel),
    betweenJoiner: resolveLabel(input?.betweenJoiner, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.betweenJoiner),
    notOperatorLabel: resolveLabel(input?.notOperatorLabel, DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS.notOperatorLabel),
    operators: normalizeOperatorLabels(input?.operators),
    joins: normalizeJoinLabels(input?.joins),
  })
}

export function resolveDataGridAdvancedFilterOperatorLabel(
  labels: DataGridResolvedAdvancedFilterLabels,
  operator: string,
): string {
  switch (operator) {
    case "startsWith":
      return labels.operators["starts-with"]
    case "endsWith":
      return labels.operators["ends-with"]
    case "notEquals":
      return labels.operators["not-equals"]
    case "isEmpty":
      return labels.operators["is-empty"]
    case "notEmpty":
      return labels.operators["not-empty"]
    case "isNull":
      return labels.operators["is-null"]
    case "notNull":
      return labels.operators["not-null"]
    default:
      return labels.operators[operator as DataGridAdvancedFilterOperatorLabelKey] ?? operator
  }
}

export function resolveDataGridAdvancedFilter(
  input: DataGridAdvancedFilterProp | undefined,
): DataGridAdvancedFilterOptions {
  if (typeof input === "boolean") {
    const labels = resolveAdvancedFilterLabels(undefined)
    return {
      enabled: input,
      buttonLabel: labels.buttonLabel,
      labels,
    }
  }
  if (!input) {
    const labels = resolveAdvancedFilterLabels(undefined)
    return {
      enabled: false,
      buttonLabel: labels.buttonLabel,
      labels,
    }
  }
  const labels = resolveAdvancedFilterLabels(input.labels, input.buttonLabel)
  return {
    enabled: input.enabled ?? true,
    buttonLabel: labels.buttonLabel,
    labels,
  }
}
