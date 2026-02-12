import type { DataGridRowNode } from "../models/rowModel.js"
import type { DataGridSelectionSnapshot } from "./snapshot.js"

export type DataGridSelectionAggregationKind =
  | "count"
  | "countDistinct"
  | "sum"
  | "avg"
  | "min"
  | "max"

export interface DataGridSelectionSummaryColumnConfig<TRow = unknown> {
  key: string
  aggregations?: readonly DataGridSelectionAggregationKind[]
  valueGetter?: (rowNode: DataGridRowNode<TRow>) => unknown
}

export interface DataGridSelectionSummaryColumnSnapshot {
  key: string
  selectedCellCount: number
  metrics: Record<DataGridSelectionAggregationKind, number | null>
}

export type DataGridSelectionSummaryScope = "selected-loaded" | "selected-visible"

export interface DataGridSelectionSummarySnapshot {
  scope: DataGridSelectionSummaryScope
  isPartial: boolean
  missingRowCount: number
  selectedCells: number
  selectedRows: number
  columns: Record<string, DataGridSelectionSummaryColumnSnapshot>
}

export interface CreateDataGridSelectionSummaryOptions<TRow = unknown> {
  selection: DataGridSelectionSnapshot | null
  rowCount: number
  getRow: (rowIndex: number) => DataGridRowNode<TRow> | undefined
  getColumnKeyByIndex: (columnIndex: number) => string | null | undefined
  columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[]
  defaultAggregations?: readonly DataGridSelectionAggregationKind[]
  scope?: DataGridSelectionSummaryScope
  includeRowIndex?: (rowIndex: number) => boolean
}

const DEFAULT_AGGREGATIONS: readonly DataGridSelectionAggregationKind[] = [
  "count",
  "countDistinct",
  "sum",
  "avg",
  "min",
  "max",
]

interface ColumnAccumulator {
  key: string
  selectedCellCount: number
  distinctValues: Set<string>
  numericCount: number
  numericSum: number
  numericMin: number
  numericMax: number
  aggregations: readonly DataGridSelectionAggregationKind[]
}

function readByPath(value: unknown, path: string): unknown {
  if (!path || typeof value !== "object" || value === null) {
    return undefined
  }
  const segments = path.split(".").filter(Boolean)
  let current: unknown = value
  for (const segment of segments) {
    if (typeof current !== "object" || current === null || !(segment in (current as Record<string, unknown>))) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function toComparableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toDistinctKey(value: unknown): string {
  if (value == null) {
    return "null"
  }
  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }
  const kind = typeof value
  if (kind === "number" || kind === "string" || kind === "boolean" || kind === "bigint") {
    return `${kind}:${String(value)}`
  }
  try {
    return `json:${JSON.stringify(value)}`
  } catch {
    return `repr:${String(value)}`
  }
}

function ensureColumnAccumulator(
  map: Map<string, ColumnAccumulator>,
  columnKey: string,
  aggregations: readonly DataGridSelectionAggregationKind[],
): ColumnAccumulator {
  const cached = map.get(columnKey)
  if (cached) {
    return cached
  }
  const accumulator: ColumnAccumulator = {
    key: columnKey,
    selectedCellCount: 0,
    distinctValues: new Set<string>(),
    numericCount: 0,
    numericSum: 0,
    numericMin: Number.POSITIVE_INFINITY,
    numericMax: Number.NEGATIVE_INFINITY,
    aggregations,
  }
  map.set(columnKey, accumulator)
  return accumulator
}

function finalizeMetrics(accumulator: ColumnAccumulator): Record<DataGridSelectionAggregationKind, number | null> {
  const metrics: Record<DataGridSelectionAggregationKind, number | null> = {
    count: null,
    countDistinct: null,
    sum: null,
    avg: null,
    min: null,
    max: null,
  }

  for (const aggregation of accumulator.aggregations) {
    if (aggregation === "count") {
      metrics.count = accumulator.selectedCellCount
      continue
    }
    if (aggregation === "countDistinct") {
      metrics.countDistinct = accumulator.distinctValues.size
      continue
    }
    if (aggregation === "sum") {
      metrics.sum = accumulator.numericCount > 0 ? accumulator.numericSum : null
      continue
    }
    if (aggregation === "avg") {
      metrics.avg = accumulator.numericCount > 0 ? accumulator.numericSum / accumulator.numericCount : null
      continue
    }
    if (aggregation === "min") {
      metrics.min = accumulator.numericCount > 0 ? accumulator.numericMin : null
      continue
    }
    if (aggregation === "max") {
      metrics.max = accumulator.numericCount > 0 ? accumulator.numericMax : null
      continue
    }
  }

  return metrics
}

function normalizeAggregations(
  aggregations: readonly DataGridSelectionAggregationKind[] | undefined,
  fallback: readonly DataGridSelectionAggregationKind[],
): readonly DataGridSelectionAggregationKind[] {
  const source = Array.isArray(aggregations) && aggregations.length > 0 ? aggregations : fallback
  const unique = new Set<DataGridSelectionAggregationKind>()
  for (const aggregation of source) {
    if (
      aggregation === "count" ||
      aggregation === "countDistinct" ||
      aggregation === "sum" ||
      aggregation === "avg" ||
      aggregation === "min" ||
      aggregation === "max"
    ) {
      unique.add(aggregation)
    }
  }
  return unique.size > 0 ? Array.from(unique) : [...DEFAULT_AGGREGATIONS]
}

function readDefaultCellValue<TRow>(rowNode: DataGridRowNode<TRow>, columnKey: string): unknown {
  const source = rowNode.data as unknown
  if (typeof source !== "object" || source === null) {
    return undefined
  }
  const direct = (source as Record<string, unknown>)[columnKey]
  if (typeof direct !== "undefined") {
    return direct
  }
  return readByPath(source, columnKey)
}

export function createDataGridSelectionSummary<TRow = unknown>(
  options: CreateDataGridSelectionSummaryOptions<TRow>,
): DataGridSelectionSummarySnapshot {
  const scope: DataGridSelectionSummaryScope = options.scope ?? "selected-loaded"
  const selection = options.selection
  if (!selection || !Array.isArray(selection.ranges) || selection.ranges.length === 0) {
    return {
      scope,
      isPartial: false,
      missingRowCount: 0,
      selectedCells: 0,
      selectedRows: 0,
      columns: {},
    }
  }

  const rowCount = Number.isFinite(options.rowCount) ? Math.max(0, Math.trunc(options.rowCount)) : 0
  if (rowCount <= 0) {
    return {
      scope,
      isPartial: false,
      missingRowCount: 0,
      selectedCells: 0,
      selectedRows: 0,
      columns: {},
    }
  }

  const columnConfigMap = new Map<string, DataGridSelectionSummaryColumnConfig<TRow>>()
  for (const column of options.columns ?? []) {
    if (typeof column.key !== "string" || column.key.trim().length === 0) {
      continue
    }
    columnConfigMap.set(column.key, column)
  }

  const defaultAggregations = normalizeAggregations(options.defaultAggregations, DEFAULT_AGGREGATIONS)
  const seenCells = new Set<string>()
  const seenRows = new Set<number>()
  const accumulators = new Map<string, ColumnAccumulator>()
  let missingRowCount = 0

  for (const range of selection.ranges) {
    const startRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.min(range.startRow, range.endRow))))
    const endRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.max(range.startRow, range.endRow))))
    const startCol = Math.max(0, Math.trunc(Math.min(range.startCol, range.endCol)))
    const endCol = Math.max(0, Math.trunc(Math.max(range.startCol, range.endCol)))

    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      if (typeof options.includeRowIndex === "function" && !options.includeRowIndex(rowIndex)) {
        continue
      }
      const rowNode = options.getRow(rowIndex)
      if (!rowNode) {
        missingRowCount += 1
        continue
      }
      for (let colIndex = startCol; colIndex <= endCol; colIndex += 1) {
        const cellKey = `${rowIndex}:${colIndex}`
        if (seenCells.has(cellKey)) {
          continue
        }

        const columnKey = options.getColumnKeyByIndex(colIndex)
        if (typeof columnKey !== "string" || columnKey.length === 0) {
          continue
        }

        seenCells.add(cellKey)
        seenRows.add(rowIndex)

        const columnConfig = columnConfigMap.get(columnKey)
        const aggregations = normalizeAggregations(columnConfig?.aggregations, defaultAggregations)
        const accumulator = ensureColumnAccumulator(accumulators, columnKey, aggregations)

        const value = typeof columnConfig?.valueGetter === "function"
          ? columnConfig.valueGetter(rowNode)
          : readDefaultCellValue(rowNode, columnKey)

        accumulator.selectedCellCount += 1
        accumulator.distinctValues.add(toDistinctKey(value))

        const numeric = toComparableNumber(value)
        if (numeric != null) {
          accumulator.numericCount += 1
          accumulator.numericSum += numeric
          if (numeric < accumulator.numericMin) {
            accumulator.numericMin = numeric
          }
          if (numeric > accumulator.numericMax) {
            accumulator.numericMax = numeric
          }
        }
      }
    }
  }

  const columns: Record<string, DataGridSelectionSummaryColumnSnapshot> = {}
  for (const [columnKey, accumulator] of accumulators.entries()) {
    columns[columnKey] = {
      key: columnKey,
      selectedCellCount: accumulator.selectedCellCount,
      metrics: finalizeMetrics(accumulator),
    }
  }

  return {
    scope,
    isPartial: missingRowCount > 0,
    missingRowCount,
    selectedCells: seenCells.size,
    selectedRows: seenRows.size,
    columns,
  }
}
