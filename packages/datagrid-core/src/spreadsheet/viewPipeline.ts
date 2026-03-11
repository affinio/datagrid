import type {
  DataGridAggOp,
  DataGridColumnPredicateOperator,
  DataGridPivotColumn,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNode,
  DataGridSortDirection,
} from "../models/rowModel.js"
import { createPivotRuntime, normalizePivotSpec } from "../models/index.js"
import { createPivotAxisKey, createPivotColumnId, createPivotColumnLabel } from "@affino/datagrid-pivot"
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

export interface DataGridSpreadsheetViewJoinColumn {
  key: string
  as?: string
  label?: string
}

export interface DataGridSpreadsheetViewJoinStep {
  type: "join"
  sheetId: string
  mode?: "left" | "inner"
  on: {
    leftKey: string
    rightKey: string
  }
  select: readonly (string | DataGridSpreadsheetViewJoinColumn)[]
  multiMatch?: "first" | "error" | "explode"
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

export interface DataGridSpreadsheetViewPivotStep {
  type: "pivot"
  spec: DataGridPivotSpec
}

export type DataGridSpreadsheetViewStep =
  | DataGridSpreadsheetViewFilterStep
  | DataGridSpreadsheetViewSortStep
  | DataGridSpreadsheetViewProjectStep
  | DataGridSpreadsheetViewJoinStep
  | DataGridSpreadsheetViewGroupStep
  | DataGridSpreadsheetViewPivotStep

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
  resolveSheetModel?: (sheetId: string) => DataGridSpreadsheetSheetModel | null
  pipeline: readonly DataGridSpreadsheetViewStep[]
  sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  errorMessage?: string | null
}

export type DataGridSpreadsheetViewMaterializationDiagnosticCode =
  | "cycle"
  | "source-missing"
  | "join-sheet-missing"
  | "join-ambiguous-match"
  | "materialization-failed"

export interface DataGridSpreadsheetViewMaterializationDiagnostic {
  code: DataGridSpreadsheetViewMaterializationDiagnosticCode
  message: string
  relatedSheetId?: string | null
}

export interface MaterializeDataGridSpreadsheetViewSheetResult {
  sheetState: DataGridSpreadsheetSheetState
  diagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[]
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

interface SpreadsheetPivotColumnState {
  key: string
  title: string
  source: "row" | "value"
  value?: DataGridPivotColumn
}

const NUMERIC_AGGREGATIONS = new Set<Exclude<DataGridAggOp, "custom">>([
  "sum",
  "avg",
  "count",
  "countNonNull",
  "min",
  "max",
])

class DataGridSpreadsheetViewMaterializationError extends Error {
  readonly code: DataGridSpreadsheetViewMaterializationDiagnosticCode
  readonly relatedSheetId: string | null

  constructor(
    code: DataGridSpreadsheetViewMaterializationDiagnosticCode,
    message: string,
    relatedSheetId: string | null = null,
  ) {
    super(message)
    this.name = "DataGridSpreadsheetViewMaterializationError"
    this.code = code
    this.relatedSheetId = relatedSheetId
  }
}

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

function normalizePivotFieldValue(value: unknown): string {
  if (value == null) {
    return ""
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }
  return String(value)
}

function createJoinLookupKey(value: unknown): string {
  if (value == null) {
    return "null:"
  }
  if (value instanceof Date) {
    return `date:${Number.isNaN(value.getTime()) ? "" : value.toISOString()}`
  }
  switch (typeof value) {
    case "string":
      return `string:${value}`
    case "number":
      return `number:${Number.isFinite(value) ? value : ""}`
    case "boolean":
      return `boolean:${value ? "1" : "0"}`
    case "bigint":
      return `bigint:${String(value)}`
    default:
      return `other:${String(value)}`
  }
}

function createJoinExplodedRowId(
  leftRowId: DataGridRowId,
  rightRowId: DataGridRowId | null,
  matchIndex: number,
): string {
  const encodedLeft = String(leftRowId)
  const encodedRight = rightRowId == null ? "null" : String(rightRowId)
  return `join:${encodedLeft.length}:${encodedLeft}|${encodedRight.length}:${encodedRight}|${matchIndex}`
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

function normalizeJoinColumns(
  columns: readonly (string | DataGridSpreadsheetViewJoinColumn)[],
): readonly DataGridSpreadsheetViewJoinColumn[] {
  return columns.map(column => (
    typeof column === "string"
      ? { key: normalizeColumnKey(column, "join select column") }
      : {
        key: normalizeColumnKey(column.key, "join select column"),
        as: column.as ? normalizeColumnKey(column.as, "join select alias") : undefined,
        label: column.label,
      }
  ))
}

function applyJoinStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewJoinStep,
  resolveSheetModel: ((sheetId: string) => DataGridSpreadsheetSheetModel | null) | undefined,
): SpreadsheetViewDataset {
  if (typeof resolveSheetModel !== "function") {
    throw new DataGridSpreadsheetViewMaterializationError(
      "materialization-failed",
      "[DataGridSpreadsheetView] join step requires a workbook sheet resolver.",
    )
  }
  const rightSheetId = normalizeColumnKey(step.sheetId, "join sheet id")
  const rightSheetModel = resolveSheetModel(rightSheetId)
  if (!rightSheetModel) {
    throw new DataGridSpreadsheetViewMaterializationError(
      "join-sheet-missing",
      `[DataGridSpreadsheetView] join sheet '${rightSheetId}' is missing.`,
      rightSheetId,
    )
  }

  const leftKey = normalizeColumnKey(step.on.leftKey, "join left key")
  const rightKey = normalizeColumnKey(step.on.rightKey, "join right key")
  const mode = step.mode === "inner" ? "inner" : "left"
  const multiMatch = step.multiMatch === "error"
    ? "error"
    : step.multiMatch === "explode"
      ? "explode"
      : "first"
  const selections = normalizeJoinColumns(step.select)
  if (selections.length === 0) {
    throw new Error("[DataGridSpreadsheetView] join step must select at least one right-side column.")
  }

  const leftColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const rightDataset = createDatasetFromSheetModel(rightSheetModel)
  const rightColumnsByKey = new Map(rightDataset.columns.map(column => [column.key, column]))
  const outputColumns: SpreadsheetViewColumnState[] = [...dataset.columns]
  const joinOutputKeys = new Set<string>(dataset.columns.map(column => column.key))

  for (const selection of selections) {
    const key = selection.as ?? selection.key
    if (joinOutputKeys.has(key)) {
      throw new Error(`[DataGridSpreadsheetView] join output column '${key}' collides with an existing column.`)
    }
    const rightColumn = rightColumnsByKey.get(selection.key)
    outputColumns.push({
      key,
      title: normalizeColumnTitle(selection.label, rightColumn?.title ?? key),
      style: rightColumn?.style ?? null,
    })
    joinOutputKeys.add(key)
  }

  if (!leftColumnsByKey.has(leftKey)) {
    throw new Error(`[DataGridSpreadsheetView] join left key '${leftKey}' does not exist.`)
  }
  if (!rightColumnsByKey.has(rightKey)) {
    throw new Error(`[DataGridSpreadsheetView] join right key '${rightKey}' does not exist on '${rightSheetId}'.`)
  }

  const rightRowsByLookupKey = new Map<string, SpreadsheetViewRowState[]>()
  for (const row of rightDataset.rows) {
    const lookupKey = createJoinLookupKey(row.values[rightKey])
    const rows = rightRowsByLookupKey.get(lookupKey)
    if (rows) {
      rows.push(row)
    } else {
      rightRowsByLookupKey.set(lookupKey, [row])
    }
  }

  const rows: SpreadsheetViewRowState[] = []
  for (const row of dataset.rows) {
    const matches = rightRowsByLookupKey.get(createJoinLookupKey(row.values[leftKey])) ?? []
    if (matches.length > 1 && multiMatch === "error") {
      throw new DataGridSpreadsheetViewMaterializationError(
        "join-ambiguous-match",
        `[DataGridSpreadsheetView] join '${rightSheetId}' produced multiple matches for ${leftKey}=${normalizeOutputValue(row.values[leftKey])}.`,
        rightSheetId,
      )
    }
    if (multiMatch === "explode") {
      const fanoutMatches = matches.length > 0 ? matches : (mode === "left" ? [null] : [])
      for (let matchIndex = 0; matchIndex < fanoutMatches.length; matchIndex += 1) {
        const match = fanoutMatches[matchIndex]
        const values: Record<string, unknown> = { ...row.values }
        for (const selection of selections) {
          values[selection.as ?? selection.key] = match?.values[selection.key] ?? null
        }
        rows.push({
          id: createJoinExplodedRowId(row.id, match?.id ?? null, matchIndex),
          values,
        })
      }
      continue
    }

    const match = matches[0] ?? null
    if (!match && mode === "inner") {
      continue
    }
    const values: Record<string, unknown> = { ...row.values }
    for (const selection of selections) {
      values[selection.as ?? selection.key] = match?.values[selection.key] ?? null
    }
    rows.push({
      id: row.id,
      values,
    })
  }

  return {
    columns: outputColumns,
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

function createPivotLeafRow(
  row: SpreadsheetViewRowState,
  index: number,
): DataGridRowNode<Record<string, unknown>> {
  return {
    kind: "leaf",
    data: row.values,
    row: row.values,
    rowKey: row.id,
    rowId: row.id,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
  }
}

function buildPivotFallbackValueColumns(
  step: DataGridSpreadsheetViewPivotStep,
): readonly DataGridPivotColumn[] {
  const normalizedSpec = normalizePivotSpec(step.spec)
  if (!normalizedSpec || normalizedSpec.columns.length > 0) {
    return Object.freeze([])
  }
  const baseColumnKey = createPivotAxisKey("pivot:column:", [])
  return Object.freeze(normalizedSpec.values.map(value => ({
    id: createPivotColumnId(baseColumnKey, {
      field: value.field,
      agg: value.agg,
      aggregateKey: `v:${value.agg}:${value.field}`,
    }),
    valueField: value.field,
    agg: value.agg,
    label: createPivotColumnLabel([], {
      field: value.field,
      agg: value.agg,
      aggregateKey: `v:${value.agg}:${value.field}`,
    }),
    columnPath: Object.freeze([]),
  })))
}

function formatPivotValueLabel(
  valueField: string,
  agg: DataGridAggOp,
  sourceColumnsByKey: ReadonlyMap<string, SpreadsheetViewColumnState>,
): string {
  const fieldTitle = sourceColumnsByKey.get(valueField)?.title ?? valueField
  if (agg === "sum") {
    return fieldTitle
  }
  return `${agg.toUpperCase()} ${fieldTitle}`
}

function formatPivotColumnTitle(
  column: DataGridPivotColumn,
  normalizedSpec: DataGridPivotSpec,
  sourceColumnsByKey: ReadonlyMap<string, SpreadsheetViewColumnState>,
): string {
  const valueLabel = formatPivotValueLabel(column.valueField, column.agg, sourceColumnsByKey)
  const pathValues = column.columnPath.map(segment => segment.value).filter(value => value.length > 0)
  const hasSingleValueMetric = normalizedSpec.values.length === 1

  if (column.grandTotal) {
    return hasSingleValueMetric ? "Total" : `Total ${valueLabel}`
  }
  if (column.subtotal) {
    const subtotalBase = pathValues.length > 0 ? pathValues.join(" / ") : "Subtotal"
    return hasSingleValueMetric ? `${subtotalBase} subtotal` : `${subtotalBase} subtotal ${valueLabel}`
  }
  if (pathValues.length === 0) {
    return hasSingleValueMetric ? valueLabel : `Total ${valueLabel}`
  }
  const pathLabel = pathValues.join(" / ")
  return hasSingleValueMetric ? pathLabel : `${pathLabel} ${valueLabel}`
}

function applyPivotStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewPivotStep,
): SpreadsheetViewDataset {
  const normalizedSpec = normalizePivotSpec(step.spec)
  if (!normalizedSpec) {
    throw new Error("[DataGridSpreadsheetView] pivot step must include at least one value aggregation.")
  }

  const sourceColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const runtime = createPivotRuntime<Record<string, unknown>>()
  const projection = runtime.projectRows({
    inputRows: dataset.rows.map(createPivotLeafRow),
    pivotModel: normalizedSpec,
    normalizeFieldValue: normalizePivotFieldValue,
  })
  const pivotColumns = projection.columns.length > 0
    ? projection.columns
    : buildPivotFallbackValueColumns(step)

  const materializedColumns: SpreadsheetPivotColumnState[] = [
    ...normalizedSpec.rows.map(rowKey => {
      const sourceColumn = sourceColumnsByKey.get(rowKey)
      return {
        key: rowKey,
        title: sourceColumn?.title ?? rowKey,
        source: "row" as const,
      }
    }),
    ...pivotColumns.map(column => ({
      key: column.id,
      title: formatPivotColumnTitle(column, normalizedSpec, sourceColumnsByKey),
      source: "value" as const,
      value: column,
    })),
  ]

  if (materializedColumns.length === 0) {
    throw new Error("[DataGridSpreadsheetView] pivot step did not produce any columns.")
  }

  const columns: SpreadsheetViewColumnState[] = materializedColumns.map(column => {
    if (column.source === "row") {
      const sourceColumn = sourceColumnsByKey.get(column.key)
      return {
        key: column.key,
        title: column.title,
        style: sourceColumn?.style ?? null,
      }
    }
    return {
      key: column.key,
      title: column.title,
      style: column.value && column.value.agg !== "custom" && NUMERIC_AGGREGATIONS.has(column.value.agg)
        ? Object.freeze({ textAlign: "right" })
        : null,
    }
  })

  const rows: SpreadsheetViewRowState[] = projection.rows.map(row => {
    const rowRecord = row.row as Record<string, unknown>
    const values: Record<string, unknown> = {}
    for (const column of materializedColumns) {
      values[column.key] = rowRecord[column.key] ?? null
    }
    return {
      id: row.rowId,
      values,
    }
  })

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

export function materializeDataGridSpreadsheetViewSheetResult(
  options: MaterializeDataGridSpreadsheetViewSheetOptions,
): MaterializeDataGridSpreadsheetViewSheetResult {
  if (options.errorMessage) {
    return {
      sheetState: createDataGridSpreadsheetViewErrorState({
        sheetId: options.sheetId,
        sheetName: options.sheetName,
        message: options.errorMessage,
        sheetModelOptions: options.sheetModelOptions,
      }),
      diagnostics: Object.freeze([
        {
          code: "cycle",
          message: options.errorMessage,
          relatedSheetId: null,
        },
      ]),
    }
  }
  if (!options.sourceSheetModel) {
    return {
      sheetState: createDataGridSpreadsheetViewErrorState({
        sheetId: options.sheetId,
        sheetName: options.sheetName,
        message: `Source sheet '${options.sourceSheetId}' is missing.`,
        sheetModelOptions: options.sheetModelOptions,
      }),
      diagnostics: Object.freeze([
        {
          code: "source-missing",
          message: `Source sheet '${options.sourceSheetId}' is missing.`,
          relatedSheetId: options.sourceSheetId,
        },
      ]),
    }
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
        case "join":
          dataset = applyJoinStep(dataset, step, options.resolveSheetModel)
          break
        case "group":
          dataset = applyGroupStep(dataset, step)
          break
        case "pivot":
          dataset = applyPivotStep(dataset, step)
          break
        default:
          throw new Error("[DataGridSpreadsheetView] unsupported pipeline step.")
      }
    }
    return {
      sheetState: datasetToSheetState(dataset, options),
      diagnostics: Object.freeze([]),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "[DataGridSpreadsheetView] materialization failed."
    const diagnostic = error instanceof DataGridSpreadsheetViewMaterializationError
      ? {
        code: error.code,
        message,
        relatedSheetId: error.relatedSheetId,
      }
      : {
        code: "materialization-failed" as const,
        message,
        relatedSheetId: null,
      }
    return {
      sheetState: createDataGridSpreadsheetViewErrorState({
        sheetId: options.sheetId,
        sheetName: options.sheetName,
        message,
        sheetModelOptions: options.sheetModelOptions,
      }),
      diagnostics: Object.freeze([diagnostic]),
    }
  }
}

export function materializeDataGridSpreadsheetViewSheet(
  options: MaterializeDataGridSpreadsheetViewSheetOptions,
): DataGridSpreadsheetSheetState {
  return materializeDataGridSpreadsheetViewSheetResult(options).sheetState
}
