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

function appendRows<T>(target: DataGridRowNode<T>[], source: readonly DataGridRowNode<T>[]): void {
  for (const row of source) {
    target.push(row)
  }
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
    .map(field => (typeof field === "string" ? field.trim() : ""))
    .filter((field): field is string => field.length > 0)
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

  interface BucketContext {
    field: string
    value: string
    level: number
    groupKey: string
    representative: DataGridRowNode<T> | undefined
    bucketRowIndexes: number[]
    expanded: boolean
  }

  interface ProjectionFrame {
    level: number
    path: GroupKeySegment[]
    rowIndexes: number[]
    initialized: boolean
    entries: Array<[string, number[]]>
    index: number
    projected: DataGridRowNode<T>[]
    pendingBucket: BucketContext | null
  }

  const createGroupNode = (bucket: BucketContext): DataGridRowNode<T> => {
    return {
      kind: "group",
      data: ({
        __group: true,
        groupKey: bucket.groupKey,
        field: bucket.field,
        value: bucket.value,
        level: bucket.level,
      } as unknown as T),
      row: ({
        __group: true,
        groupKey: bucket.groupKey,
        field: bucket.field,
        value: bucket.value,
        level: bucket.level,
      } as unknown as T),
      rowKey: bucket.groupKey,
      rowId: bucket.groupKey,
      sourceIndex: bucket.representative?.sourceIndex ?? 0,
      originalIndex: bucket.representative?.originalIndex ?? 0,
      displayIndex: -1,
      state: {
        selected: false,
        group: true,
        pinned: "none",
        expanded: bucket.expanded,
      },
      groupMeta: {
        groupKey: bucket.groupKey,
        groupField: bucket.field,
        groupValue: bucket.value,
        level: bucket.level,
        childrenCount: bucket.bucketRowIndexes.length,
      },
    }
  }

  const createFrame = (
    rowIndexes: number[],
    level: number,
    path: GroupKeySegment[],
  ): ProjectionFrame => {
    return {
      level,
      path,
      rowIndexes,
      initialized: false,
      entries: [],
      index: 0,
      projected: [],
      pendingBucket: null,
    }
  }

  const allRowIndexes = inputRows.map((_, index) => index)
  const stack: ProjectionFrame[] = [createFrame(allRowIndexes, 0, [])]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (!frame) {
      break
    }

    if (!frame.initialized) {
      frame.initialized = true
      if (frame.level >= fields.length) {
        for (const rowIndex of frame.rowIndexes) {
          const row = inputRows[rowIndex]
          if (!row) {
            continue
          }
          frame.projected.push(normalizeLeafRow(row))
        }
      } else {
        const field = fields[frame.level] ?? ""
        const buckets = new Map<string, number[]>()
        for (const rowIndex of frame.rowIndexes) {
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
        frame.entries = Array.from(buckets.entries())
      }
    }

    const frameCompleted = frame.level >= fields.length || frame.index >= frame.entries.length
    if (frameCompleted) {
      const completedProjection = frame.projected
      stack.pop()
      const parent = stack[stack.length - 1]
      if (!parent) {
        return completedProjection
      }
      const pendingBucket = parent.pendingBucket
      if (!pendingBucket) {
        continue
      }
      parent.pendingBucket = null
      parent.projected.push(createGroupNode(pendingBucket))
      if (pendingBucket.expanded) {
        appendRows(parent.projected, completedProjection)
      }
      parent.index += 1
      continue
    }

    const field = fields[frame.level] ?? ""
    const nextEntry = frame.entries[frame.index]
    if (!nextEntry) {
      frame.index += 1
      continue
    }
    const [value, bucketRowIndexes] = nextEntry
    const nextPath: GroupKeySegment[] = [...frame.path, { field, value }]
    const groupKey = buildGroupKey(nextPath)
    const expanded = isGroupExpanded(expansionSnapshot, groupKey, expansionToggledKeys)
    const bucketContext: BucketContext = {
      field,
      value,
      level: frame.level,
      groupKey,
      representative: inputRows[bucketRowIndexes[0] ?? -1],
      bucketRowIndexes,
      expanded,
    }

    if (!expanded) {
      frame.projected.push(createGroupNode(bucketContext))
      frame.index += 1
      continue
    }

    frame.pendingBucket = bucketContext
    stack.push(createFrame(bucketRowIndexes, frame.level + 1, nextPath))
  }

  return []
}
