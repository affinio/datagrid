import {
  isGroupExpanded,
  type DataGridGroupBySpec,
  type DataGridGroupExpansionSnapshot,
  type DataGridRowId,
  type DataGridRowNode,
} from "../rowModel.js"
import { enforceCacheCap } from "../clientRowRuntimeUtils.js"

function appendGroupKeyFieldPrefix(prefix: string, field: string): string {
  return `${prefix}${field.length}:${field}`
}

function appendGroupKeyValue(fieldPrefix: string, value: string): string {
  return `${fieldPrefix}${value.length}:${value}`
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
  expansionToggledKeys?: ReadonlySet<string>
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
    expansionToggledKeys: providedExpansionToggledKeys,
    readRowField,
    normalizeText,
    normalizeLeafRow,
    groupValueCache,
    groupValueCounters,
    maxGroupValueCacheSize,
  } = options
  const rawFields = groupBy.fields
  let fields: readonly string[] = rawFields
  for (let index = 0; index < rawFields.length; index += 1) {
    const field = rawFields[index] ?? ""
    if (field.length > 0 && field.trim() === field) {
      continue
    }
    const normalizedFields: string[] = []
    for (let normalizeIndex = 0; normalizeIndex < rawFields.length; normalizeIndex += 1) {
      const rawField = rawFields[normalizeIndex]
      const normalized = typeof rawField === "string"
        ? rawField.trim()
        : ""
      if (normalized.length > 0) {
        normalizedFields.push(normalized)
      }
    }
    fields = normalizedFields
    break
  }
  const expansionToggledKeys = providedExpansionToggledKeys ?? new Set<string>(expansionSnapshot.toggledGroupKeys)
  const cache = groupValueCache
  const cacheMaxSize = Number.isFinite(maxGroupValueCacheSize ?? 0)
    ? Math.max(0, Math.trunc(maxGroupValueCacheSize ?? 0))
    : 0
  const rowIdPrefixById = cache
    ? new Map<DataGridRowId, string>()
    : null
  if (fields.length === 0) {
    return inputRows.map(row => normalizeLeafRow(row))
  }
  const resolveGroupedValue = (row: DataGridRowNode<T>, field: string): string => {
    let cacheKey: string | null = null
    if (cache && rowIdPrefixById) {
      let prefix = rowIdPrefixById.get(row.rowId)
      if (!prefix) {
        prefix = `${String(row.rowId)}::`
        rowIdPrefixById.set(row.rowId, prefix)
      }
      cacheKey = `${prefix}${field}`
    }
    const cached = cache && cacheKey !== null
      ? cache.get(cacheKey)
      : undefined
    if (typeof cached !== "undefined") {
      if (groupValueCounters) {
        groupValueCounters.hits += 1
      }
      return cached
    }
    const computed = normalizeText(readRowField(row, field))
    if (cache && cacheKey) {
      cache.set(cacheKey, computed)
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
    groupKeyPrefix: string
    rowIndexes: number[]
    initialized: boolean
    bucketField: string
    bucketFieldPrefix: string
    bucketIterator: Iterator<[string, number[]]> | null
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
    groupKeyPrefix: string,
  ): ProjectionFrame => {
    return {
      level,
      groupKeyPrefix,
      rowIndexes,
      initialized: false,
      bucketField: "",
      bucketFieldPrefix: "",
      bucketIterator: null,
      projected: [],
      pendingBucket: null,
    }
  }

  const allRowIndexes = new Array<number>(inputRows.length)
  for (let index = 0; index < inputRows.length; index += 1) {
    allRowIndexes[index] = index
  }
  const stack: ProjectionFrame[] = [createFrame(allRowIndexes, 0, "group:")]

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
        frame.bucketField = field
        frame.bucketFieldPrefix = appendGroupKeyFieldPrefix(frame.groupKeyPrefix, field)
        frame.bucketIterator = buckets.entries()
      }
    }

    if (frame.level >= fields.length) {
      const completedProjection = frame.projected
      stack.pop()
      const parent = stack[stack.length - 1]
      if (!parent) {
        if (cache && cacheMaxSize > 0) {
          enforceCacheCap(cache, cacheMaxSize)
        }
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
      continue
    }

    const nextEntry = frame.bucketIterator?.next()
    if (!nextEntry || nextEntry.done) {
      const completedProjection = frame.projected
      stack.pop()
      const parent = stack[stack.length - 1]
      if (!parent) {
        if (cache && cacheMaxSize > 0) {
          enforceCacheCap(cache, cacheMaxSize)
        }
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
      continue
    }
    const [value, bucketRowIndexes] = nextEntry.value
    const groupKey = appendGroupKeyValue(frame.bucketFieldPrefix, value)
    const expanded = isGroupExpanded(expansionSnapshot, groupKey, expansionToggledKeys)
    const bucketContext: BucketContext = {
      field: frame.bucketField,
      value,
      level: frame.level,
      groupKey,
      representative: inputRows[bucketRowIndexes[0] ?? -1],
      bucketRowIndexes,
      expanded,
    }

    if (!expanded) {
      frame.projected.push(createGroupNode(bucketContext))
      continue
    }

    frame.pendingBucket = bucketContext
    stack.push(createFrame(bucketRowIndexes, frame.level + 1, groupKey))
  }

  if (cache && cacheMaxSize > 0) {
    enforceCacheCap(cache, cacheMaxSize)
  }
  return []
}
