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
  DataGridSpreadsheetSheetState,
  DataGridSpreadsheetViewSourceSheet,
} from "./sheet.js"
import type { DataGridSpreadsheetViewMaterializationDiagnosticCode } from "./viewPipelineMaterializationError.js"
import { applySpreadsheetViewJoinStep } from "./viewPipelineJoinStage.js"
import { DataGridSpreadsheetViewMaterializationError } from "./viewPipelineMaterializationError.js"
import { createSpreadsheetViewDatasetFromSheetModel } from "./viewPipelineDataset.js"
import {
  applySpreadsheetViewFilterStep,
  applySpreadsheetViewProjectStep,
  applySpreadsheetViewSortStep,
} from "./viewPipelineBasicStages.js"
import type {
  SpreadsheetViewColumnState,
  SpreadsheetViewDataset,
  SpreadsheetViewRowState,
} from "./viewPipelineDataset.js"
import {
  coerceSpreadsheetViewNumber as coerceNumericValue,
  compareSpreadsheetViewValues as compareOrderedValues,
  isSpreadsheetViewValueEmpty as isEmptyValue,
  normalizeSpreadsheetViewOutputValue as normalizeOutputValue,
  spreadsheetViewValuesEqual as shallowSpreadsheetViewValuesEqual,
} from "./viewPipelineValueUtils.js"
import {
  createDataGridSpreadsheetDerivedSheetRuntime,
  type DataGridSpreadsheetDerivedSheetRuntime,
} from "./derivedSheetRuntime.js"

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
  sourceSheetModel: DataGridSpreadsheetViewSourceSheet | null
  resolveSheetModel?: (sheetId: string) => DataGridSpreadsheetViewSourceSheet | null
  pipeline: readonly DataGridSpreadsheetViewStep[]
  sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  errorMessage?: string | null
  previousJoinStageStatesByKey?: ReadonlyMap<string, DataGridSpreadsheetViewJoinStageState>
  previousGroupStageStatesByKey?: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState>
  previousPivotStageStatesByKey?: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState>
}

export type { DataGridSpreadsheetViewMaterializationDiagnosticCode } from "./viewPipelineMaterializationError.js"

export interface DataGridSpreadsheetViewMaterializationDiagnostic {
  code: DataGridSpreadsheetViewMaterializationDiagnosticCode
  message: string
  relatedSheetId?: string | null
}

export interface MaterializeDataGridSpreadsheetViewSheetResult {
  sheetState: DataGridSpreadsheetSheetState
  derivedRuntime: DataGridSpreadsheetDerivedSheetRuntime
  diagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[]
  joinStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewJoinStageState>
  groupStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState>
  pivotStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState>
}

export interface MaterializeDataGridSpreadsheetViewRuntimeResult {
  derivedRuntime: DataGridSpreadsheetDerivedSheetRuntime
  diagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[]
  joinStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewJoinStageState>
  groupStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState>
  pivotStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState>
}

export interface DataGridSpreadsheetViewJoinStageState {
  stageKey: string
  rightSheetId: string
  rightSheetRevision: number
  selectedColumnKeys: readonly string[]
  rowsByLookupKey: ReadonlyMap<string, readonly SpreadsheetViewRowState[]>
  sourceRowsById: ReadonlyMap<DataGridRowId, SpreadsheetViewRowState>
  outputRowsBySourceRowId: ReadonlyMap<DataGridRowId, readonly SpreadsheetViewRowState[]>
}

export interface DataGridSpreadsheetViewGroupStageStateBucket {
  groupId: string
  rowsById: ReadonlyMap<DataGridRowId, SpreadsheetViewRowState>
  outputRow: SpreadsheetViewRowState
}

export interface DataGridSpreadsheetViewGroupStageState {
  stageKey: string
  sourceRowsById: ReadonlyMap<DataGridRowId, SpreadsheetViewRowState>
  bucketsByGroupId: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageStateBucket>
}

export interface DataGridSpreadsheetViewPivotStageState {
  stageKey: string
  sourceRowsById: ReadonlyMap<DataGridRowId, SpreadsheetViewRowState>
  leafRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<Record<string, unknown>>>
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
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DataGridSpreadsheetViewMaterializationDiagnostic[]

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

function createMaterializedCellRawInput(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }
  return value.trimStart().startsWith("=") ? normalizeOutputValue(value) : ""
}

function createSpreadsheetViewValues(): Record<string, unknown> {
  return {}
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

function createGroupStageKey(
  fields: readonly DataGridSpreadsheetViewGroupByField[],
  aggregations: readonly DataGridSpreadsheetViewAggregation[],
): string {
  return [
    fields.map(field => `${field.key}->${field.as ?? field.key}`).join("\u001f"),
    aggregations.map(aggregation => (
      `${normalizeColumnKey(aggregation.key, "aggregation key")}:${aggregation.agg}:${aggregation.field ?? ""}`
    )).join("\u001f"),
  ].join("|")
}

function createGroupOutputRow(
  groupId: string,
  anchorValues: Record<string, unknown>,
  groupRows: readonly SpreadsheetViewRowState[],
  groupFields: readonly DataGridSpreadsheetViewGroupByField[],
  aggregations: readonly DataGridSpreadsheetViewAggregation[],
): SpreadsheetViewRowState {
  const values = createSpreadsheetViewValues()
  for (const field of groupFields) {
    values[field.as ?? field.key] = anchorValues[field.key] ?? null
  }
  for (const aggregation of aggregations) {
    const key = normalizeColumnKey(aggregation.key, "aggregation key")
    values[key] = aggregateGroupValues(groupRows, aggregation)
  }
  return {
    id: groupId,
    values,
  }
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
  previousGroupStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState> | undefined,
  nextGroupStageStatesByKey: Map<string, DataGridSpreadsheetViewGroupStageState>,
): SpreadsheetViewDataset {
  const groupFields = normalizeGroupByFields(step.by)
  if (groupFields.length === 0 && step.aggregations.length === 0) {
    throw new Error("[DataGridSpreadsheetView] group step must include fields or aggregations.")
  }
  const sourceColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const stageKey = createGroupStageKey(groupFields, step.aggregations)

  const columns: SpreadsheetViewColumnState[] = []
  for (const field of groupFields) {
    const sourceColumn = sourceColumnsByKey.get(field.key)
    const key = field.as ?? field.key
    columns.push({
      key,
      title: normalizeColumnTitle(field.label, sourceColumn?.title ?? key),
      formulaAlias: sourceColumn?.formulaAlias ?? normalizeColumnTitle(field.label, sourceColumn?.title ?? key),
      style: sourceColumn?.style ?? null,
    })
  }
  for (const aggregation of step.aggregations) {
    const key = normalizeColumnKey(aggregation.key, "aggregation key")
    columns.push({
      key,
      title: normalizeColumnTitle(aggregation.label, key),
      formulaAlias: normalizeColumnTitle(aggregation.label, key),
      style: NUMERIC_AGGREGATIONS.has(aggregation.agg)
        ? Object.freeze({
          textAlign: "right",
          ...(aggregation.agg === "sum" ? { fontWeight: 600 } : {}),
        })
        : null,
      })
  }

  const previousState = previousGroupStageStatesByKey?.get(stageKey)
  const nextSourceRowsById = new Map<DataGridRowId, SpreadsheetViewRowState>()
  type MutableGroupBucketState = {
    groupId: string
    rowsById: Map<DataGridRowId, SpreadsheetViewRowState>
    outputRow: SpreadsheetViewRowState | null
  }
  const nextBucketsByGroupId = previousState
    ? new Map(
      [...previousState.bucketsByGroupId.entries()].map(([groupId, bucket]) => [
        groupId,
        {
          groupId: bucket.groupId,
          rowsById: new Map(bucket.rowsById),
          outputRow: bucket.outputRow,
        },
      ]),
    )
    : new Map<string, MutableGroupBucketState>()
  const affectedGroupIds = new Set<string>()

  for (const row of dataset.rows) {
    nextSourceRowsById.set(row.id, row)
  }

  if (previousState) {
    for (const [rowId, previousRow] of previousState.sourceRowsById.entries()) {
      const nextRow = nextSourceRowsById.get(rowId)
      if (nextRow && shallowSpreadsheetViewValuesEqual(nextRow.values, previousRow.values)) {
        continue
      }
      const previousBucket = nextBucketsByGroupId.get(buildGroupRowId(groupFields, previousRow))
      previousBucket?.rowsById.delete(rowId)
      affectedGroupIds.add(buildGroupRowId(groupFields, previousRow))
    }
  }

  for (const row of dataset.rows) {
    const nextRow = nextSourceRowsById.get(row.id)
    if (!nextRow) {
      continue
    }
    const previousRow = previousState?.sourceRowsById.get(row.id)
    if (previousRow && shallowSpreadsheetViewValuesEqual(previousRow.values, nextRow.values)) {
      continue
    }
    const groupId = buildGroupRowId(groupFields, nextRow)
    const bucket = nextBucketsByGroupId.get(groupId) ?? {
      groupId,
      rowsById: new Map<DataGridRowId, SpreadsheetViewRowState>(),
      outputRow: null,
    }
    bucket.rowsById.set(row.id, nextRow)
    nextBucketsByGroupId.set(groupId, bucket)
    affectedGroupIds.add(groupId)
  }

  for (const groupId of affectedGroupIds) {
    const bucket = nextBucketsByGroupId.get(groupId)
    if (!bucket || bucket.rowsById.size === 0) {
      nextBucketsByGroupId.delete(groupId)
      continue
    }
    let anchorValues: Record<string, unknown> | null = null
    for (const row of dataset.rows) {
      if (bucket.rowsById.has(row.id)) {
        anchorValues = bucket.rowsById.get(row.id)?.values ?? null
        break
      }
    }
    if (!anchorValues) {
      nextBucketsByGroupId.delete(groupId)
      continue
    }
    bucket.outputRow = createGroupOutputRow(
      groupId,
      anchorValues,
      [...bucket.rowsById.values()],
      groupFields,
      step.aggregations,
    )
  }

  const rows: SpreadsheetViewRowState[] = []
  const finalizedBucketsByGroupId = new Map<string, DataGridSpreadsheetViewGroupStageStateBucket>()
  const seenGroupIds = new Set<string>()
  for (const row of dataset.rows) {
    const groupId = buildGroupRowId(groupFields, row)
    if (seenGroupIds.has(groupId)) {
      continue
    }
    seenGroupIds.add(groupId)
    const bucket = nextBucketsByGroupId.get(groupId)
    if (!bucket?.outputRow) {
      continue
    }
    rows.push(bucket.outputRow)
    finalizedBucketsByGroupId.set(groupId, {
      groupId: bucket.groupId,
      rowsById: bucket.rowsById,
      outputRow: bucket.outputRow,
    })
  }

  nextGroupStageStatesByKey.set(stageKey, {
    stageKey,
    sourceRowsById: nextSourceRowsById,
    bucketsByGroupId: finalizedBucketsByGroupId,
  })

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

function createPivotStageKey(
  normalizedSpec: DataGridPivotSpec,
): string {
  return JSON.stringify(normalizedSpec)
}

function applyPivotStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewPivotStep,
  previousPivotStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState> | undefined,
  nextPivotStageStatesByKey: Map<string, DataGridSpreadsheetViewPivotStageState>,
): SpreadsheetViewDataset {
  const normalizedSpec = normalizePivotSpec(step.spec)
  if (!normalizedSpec) {
    throw new Error("[DataGridSpreadsheetView] pivot step must include at least one value aggregation.")
  }

  const sourceColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const stageKey = createPivotStageKey(normalizedSpec)
  const previousState = previousPivotStageStatesByKey?.get(stageKey)
  const nextSourceRowsById = new Map<DataGridRowId, SpreadsheetViewRowState>()
  const nextLeafRowsById = new Map<DataGridRowId, DataGridRowNode<Record<string, unknown>>>()
  const runtime = createPivotRuntime<Record<string, unknown>>()
  const projection = runtime.projectRows({
    inputRows: dataset.rows.map((row, index) => {
      nextSourceRowsById.set(row.id, row)
      const previousRow = previousState?.sourceRowsById.get(row.id)
      const previousLeafRow = previousState?.leafRowsById.get(row.id)
      const leafRow = previousLeafRow
        && previousLeafRow.sourceIndex === index
        && previousRow
        && shallowSpreadsheetViewValuesEqual(previousRow.values, row.values)
        ? previousLeafRow
        : createPivotLeafRow(row, index)
      nextLeafRowsById.set(row.id, leafRow)
      return leafRow
    }),
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
        formulaAlias: sourceColumn?.formulaAlias ?? column.title,
        style: sourceColumn?.style ?? null,
      }
    }
    return {
      key: column.key,
      title: column.title,
      formulaAlias: column.title,
      style: column.value && column.value.agg !== "custom" && NUMERIC_AGGREGATIONS.has(column.value.agg)
        ? Object.freeze({ textAlign: "right" })
        : null,
    }
  })

  const rows: SpreadsheetViewRowState[] = projection.rows.map(row => {
    const rowRecord = row.row as Record<string, unknown>
    return {
      id: row.rowId,
      values: rowRecord,
    }
  })

  nextPivotStageStatesByKey.set(stageKey, {
    stageKey,
    sourceRowsById: nextSourceRowsById,
    leafRowsById: nextLeafRowsById,
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
      formulaAlias: column.formulaAlias,
      style: column.style,
    } satisfies DataGridSpreadsheetColumnSnapshot))),
    rows: Object.freeze(dataset.rows.map(row => ({
      id: row.id,
      style: null,
      cells: Object.freeze(dataset.columns.map(column => ({
        columnKey: column.key,
        rawInput: createMaterializedCellRawInput(row.values[column.key]),
        resolvedValue: row.values[column.key],
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

function datasetToDerivedSheetRuntime(
  dataset: SpreadsheetViewDataset,
  diagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[] = EMPTY_DIAGNOSTICS,
): DataGridSpreadsheetDerivedSheetRuntime {
  return createDataGridSpreadsheetDerivedSheetRuntime({
    columns: dataset.columns.map(column => ({
      key: column.key,
      title: column.title,
      formulaAlias: column.formulaAlias,
      style: column.style,
    })),
    rows: dataset.rows.map(row => ({
      id: row.id,
      values: dataset.columns.map(column => row.values[column.key]),
    })),
    diagnostics,
  })
}

function createDataGridSpreadsheetViewErrorDataset(
  options: {
    sheetId: string
    message: string
  },
): SpreadsheetViewDataset {
  return {
    columns: Object.freeze([
      {
        key: "status",
        title: "Status",
        formulaAlias: "Status",
        style: Object.freeze({ fontWeight: 700 }),
      },
      {
        key: "message",
        title: "Message",
        formulaAlias: "Message",
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
}

export function materializeDataGridSpreadsheetViewSheetResult(
  options: MaterializeDataGridSpreadsheetViewSheetOptions,
): MaterializeDataGridSpreadsheetViewSheetResult {
  const runtimeResult = materializeDataGridSpreadsheetViewRuntimeResult(options)
  return {
    sheetState: datasetToSheetState({
      columns: runtimeResult.derivedRuntime.columns,
      rows: runtimeResult.derivedRuntime.rows.map(row => {
        const values: Record<string, unknown> = {}
        for (let columnIndex = 0; columnIndex < runtimeResult.derivedRuntime.columns.length; columnIndex += 1) {
          const column = runtimeResult.derivedRuntime.columns[columnIndex]
          if (!column) {
            continue
          }
          values[column.key] = row.values[columnIndex]
        }
        return {
          id: row.id,
          values,
        }
      }),
    }, options),
    derivedRuntime: runtimeResult.derivedRuntime,
    diagnostics: runtimeResult.diagnostics,
    joinStageStatesByKey: runtimeResult.joinStageStatesByKey,
    groupStageStatesByKey: runtimeResult.groupStageStatesByKey,
    pivotStageStatesByKey: runtimeResult.pivotStageStatesByKey,
  }
}

export function materializeDataGridSpreadsheetViewRuntimeResult(
  options: MaterializeDataGridSpreadsheetViewSheetOptions,
): MaterializeDataGridSpreadsheetViewRuntimeResult {
  if (options.errorMessage) {
    const diagnostics = Object.freeze([
      {
        code: "cycle" as const,
        message: options.errorMessage,
        relatedSheetId: null,
      },
    ])
    const errorDataset = createDataGridSpreadsheetViewErrorDataset({
      sheetId: options.sheetId,
      message: options.errorMessage,
    })
    return {
      derivedRuntime: datasetToDerivedSheetRuntime(errorDataset, diagnostics),
      diagnostics,
      joinStageStatesByKey: new Map(),
      groupStageStatesByKey: new Map(),
      pivotStageStatesByKey: new Map(),
    }
  }
  if (!options.sourceSheetModel) {
    const diagnostics = Object.freeze([
      {
        code: "source-missing" as const,
        message: `Source sheet '${options.sourceSheetId}' is missing.`,
        relatedSheetId: options.sourceSheetId,
      },
    ])
    const errorDataset = createDataGridSpreadsheetViewErrorDataset({
      sheetId: options.sheetId,
      message: `Source sheet '${options.sourceSheetId}' is missing.`,
    })
    return {
      derivedRuntime: datasetToDerivedSheetRuntime(errorDataset, diagnostics),
      diagnostics,
      joinStageStatesByKey: new Map(),
      groupStageStatesByKey: new Map(),
      pivotStageStatesByKey: new Map(),
    }
  }

  try {
    let dataset = createSpreadsheetViewDatasetFromSheetModel(options.sourceSheetModel)
    const nextJoinStageStatesByKey = new Map<string, DataGridSpreadsheetViewJoinStageState>()
    const nextGroupStageStatesByKey = new Map<string, DataGridSpreadsheetViewGroupStageState>()
    const nextPivotStageStatesByKey = new Map<string, DataGridSpreadsheetViewPivotStageState>()
    for (const step of options.pipeline) {
      switch (step.type) {
        case "filter":
          dataset = applySpreadsheetViewFilterStep(dataset, step)
          break
        case "sort":
          dataset = applySpreadsheetViewSortStep(dataset, step)
          break
        case "project":
          dataset = applySpreadsheetViewProjectStep(dataset, step)
          break
        case "join":
          dataset = applySpreadsheetViewJoinStep(dataset, step, {
            resolveSheetModel: options.resolveSheetModel,
            previousStageStates: options.previousJoinStageStatesByKey,
            nextStageStates: nextJoinStageStatesByKey,
          })
          break
        case "group":
          dataset = applyGroupStep(
            dataset,
            step,
            options.previousGroupStageStatesByKey,
            nextGroupStageStatesByKey,
          )
          break
        case "pivot":
          dataset = applyPivotStep(
            dataset,
            step,
            options.previousPivotStageStatesByKey,
            nextPivotStageStatesByKey,
          )
          break
        default:
          throw new Error("[DataGridSpreadsheetView] unsupported pipeline step.")
      }
    }
    return {
      derivedRuntime: datasetToDerivedSheetRuntime(dataset),
      diagnostics: EMPTY_DIAGNOSTICS,
      joinStageStatesByKey: nextJoinStageStatesByKey,
      groupStageStatesByKey: nextGroupStageStatesByKey,
      pivotStageStatesByKey: nextPivotStageStatesByKey,
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
    const diagnostics = Object.freeze([diagnostic])
    const errorDataset = createDataGridSpreadsheetViewErrorDataset({
      sheetId: options.sheetId,
      message,
    })
    return {
      derivedRuntime: datasetToDerivedSheetRuntime(errorDataset, diagnostics),
      diagnostics,
      joinStageStatesByKey: new Map(),
      groupStageStatesByKey: new Map(),
      pivotStageStatesByKey: new Map(),
    }
  }
}
