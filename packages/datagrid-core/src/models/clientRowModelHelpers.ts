import type {
  DataGridAggregationModel,
  DataGridGroupBySpec,
  DataGridRowId,
  DataGridRowNode,
  DataGridTreeDataDiagnostics,
} from "./rowModel.js"

interface GroupKeySegment {
  field: string
  value: string
}

function createGroupedRowKey(segments: readonly GroupKeySegment[]): string {
  let encoded = "group:"
  for (const segment of segments) {
    encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`
  }
  return encoded
}

export function computeGroupByAggregatesMap<T>(
  inputRows: readonly DataGridRowNode<T>[],
  groupBy: DataGridGroupBySpec,
  resolveGroupValue: (row: DataGridRowNode<T>, field: string) => string,
  computeAggregates: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown>,
): Map<string, Record<string, unknown>> {
  const aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  const fields = groupBy.fields
  if (fields.length === 0 || inputRows.length === 0) {
    return aggregatesByGroupKey
  }

  const projectLevel = (
    rows: readonly DataGridRowNode<T>[],
    level: number,
    path: readonly GroupKeySegment[],
  ): void => {
    if (level >= fields.length || rows.length === 0) {
      return
    }
    const field = fields[level] ?? ""
    const buckets = new Map<string, DataGridRowNode<T>[]>()
    for (const row of rows) {
      const value = resolveGroupValue(row, field)
      const bucket = buckets.get(value)
      if (bucket) {
        bucket.push(row)
      } else {
        buckets.set(value, [row])
      }
    }
    for (const [value, bucketRows] of buckets.entries()) {
      const nextPath: GroupKeySegment[] = [...path, { field, value }]
      const groupKey = createGroupedRowKey(nextPath)
      const aggregates = computeAggregates(bucketRows)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(groupKey, { ...aggregates })
      }
      projectLevel(bucketRows, level + 1, nextPath)
    }
  }

  projectLevel(inputRows, 0, [])
  return aggregatesByGroupKey
}

export function areSameAggregateRecords(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    if (!(key in right) || left[key] !== right[key]) {
      return false
    }
  }
  return true
}

export function patchGroupRowsAggregatesByGroupKey<T>(
  rows: readonly DataGridRowNode<T>[],
  resolveAggregates: (groupKey: string) => Record<string, unknown> | undefined,
): DataGridRowNode<T>[] {
  const patched: DataGridRowNode<T>[] = []
  for (const row of rows) {
    if (row.kind !== "group" || !row.groupMeta?.groupKey) {
      patched.push(row)
      continue
    }
    const nextAggregates = resolveAggregates(row.groupMeta.groupKey)
    if (!nextAggregates || Object.keys(nextAggregates).length === 0) {
      if (!row.groupMeta.aggregates) {
        patched.push(row)
        continue
      }
      const { aggregates: _dropAggregates, ...groupMeta } = row.groupMeta
      patched.push({
        ...row,
        groupMeta,
      })
      continue
    }
    if (areSameAggregateRecords(row.groupMeta.aggregates, nextAggregates)) {
      patched.push(row)
      continue
    }
    patched.push({
      ...row,
      groupMeta: {
        ...row.groupMeta,
        aggregates: { ...nextAggregates },
      },
    })
  }
  return patched
}

export function cloneAggregationModel<T>(
  input: DataGridAggregationModel<T> | null | undefined,
): DataGridAggregationModel<T> | null {
  if (!input || !Array.isArray(input.columns)) {
    return null
  }
  return {
    basis: input.basis,
    columns: input.columns.map(column => ({ ...column })),
  }
}

export function isSameAggregationModel<T>(
  left: DataGridAggregationModel<T> | null,
  right: DataGridAggregationModel<T> | null,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  if (left.basis !== right.basis) {
    return false
  }
  if (left.columns.length !== right.columns.length) {
    return false
  }
  for (let index = 0; index < left.columns.length; index += 1) {
    const leftColumn = left.columns[index]
    const rightColumn = right.columns[index]
    if (!leftColumn || !rightColumn) {
      return false
    }
    if (
      leftColumn.key !== rightColumn.key ||
      leftColumn.field !== rightColumn.field ||
      leftColumn.op !== rightColumn.op ||
      leftColumn.createState !== rightColumn.createState ||
      leftColumn.add !== rightColumn.add ||
      leftColumn.remove !== rightColumn.remove ||
      leftColumn.finalize !== rightColumn.finalize ||
      leftColumn.coerce !== rightColumn.coerce
    ) {
      return false
    }
  }
  return true
}

export function createEmptyTreeDataDiagnostics(
  overrides?: Partial<DataGridTreeDataDiagnostics>,
): DataGridTreeDataDiagnostics {
  return {
    orphans: 0,
    cycles: 0,
    duplicates: 0,
    lastError: null,
    ...overrides,
  }
}

export function findDuplicateRowIds<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowId[] {
  const seen = new Set<DataGridRowId>()
  const duplicates = new Set<DataGridRowId>()
  for (const row of rows) {
    const rowId = row.rowId
    if (seen.has(rowId)) {
      duplicates.add(rowId)
      continue
    }
    seen.add(rowId)
  }
  return [...duplicates]
}
