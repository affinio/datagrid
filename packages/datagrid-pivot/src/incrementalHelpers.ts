import type {
  DataGridIncrementalAggregationLeafContribution,
} from "./coreTypes.js"
import type {
  DataGridRowNode,
} from "./coreTypes.js"
import type {
  DataGridPivotFieldResolver,
} from "./fieldRuntime.js"
import {
  createPivotAxisKey,
  normalizePivotAxisValue,
} from "./runtimeHelpers.js"

export interface DataGridPivotIncrementalTouchedKeys {
  rowEntryKeys: readonly string[]
  columnKeys: readonly string[]
}

export interface DataGridPivotIncrementalTouchedKeysState<T> {
  rowEntries: ReadonlyMap<string, unknown>
  runtimeColumnsByColumnKey: ReadonlyMap<string, readonly unknown[]>
  rowFieldResolvers: readonly DataGridPivotFieldResolver<T>[]
  columnFieldResolvers: readonly DataGridPivotFieldResolver<T>[]
  normalizeFieldValue: (value: unknown) => string
  includeRowSubtotals: boolean
  includeColumnSubtotals: boolean
  includeGrandTotal: boolean
  includeColumnGrandTotal: boolean
  columnGrandTotalKey: string
}

export function isSameLeafContribution(
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

export function buildPivotIncrementalTouchedKeys<T>(
  row: DataGridRowNode<T>,
  state: DataGridPivotIncrementalTouchedKeysState<T>,
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

  const rowKey = createPivotAxisKey("pivot:row:", rowPath)
  const rowEntryKeys: string[] = []
  if (state.rowEntries.has(rowKey)) {
    rowEntryKeys.push(rowKey)
  }
  if (rowPath.length > 1) {
    for (let depth = 1; depth < rowPath.length; depth += 1) {
      const groupPath = rowPath.slice(0, depth)
      const groupKey = createPivotAxisKey("pivot:group:", groupPath)
      if (state.rowEntries.has(groupKey)) {
        rowEntryKeys.push(groupKey)
      }
      if (state.includeRowSubtotals) {
        const subtotalKey = `${createPivotAxisKey("pivot:subtotal:", groupPath)}depth:${depth}`
        if (state.rowEntries.has(subtotalKey)) {
          rowEntryKeys.push(subtotalKey)
        }
      }
    }
  }
  if (state.includeGrandTotal && state.rowEntries.has("pivot:grand-total")) {
    rowEntryKeys.push("pivot:grand-total")
  }

  const columnKey = createPivotAxisKey("pivot:column:", columnPath)
  const columnKeys: string[] = []
  if (state.runtimeColumnsByColumnKey.has(columnKey)) {
    columnKeys.push(columnKey)
  }
  if (state.includeColumnGrandTotal && state.runtimeColumnsByColumnKey.has(state.columnGrandTotalKey)) {
    columnKeys.push(state.columnGrandTotalKey)
  }
  if (state.includeColumnSubtotals) {
    for (let depth = 1; depth < columnPath.length; depth += 1) {
      const subtotalColumnPath = columnPath.slice(0, depth)
      const subtotalColumnKey = `${createPivotAxisKey("pivot:column-subtotal:", subtotalColumnPath)}depth:${depth}`
      if (state.runtimeColumnsByColumnKey.has(subtotalColumnKey)) {
        columnKeys.push(subtotalColumnKey)
      }
    }
  }

  return {
    rowEntryKeys,
    columnKeys,
  }
}

export function isSamePivotTouchedKeys(
  left: DataGridPivotIncrementalTouchedKeys,
  right: DataGridPivotIncrementalTouchedKeys,
): boolean {
  if (left.rowEntryKeys.length !== right.rowEntryKeys.length || left.columnKeys.length !== right.columnKeys.length) {
    return false
  }
  for (let index = 0; index < left.rowEntryKeys.length; index += 1) {
    if (left.rowEntryKeys[index] !== right.rowEntryKeys[index]) {
      return false
    }
  }
  for (let index = 0; index < left.columnKeys.length; index += 1) {
    if (left.columnKeys[index] !== right.columnKeys[index]) {
      return false
    }
  }
  return true
}
