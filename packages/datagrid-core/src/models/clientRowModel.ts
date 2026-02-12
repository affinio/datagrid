import {
  buildGroupExpansionSnapshot,
  buildPaginationSnapshot,
  cloneGroupBySpec,
  isGroupExpanded,
  isSameGroupExpansionSnapshot,
  isSameGroupBySpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizeTreeDataSpec,
  normalizeViewportRange,
  setGroupExpansionKey,
  toggleGroupExpansionKey,
  withResolvedRowIdentity,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridRowId,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridRowNodeInput,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridTreeDataDiagnostics,
  type DataGridTreeDataResolvedSpec,
  type DataGridTreeDataSpec,
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
  initialTreeData?: DataGridTreeDataSpec<T> | null
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialGroupBy?: DataGridGroupBySpec | null
  initialPagination?: DataGridPaginationInput | null
}

export interface DataGridClientRowReorderInput {
  fromIndex: number
  toIndex: number
  count?: number
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  reorderRows(input: DataGridClientRowReorderInput): boolean
  getDerivedCacheDiagnostics(): DataGridClientRowModelDerivedCacheDiagnostics
}

export interface DataGridClientRowModelDerivedCacheDiagnostics {
  revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }
  filterPredicateHits: number
  filterPredicateMisses: number
  sortValueHits: number
  sortValueMisses: number
  groupValueHits: number
  groupValueMisses: number
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

function serializeSortModelForCache(sortModel: readonly DataGridSortState[]): string {
  if (!Array.isArray(sortModel) || sortModel.length === 0) {
    return "__none__"
  }
  return sortModel
    .map(descriptor => `${descriptor.key}:${descriptor.direction}:${descriptor.field ?? ""}`)
    .join("|")
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
  resolveSortValues?: (row: DataGridRowNode<T>, descriptors: readonly DataGridSortState[]) => readonly unknown[],
): DataGridRowNode<T>[] {
  const descriptors = Array.isArray(sortModel) ? sortModel.filter(Boolean) : []
  if (descriptors.length === 0) {
    return [...rows]
  }
  const decorated = rows.map((row, index) => ({
    row,
    index,
    sortValues: resolveSortValues
      ? resolveSortValues(row, descriptors)
      : descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field)),
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
    const rowIdDelta = compareUnknown(left.row.rowId, right.row.rowId)
    if (rowIdDelta !== 0) {
      return rowIdDelta
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

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function normalizeTreePathSegments(raw: readonly (string | number)[]): string[] {
  const segments: string[] = []
  for (const value of raw) {
    const normalized = String(value).trim()
    if (normalized.length === 0) {
      continue
    }
    segments.push(normalized)
  }
  return segments
}

interface TreePathBranch<T> {
  key: string
  value: string
  level: number
  groups: Map<string, TreePathBranch<T>>
  leaves: DataGridRowNode<T>[]
  matchedLeaves: number
  descendantLeafCount: number
}

interface TreeProjectionDiagnostics {
  orphans: number
  cycles: number
}

interface TreeProjectionResult<T> {
  rows: DataGridRowNode<T>[]
  diagnostics: TreeProjectionDiagnostics
}

function createTreePathGroupKey(segments: readonly string[]): string {
  return `tree:path:${JSON.stringify(segments)}`
}

function projectTreeDataByPath<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }>,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
): TreeProjectionResult<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rootGroups = new Map<string, TreePathBranch<T>>()
  const rootLeaves: DataGridRowNode<T>[] = []
  const matchedLeafRowIds = new Set<DataGridRowId>()

  for (const row of inputRows) {
    const normalizedLeaf = normalizeLeafRow(row)
    const path = normalizeTreePathSegments(treeData.getDataPath(normalizedLeaf.data, normalizedLeaf.sourceIndex))
    const matches = rowMatchesFilter(normalizedLeaf)
    if (matches) {
      matchedLeafRowIds.add(normalizedLeaf.rowId)
    }
    if (path.length === 0) {
      rootLeaves.push(normalizedLeaf)
      continue
    }
    let currentGroups = rootGroups
    const traversed: TreePathBranch<T>[] = []
    for (let level = 0; level < path.length; level += 1) {
      const value = path[level] ?? ""
      const keySegments = path.slice(0, level + 1)
      const groupKey = createTreePathGroupKey(keySegments)
      const existing = currentGroups.get(value)
      if (existing) {
        traversed.push(existing)
        currentGroups = existing.groups
        continue
      }
      const next: TreePathBranch<T> = {
        key: groupKey,
        value,
        level,
        groups: new Map<string, TreePathBranch<T>>(),
        leaves: [],
        matchedLeaves: 0,
        descendantLeafCount: 0,
      }
      currentGroups.set(value, next)
      traversed.push(next)
      currentGroups = next.groups
    }
    const target = traversed[traversed.length - 1]
    if (target) {
      target.leaves.push(normalizedLeaf)
    }
    for (const branch of traversed) {
      branch.descendantLeafCount += 1
      if (matches) {
        branch.matchedLeaves += 1
      }
    }
  }

  if (treeData.filterMode === "leaf-only") {
    const leaves: DataGridRowNode<T>[] = []
    for (const row of inputRows) {
      if (matchedLeafRowIds.has(row.rowId)) {
        leaves.push(normalizeLeafRow(row))
      }
    }
    return { rows: leaves, diagnostics }
  }

  const projected: DataGridRowNode<T>[] = []
  const pushBranch = (branch: TreePathBranch<T>) => {
    // Path mode filter markers are leaf-driven. Synthetic path groups do not evaluate
    // row predicates directly, so include-parents/include-descendants share the same
    // branch visibility rule: keep ancestor chain for matched leaves.
    const branchVisible = branch.matchedLeaves > 0
    if (!branchVisible) {
      return
    }
    const expanded = isGroupExpanded(expansionSnapshot, branch.key)
    const groupNode: DataGridRowNode<T> = {
      kind: "group",
      data: ({
        __tree: true,
        key: branch.key,
        value: branch.value,
        level: branch.level,
      } as unknown as T),
      row: ({
        __tree: true,
        key: branch.key,
        value: branch.value,
        level: branch.level,
      } as unknown as T),
      rowKey: branch.key,
      rowId: branch.key,
      sourceIndex: 0,
      originalIndex: 0,
      displayIndex: -1,
      state: {
        selected: false,
        group: true,
        pinned: "none",
        expanded,
      },
      groupMeta: {
        groupKey: branch.key,
        groupField: "path",
        groupValue: branch.value,
        level: branch.level,
        childrenCount: branch.matchedLeaves,
      },
    }
    projected.push(groupNode)
    if (!expanded) {
      return
    }
    for (const child of branch.groups.values()) {
      pushBranch(child)
    }
    for (const leaf of branch.leaves) {
      if (matchedLeafRowIds.has(leaf.rowId)) {
        projected.push(leaf)
      }
    }
  }

  for (const branch of rootGroups.values()) {
    pushBranch(branch)
  }
  for (const leaf of rootLeaves) {
    if (matchedLeafRowIds.has(leaf.rowId)) {
      projected.push(leaf)
    }
  }
  return {
    rows: projected,
    diagnostics,
  }
}

function createTreeParentGroupKey(rowId: DataGridRowId): string {
  return `tree:parent:${String(rowId)}`
}

function projectTreeDataByParent<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "parent" }>,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
): TreeProjectionResult<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rowById = new Map<DataGridRowId, DataGridRowNode<T>>()
  for (const row of inputRows) {
    rowById.set(row.rowId, normalizeLeafRow(row))
  }
  const rawParentById = new Map<DataGridRowId, DataGridRowId | null>()
  const dropped = new Set<DataGridRowId>()

  for (const row of inputRows) {
    const rowId = row.rowId
    const resolved = treeData.getParentId(row.data, row.sourceIndex)
    let parentId: DataGridRowId | null =
      resolved == null
        ? null
        : (isDataGridRowId(resolved) ? resolved : null)
    if (treeData.rootParentId != null && parentId === treeData.rootParentId) {
      parentId = null
    }
    if (parentId != null && !rowById.has(parentId)) {
      diagnostics.orphans += 1
      if (treeData.orphanPolicy === "drop") {
        dropped.add(rowId)
        continue
      }
      if (treeData.orphanPolicy === "error") {
        throw new Error(`[DataGridTreeData] Orphan row '${String(rowId)}' has missing parent '${String(parentId)}'.`)
      }
      parentId = null
    }
    if (parentId === rowId) {
      diagnostics.cycles += 1
      if (treeData.cyclePolicy === "error") {
        throw new Error(`[DataGridTreeData] Self-cycle for row '${String(rowId)}'.`)
      }
      parentId = null
    }
    rawParentById.set(rowId, parentId)
  }

  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    const rowId = row.rowId
    let parentId = rawParentById.get(rowId) ?? null
    if (parentId == null) {
      continue
    }
    const visited = new Set<DataGridRowId>([rowId])
    let cursor: DataGridRowId | null = parentId
    while (cursor != null) {
      if (visited.has(cursor)) {
        diagnostics.cycles += 1
        if (treeData.cyclePolicy === "error") {
          throw new Error(`[DataGridTreeData] Cycle detected for row '${String(rowId)}'.`)
        }
        parentId = null
        break
      }
      visited.add(cursor)
      cursor = rawParentById.get(cursor) ?? null
    }
    if (parentId == null) {
      rawParentById.set(rowId, null)
    }
  }

  const childrenById = new Map<DataGridRowId | null, DataGridRowId[]>()
  const pushChild = (parentId: DataGridRowId | null, rowId: DataGridRowId) => {
    const bucket = childrenById.get(parentId)
    if (bucket) {
      bucket.push(rowId)
      return
    }
    childrenById.set(parentId, [rowId])
  }
  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    const parentId = rawParentById.get(row.rowId) ?? null
    pushChild(parentId, row.rowId)
  }

  const matchedIds = new Set<DataGridRowId>()
  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    if (rowMatchesFilter(row)) {
      matchedIds.add(row.rowId)
    }
  }

  const includeIds = new Set<DataGridRowId>()
  const includeWithAncestors = (rowId: DataGridRowId) => {
    includeIds.add(rowId)
    let cursor = rawParentById.get(rowId) ?? null
    while (cursor != null) {
      includeIds.add(cursor)
      cursor = rawParentById.get(cursor) ?? null
    }
  }
  const includeDescendants = (rowId: DataGridRowId) => {
    const stack: DataGridRowId[] = [rowId]
    const visited = new Set<DataGridRowId>()
    while (stack.length > 0) {
      const current = stack.pop()
      if (typeof current === "undefined" || visited.has(current)) {
        continue
      }
      visited.add(current)
      includeIds.add(current)
      const children = childrenById.get(current) ?? []
      for (const childId of children) {
        stack.push(childId)
      }
    }
  }

  if (treeData.filterMode === "leaf-only") {
    for (const rowId of matchedIds) {
      const children = childrenById.get(rowId) ?? []
      if (children.length === 0) {
        includeIds.add(rowId)
      }
    }
  } else if (treeData.filterMode === "include-descendants") {
    for (const rowId of matchedIds) {
      includeWithAncestors(rowId)
      includeDescendants(rowId)
    }
  } else {
    for (const rowId of matchedIds) {
      includeWithAncestors(rowId)
    }
  }

  if (includeIds.size === 0) {
    return {
      rows: [],
      diagnostics,
    }
  }

  const projected: DataGridRowNode<T>[] = []
  const emitRow = (rowId: DataGridRowId, level: number) => {
    if (!includeIds.has(rowId)) {
      return
    }
    const row = rowById.get(rowId)
    if (!row || dropped.has(rowId)) {
      return
    }
    const children = (childrenById.get(rowId) ?? []).filter(childId => includeIds.has(childId))
    if (children.length === 0) {
      projected.push(row)
      return
    }
    const groupKey = createTreeParentGroupKey(rowId)
    const expanded = isGroupExpanded(expansionSnapshot, groupKey)
    const groupNode: DataGridRowNode<T> = {
      ...row,
      kind: "group",
      state: {
        ...row.state,
        group: true,
        expanded,
      },
      groupMeta: {
        groupKey,
        groupField: "parent",
        groupValue: String(rowId),
        level,
        childrenCount: children.length,
      },
    }
    projected.push(groupNode)
    if (!expanded) {
      return
    }
    for (const childId of children) {
      emitRow(childId, level + 1)
    }
  }

  const rootIncluded: DataGridRowId[] = []
  for (const rowId of includeIds) {
    const parentId = rawParentById.get(rowId) ?? null
    if (parentId == null || !includeIds.has(parentId)) {
      rootIncluded.push(rowId)
    }
  }
  rootIncluded.sort((left, right) => {
    const leftIndex = rowById.get(left)?.sourceIndex ?? 0
    const rightIndex = rowById.get(right)?.sourceIndex ?? 0
    return leftIndex - rightIndex
  })

  for (const rootId of rootIncluded) {
    emitRow(rootId, 0)
  }
  return {
    rows: projected,
    diagnostics,
  }
}

function buildTreeDataRows<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: DataGridTreeDataResolvedSpec<T>,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
): TreeProjectionResult<T> {
  if (treeData.mode === "path") {
    return projectTreeDataByPath(inputRows, treeData, expansionSnapshot, rowMatchesFilter)
  }
  return projectTreeDataByParent(inputRows, treeData, expansionSnapshot, rowMatchesFilter)
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
  groupValueCache?: Map<string, string>,
  groupValueCounters?: { hits: number; misses: number },
): DataGridRowNode<T>[] {
  const fields = groupBy.fields
  if (fields.length === 0) {
    return inputRows.map(row => normalizeLeafRow(row))
  }
  const resolveGroupedValue = (row: DataGridRowNode<T>, field: string): string => {
    const cacheKey = `${String(row.rowId)}::${field}`
    const cache = groupValueCache
    const cached = cache?.get(cacheKey)
    if (typeof cached !== "undefined") {
      if (groupValueCounters) {
        groupValueCounters.hits += 1
      }
      return cached
    }
    const computed = normalizeText(readRowField(row, field))
    if (cache) {
      cache.set(cacheKey, computed)
      if (groupValueCounters) {
        groupValueCounters.misses += 1
      }
    }
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

function reindexSourceRows<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] {
  const normalized: DataGridRowNode<T>[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      continue
    }
    normalized.push({
      ...row,
      sourceIndex: index,
      originalIndex: index,
      displayIndex: index,
    })
  }
  return normalized
}

function createEmptyTreeDataDiagnostics(
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

function findDuplicateRowIds<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowId[] {
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
  const treeData = normalizeTreeDataSpec(options.initialTreeData ?? null)
  let treeDataDiagnostics: DataGridTreeDataDiagnostics | null = treeData ? createEmptyTreeDataDiagnostics() : null

  const normalizeSourceRows = (inputRows: readonly DataGridRowNodeInput<T>[] | null | undefined): DataGridRowNode<T>[] => {
    const normalized = Array.isArray(inputRows)
      ? reindexSourceRows(inputRows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index)))
      : []
    if (!treeData) {
      return normalized
    }
    const duplicates = findDuplicateRowIds(normalized)
    if (duplicates.length === 0) {
      return normalized
    }
    const message = `[DataGridTreeData] Duplicate rowId detected (${duplicates.map(value => String(value)).join(", ")}).`
    treeDataDiagnostics = createEmptyTreeDataDiagnostics({
      duplicates: duplicates.length,
      lastError: message,
      orphans: treeDataDiagnostics?.orphans ?? 0,
      cycles: treeDataDiagnostics?.cycles ?? 0,
    })
    throw new Error(message)
  }

  let sourceRows: DataGridRowNode<T>[] = normalizeSourceRows(options.rows ?? [])
  let rows: DataGridRowNode<T>[] = []
  let revision = 0
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? cloneSortModel(options.initialSortModel) : []
  let filterModel: DataGridFilterSnapshot | null = cloneFilterModel(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = treeData
    ? null
    : normalizeGroupBySpec(options.initialGroupBy ?? null)
  let expansionExpandedByDefault = Boolean(treeData?.expandedByDefault ?? groupBy?.expandedByDefault)
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  let pagination = buildPaginationSnapshot(0, paginationInput)
  const toggledGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, rows.length)
  let disposed = false
  const listeners = new Set<DataGridRowModelListener<T>>()
  let rowRevision = 0
  let sortRevision = 0
  let filterRevision = 0
  let groupRevision = 0
  let cachedFilterPredicateKey = "__none__"
  let cachedFilterPredicate: ((rowNode: DataGridRowNode<T>) => boolean) | null = null
  const sortValueCache = new Map<DataGridRowId, readonly unknown[]>()
  let sortValueCacheKey = "__none__"
  const groupValueCache = new Map<string, string>()
  let groupValueCacheKey = "__none__"
  const derivedCacheDiagnostics: DataGridClientRowModelDerivedCacheDiagnostics = {
    revisions: {
      row: rowRevision,
      sort: sortRevision,
      filter: filterRevision,
      group: groupRevision,
    },
    filterPredicateHits: 0,
    filterPredicateMisses: 0,
    sortValueHits: 0,
    sortValueMisses: 0,
    groupValueHits: 0,
    groupValueMisses: 0,
  }

  function ensureActive() {
    if (disposed) {
      throw new Error("ClientRowModel has been disposed")
    }
  }

  function recomputeProjection() {
    const filterKey = `${filterRevision}:${serializeFilterModelForCache(filterModel)}`
    const filterPredicate = filterKey === cachedFilterPredicateKey && cachedFilterPredicate
      ? (() => {
          derivedCacheDiagnostics.filterPredicateHits += 1
          return cachedFilterPredicate as (rowNode: DataGridRowNode<T>) => boolean
        })()
      : (() => {
          const next = createFilterPredicate(filterModel)
          cachedFilterPredicateKey = filterKey
          cachedFilterPredicate = next
          derivedCacheDiagnostics.filterPredicateMisses += 1
          return next
        })()
    const rowsForSort = treeData
      ? sourceRows
      : sourceRows.filter(filterPredicate)
    const sortKey = `${rowRevision}:${sortRevision}:${serializeSortModelForCache(sortModel)}`
    if (sortKey !== sortValueCacheKey) {
      sortValueCache.clear()
      sortValueCacheKey = sortKey
    }
    const sortedRows = sortLeafRows(rowsForSort, sortModel, (row, descriptors) => {
      const cached = sortValueCache.get(row.rowId)
      if (cached) {
        derivedCacheDiagnostics.sortValueHits += 1
        return cached
      }
      const resolved = descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
      sortValueCache.set(row.rowId, resolved)
      derivedCacheDiagnostics.sortValueMisses += 1
      return resolved
    })
    const expansionSpec = getExpansionSpec()
    const expansionSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys)
    const nextGroupValueCacheKey = groupBy
      ? `${rowRevision}:${groupRevision}:${groupBy.fields.join("|")}`
      : "__none__"
    if (nextGroupValueCacheKey !== groupValueCacheKey) {
      groupValueCache.clear()
      groupValueCacheKey = nextGroupValueCacheKey
    }
    const groupValueCounters = {
      hits: derivedCacheDiagnostics.groupValueHits,
      misses: derivedCacheDiagnostics.groupValueMisses,
    }
    let groupedResult: TreeProjectionResult<T> | null = null
    if (treeData) {
      try {
        groupedResult = buildTreeDataRows(sortedRows, treeData, expansionSnapshot, filterPredicate)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        treeDataDiagnostics = createEmptyTreeDataDiagnostics({
          duplicates: treeDataDiagnostics?.duplicates ?? 0,
          lastError: message,
        })
        throw error
      }
    }
    const groupedRows = groupedResult
      ? groupedResult.rows
      : (
          groupBy
            ? buildGroupedRows(sortedRows, groupBy, expansionSnapshot, groupValueCache, groupValueCounters)
            : sortedRows
        )
    if (treeData) {
      treeDataDiagnostics = createEmptyTreeDataDiagnostics({
        duplicates: 0,
        lastError: null,
        orphans: groupedResult?.diagnostics.orphans ?? 0,
        cycles: groupedResult?.diagnostics.cycles ?? 0,
      })
    }
    derivedCacheDiagnostics.groupValueHits = groupValueCounters.hits
    derivedCacheDiagnostics.groupValueMisses = groupValueCounters.misses
    pagination = buildPaginationSnapshot(groupedRows.length, paginationInput)
    if (pagination.enabled && pagination.startIndex >= 0 && pagination.endIndex >= pagination.startIndex) {
      rows = assignDisplayIndexes(groupedRows.slice(pagination.startIndex, pagination.endIndex + 1))
    } else {
      rows = assignDisplayIndexes(groupedRows)
    }
    paginationInput = {
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
    }
    viewportRange = normalizeViewportRange(viewportRange, rows.length)
    derivedCacheDiagnostics.revisions = {
      row: rowRevision,
      sort: sortRevision,
      filter: filterRevision,
      group: groupRevision,
    }
    revision += 1
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    viewportRange = normalizeViewportRange(viewportRange, rows.length)
    const expansionSpec = getExpansionSpec()
    return {
      revision,
      kind: "client",
      rowCount: rows.length,
      loading: false,
      error: null,
      ...(treeData ? { treeDataDiagnostics: createEmptyTreeDataDiagnostics(treeDataDiagnostics ?? undefined) } : {}),
      viewportRange,
      pagination,
      sortModel: cloneSortModel(sortModel),
      filterModel: cloneFilterModel(filterModel),
      groupBy: treeData ? null : cloneGroupBySpec(groupBy),
      groupExpansion: buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys),
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

  function getExpansionSpec(): DataGridGroupBySpec | null {
    if (treeData) {
      return {
        fields: ["__tree__"],
        expandedByDefault: expansionExpandedByDefault,
      }
    }
    if (!groupBy) {
      return null
    }
    return {
      fields: groupBy.fields,
      expandedByDefault: expansionExpandedByDefault,
    }
  }

  function applyGroupExpansion(nextExpansion: DataGridGroupExpansionSnapshot | null): boolean {
    const expansionSpec = getExpansionSpec()
    if (!expansionSpec) {
      return false
    }
    const normalizedSnapshot = buildGroupExpansionSnapshot(
      {
        fields: expansionSpec.fields,
        expandedByDefault: nextExpansion?.expandedByDefault ?? expansionSpec.expandedByDefault,
      },
      nextExpansion?.toggledGroupKeys ?? [],
    )
    const currentSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys)
    if (isSameGroupExpansionSnapshot(currentSnapshot, normalizedSnapshot)) {
      return false
    }
    expansionExpandedByDefault = normalizedSnapshot.expandedByDefault
    toggledGroupKeys.clear()
    for (const groupKey of normalizedSnapshot.toggledGroupKeys) {
      toggledGroupKeys.add(groupKey)
    }
    return true
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
      const nextSourceRows = normalizeSourceRows(nextRows ?? [])
      sourceRows = nextSourceRows
      rowRevision += 1
      recomputeProjection()
      emit()
    },
    reorderRows(input: DataGridClientRowReorderInput) {
      ensureActive()
      const length = sourceRows.length
      if (length <= 1) {
        return false
      }
      if (!Number.isFinite(input.fromIndex) || !Number.isFinite(input.toIndex)) {
        return false
      }
      const fromIndex = Math.max(0, Math.min(length - 1, Math.trunc(input.fromIndex)))
      const count = Number.isFinite(input.count) ? Math.max(1, Math.trunc(input.count as number)) : 1
      const maxCount = Math.max(1, Math.min(count, length - fromIndex))
      const toIndexRaw = Math.max(0, Math.min(length, Math.trunc(input.toIndex)))
      const rows = sourceRows.slice()
      const moved = rows.splice(fromIndex, maxCount)
      if (moved.length === 0) {
        return false
      }
      const adjustedTarget = toIndexRaw > fromIndex ? Math.max(0, toIndexRaw - moved.length) : toIndexRaw
      rows.splice(adjustedTarget, 0, ...moved)
      sourceRows = reindexSourceRows(rows)
      rowRevision += 1
      recomputeProjection()
      emit()
      return true
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
    setPagination(nextPagination: DataGridPaginationInput | null) {
      ensureActive()
      const normalized = normalizePaginationInput(nextPagination)
      if (
        normalized.pageSize === paginationInput.pageSize &&
        normalized.currentPage === paginationInput.currentPage
      ) {
        return
      }
      paginationInput = normalized
      recomputeProjection()
      emit()
    },
    setPageSize(pageSize: number | null) {
      ensureActive()
      const normalizedPageSize = normalizePaginationInput({ pageSize: pageSize ?? 0, currentPage: 0 }).pageSize
      if (normalizedPageSize === paginationInput.pageSize) {
        return
      }
      paginationInput = {
        pageSize: normalizedPageSize,
        currentPage: 0,
      }
      recomputeProjection()
      emit()
    },
    setCurrentPage(page: number) {
      ensureActive()
      const normalizedPage = normalizePaginationInput({ pageSize: paginationInput.pageSize, currentPage: page }).currentPage
      if (normalizedPage === paginationInput.currentPage) {
        return
      }
      paginationInput = {
        ...paginationInput,
        currentPage: normalizedPage,
      }
      recomputeProjection()
      emit()
    },
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? cloneSortModel(nextSortModel) : []
      sortRevision += 1
      recomputeProjection()
      emit()
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      ensureActive()
      filterModel = cloneFilterModel(nextFilterModel ?? null)
      filterRevision += 1
      recomputeProjection()
      emit()
    },
    setGroupBy(nextGroupBy: DataGridGroupBySpec | null) {
      ensureActive()
      if (treeData) {
        return
      }
      const normalized = normalizeGroupBySpec(nextGroupBy)
      if (isSameGroupBySpec(groupBy, normalized)) {
        return
      }
      groupBy = normalized
      expansionExpandedByDefault = Boolean(normalized?.expandedByDefault)
      toggledGroupKeys.clear()
      groupRevision += 1
      recomputeProjection()
      emit()
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      ensureActive()
      if (!applyGroupExpansion(expansion)) {
        return
      }
      groupRevision += 1
      recomputeProjection()
      emit()
    },
    toggleGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
        return
      }
      groupRevision += 1
      recomputeProjection()
      emit()
    },
    expandGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, true)) {
        return
      }
      groupRevision += 1
      recomputeProjection()
      emit()
    },
    collapseGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, false)) {
        return
      }
      groupRevision += 1
      recomputeProjection()
      emit()
    },
    expandAllGroups() {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = true
      toggledGroupKeys.clear()
      groupRevision += 1
      recomputeProjection()
      emit()
    },
    collapseAllGroups() {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = false
      toggledGroupKeys.clear()
      groupRevision += 1
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
    getDerivedCacheDiagnostics() {
      return {
        revisions: { ...derivedCacheDiagnostics.revisions },
        filterPredicateHits: derivedCacheDiagnostics.filterPredicateHits,
        filterPredicateMisses: derivedCacheDiagnostics.filterPredicateMisses,
        sortValueHits: derivedCacheDiagnostics.sortValueHits,
        sortValueMisses: derivedCacheDiagnostics.sortValueMisses,
        groupValueHits: derivedCacheDiagnostics.groupValueHits,
        groupValueMisses: derivedCacheDiagnostics.groupValueMisses,
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
      sortValueCache.clear()
      groupValueCache.clear()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}
