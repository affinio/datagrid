import {
  buildGroupExpansionSnapshot,
  cloneGroupBySpec,
  isGroupExpanded,
  isSameGroupBySpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizeViewportRange,
  toggleGroupExpansionKey,
  withResolvedRowIdentity,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridRowNodeInput,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridViewportRange,
} from "./rowModel.js"
import type { DataGridAdvancedFilterExpression } from "./rowModel.js"
import {
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  cloneDataGridFilterSnapshot as cloneFilterSnapshot,
  evaluateDataGridAdvancedFilterExpression,
  normalizeDataGridAdvancedFilterExpression,
} from "./advancedFilter.js"

export interface CreateClientRowModelOptions<T> {
  rows?: readonly DataGridRowNodeInput<T>[]
  resolveRowId?: DataGridRowIdResolver<T>
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialGroupBy?: DataGridGroupBySpec | null
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
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

function readRowField<T>(rowNode: DataGridRowNode<T>, key: string, field?: string): unknown {
  const source = rowNode.data as unknown
  const resolvedField = field && field.trim().length > 0 ? field : key
  if (!resolvedField) {
    return undefined
  }
  const directValue = typeof source === "object" && source !== null
    ? (source as Record<string, unknown>)[resolvedField]
    : undefined
  if (typeof directValue !== "undefined") {
    return directValue
  }
  return readByPath(source, resolvedField)
}

function normalizeText(value: unknown): string {
  if (value == null) {
    return ""
  }
  return String(value)
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

function resolveAdvancedExpression(
  filterModel: DataGridFilterSnapshot | null,
): DataGridAdvancedFilterExpression | null {
  if (!filterModel) {
    return null
  }
  const explicit = normalizeDataGridAdvancedFilterExpression(filterModel.advancedExpression ?? null)
  if (explicit) {
    return explicit
  }
  return buildDataGridAdvancedFilterExpressionFromLegacyFilters(filterModel.advancedFilters)
}

function createFilterPredicate<T>(
  filterModel: DataGridFilterSnapshot | null,
): (rowNode: DataGridRowNode<T>) => boolean {
  if (!filterModel) {
    return () => true
  }

  const columnFilters = Object.entries(filterModel.columnFilters ?? {})
    .filter(([, values]) => Array.isArray(values) && values.length > 0)
    .map(([key, values]) => [key, [...values]] as const)
  const advancedExpression = resolveAdvancedExpression(filterModel)

  return (rowNode: DataGridRowNode<T>) => {
    for (const [key, values] of columnFilters) {
      const candidate = normalizeText(readRowField(rowNode, key))
      if (!values.includes(candidate)) {
        return false
      }
    }

    if (advancedExpression) {
      return evaluateDataGridAdvancedFilterExpression(advancedExpression, condition => {
        return readRowField(rowNode, condition.key, condition.field)
      })
    }

    return true
  }
}

function serializeFilterModelForCache(filterModel: DataGridFilterSnapshot | null): string {
  if (!filterModel) {
    return "__none__"
  }
  const columnPart = Object.entries(filterModel.columnFilters ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => `${key}:${values.join("\u001f")}`)
    .join("\u001e")
  const advancedPart = JSON.stringify(resolveAdvancedExpression(filterModel))
  return `${columnPart}||${advancedPart}`
}

function compareUnknown(left: unknown, right: unknown): number {
  if (left == null && right == null) {
    return 0
  }
  if (left == null) {
    return 1
  }
  if (right == null) {
    return -1
  }
  const leftNumber = toComparableNumber(left)
  const rightNumber = toComparableNumber(right)
  if (leftNumber != null && rightNumber != null) {
    return leftNumber - rightNumber
  }
  const leftText = normalizeText(left)
  const rightText = normalizeText(right)
  return leftText.localeCompare(rightText)
}

function sortLeafRows<T>(
  rows: readonly DataGridRowNode<T>[],
  sortModel: readonly DataGridSortState[],
): DataGridRowNode<T>[] {
  const descriptors = Array.isArray(sortModel) ? sortModel.filter(Boolean) : []
  if (descriptors.length === 0) {
    return [...rows]
  }
  const decorated = rows.map((row, index) => ({
    row,
    index,
    sortValues: descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field)),
  }))
  decorated.sort((left, right) => {
    for (let descriptorIndex = 0; descriptorIndex < descriptors.length; descriptorIndex += 1) {
      const descriptor = descriptors[descriptorIndex]
      if (!descriptor) {
        continue
      }
      const direction = descriptor.direction === "desc" ? -1 : 1
      const leftValue = left.sortValues[descriptorIndex]
      const rightValue = right.sortValues[descriptorIndex]
      const compared = compareUnknown(leftValue, rightValue)
      if (compared !== 0) {
        return compared * direction
      }
    }
    const sourceDelta = left.row.sourceIndex - right.row.sourceIndex
    if (sourceDelta !== 0) {
      return sourceDelta
    }
    return left.index - right.index
  })
  return decorated.map(entry => entry.row)
}

interface GroupKeySegment {
  field: string
  value: string
}

function buildGroupKey(segments: readonly GroupKeySegment[]): string {
  return JSON.stringify(segments.map(segment => [segment.field, segment.value]))
}

function normalizeLeafRow<T>(row: DataGridRowNode<T>): DataGridRowNode<T> {
  if (row.kind === "leaf" && row.state.group === false) {
    return row
  }
  return {
    ...row,
    kind: "leaf",
    state: {
      ...row.state,
      group: false,
    },
    groupMeta: undefined,
  }
}

function buildGroupedRows<T>(
  inputRows: readonly DataGridRowNode<T>[],
  groupBy: DataGridGroupBySpec,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
): DataGridRowNode<T>[] {
  const fields = groupBy.fields
  if (fields.length === 0) {
    return inputRows.map(row => normalizeLeafRow(row))
  }
  const groupValueCache = new Map<string, string>()
  const resolveGroupedValue = (row: DataGridRowNode<T>, field: string): string => {
    const cacheKey = `${String(row.rowId)}::${field}`
    const cached = groupValueCache.get(cacheKey)
    if (typeof cached !== "undefined") {
      return cached
    }
    const computed = normalizeText(readRowField(row, field))
    groupValueCache.set(cacheKey, computed)
    return computed
  }

  const projectLevel = (
    rowsAtLevel: readonly DataGridRowNode<T>[],
    level: number,
    path: readonly GroupKeySegment[],
  ): DataGridRowNode<T>[] => {
    if (level >= fields.length) {
      return rowsAtLevel.map(row => normalizeLeafRow(row))
    }
    const field = fields[level] ?? ""
    const buckets = new Map<string, DataGridRowNode<T>[]>()
    for (const row of rowsAtLevel) {
      const value = resolveGroupedValue(row, field)
      if (!buckets.has(value)) {
        buckets.set(value, [])
      }
      buckets.get(value)?.push(row)
    }

    const projected: DataGridRowNode<T>[] = []
    for (const [value, bucketRows] of buckets.entries()) {
      const nextPath: GroupKeySegment[] = [...path, { field, value }]
      const groupKey = buildGroupKey(nextPath)
      const expanded = isGroupExpanded(expansionSnapshot, groupKey)
      const representative = bucketRows[0]
      const children = projectLevel(bucketRows, level + 1, nextPath)
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
          childrenCount: bucketRows.length,
        },
      }
      projected.push(groupNode)
      if (expanded) {
        projected.push(...children)
      }
    }
    return projected
  }

  return projectLevel(inputRows.map(row => normalizeLeafRow(row)), 0, [])
}

function assignDisplayIndexes<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] {
  const projected: DataGridRowNode<T>[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      continue
    }
    if (row.displayIndex === index) {
      projected.push(row)
    } else {
      projected.push({
        ...row,
        displayIndex: index,
      })
    }
  }
  return projected
}

export function createClientRowModel<T>(
  options: CreateClientRowModelOptions<T> = {},
): ClientRowModel<T> {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(value: U) => U
  }).structuredClone

  const cloneSortModel = (input: readonly DataGridSortState[]): readonly DataGridSortState[] =>
    input.map(item => ({ ...item }))

  const cloneFilterModel = (input: DataGridFilterSnapshot | null): DataGridFilterSnapshot | null => {
    if (!input) {
      return null
    }
    if (typeof structuredCloneRef === "function") {
      try {
        return structuredCloneRef(input)
      } catch {
        // Fall through to deterministic JS clone for non-cloneable payloads.
      }
    }
    return cloneFilterSnapshot(input)
  }

  const resolveRowId = options.resolveRowId
  let sourceRows: DataGridRowNode<T>[] = Array.isArray(options.rows)
    ? options.rows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index))
    : []
  let rows: DataGridRowNode<T>[] = []
  let revision = 0
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? cloneSortModel(options.initialSortModel) : []
  let filterModel: DataGridFilterSnapshot | null = cloneFilterModel(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = normalizeGroupBySpec(options.initialGroupBy ?? null)
  const toggledGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, rows.length)
  let disposed = false
  const listeners = new Set<DataGridRowModelListener<T>>()
  let cachedFilterPredicateKey = "__none__"
  let cachedFilterPredicate: ((rowNode: DataGridRowNode<T>) => boolean) | null = null

  function ensureActive() {
    if (disposed) {
      throw new Error("ClientRowModel has been disposed")
    }
  }

  function recomputeProjection() {
    const filterKey = serializeFilterModelForCache(filterModel)
    const filterPredicate = filterKey === cachedFilterPredicateKey && cachedFilterPredicate
      ? cachedFilterPredicate
      : (() => {
          const next = createFilterPredicate(filterModel)
          cachedFilterPredicateKey = filterKey
          cachedFilterPredicate = next
          return next
        })()
    const filteredRows = sourceRows.filter(filterPredicate)
    const sortedRows = sortLeafRows(filteredRows, sortModel)
    const expansionSnapshot = buildGroupExpansionSnapshot(groupBy, toggledGroupKeys)
    const groupedRows = groupBy
      ? buildGroupedRows(sortedRows, groupBy, expansionSnapshot)
      : sortedRows
    rows = assignDisplayIndexes(groupedRows)
    viewportRange = normalizeViewportRange(viewportRange, rows.length)
    revision += 1
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    viewportRange = normalizeViewportRange(viewportRange, rows.length)
    return {
      revision,
      kind: "client",
      rowCount: rows.length,
      loading: false,
      error: null,
      viewportRange,
      sortModel: cloneSortModel(sortModel),
      filterModel: cloneFilterModel(filterModel),
      groupBy: cloneGroupBySpec(groupBy),
      groupExpansion: buildGroupExpansionSnapshot(groupBy, toggledGroupKeys),
    }
  }

  function emit() {
    if (disposed || listeners.size === 0) {
      return
    }
    const snapshot = getSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  recomputeProjection()

  return {
    kind: "client",
    getSnapshot,
    getRowCount() {
      return rows.length
    },
    getRow(index: number) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      return rows[Math.max(0, Math.trunc(index))]
    },
    getRowsInRange(range: DataGridViewportRange) {
      const normalized = normalizeViewportRange(range, rows.length)
      if (rows.length === 0) {
        return []
      }
      return rows.slice(normalized.start, normalized.end + 1)
    },
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      ensureActive()
      sourceRows = Array.isArray(nextRows)
        ? nextRows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index))
        : []
      recomputeProjection()
      emit()
    },
    setViewportRange(range: DataGridViewportRange) {
      ensureActive()
      const nextRange = normalizeViewportRange(range, rows.length)
      if (nextRange.start === viewportRange.start && nextRange.end === viewportRange.end) {
        return
      }
      viewportRange = nextRange
      emit()
    },
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? cloneSortModel(nextSortModel) : []
      recomputeProjection()
      emit()
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      ensureActive()
      filterModel = cloneFilterModel(nextFilterModel ?? null)
      recomputeProjection()
      emit()
    },
    setGroupBy(nextGroupBy: DataGridGroupBySpec | null) {
      ensureActive()
      const normalized = normalizeGroupBySpec(nextGroupBy)
      if (isSameGroupBySpec(groupBy, normalized)) {
        return
      }
      groupBy = normalized
      toggledGroupKeys.clear()
      recomputeProjection()
      emit()
    },
    toggleGroup(groupKey: string) {
      ensureActive()
      if (!groupBy) {
        return
      }
      if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
        return
      }
      recomputeProjection()
      emit()
    },
    refresh(_reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      emit()
    },
    subscribe(listener: DataGridRowModelListener<T>) {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      listeners.clear()
      sourceRows = []
      rows = []
    },
  }
}
