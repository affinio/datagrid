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

function evaluateAdvancedFilterClause(
  candidate: unknown,
  type: "text" | "number" | "date",
  operator: string,
  value: unknown,
  value2: unknown,
): boolean {
  const normalizedOperator = operator.trim().toLowerCase()
  if (type === "number" || type === "date") {
    const left = toComparableNumber(candidate)
    const right = toComparableNumber(value)
    const right2 = toComparableNumber(value2)
    if (left == null) {
      return false
    }
    if ((normalizedOperator === "between" || normalizedOperator === "range") && right != null && right2 != null) {
      const min = Math.min(right, right2)
      const max = Math.max(right, right2)
      return left >= min && left <= max
    }
    if (right == null) {
      return true
    }
    if (normalizedOperator === "eq" || normalizedOperator === "equals") {
      return left === right
    }
    if (normalizedOperator === "ne" || normalizedOperator === "not-equals" || normalizedOperator === "notequals") {
      return left !== right
    }
    if (normalizedOperator === "gt" || normalizedOperator === ">") {
      return left > right
    }
    if (normalizedOperator === "gte" || normalizedOperator === ">=") {
      return left >= right
    }
    if (normalizedOperator === "lt" || normalizedOperator === "<") {
      return left < right
    }
    if (normalizedOperator === "lte" || normalizedOperator === "<=") {
      return left <= right
    }
    return true
  }

  const left = normalizeText(candidate).toLowerCase()
  const right = normalizeText(value).toLowerCase()
  if (normalizedOperator === "eq" || normalizedOperator === "equals") {
    return left === right
  }
  if (normalizedOperator === "ne" || normalizedOperator === "not-equals" || normalizedOperator === "notequals") {
    return left !== right
  }
  if (normalizedOperator === "contains") {
    return left.includes(right)
  }
  if (normalizedOperator === "startswith" || normalizedOperator === "starts-with") {
    return left.startsWith(right)
  }
  if (normalizedOperator === "endswith" || normalizedOperator === "ends-with") {
    return left.endsWith(right)
  }
  return true
}

function passesColumnFilters<T>(rowNode: DataGridRowNode<T>, filterModel: DataGridFilterSnapshot | null): boolean {
  if (!filterModel) {
    return true
  }

  for (const [key, values] of Object.entries(filterModel.columnFilters ?? {})) {
    if (!Array.isArray(values) || values.length === 0) {
      continue
    }
    const candidate = normalizeText(readRowField(rowNode, key))
    if (!values.includes(candidate)) {
      return false
    }
  }

  for (const [key, advanced] of Object.entries(filterModel.advancedFilters ?? {})) {
    if (!advanced || !Array.isArray(advanced.clauses) || advanced.clauses.length === 0) {
      continue
    }
    const candidate = readRowField(rowNode, key)
    let decision = evaluateAdvancedFilterClause(
      candidate,
      advanced.type,
      advanced.clauses[0]?.operator ?? "equals",
      advanced.clauses[0]?.value,
      advanced.clauses[0]?.value2,
    )
    for (let index = 1; index < advanced.clauses.length; index += 1) {
      const clause = advanced.clauses[index]
      if (!clause) {
        continue
      }
      const nextDecision = evaluateAdvancedFilterClause(
        candidate,
        advanced.type,
        clause.operator,
        clause.value,
        clause.value2,
      )
      if ((clause.join ?? "and") === "or") {
        decision = decision || nextDecision
      } else {
        decision = decision && nextDecision
      }
    }
    if (!decision) {
      return false
    }
  }

  return true
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
  if (!Array.isArray(sortModel) || sortModel.length === 0) {
    return [...rows]
  }
  const decorated = rows.map((row, index) => ({ row, index }))
  decorated.sort((left, right) => {
    for (const descriptor of sortModel) {
      const direction = descriptor.direction === "desc" ? -1 : 1
      const leftValue = readRowField(left.row, descriptor.key, descriptor.field)
      const rightValue = readRowField(right.row, descriptor.key, descriptor.field)
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
      const value = normalizeText(readRowField(row, field))
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

  const cloneFilterModel = (
    input: DataGridFilterSnapshot | null,
  ): DataGridFilterSnapshot | null => {
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
    return {
      columnFilters: Object.fromEntries(
        Object.entries(input.columnFilters ?? {}).map(([key, values]) => [key, [...values]]),
      ),
      advancedFilters: Object.fromEntries(
        Object.entries(input.advancedFilters ?? {}).map(([key, condition]) => [
          key,
          {
            ...condition,
            clauses: Array.isArray(condition?.clauses)
              ? condition.clauses.map(clause => ({ ...clause }))
              : [],
          },
        ]),
      ),
    }
  }

  const resolveRowId = options.resolveRowId
  let sourceRows: DataGridRowNode<T>[] = Array.isArray(options.rows)
    ? options.rows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index))
    : []
  let rows: DataGridRowNode<T>[] = []
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? cloneSortModel(options.initialSortModel) : []
  let filterModel: DataGridFilterSnapshot | null = cloneFilterModel(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = normalizeGroupBySpec(options.initialGroupBy ?? null)
  const toggledGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, rows.length)
  let disposed = false
  const listeners = new Set<DataGridRowModelListener<T>>()

  function ensureActive() {
    if (disposed) {
      throw new Error("ClientRowModel has been disposed")
    }
  }

  function recomputeProjection() {
    const filteredRows = sourceRows.filter(row => passesColumnFilters(row, filterModel))
    const sortedRows = sortLeafRows(filteredRows, sortModel)
    const expansionSnapshot = buildGroupExpansionSnapshot(groupBy, toggledGroupKeys)
    const groupedRows = groupBy
      ? buildGroupedRows(sortedRows, groupBy, expansionSnapshot)
      : sortedRows
    rows = assignDisplayIndexes(groupedRows)
    viewportRange = normalizeViewportRange(viewportRange, rows.length)
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    viewportRange = normalizeViewportRange(viewportRange, rows.length)
    return {
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
