import type {
  DataGridAggOp,
  DataGridColumnPredicateOperator,
  DataGridRowId,
  DataGridSortDirection,
} from "../models/rowModel.js"
import type {
  CreateDataGridSpreadsheetSheetModelOptions,
  DataGridSpreadsheetColumnSnapshot,
  DataGridSpreadsheetSheetModel,
  DataGridSpreadsheetSheetState,
  DataGridSpreadsheetStyle,
} from "./sheetModel.js"

export type DataGridSpreadsheetWorkbookSheetKind = "data" | "view"

export interface DataGridSpreadsheetViewFilterClause {
  key: string
  operator: DataGridColumnPredicateOperator
  value?: unknown
  value2?: unknown
  caseSensitive?: boolean
}

export interface DataGridSpreadsheetViewFilterStep {
  type: "filter"
  mode?: "all" | "any"
  clauses: readonly DataGridSpreadsheetViewFilterClause[]
}

export interface DataGridSpreadsheetViewSortField {
  key: string
  direction?: DataGridSortDirection
}

export interface DataGridSpreadsheetViewSortStep {
  type: "sort"
  fields: readonly (string | DataGridSpreadsheetViewSortField)[]
}

export interface DataGridSpreadsheetViewProjectColumn {
  key: string
  as?: string
  label?: string
}

export interface DataGridSpreadsheetViewProjectStep {
  type: "project"
  columns: readonly (string | DataGridSpreadsheetViewProjectColumn)[]
}

export interface DataGridSpreadsheetViewGroupByField {
  key: string
  as?: string
  label?: string
}

export interface DataGridSpreadsheetViewAggregation {
  key: string
  field?: string | null
  agg: Exclude<DataGridAggOp, "custom">
  label?: string
}

export interface DataGridSpreadsheetViewGroupStep {
  type: "group"
  by: readonly (string | DataGridSpreadsheetViewGroupByField)[]
  aggregations: readonly DataGridSpreadsheetViewAggregation[]
}

export type DataGridSpreadsheetViewStep =
  | DataGridSpreadsheetViewFilterStep
  | DataGridSpreadsheetViewSortStep
  | DataGridSpreadsheetViewProjectStep
  | DataGridSpreadsheetViewGroupStep

export interface DataGridSpreadsheetWorkbookViewDefinition {
  sourceSheetId: string
  pipeline: readonly DataGridSpreadsheetViewStep[]
}

export type DataGridSpreadsheetWorkbookViewSheetModelOptions = Omit<
  CreateDataGridSpreadsheetSheetModelOptions,
  "sheetId" | "sheetName" | "columns" | "rows" | "formulaTables" | "resolveSheetReference"
>

export interface MaterializeDataGridSpreadsheetViewSheetOptions {
  sheetId: string
  sheetName: string
  sourceSheetId: string
  sourceSheetModel: DataGridSpreadsheetSheetModel | null
  pipeline: readonly DataGridSpreadsheetViewStep[]
  sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  errorMessage?: string | null
}

interface SpreadsheetViewColumnState {
  key: string
  title: string
  style: DataGridSpreadsheetStyle | null
}

interface SpreadsheetViewRowState {
  id: DataGridRowId
  values: Record<string, unknown>
}

interface SpreadsheetViewDataset {
  columns: readonly SpreadsheetViewColumnState[]
  rows: readonly SpreadsheetViewRowState[]
}

const NUMERIC_AGGREGATIONS = new Set<Exclude<DataGridAggOp, "custom">>([
  "sum",
  "avg",
  "count",
  "countNonNull",
  "min",
  "max",
])

function normalizeColumnKey(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim()
  if (normalized.length === 0) {
    throw new Error(`[DataGridSpreadsheetView] ${label} must be non-empty.`)
  }
  return normalized
}

function normalizeColumnTitle(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim()
  return normalized.length > 0 ? normalized : fallback
}

function normalizeSheetModelOptions(
  options: DataGridSpreadsheetWorkbookViewSheetModelOptions | null | undefined,
): DataGridSpreadsheetWorkbookViewSheetModelOptions {
  return {
    sheetStyle: options?.sheetStyle ?? null,
    functionRegistry: options?.functionRegistry,
    referenceParserOptions: options?.referenceParserOptions,
    runtimeErrorPolicy: options?.runtimeErrorPolicy ?? "error-value",
    resolveContextValue: options?.resolveContextValue,
  }
}

function normalizeOutputValue(value: unknown): string {
  if (value == null) {
    return ""
  }
  if (typeof value === "string") {
    return value.startsWith("=") ? `=${JSON.stringify(value)}` : value
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }
  return String(value)
}

function normalizeTextComparisonValue(value: unknown, caseSensitive = false): string {
  const normalized = String(value ?? "")
  return caseSensitive ? normalized : normalized.toLowerCase()
}

function normalizeOrderedValue(value: unknown): number | string | boolean | null {
  if (value == null) {
    return null
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "bigint") {
    return Number(value)
  }
  const text = String(value).trim()
  if (text.length === 0) {
    return ""
  }
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
    const numericValue = Number(text)
    if (Number.isFinite(numericValue)) {
      return numericValue
    }
  }
  return text.toLowerCase()
}

function compareOrderedValues(left: unknown, right: unknown): number {
  const normalizedLeft = normalizeOrderedValue(left)
  const normalizedRight = normalizeOrderedValue(right)
  if (normalizedLeft == null && normalizedRight == null) {
    return 0
  }
  if (normalizedLeft == null) {
    return 1
  }
  if (normalizedRight == null) {
    return -1
  }
  if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
    return normalizedLeft - normalizedRight
  }
  if (typeof normalizedLeft === "boolean" && typeof normalizedRight === "boolean") {
    return Number(normalizedLeft) - Number(normalizedRight)
  }
  return String(normalizedLeft).localeCompare(String(normalizedRight))
}

function isEmptyValue(value: unknown): boolean {
  return value == null || String(value).trim().length === 0
}

function valuesAreEquivalent(
  left: unknown,
  right: unknown,
  caseSensitive = false,
): boolean {
  if (left == null || right == null) {
    return left == null && right == null
  }
  const orderedComparison = compareOrderedValues(left, right)
  if (orderedComparison === 0) {
    return true
  }
  return normalizeTextComparisonValue(left, caseSensitive) === normalizeTextComparisonValue(right, caseSensitive)
}

function coerceNumericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "bigint") {
    return Number(value)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }
  const text = String(value ?? "").trim()
  if (text.length === 0) {
    return null
  }
  const numericValue = Number(text)
  return Number.isFinite(numericValue) ? numericValue : null
}

function matchesFilterClause(
  row: SpreadsheetViewRowState,
  clause: DataGridSpreadsheetViewFilterClause,
): boolean {
  const value = row.values[clause.key]
  switch (clause.operator) {
    case "contains":
      return normalizeTextComparisonValue(value, clause.caseSensitive).includes(
        normalizeTextComparisonValue(clause.value, clause.caseSensitive),
      )
    case "startsWith":
      return normalizeTextComparisonValue(value, clause.caseSensitive).startsWith(
        normalizeTextComparisonValue(clause.value, clause.caseSensitive),
      )
    case "endsWith":
      return normalizeTextComparisonValue(value, clause.caseSensitive).endsWith(
        normalizeTextComparisonValue(clause.value, clause.caseSensitive),
      )
    case "equals":
      return valuesAreEquivalent(value, clause.value, clause.caseSensitive)
    case "notEquals":
      return !valuesAreEquivalent(value, clause.value, clause.caseSensitive)
    case "gt":
      return compareOrderedValues(value, clause.value) > 0
    case "gte":
      return compareOrderedValues(value, clause.value) >= 0
    case "lt":
      return compareOrderedValues(value, clause.value) < 0
    case "lte":
      return compareOrderedValues(value, clause.value) <= 0
    case "between":
      return compareOrderedValues(value, clause.value) >= 0
        && compareOrderedValues(value, clause.value2) <= 0
    case "isEmpty":
      return isEmptyValue(value)
    case "notEmpty":
      return !isEmptyValue(value)
    case "isNull":
      return value == null
    case "notNull":
      return value != null
    default:
      return false
  }
}

function createDatasetFromSheetModel(sheetModel: DataGridSpreadsheetSheetModel): SpreadsheetViewDataset {
  const columns = sheetModel.getColumns().map(column => ({
    key: column.key,
    title: column.title,
    style: column.style,
  }))
  const rows = sheetModel.getRows().map(row => {
    const values: Record<string, unknown> = {}
    for (const column of columns) {
      values[column.key] = sheetModel.getCell({
        sheetId: sheetModel.getSheetId(),
        rowId: row.id,
        rowIndex: row.rowIndex,
        columnKey: column.key,
      })?.displayValue ?? null
    }
    return {
      id: row.id,
      values,
    }
  })
  return {
    columns,
    rows,
  }
}

function applyFilterStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewFilterStep,
): SpreadsheetViewDataset {
  if (step.clauses.length === 0) {
    return dataset
  }
  const mode = step.mode ?? "all"
  return {
    columns: dataset.columns,
    rows: dataset.rows.filter(row => {
      const matches = step.clauses.map(clause => matchesFilterClause(row, clause))
      return mode === "any" ? matches.some(Boolean) : matches.every(Boolean)
    }),
  }
}

function normalizeSortFields(
  fields: readonly (string | DataGridSpreadsheetViewSortField)[],
): readonly DataGridSpreadsheetViewSortField[] {
  return fields.map(field => (
    typeof field === "string"
      ? { key: normalizeColumnKey(field, "sort field"), direction: "asc" }
      : {
        key: normalizeColumnKey(field.key, "sort field"),
        direction: field.direction ?? "asc",
      }
  ))
}

function applySortStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewSortStep,
): SpreadsheetViewDataset {
  const fields = normalizeSortFields(step.fields)
  if (fields.length === 0) {
    return dataset
  }
  const rows = [...dataset.rows]
  rows.sort((left, right) => {
    for (const field of fields) {
      const comparison = compareOrderedValues(left.values[field.key], right.values[field.key])
      if (comparison !== 0) {
        return field.direction === "desc" ? -comparison : comparison
      }
    }
    return String(left.id).localeCompare(String(right.id))
  })
  return {
    columns: dataset.columns,
    rows,
  }
}

function normalizeProjectColumns(
  columns: readonly (string | DataGridSpreadsheetViewProjectColumn)[],
): readonly DataGridSpreadsheetViewProjectColumn[] {
  return columns.map(column => (
    typeof column === "string"
      ? { key: normalizeColumnKey(column, "projection column") }
      : {
        key: normalizeColumnKey(column.key, "projection column"),
        as: column.as ? normalizeColumnKey(column.as, "projection alias") : undefined,
        label: column.label,
      }
  ))
}

function applyProjectStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewProjectStep,
): SpreadsheetViewDataset {
  const projections = normalizeProjectColumns(step.columns)
  if (projections.length === 0) {
    throw new Error("[DataGridSpreadsheetView] project step must include at least one column.")
  }
  const sourceColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const columns = projections.map(projection => {
    const sourceColumn = sourceColumnsByKey.get(projection.key)
    const nextKey = projection.as ?? projection.key
    return {
      key: nextKey,
      title: normalizeColumnTitle(projection.label, sourceColumn?.title ?? nextKey),
      style: sourceColumn?.style ?? null,
    }
  })
  const rows = dataset.rows.map(row => {
    const values: Record<string, unknown> = {}
    for (const projection of projections) {
      values[projection.as ?? projection.key] = row.values[projection.key] ?? null
    }
    return {
      id: row.id,
      values,
    }
  })
  return {
    columns,
    rows,
  }
}

function normalizeGroupByFields(
  fields: readonly (string | DataGridSpreadsheetViewGroupByField)[],
): readonly DataGridSpreadsheetViewGroupByField[] {
  return fields.map(field => (
    typeof field === "string"
      ? { key: normalizeColumnKey(field, "group field") }
      : {
        key: normalizeColumnKey(field.key, "group field"),
        as: field.as ? normalizeColumnKey(field.as, "group alias") : undefined,
        label: field.label,
      }
  ))
}

function buildGroupRowId(
  fields: readonly DataGridSpreadsheetViewGroupByField[],
  row: SpreadsheetViewRowState,
): string {
  if (fields.length === 0) {
    return "group:all"
  }
  return `group:${fields.map(field => `${field.as ?? field.key}=${normalizeOutputValue(row.values[field.key])}`).join("\u001f")}`
}

function aggregateGroupValues(
  rows: readonly SpreadsheetViewRowState[],
  aggregation: DataGridSpreadsheetViewAggregation,
): unknown {
  const field = aggregation.field ?? null
  switch (aggregation.agg) {
    case "count":
      return rows.length
    case "countNonNull":
      return rows.reduce((count, row) => (
        row.values[field ?? ""] == null || isEmptyValue(row.values[field ?? ""]) ? count : count + 1
      ), 0)
    case "sum":
      return rows.reduce((sum, row) => sum + (coerceNumericValue(row.values[field ?? ""]) ?? 0), 0)
    case "avg": {
      let sum = 0
      let count = 0
      for (const row of rows) {
        const value = coerceNumericValue(row.values[field ?? ""])
        if (value == null) {
          continue
        }
        sum += value
        count += 1
      }
      return count > 0 ? sum / count : null
    }
    case "min": {
      let current: unknown = null
      for (const row of rows) {
        const value = row.values[field ?? ""]
        if (current == null || compareOrderedValues(value, current) < 0) {
          current = value
        }
      }
      return current
    }
    case "max": {
      let current: unknown = null
      for (const row of rows) {
        const value = row.values[field ?? ""]
        if (current == null || compareOrderedValues(value, current) > 0) {
          current = value
        }
      }
      return current
    }
    case "first":
      return rows[0]?.values[field ?? ""] ?? null
    case "last":
      return rows[rows.length - 1]?.values[field ?? ""] ?? null
    default:
      return null
  }
}

function applyGroupStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewGroupStep,
): SpreadsheetViewDataset {
  const groupFields = normalizeGroupByFields(step.by)
  if (groupFields.length === 0 && step.aggregations.length === 0) {
    throw new Error("[DataGridSpreadsheetView] group step must include fields or aggregations.")
  }
  const sourceColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const groups = new Map<string, SpreadsheetViewRowState[]>()

  for (const row of dataset.rows) {
    const groupId = buildGroupRowId(groupFields, row)
    const rows = groups.get(groupId)
    if (rows) {
      rows.push(row)
    } else {
      groups.set(groupId, [row])
    }
  }

  const columns: SpreadsheetViewColumnState[] = []
  for (const field of groupFields) {
    const sourceColumn = sourceColumnsByKey.get(field.key)
    const key = field.as ?? field.key
    columns.push({
      key,
      title: normalizeColumnTitle(field.label, sourceColumn?.title ?? key),
      style: sourceColumn?.style ?? null,
    })
  }
  for (const aggregation of step.aggregations) {
    const key = normalizeColumnKey(aggregation.key, "aggregation key")
    columns.push({
      key,
      title: normalizeColumnTitle(aggregation.label, key),
      style: NUMERIC_AGGREGATIONS.has(aggregation.agg)
        ? Object.freeze({
          textAlign: "right",
          ...(aggregation.agg === "sum" ? { fontWeight: 600 } : {}),
        })
        : null,
    })
  }

  const rows: SpreadsheetViewRowState[] = []
  for (const [groupId, groupRows] of groups.entries()) {
    const firstRow = groupRows[0]
    if (!firstRow) {
      continue
    }
    const values: Record<string, unknown> = {}
    for (const field of groupFields) {
      values[field.as ?? field.key] = firstRow.values[field.key] ?? null
    }
    for (const aggregation of step.aggregations) {
      const key = normalizeColumnKey(aggregation.key, "aggregation key")
      values[key] = aggregateGroupValues(groupRows, aggregation)
    }
    rows.push({
      id: groupId,
      values,
    })
  }

  return {
    columns,
    rows,
  }
}

function datasetToSheetState(
  dataset: SpreadsheetViewDataset,
  options: {
    sheetId: string
    sheetName: string
    sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  },
): DataGridSpreadsheetSheetState {
  if (dataset.columns.length === 0) {
    throw new Error("[DataGridSpreadsheetView] materialized view must expose at least one column.")
  }
  const normalizedSheetModelOptions = normalizeSheetModelOptions(options.sheetModelOptions)
  return {
    sheetId: options.sheetId,
    sheetName: options.sheetName,
    columns: Object.freeze(dataset.columns.map(column => ({
      key: column.key,
      title: column.title,
      style: column.style,
    } satisfies DataGridSpreadsheetColumnSnapshot))),
    rows: Object.freeze(dataset.rows.map(row => ({
      id: row.id,
      style: null,
      cells: Object.freeze(dataset.columns.map(column => ({
        columnKey: column.key,
        rawInput: normalizeOutputValue(row.values[column.key]),
        style: null,
      }))),
    }))),
    sheetStyle: normalizedSheetModelOptions.sheetStyle ?? null,
    formulaTables: Object.freeze([]),
    functionRegistry: normalizedSheetModelOptions.functionRegistry,
    referenceParserOptions: normalizedSheetModelOptions.referenceParserOptions,
    runtimeErrorPolicy: normalizedSheetModelOptions.runtimeErrorPolicy ?? "error-value",
    resolveContextValue: normalizedSheetModelOptions.resolveContextValue,
  }
}

export function createDataGridSpreadsheetViewErrorState(
  options: {
    sheetId: string
    sheetName: string
    message: string
    sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  },
): DataGridSpreadsheetSheetState {
  const dataset: SpreadsheetViewDataset = {
    columns: Object.freeze([
      {
        key: "status",
        title: "Status",
        style: Object.freeze({ fontWeight: 700 }),
      },
      {
        key: "message",
        title: "Message",
        style: null,
      },
    ]),
    rows: Object.freeze([
      {
        id: `${options.sheetId}-error`,
        values: {
          status: "Error",
          message: options.message,
        },
      },
    ]),
  }
  return datasetToSheetState(dataset, options)
}

export function materializeDataGridSpreadsheetViewSheet(
  options: MaterializeDataGridSpreadsheetViewSheetOptions,
): DataGridSpreadsheetSheetState {
  if (options.errorMessage) {
    return createDataGridSpreadsheetViewErrorState({
      sheetId: options.sheetId,
      sheetName: options.sheetName,
      message: options.errorMessage,
      sheetModelOptions: options.sheetModelOptions,
    })
  }
  if (!options.sourceSheetModel) {
    return createDataGridSpreadsheetViewErrorState({
      sheetId: options.sheetId,
      sheetName: options.sheetName,
      message: `Source sheet '${options.sourceSheetId}' is missing.`,
      sheetModelOptions: options.sheetModelOptions,
    })
  }

  try {
    let dataset = createDatasetFromSheetModel(options.sourceSheetModel)
    for (const step of options.pipeline) {
      switch (step.type) {
        case "filter":
          dataset = applyFilterStep(dataset, step)
          break
        case "sort":
          dataset = applySortStep(dataset, step)
          break
        case "project":
          dataset = applyProjectStep(dataset, step)
          break
        case "group":
          dataset = applyGroupStep(dataset, step)
          break
        default:
          throw new Error("[DataGridSpreadsheetView] unsupported pipeline step.")
      }
    }
    return datasetToSheetState(dataset, options)
  } catch (error) {
    const message = error instanceof Error ? error.message : "[DataGridSpreadsheetView] materialization failed."
    return createDataGridSpreadsheetViewErrorState({
      sheetId: options.sheetId,
      sheetName: options.sheetName,
      message,
      sheetModelOptions: options.sheetModelOptions,
    })
  }
}
