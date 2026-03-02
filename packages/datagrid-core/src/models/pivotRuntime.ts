import {
  createDataGridAggregationEngine,
  type DataGridIncrementalAggregationLeafContribution,
  type DataGridIncrementalAggregationGroupState,
} from "./aggregationEngine.js"
import type {
  DataGridAggOp,
  DataGridGroupExpansionSnapshot,
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
  subtotal: boolean
  grandTotal: boolean
}

interface DataGridPivotColumnKeyMeta {
  columnPath: readonly DataGridPivotColumnPathSegment[]
  subtotal: boolean
  grandTotal: boolean
}

interface DataGridPivotFieldResolver<T> {
  field: string
  read: (rowNode: DataGridRowNode<T>) => unknown
}

type DataGridPivotProjectionEntryKind = "group" | "detail" | "subtotal" | "grand-total"

interface DataGridPivotProjectionEntry<T> {
  kind: DataGridPivotProjectionEntryKind
  rowPath: readonly DataGridPivotRowPathSegment[]
  rowDepth: number
  minSourceIndex: number
  minOriginalIndex: number
  columnBuckets?: Map<string, DataGridRowNode<T>[]>
  columnAggregateStateByKey?: Map<string, DataGridIncrementalAggregationGroupState>
}

interface DataGridPivotIncrementalProjectionState<T> {
  modelKey: string
  runtimeColumns: readonly DataGridPivotRuntimeColumn[]
  columnOrder: readonly string[]
  runtimeColumnsByColumnKey: ReadonlyMap<string, readonly DataGridPivotRuntimeColumn[]>
  rowEntries: ReadonlyMap<string, DataGridPivotProjectionEntry<T>>
  rowIndexByEntryKey: ReadonlyMap<string, number>
  rowFieldResolvers: readonly DataGridPivotFieldResolver<T>[]
  columnFieldResolvers: readonly DataGridPivotFieldResolver<T>[]
  normalizeFieldValue: (value: unknown) => string
  includeRowSubtotals: boolean
  includeColumnSubtotals: boolean
  includeGrandTotal: boolean
  includeColumnGrandTotal: boolean
  columnGrandTotalKey: string
  aggregationEngine: ReturnType<typeof createDataGridAggregationEngine<T>>
}

interface DataGridPivotProjectionBuildResult<T> extends DataGridPivotProjectionResult<T> {
  incrementalState: DataGridPivotIncrementalProjectionState<T> | null
}

export interface DataGridPivotProjectionResult<T> {
  rows: DataGridRowNode<T>[]
  columns: DataGridPivotColumn[]
}

export interface DataGridPivotProjectRowsInput<T> {
  inputRows: readonly DataGridRowNode<T>[]
  pivotModel: DataGridPivotSpec
  normalizeFieldValue: (value: unknown) => string
  expansionSnapshot?: DataGridGroupExpansionSnapshot | null
}

export interface DataGridPivotIncrementalPatchRow<T> {
  previousRow: DataGridRowNode<T>
  nextRow: DataGridRowNode<T>
}

export interface DataGridPivotApplyValuePatchInput<T> {
  projectedRows: readonly DataGridRowNode<T>[]
  pivotModel: DataGridPivotSpec
  changedRows: readonly DataGridPivotIncrementalPatchRow<T>[]
}

export interface DataGridPivotRuntime<T> {
  projectRows: (input: DataGridPivotProjectRowsInput<T>) => DataGridPivotProjectionResult<T>
  applyValueOnlyPatch: (input: DataGridPivotApplyValuePatchInput<T>) => DataGridPivotProjectionResult<T> | null
  normalizeColumns: (columns: readonly DataGridPivotColumn[]) => DataGridPivotColumn[]
}

function createPivotAxisKey(
  prefix: "pivot:row:" | "pivot:column:" | "pivot:column-subtotal:" | "pivot:subtotal:" | "pivot:group:",
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
  options: { subtotal?: boolean; grandTotal?: boolean } = {},
): string {
  const axisLabel = options.grandTotal
    ? "grand total"
    : columnPath.length === 0
    ? "total"
    : columnPath.map(segment => `${segment.field}=${segment.value}`).join(" · ")
  const subtotalLabel = options.subtotal ? " · subtotal" : ""
  return `${axisLabel}${subtotalLabel} · ${valueSpec.agg}(${valueSpec.field})`
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

function isPivotPathPrefixOrEqual(
  prefix: readonly { field: string; value: string }[],
  candidate: readonly { field: string; value: string }[],
): boolean {
  if (prefix.length > candidate.length) {
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
  if (kind === "group") {
    return 0
  }
  if (kind === "detail") {
    return 1
  }
  if (kind === "subtotal") {
    return 2
  }
  return 3
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
    ...(column.subtotal ? { subtotal: true } : {}),
    ...(column.grandTotal ? { grandTotal: true } : {}),
    columnPath: column.columnPath.map(segment => ({
      field: segment.field,
      value: segment.value,
    })),
  }))
}

function serializePivotModelForIncrementalState(pivotModel: DataGridPivotSpec): string {
  return JSON.stringify({
    rows: pivotModel.rows,
    columns: pivotModel.columns,
    values: pivotModel.values.map(value => ({ field: value.field, agg: value.agg })),
    rowSubtotals: pivotModel.rowSubtotals === true,
    columnSubtotals: pivotModel.columnSubtotals === true,
    grandTotal: pivotModel.grandTotal === true,
    columnGrandTotal: pivotModel.columnGrandTotal === true,
    columnSubtotalPosition: pivotModel.columnSubtotalPosition === "before" ? "before" : "after",
    columnGrandTotalPosition: pivotModel.columnGrandTotalPosition === "first" ? "first" : "last",
  })
}

function isSameLeafContribution(
  left: DataGridIncrementalAggregationLeafContribution,
  right: DataGridIncrementalAggregationLeafContribution,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    const leftValue = left[key]
    const rightValue = right[key]
    if (
      typeof leftValue === "object" &&
      leftValue !== null &&
      typeof rightValue === "object" &&
      rightValue !== null
    ) {
      const leftRecord = leftValue as Record<string, unknown>
      const rightRecord = rightValue as Record<string, unknown>
      const leftRecordKeys = Object.keys(leftRecord)
      const rightRecordKeys = Object.keys(rightRecord)
      if (leftRecordKeys.length !== rightRecordKeys.length) {
        return false
      }
      for (const nestedKey of leftRecordKeys) {
        if (leftRecord[nestedKey] !== rightRecord[nestedKey]) {
          return false
        }
      }
      continue
    }
    if (leftValue !== rightValue) {
      return false
    }
  }
  return true
}

interface DataGridPivotIncrementalTouchedKeys {
  rowEntryKeys: readonly string[]
  columnKeys: readonly string[]
}

function toPivotRuntimeColumns(
  runtimeColumns: readonly DataGridPivotRuntimeColumn[],
): DataGridPivotColumn[] {
  return runtimeColumns.map(column => ({
    id: column.id,
    valueField: column.valueField,
    agg: column.agg,
    label: createPivotColumnLabel(column.columnPath, {
      field: column.valueField,
      agg: column.agg,
      aggregateKey: column.aggregateKey,
    }, {
      subtotal: column.subtotal,
      grandTotal: column.grandTotal,
    }),
    ...(column.subtotal ? { subtotal: true } : {}),
    ...(column.grandTotal ? { grandTotal: true } : {}),
    columnPath: column.columnPath.map(segment => ({
      field: segment.field,
      value: segment.value,
    })),
  }))
}

function buildPivotIncrementalTouchedKeys<T>(
  row: DataGridRowNode<T>,
  state: DataGridPivotIncrementalProjectionState<T>,
): DataGridPivotIncrementalTouchedKeys | null {
  if (row.kind !== "leaf") {
    return null
  }
  const rowPath = state.rowFieldResolvers.map(resolver => ({
    field: resolver.field,
    value: normalizePivotAxisValue(resolver.read(row), state.normalizeFieldValue),
  }))
  const columnPath = state.columnFieldResolvers.map(resolver => ({
    field: resolver.field,
    value: normalizePivotAxisValue(resolver.read(row), state.normalizeFieldValue),
  }))

  const rowEntryKeys = new Set<string>()
  const columnKeys = new Set<string>()

  const rowKey = createPivotAxisKey("pivot:row:", rowPath)
  rowEntryKeys.add(rowKey)
  if (rowPath.length > 1) {
    for (let depth = 1; depth < rowPath.length; depth += 1) {
      const groupPath = rowPath.slice(0, depth)
      rowEntryKeys.add(createPivotAxisKey("pivot:group:", groupPath))
      if (state.includeRowSubtotals) {
        rowEntryKeys.add(`${createPivotAxisKey("pivot:subtotal:", groupPath)}depth:${depth}`)
      }
    }
  }
  if (state.includeGrandTotal) {
    rowEntryKeys.add("pivot:grand-total")
  }

  const columnKey = createPivotAxisKey("pivot:column:", columnPath)
  columnKeys.add(columnKey)
  if (state.includeColumnGrandTotal) {
    columnKeys.add(state.columnGrandTotalKey)
  }
  if (state.includeColumnSubtotals) {
    for (let depth = 1; depth < columnPath.length; depth += 1) {
      const subtotalColumnPath = columnPath.slice(0, depth)
      columnKeys.add(`${createPivotAxisKey("pivot:column-subtotal:", subtotalColumnPath)}depth:${depth}`)
    }
  }

  return {
    rowEntryKeys: Array.from(rowEntryKeys).filter(entryKey => state.rowEntries.has(entryKey)),
    columnKeys: Array.from(columnKeys).filter(columnKey => state.runtimeColumnsByColumnKey.has(columnKey)),
  }
}

function isSamePivotTouchedKeys(
  left: DataGridPivotIncrementalTouchedKeys,
  right: DataGridPivotIncrementalTouchedKeys,
): boolean {
  if (left.rowEntryKeys.length !== right.rowEntryKeys.length || left.columnKeys.length !== right.columnKeys.length) {
    return false
  }
  const rightRowEntries = new Set<string>(right.rowEntryKeys)
  for (const key of left.rowEntryKeys) {
    if (!rightRowEntries.has(key)) {
      return false
    }
  }
  const rightColumns = new Set<string>(right.columnKeys)
  for (const key of left.columnKeys) {
    if (!rightColumns.has(key)) {
      return false
    }
  }
  return true
}

function buildPivotProjectionRows<T>(
  input: DataGridPivotProjectRowsInput<T>,
): DataGridPivotProjectionBuildResult<T> {
  const { inputRows, pivotModel, normalizeFieldValue } = input
  if (inputRows.length === 0) {
    return { rows: [], columns: [], incrementalState: null }
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
    return { rows: [], columns: [], incrementalState: null }
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
  const includeColumnSubtotals = pivotModel.columnSubtotals === true && columnFieldResolvers.length > 1
  const includeGrandTotal = pivotModel.grandTotal === true
  const includeColumnGrandTotal = pivotModel.columnGrandTotal === true
  const columnSubtotalPosition = pivotModel.columnSubtotalPosition === "before"
    ? "before"
    : "after"
  const columnGrandTotalPosition = pivotModel.columnGrandTotalPosition === "first"
    ? "first"
    : "last"
  const columnGrandTotalKey = "pivot:column:grand-total"

  const rowEntries = new Map<string, DataGridPivotProjectionEntry<T>>()
  const groupLeafCountByPathKey = new Map<string, number>()
  const columnMetaByKey = new Map<string, DataGridPivotColumnKeyMeta>()
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

  const registerColumnKey = (
    columnKey: string,
    columnPath: readonly DataGridPivotColumnPathSegment[],
    subtotal: boolean,
    grandTotal: boolean,
  ): void => {
    if (columnMetaByKey.has(columnKey)) {
      return
    }
    columnMetaByKey.set(columnKey, {
      columnPath,
      subtotal,
      grandTotal,
    })
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
    registerColumnKey(columnKey, columnPath, false, false)
    const leafContribution = canUseIncrementalPivotAggregation
      ? pivotAggregationEngine.createLeafContribution(row)
      : null
    if (rowPath.length > 1) {
      for (let depth = 1; depth < rowPath.length; depth += 1) {
        const groupPath = rowPath.slice(0, depth)
        const groupRowKey = createPivotAxisKey("pivot:group:", groupPath)
        const groupEntry = ensureRowEntry(groupRowKey, groupPath, row, "group", depth)
        addRowToPivotEntry(groupEntry, columnKey, row, leafContribution)
        if (includeColumnGrandTotal) {
          addRowToPivotEntry(groupEntry, columnGrandTotalKey, row, leafContribution)
        }
        const groupPathKey = createPivotAxisKey("pivot:row:", groupPath)
        groupLeafCountByPathKey.set(groupPathKey, (groupLeafCountByPathKey.get(groupPathKey) ?? 0) + 1)
        if (includeRowSubtotals) {
          const subtotalKey = `${createPivotAxisKey("pivot:subtotal:", groupPath)}depth:${depth}`
          const subtotalEntry = ensureRowEntry(subtotalKey, groupPath, row, "subtotal", depth)
          addRowToPivotEntry(subtotalEntry, columnKey, row, leafContribution)
          if (includeColumnGrandTotal) {
            addRowToPivotEntry(subtotalEntry, columnGrandTotalKey, row, leafContribution)
          }
        }
      }
    }
    const rowEntry = ensureRowEntry(rowKey, rowPath, row, "detail", rowPath.length)
    addRowToPivotEntry(rowEntry, columnKey, row, leafContribution)
    if (includeColumnGrandTotal) {
      addRowToPivotEntry(rowEntry, columnGrandTotalKey, row, leafContribution)
    }
    if (includeColumnSubtotals) {
      for (let depth = 1; depth < columnPath.length; depth += 1) {
        const subtotalColumnPath = columnPath.slice(0, depth)
        const subtotalColumnKey = `${createPivotAxisKey("pivot:column-subtotal:", subtotalColumnPath)}depth:${depth}`
        registerColumnKey(subtotalColumnKey, subtotalColumnPath, true, false)
        addRowToPivotEntry(rowEntry, subtotalColumnKey, row, leafContribution)
        if (rowPath.length > 1) {
          for (let groupDepth = 1; groupDepth < rowPath.length; groupDepth += 1) {
            const groupPath = rowPath.slice(0, groupDepth)
            const groupRowKey = createPivotAxisKey("pivot:group:", groupPath)
            const groupEntry = rowEntries.get(groupRowKey)
            if (groupEntry) {
              addRowToPivotEntry(groupEntry, subtotalColumnKey, row, leafContribution)
            }
            if (includeRowSubtotals) {
              const subtotalRowKey = `${createPivotAxisKey("pivot:subtotal:", groupPath)}depth:${groupDepth}`
              const subtotalEntry = rowEntries.get(subtotalRowKey)
              if (subtotalEntry) {
                addRowToPivotEntry(subtotalEntry, subtotalColumnKey, row, leafContribution)
              }
            }
          }
        }
        if (includeGrandTotal) {
          const grandTotalEntry = ensureRowEntry("pivot:grand-total", [], row, "grand-total", 0)
          addRowToPivotEntry(grandTotalEntry, subtotalColumnKey, row, leafContribution)
        }
      }
    }
    if (includeGrandTotal) {
      const grandTotalEntry = ensureRowEntry("pivot:grand-total", [], row, "grand-total", 0)
      addRowToPivotEntry(grandTotalEntry, columnKey, row, leafContribution)
      if (includeColumnGrandTotal) {
        addRowToPivotEntry(grandTotalEntry, columnGrandTotalKey, row, leafContribution)
      }
    }
  }

  if (rowEntries.size === 0) {
    return { rows: [], columns: [], incrementalState: null }
  }

  if (includeColumnGrandTotal) {
    registerColumnKey(columnGrandTotalKey, [], false, true)
  }

  const columnOrder = Array.from(columnMetaByKey.entries())
    .sort(([leftKey, leftMeta], [rightKey, rightMeta]) => {
      if (leftMeta.grandTotal !== rightMeta.grandTotal) {
        if (columnGrandTotalPosition === "first") {
          return leftMeta.grandTotal ? -1 : 1
        }
        return leftMeta.grandTotal ? 1 : -1
      }
      const pathComparison = comparePivotPathSegments(leftMeta.columnPath, rightMeta.columnPath)
      if (pathComparison !== 0) {
        const leftShorterPrefix = leftMeta.subtotal
          && isPivotPathPrefixOrEqual(leftMeta.columnPath, rightMeta.columnPath)
        const rightShorterPrefix = rightMeta.subtotal
          && isPivotPathPrefixOrEqual(rightMeta.columnPath, leftMeta.columnPath)
        if (leftShorterPrefix !== rightShorterPrefix) {
          if (columnSubtotalPosition === "before") {
            return leftShorterPrefix ? -1 : 1
          }
          return leftShorterPrefix ? 1 : -1
        }
        return pathComparison
      }
      if (leftMeta.subtotal !== rightMeta.subtotal) {
        if (columnSubtotalPosition === "before") {
          return leftMeta.subtotal ? -1 : 1
        }
        return leftMeta.subtotal ? 1 : -1
      }
      return leftKey.localeCompare(rightKey)
    })
    .map(([columnKey]) => columnKey)

  const runtimeColumns: DataGridPivotRuntimeColumn[] = []
  const runtimeColumnsByColumnKey = new Map<string, DataGridPivotRuntimeColumn[]>()
  for (const columnKey of columnOrder) {
    const columnMeta = columnMetaByKey.get(columnKey)
    const columnPath = columnMeta?.columnPath ?? []
    const subtotal = columnMeta?.subtotal === true
    const grandTotal = columnMeta?.grandTotal === true
    const runtimeColumnsForKey: DataGridPivotRuntimeColumn[] = []
    for (const valueSpec of valueSpecs) {
      const runtimeColumn: DataGridPivotRuntimeColumn = {
        id: createPivotColumnId(columnKey, valueSpec),
        columnKey,
        valueField: valueSpec.field,
        agg: valueSpec.agg,
        aggregateKey: valueSpec.aggregateKey,
        columnPath,
        subtotal,
        grandTotal,
      }
      runtimeColumns.push(runtimeColumn)
      runtimeColumnsForKey.push(runtimeColumn)
    }
    runtimeColumnsByColumnKey.set(columnKey, runtimeColumnsForKey)
  }

  const expansionSnapshot = input.expansionSnapshot ?? null
  const expansionToggledKeys = new Set<string>(expansionSnapshot?.toggledGroupKeys ?? [])
  const isExpanded = (groupKey: string): boolean => {
    if (!expansionSnapshot) {
      return true
    }
    return expansionSnapshot.expandedByDefault
      ? !expansionToggledKeys.has(groupKey)
      : expansionToggledKeys.has(groupKey)
  }

  const toRowPathKey = (segments: readonly DataGridPivotRowPathSegment[]): string => {
    return createPivotAxisKey("pivot:row:", segments)
  }
  const pushByKey = (target: Map<string, string[]>, key: string, value: string): void => {
    const existing = target.get(key)
    if (existing) {
      existing.push(value)
      return
    }
    target.set(key, [value])
  }
  const compareEntryKeys = (leftKey: string, rightKey: string): number => {
    const left = rowEntries.get(leftKey)
    const right = rowEntries.get(rightKey)
    if (!left || !right) {
      return leftKey.localeCompare(rightKey)
    }
    const pathComparison = comparePivotPathSegments(left.rowPath, right.rowPath)
    if (pathComparison !== 0) {
      return pathComparison
    }
    const rankComparison = resolvePivotProjectionEntryRank(left.kind) - resolvePivotProjectionEntryRank(right.kind)
    if (rankComparison !== 0) {
      return rankComparison
    }
    return leftKey.localeCompare(rightKey)
  }
  const compareGroupPathKeys = (leftPathKey: string, rightPathKey: string): number => {
    const leftEntryKey = groupEntryKeyByPathKey.get(leftPathKey)
    const rightEntryKey = groupEntryKeyByPathKey.get(rightPathKey)
    if (!leftEntryKey || !rightEntryKey) {
      return leftPathKey.localeCompare(rightPathKey)
    }
    const leftEntry = rowEntries.get(leftEntryKey)
    const rightEntry = rowEntries.get(rightEntryKey)
    if (!leftEntry || !rightEntry) {
      return leftEntryKey.localeCompare(rightEntryKey)
    }
    const pathComparison = comparePivotPathSegments(leftEntry.rowPath, rightEntry.rowPath)
    if (pathComparison !== 0) {
      return pathComparison
    }
    return leftEntryKey.localeCompare(rightEntryKey)
  }

  const groupEntryKeyByPathKey = new Map<string, string>()
  const groupChildPathKeysByPathKey = new Map<string, string[]>()
  const groupDetailEntryKeysByPathKey = new Map<string, string[]>()
  const groupSubtotalEntryKeysByPathKey = new Map<string, string[]>()
  const rootGroupPathKeys: string[] = []
  const rootDetailEntryKeys: string[] = []
  const rootSubtotalEntryKeys: string[] = []
  const grandTotalEntryKeys: string[] = []

  for (const [entryKey, entry] of rowEntries.entries()) {
    if (entry.kind === "grand-total") {
      grandTotalEntryKeys.push(entryKey)
      continue
    }
    if (entry.kind === "group") {
      const pathKey = toRowPathKey(entry.rowPath)
      groupEntryKeyByPathKey.set(pathKey, entryKey)
      if (entry.rowDepth <= 1) {
        rootGroupPathKeys.push(pathKey)
      } else {
        const parentPathKey = toRowPathKey(entry.rowPath.slice(0, entry.rowDepth - 1))
        pushByKey(groupChildPathKeysByPathKey, parentPathKey, pathKey)
      }
      continue
    }
    if (entry.kind === "detail") {
      if (entry.rowDepth <= 1) {
        rootDetailEntryKeys.push(entryKey)
      } else {
        const parentPathKey = toRowPathKey(entry.rowPath.slice(0, entry.rowDepth - 1))
        pushByKey(groupDetailEntryKeysByPathKey, parentPathKey, entryKey)
      }
      continue
    }
    if (entry.kind === "subtotal") {
      const pathKey = toRowPathKey(entry.rowPath)
      if (groupEntryKeyByPathKey.has(pathKey)) {
        pushByKey(groupSubtotalEntryKeysByPathKey, pathKey, entryKey)
      } else {
        rootSubtotalEntryKeys.push(entryKey)
      }
    }
  }

  rootGroupPathKeys.sort(compareGroupPathKeys)
  rootDetailEntryKeys.sort(compareEntryKeys)
  rootSubtotalEntryKeys.sort(compareEntryKeys)
  grandTotalEntryKeys.sort(compareEntryKeys)
  for (const values of groupChildPathKeysByPathKey.values()) {
    values.sort(compareGroupPathKeys)
  }
  for (const values of groupDetailEntryKeysByPathKey.values()) {
    values.sort(compareEntryKeys)
  }
  for (const values of groupSubtotalEntryKeysByPathKey.values()) {
    values.sort(compareEntryKeys)
  }

  const buildAggregateRecordByColumnKey = (
    rowEntry: DataGridPivotProjectionEntry<T>,
  ): Map<string, Record<string, unknown>> => {
    const result = new Map<string, Record<string, unknown>>()
    if (canUseIncrementalPivotAggregation) {
      const aggregateStates = rowEntry.columnAggregateStateByKey
      if (aggregateStates) {
        for (const [columnKey, groupState] of aggregateStates.entries()) {
          result.set(columnKey, pivotAggregationEngine.finalizeGroupState(groupState))
        }
      }
      return result
    }
    if (!rowEntry.columnBuckets) {
      return result
    }
    for (const [columnKey, rows] of rowEntry.columnBuckets.entries()) {
      result.set(columnKey, pivotAggregationEngine.computeAggregatesForLeaves(rows))
    }
    return result
  }

  const buildPivotRowNode = (
    rowKey: string,
    rowEntry: DataGridPivotProjectionEntry<T>,
    expanded: boolean,
  ): DataGridRowNode<T> => {
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
    if (typeof rowData.rowId === "undefined") {
      rowData.rowId = rowKey
    }
    if (typeof rowData.rowKey === "undefined") {
      rowData.rowKey = rowKey
    }

    const aggregatesByColumnKey = buildAggregateRecordByColumnKey(rowEntry)
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

    if (rowEntry.kind === "group") {
      const level = Math.max(0, rowEntry.rowDepth - 1)
      const lastSegment = rowEntry.rowPath[rowEntry.rowPath.length - 1]
      const pathKey = toRowPathKey(rowEntry.rowPath)
      return {
        kind: "group",
        data: rowData as T,
        row: rowData as T,
        rowKey,
        rowId: rowKey,
        sourceIndex: rowEntry.minSourceIndex,
        originalIndex: rowEntry.minOriginalIndex,
        displayIndex: -1,
        state: {
          selected: false,
          group: true,
          pinned: "none",
          expanded,
        },
        groupMeta: {
          groupKey: rowKey,
          groupField: lastSegment?.field ?? "",
          groupValue: lastSegment?.value ?? "Group",
          level,
          childrenCount: groupLeafCountByPathKey.get(pathKey) ?? 0,
        },
      }
    }

    return {
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
    }
  }

  const projectedRows: DataGridRowNode<T>[] = []
  const appendGroupPath = (groupPathKey: string): void => {
    const groupEntryKey = groupEntryKeyByPathKey.get(groupPathKey)
    if (!groupEntryKey) {
      return
    }
    const groupEntry = rowEntries.get(groupEntryKey)
    if (!groupEntry) {
      return
    }
    const groupExpanded = isExpanded(groupEntryKey)
    projectedRows.push(buildPivotRowNode(groupEntryKey, groupEntry, groupExpanded))
    if (!groupExpanded) {
      return
    }
    const childGroupPathKeys = groupChildPathKeysByPathKey.get(groupPathKey) ?? []
    for (const childPathKey of childGroupPathKeys) {
      appendGroupPath(childPathKey)
    }
    const detailEntryKeys = groupDetailEntryKeysByPathKey.get(groupPathKey) ?? []
    for (const detailEntryKey of detailEntryKeys) {
      const detailEntry = rowEntries.get(detailEntryKey)
      if (!detailEntry) {
        continue
      }
      projectedRows.push(buildPivotRowNode(detailEntryKey, detailEntry, false))
    }
    const subtotalEntryKeys = groupSubtotalEntryKeysByPathKey.get(groupPathKey) ?? []
    for (const subtotalEntryKey of subtotalEntryKeys) {
      const subtotalEntry = rowEntries.get(subtotalEntryKey)
      if (!subtotalEntry) {
        continue
      }
      projectedRows.push(buildPivotRowNode(subtotalEntryKey, subtotalEntry, false))
    }
  }

  for (const rootGroupPathKey of rootGroupPathKeys) {
    appendGroupPath(rootGroupPathKey)
  }
  for (const detailEntryKey of rootDetailEntryKeys) {
    const detailEntry = rowEntries.get(detailEntryKey)
    if (!detailEntry) {
      continue
    }
    projectedRows.push(buildPivotRowNode(detailEntryKey, detailEntry, false))
  }
  for (const subtotalEntryKey of rootSubtotalEntryKeys) {
    const subtotalEntry = rowEntries.get(subtotalEntryKey)
    if (!subtotalEntry) {
      continue
    }
    projectedRows.push(buildPivotRowNode(subtotalEntryKey, subtotalEntry, false))
  }
  for (const grandTotalEntryKey of grandTotalEntryKeys) {
    const grandTotalEntry = rowEntries.get(grandTotalEntryKey)
    if (!grandTotalEntry) {
      continue
    }
    projectedRows.push(buildPivotRowNode(grandTotalEntryKey, grandTotalEntry, false))
  }

  const columns = runtimeColumns.map(column => ({
    id: column.id,
    valueField: column.valueField,
    agg: column.agg,
    ...(column.subtotal ? { subtotal: true } : {}),
    ...(column.grandTotal ? { grandTotal: true } : {}),
    columnPath: column.columnPath.map(segment => ({
      field: segment.field,
      value: segment.value,
    })),
    label: createPivotColumnLabel(column.columnPath, {
      field: column.valueField,
      agg: column.agg,
      aggregateKey: column.aggregateKey,
    }, {
      subtotal: column.subtotal,
      grandTotal: column.grandTotal,
    }),
  }))

  const modelKey = serializePivotModelForIncrementalState(pivotModel)
  const incrementalState = canUseIncrementalPivotAggregation
    ? {
        modelKey,
        runtimeColumns,
        columnOrder,
        runtimeColumnsByColumnKey,
        rowEntries,
        rowIndexByEntryKey: new Map<string, number>(
          projectedRows.map((row, index) => [String(row.rowId), index]),
        ),
        rowFieldResolvers,
        columnFieldResolvers,
        normalizeFieldValue,
        includeRowSubtotals,
        includeColumnSubtotals,
        includeGrandTotal,
        includeColumnGrandTotal,
        columnGrandTotalKey,
        aggregationEngine: pivotAggregationEngine,
      } satisfies DataGridPivotIncrementalProjectionState<T>
    : null

  return {
    rows: projectedRows,
    columns,
    incrementalState,
  }
}

export function createPivotRuntime<T>(): DataGridPivotRuntime<T> {
  let incrementalState: DataGridPivotIncrementalProjectionState<T> | null = null

  const applyValueOnlyPatch = (input: DataGridPivotApplyValuePatchInput<T>): DataGridPivotProjectionResult<T> | null => {
    const state = incrementalState
    if (!state) {
      return null
    }
    if (state.modelKey !== serializePivotModelForIncrementalState(input.pivotModel)) {
      return null
    }
    const normalizedColumns = normalizePivotColumns(toPivotRuntimeColumns(state.runtimeColumns))
    if (!Array.isArray(input.changedRows) || input.changedRows.length === 0) {
      return {
        rows: [...input.projectedRows],
        columns: normalizedColumns,
      }
    }
    const nextRows = input.projectedRows.slice()
    const affectedEntryKeys = new Set<string>()
    for (const changedRow of input.changedRows) {
      if (changedRow.previousRow.kind !== "leaf" || changedRow.nextRow.kind !== "leaf") {
        return null
      }
      const previousTouched = buildPivotIncrementalTouchedKeys(changedRow.previousRow, state)
      const nextTouched = buildPivotIncrementalTouchedKeys(changedRow.nextRow, state)
      if (!previousTouched || !nextTouched || !isSamePivotTouchedKeys(previousTouched, nextTouched)) {
        return null
      }
      if (previousTouched.rowEntryKeys.length === 0 || previousTouched.columnKeys.length === 0) {
        continue
      }
      const previousContribution = state.aggregationEngine.createLeafContribution(changedRow.previousRow)
      const nextContribution = state.aggregationEngine.createLeafContribution(changedRow.nextRow)
      if (!previousContribution || !nextContribution) {
        return null
      }
      if (isSameLeafContribution(previousContribution, nextContribution)) {
        continue
      }
      for (const entryKey of previousTouched.rowEntryKeys) {
        const rowEntry = state.rowEntries.get(entryKey)
        const aggregateStates = rowEntry?.columnAggregateStateByKey
        if (!rowEntry || !aggregateStates) {
          return null
        }
        affectedEntryKeys.add(entryKey)
        for (const columnKey of previousTouched.columnKeys) {
          let groupState = aggregateStates.get(columnKey)
          if (!groupState) {
            const createdState = state.aggregationEngine.createEmptyGroupState()
            if (!createdState) {
              return null
            }
            aggregateStates.set(columnKey, createdState)
            groupState = createdState
          }
          state.aggregationEngine.applyContributionDelta(groupState, previousContribution, nextContribution)
        }
      }
    }

    if (affectedEntryKeys.size === 0) {
      return {
        rows: nextRows,
        columns: normalizedColumns,
      }
    }

    for (const entryKey of affectedEntryKeys) {
      const rowIndex = state.rowIndexByEntryKey.get(entryKey)
      if (typeof rowIndex !== "number") {
        return null
      }
      const rowEntry = state.rowEntries.get(entryKey)
      const currentRow = nextRows[rowIndex]
      if (!rowEntry || !currentRow || !rowEntry.columnAggregateStateByKey) {
        return null
      }
      const nextRowData = { ...(currentRow.data as Record<string, unknown>) }
      for (const columnKey of state.columnOrder) {
        const runtimeColumnsForKey = state.runtimeColumnsByColumnKey.get(columnKey)
        if (!runtimeColumnsForKey || runtimeColumnsForKey.length === 0) {
          continue
        }
        const groupState = rowEntry.columnAggregateStateByKey.get(columnKey)
        const aggregateRecord = groupState
          ? state.aggregationEngine.finalizeGroupState(groupState)
          : {}
        for (const column of runtimeColumnsForKey) {
          nextRowData[column.id] = aggregateRecord[column.aggregateKey] ?? null
        }
      }
      nextRows[rowIndex] = {
        ...currentRow,
        data: nextRowData as T,
        row: nextRowData as T,
      }
    }

    return {
      rows: nextRows,
      columns: normalizedColumns,
    }
  }

  return {
    projectRows: (input: DataGridPivotProjectRowsInput<T>): DataGridPivotProjectionResult<T> => {
      const built = buildPivotProjectionRows(input)
      incrementalState = built.incrementalState
      return {
        rows: built.rows,
        columns: built.columns,
      }
    },
    applyValueOnlyPatch,
    normalizeColumns: normalizePivotColumns,
  }
}
