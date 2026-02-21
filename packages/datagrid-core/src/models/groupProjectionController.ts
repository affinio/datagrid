import {
  isGroupExpanded,
  type DataGridGroupBySpec,
  type DataGridGroupExpansionSnapshot,
  type DataGridRowNode,
} from "./rowModel.js"

interface GroupKeySegment {
  field: string
  value: string
}

function enforceCacheCap<K, V>(cache: Map<K, V>, maxSize: number): void {
  if (!Number.isFinite(maxSize) || maxSize <= 0) {
    cache.clear()
    return
  }
  while (cache.size > maxSize) {
    const next = cache.keys().next()
    if (next.done) {
      break
    }
    cache.delete(next.value)
  }
}

function buildGroupKey(segments: readonly GroupKeySegment[]): string {
  let encoded = "group:"
  for (const segment of segments) {
    encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`
  }
  return encoded
}

export interface BuildGroupedRowsProjectionOptions<T> {
  inputRows: readonly DataGridRowNode<T>[]
  groupBy: DataGridGroupBySpec
  expansionSnapshot: DataGridGroupExpansionSnapshot
  readRowField: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown
  normalizeText: (value: unknown) => string
  normalizeLeafRow: (row: DataGridRowNode<T>) => DataGridRowNode<T>
  groupValueCache?: Map<string, string>
  groupValueCounters?: { hits: number; misses: number }
  maxGroupValueCacheSize?: number
}

export function buildGroupedRowsProjection<T>(
  options: BuildGroupedRowsProjectionOptions<T>,
): DataGridRowNode<T>[] {
  const {
    inputRows,
    groupBy,
    expansionSnapshot,
    readRowField,
    normalizeText,
    normalizeLeafRow,
    groupValueCache,
    groupValueCounters,
    maxGroupValueCacheSize,
  } = options
  const fields = groupBy.fields
  const expansionToggledKeys = new Set<string>(expansionSnapshot.toggledGroupKeys)
  if (fields.length === 0) {
    return inputRows.map(row => normalizeLeafRow(row))
  }
  const resolveGroupedValue = (row: DataGridRowNode<T>, field: string): string => {
    const cacheKey = `${String(row.rowId)}::${field}`
    const cache = groupValueCache
    const cached = cache?.get(cacheKey)
    if (typeof cached !== "undefined") {
      if (cache) {
        cache.delete(cacheKey)
        cache.set(cacheKey, cached)
      }
      if (groupValueCounters) {
        groupValueCounters.hits += 1
      }
      return cached
    }
    const computed = normalizeText(readRowField(row, field))
    if (cache) {
      cache.set(cacheKey, computed)
      enforceCacheCap(cache, maxGroupValueCacheSize ?? 0)
      if (groupValueCounters) {
        groupValueCounters.misses += 1
      }
    }
    return computed
  }

  const projectLevel = (
    rowIndexesAtLevel: readonly number[],
    level: number,
    path: readonly GroupKeySegment[],
  ): DataGridRowNode<T>[] => {
    if (level >= fields.length) {
      const projectedLeaves: DataGridRowNode<T>[] = []
      for (const rowIndex of rowIndexesAtLevel) {
        const row = inputRows[rowIndex]
        if (!row) {
          continue
        }
        projectedLeaves.push(normalizeLeafRow(row))
      }
      return projectedLeaves
    }
    const field = fields[level] ?? ""
    const buckets = new Map<string, number[]>()
    for (const rowIndex of rowIndexesAtLevel) {
      const row = inputRows[rowIndex]
      if (!row) {
        continue
      }
      const value = resolveGroupedValue(row, field)
      const bucket = buckets.get(value)
      if (bucket) {
        bucket.push(rowIndex)
        continue
      }
      buckets.set(value, [rowIndex])
    }

    const projected: DataGridRowNode<T>[] = []
    for (const [value, bucketRowIndexes] of buckets.entries()) {
      const nextPath: GroupKeySegment[] = [...path, { field, value }]
      const groupKey = buildGroupKey(nextPath)
      const expanded = isGroupExpanded(expansionSnapshot, groupKey, expansionToggledKeys)
      const representative = inputRows[bucketRowIndexes[0] ?? -1]
      const children = projectLevel(bucketRowIndexes, level + 1, nextPath)
      const groupNode: DataGridRowNode<T> = {
        kind: "group",
        data: ({
          __group: true,
          groupKey,
          field,
          value,
          level,
        } as unknown as T),
        row: ({
          __group: true,
          groupKey,
          field,
          value,
          level,
        } as unknown as T),
        rowKey: groupKey,
        rowId: groupKey,
        sourceIndex: representative?.sourceIndex ?? 0,
        originalIndex: representative?.originalIndex ?? 0,
        displayIndex: -1,
        state: {
          selected: false,
          group: true,
          pinned: "none",
          expanded,
        },
        groupMeta: {
          groupKey,
          groupField: field,
          groupValue: value,
          level,
          childrenCount: bucketRowIndexes.length,
        },
      }
      projected.push(groupNode)
      if (expanded) {
        projected.push(...children)
      }
    }
    return projected
  }

  const allRowIndexes = inputRows.map((_, index) => index)
  return projectLevel(allRowIndexes, 0, [])
}
