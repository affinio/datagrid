import type {
  DataGridAggOp,
  DataGridPivotColumn,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNode,
} from "../models/rowModel.js"
import { createPivotRuntime, normalizePivotSpec } from "../models/index.js"
import { createPivotAxisKey, createPivotColumnId, createPivotColumnLabel } from "@affino/datagrid-pivot"
import type {
  DataGridSpreadsheetViewPivotStageState,
  DataGridSpreadsheetViewPivotStep,
} from "./viewPipeline.js"
import type { SpreadsheetViewColumnState, SpreadsheetViewDataset, SpreadsheetViewRowState } from "./viewPipelineDataset.js"
import {
  isNumericSpreadsheetViewAggregation,
  spreadsheetViewValuesEqual,
} from "./viewPipelineValueUtils.js"

interface SpreadsheetPivotColumnState {
  key: string
  title: string
  source: "row" | "value"
  value?: DataGridPivotColumn
}

function normalizePivotFieldValue(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  return String(value)
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
    state: { selected: false, group: false, pinned: "none", expanded: false },
  }
}

function buildPivotFallbackValueColumns(step: DataGridSpreadsheetViewPivotStep): readonly DataGridPivotColumn[] {
  const normalizedSpec = normalizePivotSpec(step.spec)
  if (!normalizedSpec || normalizedSpec.columns.length > 0) return Object.freeze([])
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
  return agg === "sum" ? fieldTitle : `${agg.toUpperCase()} ${fieldTitle}`
}

function formatPivotColumnTitle(
  column: DataGridPivotColumn,
  normalizedSpec: DataGridPivotSpec,
  sourceColumnsByKey: ReadonlyMap<string, SpreadsheetViewColumnState>,
): string {
  const valueLabel = formatPivotValueLabel(column.valueField, column.agg, sourceColumnsByKey)
  const pathValues = column.columnPath.map(segment => segment.value).filter(value => value.length > 0)
  const hasSingleValueMetric = normalizedSpec.values.length === 1
  if (column.grandTotal) return hasSingleValueMetric ? "Total" : `Total ${valueLabel}`
  if (column.subtotal) {
    const subtotalBase = pathValues.length > 0 ? pathValues.join(" / ") : "Subtotal"
    return hasSingleValueMetric ? `${subtotalBase} subtotal` : `${subtotalBase} subtotal ${valueLabel}`
  }
  if (pathValues.length === 0) return hasSingleValueMetric ? valueLabel : `Total ${valueLabel}`
  const pathLabel = pathValues.join(" / ")
  return hasSingleValueMetric ? pathLabel : `${pathLabel} ${valueLabel}`
}

export function applySpreadsheetViewPivotStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewPivotStep,
  previousPivotStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState> | undefined,
  nextPivotStageStatesByKey: Map<string, DataGridSpreadsheetViewPivotStageState>,
): SpreadsheetViewDataset {
  const normalizedSpec = normalizePivotSpec(step.spec)
  if (!normalizedSpec) throw new Error("[DataGridSpreadsheetView] pivot step must include at least one value aggregation.")

  const sourceColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const stageKey = JSON.stringify(normalizedSpec)
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
        && spreadsheetViewValuesEqual(previousRow.values, row.values)
        ? previousLeafRow
        : createPivotLeafRow(row, index)
      nextLeafRowsById.set(row.id, leafRow)
      return leafRow
    }),
    pivotModel: normalizedSpec,
    normalizeFieldValue: normalizePivotFieldValue,
  })
  const pivotColumns = projection.columns.length > 0 ? projection.columns : buildPivotFallbackValueColumns(step)
  const materializedColumns: SpreadsheetPivotColumnState[] = [
    ...normalizedSpec.rows.map(rowKey => {
      const sourceColumn = sourceColumnsByKey.get(rowKey)
      return { key: rowKey, title: sourceColumn?.title ?? rowKey, source: "row" as const }
    }),
    ...pivotColumns.map(column => ({
      key: column.id,
      title: formatPivotColumnTitle(column, normalizedSpec, sourceColumnsByKey),
      source: "value" as const,
      value: column,
    })),
  ]
  if (materializedColumns.length === 0) throw new Error("[DataGridSpreadsheetView] pivot step did not produce any columns.")

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
      style: column.value && column.value.agg !== "custom" && isNumericSpreadsheetViewAggregation(column.value.agg)
        ? Object.freeze({ textAlign: "right" })
        : null,
    }
  })
  const rows: SpreadsheetViewRowState[] = projection.rows.map(row => ({
    id: row.rowId,
    values: row.row as Record<string, unknown>,
  }))
  nextPivotStageStatesByKey.set(stageKey, {
    stageKey,
    sourceRowsById: nextSourceRowsById,
    leafRowsById: nextLeafRowsById,
  })
  return { columns, rows }
}
