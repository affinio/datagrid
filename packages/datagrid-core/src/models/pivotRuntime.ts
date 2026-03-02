import {
  createDataGridAggregationEngine,
  type DataGridIncrementalAggregationLeafContribution,
  type DataGridIncrementalAggregationGroupState,
} from "./aggregationEngine.js"
import type {
  DataGridAggOp,
  DataGridPivotColumn,
  DataGridPivotSpec,
  DataGridRowNode,
} from "./rowModel.js"

interface DataGridPivotRuntimeValueSpec {
  field: string
  agg: DataGridAggOp
  aggregateKey: string
}

interface DataGridPivotRowPathSegment {
  field: string
  value: string
}

interface DataGridPivotColumnPathSegment {
  field: string
  value: string
}

interface DataGridPivotRuntimeColumn {
  id: string
  columnKey: string
  valueField: string
  agg: DataGridAggOp
  aggregateKey: string
  columnPath: readonly DataGridPivotColumnPathSegment[]
}

interface DataGridPivotFieldResolver<T> {
  field: string
  read: (rowNode: DataGridRowNode<T>) => unknown
}

type DataGridPivotProjectionEntryKind = "detail" | "subtotal" | "grand-total"

interface DataGridPivotProjectionEntry<T> {
  kind: DataGridPivotProjectionEntryKind
  rowPath: readonly DataGridPivotRowPathSegment[]
  rowDepth: number
  minSourceIndex: number
  minOriginalIndex: number
  columnBuckets?: Map<string, DataGridRowNode<T>[]>
  columnAggregateStateByKey?: Map<string, DataGridIncrementalAggregationGroupState>
}

export interface DataGridPivotProjectionResult<T> {
  rows: DataGridRowNode<T>[]
  columns: DataGridPivotColumn[]
}

export interface DataGridPivotProjectRowsInput<T> {
  inputRows: readonly DataGridRowNode<T>[]
  pivotModel: DataGridPivotSpec
  normalizeFieldValue: (value: unknown) => string
}

export interface DataGridPivotRuntime<T> {
  projectRows: (input: DataGridPivotProjectRowsInput<T>) => DataGridPivotProjectionResult<T>
  normalizeColumns: (columns: readonly DataGridPivotColumn[]) => DataGridPivotColumn[]
}

function createPivotAxisKey(
  prefix: "pivot:row:" | "pivot:column:" | "pivot:subtotal:",
  segments: readonly { field: string; value: string }[],
): string {
  let encoded = prefix
  for (const segment of segments) {
    encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`
  }
  return encoded
}

function createPivotAggregateKey(spec: DataGridPivotRuntimeValueSpec): string {
  return `pivot:agg:${spec.agg.length}:${spec.agg}${spec.field.length}:${spec.field}`
}

function createPivotColumnId(
  columnKey: string,
  valueSpec: DataGridPivotRuntimeValueSpec,
): string {
  return `pivot|${columnKey}|${createPivotAggregateKey(valueSpec)}`
}

function createPivotColumnLabel(
  columnPath: readonly DataGridPivotColumnPathSegment[],
  valueSpec: DataGridPivotRuntimeValueSpec,
): string {
  const axisLabel = columnPath.length === 0
    ? "total"
    : columnPath.map(segment => `${segment.field}=${segment.value}`).join(" · ")
  return `${axisLabel} · ${valueSpec.agg}(${valueSpec.field})`
}

function normalizePivotAxisValue(
  value: unknown,
  normalizeFieldValue: (value: unknown) => string,
): string {
  if (value == null) {
    return ""
  }
  const normalized = normalizeFieldValue(value)
  return normalized == null ? "" : String(normalized)
}

function comparePivotPathSegments(
  left: readonly { field: string; value: string }[],
  right: readonly { field: string; value: string }[],
): number {
  const maxLength = Math.max(left.length, right.length)
  for (let index = 0; index < maxLength; index += 1) {
    const leftSegment = left[index]
    const rightSegment = right[index]
    if (!leftSegment && !rightSegment) {
      return 0
    }
    if (!leftSegment) {
      return -1
    }
    if (!rightSegment) {
      return 1
    }
    const fieldComparison = leftSegment.field.localeCompare(rightSegment.field)
    if (fieldComparison !== 0) {
      return fieldComparison
    }
    const valueComparison = leftSegment.value.localeCompare(rightSegment.value, undefined, {
      numeric: true,
      sensitivity: "base",
    })
    if (valueComparison !== 0) {
      return valueComparison
    }
  }
  return 0
}

function isPivotPathPrefix(
  prefix: readonly { field: string; value: string }[],
  candidate: readonly { field: string; value: string }[],
): boolean {
  if (prefix.length >= candidate.length) {
    return false
  }
  for (let index = 0; index < prefix.length; index += 1) {
    const leftSegment = prefix[index]
    const rightSegment = candidate[index]
    if (!leftSegment || !rightSegment) {
      return false
    }
    if (leftSegment.field !== rightSegment.field || leftSegment.value !== rightSegment.value) {
      return false
    }
  }
  return true
}

function resolvePivotProjectionEntryRank(kind: DataGridPivotProjectionEntryKind): number {
  if (kind === "detail") {
    return 0
  }
  if (kind === "subtotal") {
    return 1
  }
  return 2
}

function comparePivotProjectionEntries<T>(
  leftKey: string,
  left: DataGridPivotProjectionEntry<T>,
  rightKey: string,
  right: DataGridPivotProjectionEntry<T>,
): number {
  const leftRank = resolvePivotProjectionEntryRank(left.kind)
  const rightRank = resolvePivotProjectionEntryRank(right.kind)
  if (left.kind === "grand-total" || right.kind === "grand-total") {
    if (leftRank !== rightRank) {
      return leftRank - rightRank
    }
  }

  const leftSubtotalParent = left.kind === "subtotal" && isPivotPathPrefix(left.rowPath, right.rowPath)
  const rightSubtotalParent = right.kind === "subtotal" && isPivotPathPrefix(right.rowPath, left.rowPath)
  if (leftSubtotalParent !== rightSubtotalParent) {
    return leftSubtotalParent ? 1 : -1
  }

  const pathComparison = comparePivotPathSegments(left.rowPath, right.rowPath)
  if (pathComparison !== 0) {
    return pathComparison
  }
  if (leftRank !== rightRank) {
    return leftRank - rightRank
  }
  if (left.rowDepth !== right.rowDepth) {
    return left.rowDepth - right.rowDepth
  }
  return leftKey.localeCompare(rightKey)
}

function readByPathSegments(value: unknown, segments: readonly string[]): unknown {
  if (segments.length === 0 || typeof value !== "object" || value === null) {
    return undefined
  }
  let current: unknown = value
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined
      }
      current = current[index]
      continue
    }
    if (typeof current !== "object" || current === null || !(segment in (current as Record<string, unknown>))) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function createPivotFieldResolver<T>(field: string): DataGridPivotFieldResolver<T> | null {
  const normalizedField = field.trim()
  if (normalizedField.length === 0) {
    return null
  }
  const segments = normalizedField.includes(".")
    ? normalizedField.split(".").filter(Boolean)
    : []
  return {
    field: normalizedField,
    read: (rowNode: DataGridRowNode<T>): unknown => {
      const source = rowNode.data as unknown
      const directValue = typeof source === "object" && source !== null
        ? (source as Record<string, unknown>)[normalizedField]
        : undefined
      if (typeof directValue !== "undefined") {
        return directValue
      }
      if (segments.length === 0) {
        return undefined
      }
      return readByPathSegments(source, segments)
    },
  }
}

function normalizePivotColumns(
  columns: readonly DataGridPivotColumn[],
): DataGridPivotColumn[] {
  return columns.map(column => ({
    id: column.id,
    valueField: column.valueField,
    agg: column.agg,
    label: column.label,
    columnPath: column.columnPath.map(segment => ({
      field: segment.field,
      value: segment.value,
    })),
  }))
}

function buildPivotProjectionRows<T>(
  input: DataGridPivotProjectRowsInput<T>,
): DataGridPivotProjectionResult<T> {
  const { inputRows, pivotModel, normalizeFieldValue } = input
  if (inputRows.length === 0) {
    return { rows: [], columns: [] }
  }

  const valueSpecs: DataGridPivotRuntimeValueSpec[] = pivotModel.values.map((valueSpec) => {
    const field = valueSpec.field.trim()
    const aggregateKey = `v:${valueSpec.agg}:${field}`
    return {
      field,
      agg: valueSpec.agg,
      aggregateKey,
    }
  })
  if (valueSpecs.length === 0) {
    return { rows: [], columns: [] }
  }

  const pivotAggregationEngine = createDataGridAggregationEngine<T>({
    basis: "filtered",
    columns: valueSpecs.map(valueSpec => ({
      key: valueSpec.aggregateKey,
      field: valueSpec.field,
      op: valueSpec.agg,
    })),
  })
  const canUseIncrementalPivotAggregation = pivotAggregationEngine.isIncrementalAggregationSupported()
  const rowFieldResolvers: DataGridPivotFieldResolver<T>[] = pivotModel.rows
    .map(field => createPivotFieldResolver<T>(field))
    .filter((resolver): resolver is DataGridPivotFieldResolver<T> => resolver !== null)
  const columnFieldResolvers: DataGridPivotFieldResolver<T>[] = pivotModel.columns
    .map(field => createPivotFieldResolver<T>(field))
    .filter((resolver): resolver is DataGridPivotFieldResolver<T> => resolver !== null)
  const includeRowSubtotals = pivotModel.rowSubtotals === true && rowFieldResolvers.length > 1
  const includeGrandTotal = pivotModel.grandTotal === true

  const rowEntries = new Map<string, DataGridPivotProjectionEntry<T>>()
  const columnPathByKey = new Map<string, readonly DataGridPivotColumnPathSegment[]>()
  const ensureRowEntry = (
    rowKey: string,
    rowPath: readonly DataGridPivotRowPathSegment[],
    row: DataGridRowNode<T>,
    kind: DataGridPivotProjectionEntryKind,
    rowDepth: number,
  ): DataGridPivotProjectionEntry<T> => {
    const existing = rowEntries.get(rowKey)
    if (existing) {
      existing.minSourceIndex = Math.min(existing.minSourceIndex, row.sourceIndex)
      existing.minOriginalIndex = Math.min(existing.minOriginalIndex, row.originalIndex)
      return existing
    }
    const created: DataGridPivotProjectionEntry<T> = {
      kind,
      rowPath,
      rowDepth,
      minSourceIndex: row.sourceIndex,
      minOriginalIndex: row.originalIndex,
      ...(canUseIncrementalPivotAggregation
        ? { columnAggregateStateByKey: new Map<string, DataGridIncrementalAggregationGroupState>() }
        : { columnBuckets: new Map<string, DataGridRowNode<T>[]>() }),
    }
    rowEntries.set(rowKey, created)
    return created
  }

  const addRowToPivotEntry = (
    rowEntry: DataGridPivotProjectionEntry<T>,
    columnKey: string,
    row: DataGridRowNode<T>,
    leafContribution: DataGridIncrementalAggregationLeafContribution | null,
  ): void => {
    if (canUseIncrementalPivotAggregation) {
      if (!leafContribution) {
        return
      }
      const aggregateStates = rowEntry.columnAggregateStateByKey
      if (!aggregateStates) {
        return
      }
      let groupState = aggregateStates.get(columnKey)
      if (!groupState) {
        const createdGroupState = pivotAggregationEngine.createEmptyGroupState()
        if (!createdGroupState) {
          return
        }
        aggregateStates.set(columnKey, createdGroupState)
        groupState = createdGroupState
      }
      pivotAggregationEngine.applyContributionDelta(groupState, null, leafContribution)
      return
    }

    const buckets = rowEntry.columnBuckets
    if (!buckets) {
      return
    }
    const bucket = buckets.get(columnKey)
    if (bucket) {
      bucket.push(row)
    } else {
      buckets.set(columnKey, [row])
    }
  }

  for (const row of inputRows) {
    if (row.kind !== "leaf") {
      continue
    }
    const rowPath = rowFieldResolvers.map(resolver => ({
      field: resolver.field,
      value: normalizePivotAxisValue(resolver.read(row), normalizeFieldValue),
    }))
    const columnPath = columnFieldResolvers.map(resolver => ({
      field: resolver.field,
      value: normalizePivotAxisValue(resolver.read(row), normalizeFieldValue),
    }))
    const rowKey = createPivotAxisKey("pivot:row:", rowPath)
    const columnKey = createPivotAxisKey("pivot:column:", columnPath)
    const leafContribution = canUseIncrementalPivotAggregation
      ? pivotAggregationEngine.createLeafContribution(row)
      : null
    const rowEntry = ensureRowEntry(rowKey, rowPath, row, "detail", rowPath.length)
    addRowToPivotEntry(rowEntry, columnKey, row, leafContribution)
    if (includeRowSubtotals) {
      for (let depth = 1; depth < rowPath.length; depth += 1) {
        const subtotalPath = rowPath.slice(0, depth)
        const subtotalKey = `${createPivotAxisKey("pivot:subtotal:", subtotalPath)}depth:${depth}`
        const subtotalEntry = ensureRowEntry(subtotalKey, subtotalPath, row, "subtotal", depth)
        addRowToPivotEntry(subtotalEntry, columnKey, row, leafContribution)
      }
    }
    if (includeGrandTotal) {
      const grandTotalEntry = ensureRowEntry("pivot:grand-total", [], row, "grand-total", 0)
      addRowToPivotEntry(grandTotalEntry, columnKey, row, leafContribution)
    }

    if (!columnPathByKey.has(columnKey)) {
      columnPathByKey.set(columnKey, columnPath)
    }
  }

  const rowOrder = Array.from(rowEntries.entries())
    .sort(([leftKey, leftEntry], [rightKey, rightEntry]) => {
      return comparePivotProjectionEntries(leftKey, leftEntry, rightKey, rightEntry)
    })
    .map(([rowKey]) => rowKey)
  if (rowOrder.length === 0) {
    return { rows: [], columns: [] }
  }

  const columnOrder = Array.from(columnPathByKey.entries())
    .sort(([leftKey, leftPath], [rightKey, rightPath]) => {
      const pathComparison = comparePivotPathSegments(leftPath, rightPath)
      if (pathComparison !== 0) {
        return pathComparison
      }
      return leftKey.localeCompare(rightKey)
    })
    .map(([columnKey]) => columnKey)

  const runtimeColumns: DataGridPivotRuntimeColumn[] = []
  const runtimeColumnsByColumnKey = new Map<string, DataGridPivotRuntimeColumn[]>()
  for (const columnKey of columnOrder) {
    const columnPath = columnPathByKey.get(columnKey) ?? []
    const runtimeColumnsForKey: DataGridPivotRuntimeColumn[] = []
    for (const valueSpec of valueSpecs) {
      const runtimeColumn: DataGridPivotRuntimeColumn = {
        id: createPivotColumnId(columnKey, valueSpec),
        columnKey,
        valueField: valueSpec.field,
        agg: valueSpec.agg,
        aggregateKey: valueSpec.aggregateKey,
        columnPath,
      }
      runtimeColumns.push(runtimeColumn)
      runtimeColumnsForKey.push(runtimeColumn)
    }
    runtimeColumnsByColumnKey.set(columnKey, runtimeColumnsForKey)
  }

  const projectedRows: DataGridRowNode<T>[] = []
  for (const rowKey of rowOrder) {
    const rowEntry = rowEntries.get(rowKey)
    if (!rowEntry) {
      continue
    }
    const rowData: Record<string, unknown> = {}
    for (const segment of rowEntry.rowPath) {
      rowData[segment.field] = segment.value
    }
    if (rowEntry.kind === "subtotal") {
      const subtotalField = rowFieldResolvers[rowEntry.rowDepth]?.field
      if (subtotalField) {
        rowData[subtotalField] = "Subtotal"
      }
    } else if (rowEntry.kind === "grand-total") {
      const firstRowField = rowFieldResolvers[0]?.field
      if (firstRowField) {
        rowData[firstRowField] = "Grand Total"
      }
    }
    // Keep synthetic pivot rows compatible with adapters that resolve row key from row payload.
    if (typeof rowData.rowId === "undefined") {
      rowData.rowId = rowKey
    }
    if (typeof rowData.rowKey === "undefined") {
      rowData.rowKey = rowKey
    }

    const aggregatesByColumnKey = new Map<string, Record<string, unknown>>()
    if (canUseIncrementalPivotAggregation) {
      const aggregateStates = rowEntry.columnAggregateStateByKey
      if (aggregateStates) {
        for (const [columnKey, groupState] of aggregateStates.entries()) {
          aggregatesByColumnKey.set(columnKey, pivotAggregationEngine.finalizeGroupState(groupState))
        }
      }
    } else if (rowEntry.columnBuckets) {
      for (const [columnKey, rows] of rowEntry.columnBuckets.entries()) {
        aggregatesByColumnKey.set(columnKey, pivotAggregationEngine.computeAggregatesForLeaves(rows))
      }
    }

    for (const columnKey of columnOrder) {
      const runtimeColumnsForKey = runtimeColumnsByColumnKey.get(columnKey)
      if (!runtimeColumnsForKey) {
        continue
      }
      const aggregateRecord = aggregatesByColumnKey.get(columnKey)
      for (const column of runtimeColumnsForKey) {
        rowData[column.id] = aggregateRecord?.[column.aggregateKey] ?? null
      }
    }

    projectedRows.push({
      kind: "leaf",
      data: rowData as T,
      row: rowData as T,
      rowKey,
      rowId: rowKey,
      sourceIndex: rowEntry.minSourceIndex,
      originalIndex: rowEntry.minOriginalIndex,
      displayIndex: -1,
      state: {
        selected: false,
        group: false,
        pinned: "none",
        expanded: false,
      },
    })
  }

  return {
    rows: projectedRows,
    columns: runtimeColumns.map(column => ({
      id: column.id,
      valueField: column.valueField,
      agg: column.agg,
      columnPath: column.columnPath.map(segment => ({
        field: segment.field,
        value: segment.value,
      })),
      label: createPivotColumnLabel(column.columnPath, {
        field: column.valueField,
        agg: column.agg,
        aggregateKey: column.aggregateKey,
      }),
    })),
  }
}

export function createPivotRuntime<T>(): DataGridPivotRuntime<T> {
  return {
    projectRows: buildPivotProjectionRows<T>,
    normalizeColumns: normalizePivotColumns,
  }
}
