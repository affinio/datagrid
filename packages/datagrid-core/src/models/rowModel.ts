export type DataGridRowId = string | number
export type DataGridRowIdResolver<T = unknown> = (row: T, index: number) => DataGridRowId

export type DataGridSortDirection = "asc" | "desc"

export interface DataGridSortState {
  key: string
  field?: string
  direction: DataGridSortDirection
}

export interface DataGridFilterClause {
  operator: string
  value: unknown
  value2?: unknown
  join?: "and" | "or"
}

export interface DataGridAdvancedFilter {
  type: "text" | "number" | "date"
  clauses: DataGridFilterClause[]
}

export type DataGridAdvancedFilterConditionType =
  | "text"
  | "number"
  | "date"
  | "boolean"

export interface DataGridAdvancedFilterCondition {
  kind: "condition"
  key: string
  field?: string
  type?: DataGridAdvancedFilterConditionType
  operator: string
  value?: unknown
  value2?: unknown
}

export interface DataGridAdvancedFilterGroup {
  kind: "group"
  operator: "and" | "or"
  children: DataGridAdvancedFilterExpression[]
}

export interface DataGridAdvancedFilterNot {
  kind: "not"
  child: DataGridAdvancedFilterExpression
}

export type DataGridAdvancedFilterExpression =
  | DataGridAdvancedFilterCondition
  | DataGridAdvancedFilterGroup
  | DataGridAdvancedFilterNot

export interface DataGridFilterSnapshot {
  columnFilters: Record<string, string[]>
  advancedFilters: Record<string, DataGridAdvancedFilter>
  advancedExpression?: DataGridAdvancedFilterExpression | null
}

export interface DataGridGroupBySpec {
  fields: string[]
  expandedByDefault?: boolean
}

export interface DataGridGroupExpansionSnapshot {
  expandedByDefault: boolean
  toggledGroupKeys: readonly string[]
}

export type DataGridRowModelKind = "client" | "server"

export type DataGridRowModelRefreshReason =
  | "mount"
  | "manual"
  | "sort-change"
  | "filter-change"
  | "viewport-change"
  | "reset"

export interface DataGridViewportRange {
  start: number
  end: number
}

export type DataGridRowPinState = "none" | "top" | "bottom"

export interface DataGridRowNodeState {
  selected: boolean
  group: boolean
  pinned: DataGridRowPinState
  expanded: boolean
}

export type DataGridRowKind = "group" | "leaf"

export interface DataGridRowGroupMeta {
  groupKey: string
  groupField: string
  groupValue: string
  level: number
  childrenCount: number
}

export interface DataGridRowRenderMeta {
  level: number
  isGroup: boolean
  isExpanded?: boolean
  hasChildren?: boolean
}

export interface DataGridRowNode<T = unknown> {
  kind: DataGridRowKind
  data: T
  row: T
  rowKey: DataGridRowId
  rowId: DataGridRowId
  sourceIndex: number
  originalIndex: number
  displayIndex: number
  state: DataGridRowNodeState
  groupMeta?: DataGridRowGroupMeta
}

export interface DataGridRowModelSnapshot<T = unknown> {
  revision?: number
  kind: DataGridRowModelKind
  rowCount: number
  loading: boolean
  error: Error | null
  viewportRange: DataGridViewportRange
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
}

export type DataGridRowModelListener<T = unknown> = (snapshot: DataGridRowModelSnapshot<T>) => void

export interface DataGridRowModel<T = unknown> {
  readonly kind: DataGridRowModelKind
  getSnapshot(): DataGridRowModelSnapshot<T>
  getRowCount(): number
  getRow(index: number): DataGridRowNode<T> | undefined
  getRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<T>[]
  setViewportRange(range: DataGridViewportRange): void
  setSortModel(sortModel: readonly DataGridSortState[]): void
  setFilterModel(filterModel: DataGridFilterSnapshot | null): void
  setGroupBy(groupBy: DataGridGroupBySpec | null): void
  toggleGroup(groupKey: string): void
  refresh(reason?: DataGridRowModelRefreshReason): Promise<void> | void
  subscribe(listener: DataGridRowModelListener<T>): () => void
  dispose(): void
}

export function normalizeGroupBySpec(groupBy: DataGridGroupBySpec | null | undefined): DataGridGroupBySpec | null {
  if (!groupBy) {
    return null
  }
  const normalizedFields = Array.isArray(groupBy.fields) ? (() => {
    const unique = new Set<string>()
    for (const fieldValue of groupBy.fields) {
      if (typeof fieldValue !== "string") {
        continue
      }
      const field = fieldValue.trim()
      if (field.length === 0 || unique.has(field)) {
        continue
      }
      unique.add(field)
    }
    return Array.from(unique)
  })() : []
  if (normalizedFields.length === 0) {
    return null
  }
  return {
    fields: normalizedFields,
    expandedByDefault: Boolean(groupBy.expandedByDefault),
  }
}

export function cloneGroupBySpec(groupBy: DataGridGroupBySpec | null | undefined): DataGridGroupBySpec | null {
  if (!groupBy) {
    return null
  }
  return {
    fields: [...groupBy.fields],
    expandedByDefault: Boolean(groupBy.expandedByDefault),
  }
}

function normalizeGroupKey(groupKey: string): string | null {
  if (typeof groupKey !== "string") {
    return null
  }
  const normalized = groupKey.trim()
  return normalized.length > 0 ? normalized : null
}

export function buildGroupExpansionSnapshot(
  groupBy: DataGridGroupBySpec | null | undefined,
  toggledGroupKeys: ReadonlySet<string> | readonly string[],
): DataGridGroupExpansionSnapshot {
  const normalizedGroupBy = normalizeGroupBySpec(groupBy)
  const expandedByDefault = Boolean(normalizedGroupBy?.expandedByDefault)
  const keysSource = toggledGroupKeys instanceof Set ? Array.from(toggledGroupKeys) : [...toggledGroupKeys]
  const unique = new Set<string>()
  for (const rawKey of keysSource) {
    const key = normalizeGroupKey(rawKey)
    if (key) {
      unique.add(key)
    }
  }
  return {
    expandedByDefault,
    toggledGroupKeys: Array.from(unique),
  }
}

export function isSameGroupExpansionSnapshot(
  left: DataGridGroupExpansionSnapshot | null | undefined,
  right: DataGridGroupExpansionSnapshot | null | undefined,
): boolean {
  const normalizedLeft = left ?? { expandedByDefault: false, toggledGroupKeys: [] }
  const normalizedRight = right ?? { expandedByDefault: false, toggledGroupKeys: [] }
  if (normalizedLeft.expandedByDefault !== normalizedRight.expandedByDefault) {
    return false
  }
  if (normalizedLeft.toggledGroupKeys.length !== normalizedRight.toggledGroupKeys.length) {
    return false
  }
  for (let index = 0; index < normalizedLeft.toggledGroupKeys.length; index += 1) {
    if (normalizedLeft.toggledGroupKeys[index] !== normalizedRight.toggledGroupKeys[index]) {
      return false
    }
  }
  return true
}

export function isGroupExpanded(
  expansion: DataGridGroupExpansionSnapshot | null | undefined,
  groupKey: string,
): boolean {
  const key = normalizeGroupKey(groupKey)
  if (!key) {
    return false
  }
  const normalized = expansion ?? { expandedByDefault: false, toggledGroupKeys: [] }
  const toggled = new Set(normalized.toggledGroupKeys)
  return normalized.expandedByDefault ? !toggled.has(key) : toggled.has(key)
}

export function toggleGroupExpansionKey(
  toggledGroupKeys: Set<string>,
  groupKey: string,
): boolean {
  const key = normalizeGroupKey(groupKey)
  if (!key) {
    return false
  }
  if (toggledGroupKeys.has(key)) {
    toggledGroupKeys.delete(key)
  } else {
    toggledGroupKeys.add(key)
  }
  return true
}

export function isSameGroupBySpec(
  left: DataGridGroupBySpec | null | undefined,
  right: DataGridGroupBySpec | null | undefined,
): boolean {
  const normalizedLeft = normalizeGroupBySpec(left)
  const normalizedRight = normalizeGroupBySpec(right)
  if (!normalizedLeft && !normalizedRight) {
    return true
  }
  if (!normalizedLeft || !normalizedRight) {
    return false
  }
  if (normalizedLeft.expandedByDefault !== normalizedRight.expandedByDefault) {
    return false
  }
  if (normalizedLeft.fields.length !== normalizedRight.fields.length) {
    return false
  }
  for (let index = 0; index < normalizedLeft.fields.length; index += 1) {
    if (normalizedLeft.fields[index] !== normalizedRight.fields[index]) {
      return false
    }
  }
  return true
}

export function normalizeViewportRange(
  range: DataGridViewportRange,
  rowCount: number,
): DataGridViewportRange {
  const safeCount = Number.isFinite(rowCount) ? Math.max(0, Math.trunc(rowCount)) : 0
  const maxIndex = Math.max(0, safeCount - 1)
  const start = Number.isFinite(range.start) ? Math.max(0, Math.trunc(range.start)) : 0
  const endRaw = Number.isFinite(range.end) ? Math.max(0, Math.trunc(range.end)) : start
  const end = Math.max(start, endRaw)

  if (safeCount <= 0) {
    return { start: 0, end: 0 }
  }

  return {
    start: Math.min(start, maxIndex),
    end: Math.min(end, maxIndex),
  }
}

export interface DataGridLegacyVisibleRow<T = unknown> {
  row: T
  rowId: DataGridRowId
  originalIndex: number
  displayIndex?: number
  kind?: DataGridRowKind
  groupMeta?: Partial<DataGridRowGroupMeta>
  state?: Partial<DataGridRowNodeState>
}

export type DataGridRowNodeInput<T = unknown> = DataGridRowNode<T> | DataGridLegacyVisibleRow<T> | T

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function assertDataGridRowId(value: unknown, context: string): DataGridRowId {
  if (!isDataGridRowId(value)) {
    throw new Error(`[DataGrid] ${context}. Expected row id to be string|number.`)
  }
  return value
}

function normalizePinnedState(state: Partial<DataGridRowNodeState> | null | undefined): DataGridRowPinState {
  if (state?.pinned === "top") {
    return "top"
  }
  if (state?.pinned === "bottom") {
    return "bottom"
  }
  return "none"
}

function resolveRowKind(node: DataGridRowNodeInput<unknown>): DataGridRowKind {
  const kind = (node as { kind?: unknown }).kind
  if (kind === "group") {
    return "group"
  }
  if (kind === "leaf") {
    return "leaf"
  }
  const state = (node as { state?: Partial<DataGridRowNodeState> }).state
  return state?.group ? "group" : "leaf"
}

function normalizeGroupMeta(
  value: Partial<DataGridRowGroupMeta> | null | undefined,
  fallbackRowKey: DataGridRowId,
): DataGridRowGroupMeta {
  const normalizedKey = String(value?.groupKey ?? fallbackRowKey)
  const normalizedField = typeof value?.groupField === "string" ? value.groupField : ""
  const normalizedValue = typeof value?.groupValue === "string" ? value.groupValue : normalizedKey
  const level = Number.isFinite(value?.level) ? Math.max(0, Math.trunc(value?.level as number)) : 0
  const childrenCount = Number.isFinite(value?.childrenCount)
    ? Math.max(0, Math.trunc(value?.childrenCount as number))
    : 0

  return {
    groupKey: normalizedKey,
    groupField: normalizedField,
    groupValue: normalizedValue,
    level,
    childrenCount,
  }
}

function resolveRowState(node: DataGridRowNodeInput<unknown>, rowKind: DataGridRowKind): DataGridRowNodeState {
  const state = (node as { state?: Partial<DataGridRowNodeState> }).state
  return {
    selected: Boolean(state?.selected),
    group: rowKind === "group" || Boolean(state?.group),
    pinned: normalizePinnedState(state),
    expanded: Boolean(state?.expanded),
  }
}

function resolveSourceIndex(node: DataGridRowNodeInput<unknown>, fallbackIndex: number): number {
  const rowNode = node as Partial<DataGridRowNode<unknown>>
  if (Number.isFinite(rowNode.sourceIndex)) {
    return Math.max(0, Math.trunc(rowNode.sourceIndex as number))
  }
  if (Number.isFinite(rowNode.originalIndex)) {
    return Math.max(0, Math.trunc(rowNode.originalIndex as number))
  }
  return Math.max(0, Math.trunc(fallbackIndex))
}

function resolveDisplayIndex(node: DataGridRowNodeInput<unknown>, fallbackIndex: number): number {
  const rowNode = node as Partial<DataGridRowNode<unknown>>
  if (Number.isFinite(rowNode.displayIndex)) {
    return Math.max(0, Math.trunc(rowNode.displayIndex as number))
  }
  return Math.max(0, Math.trunc(fallbackIndex))
}

function resolveRowData<T>(node: DataGridRowNodeInput<T>): T {
  const rowNode = node as Partial<DataGridRowNode<T>>
  if (typeof rowNode.data !== "undefined") {
    return rowNode.data
  }
  if (typeof (node as DataGridLegacyVisibleRow<T>).row !== "undefined") {
    return (node as DataGridLegacyVisibleRow<T>).row
  }
  return node as T
}

function resolveRowKey<T>(node: DataGridRowNodeInput<T>): DataGridRowId {
  const rowNode = node as Partial<DataGridRowNode<T>>
  if (typeof rowNode.rowKey !== "undefined") {
    return assertDataGridRowId(rowNode.rowKey, "Invalid rowKey")
  }
  if (typeof rowNode.rowId !== "undefined") {
    return assertDataGridRowId(rowNode.rowId, "Invalid rowId")
  }
  throw new Error(
    "[DataGrid] Missing row identity. Provide rowKey/rowId or configure a row id resolver in the row model.",
  )
}

export function withResolvedRowIdentity<T>(
  node: DataGridRowNodeInput<T>,
  index: number,
  resolveRowId?: DataGridRowIdResolver<T>,
): DataGridRowNodeInput<T> {
  if (typeof (node as Partial<DataGridRowNode<T>>).rowKey !== "undefined") {
    return node
  }
  if (typeof (node as Partial<DataGridRowNode<T>>).rowId !== "undefined") {
    return node
  }
  if (typeof resolveRowId !== "function") {
    return node
  }
  const rowData = resolveRowData(node)
  const rowId = assertDataGridRowId(resolveRowId(rowData, index), "Invalid row id returned by resolver")
  if (typeof node === "object" && node !== null) {
    return { ...(node as object), rowId } as DataGridRowNodeInput<T>
  }
  return { row: rowData, rowId } as DataGridRowNodeInput<T>
}

export function normalizeRowNode<T>(
  node: DataGridRowNodeInput<T>,
  fallbackIndex: number,
): DataGridRowNode<T> {
  const data = resolveRowData(node)
  const sourceIndex = resolveSourceIndex(node, fallbackIndex)
  const displayIndex = resolveDisplayIndex(node, sourceIndex)
  const rowKind = resolveRowKind(node)
  const state = resolveRowState(node, rowKind)
  const rowKey = resolveRowKey(node)
  const groupMeta = rowKind === "group"
    ? normalizeGroupMeta((node as { groupMeta?: Partial<DataGridRowGroupMeta> }).groupMeta, rowKey)
    : undefined

  return {
    kind: rowKind,
    data,
    row: data,
    rowKey,
    rowId: rowKey,
    originalIndex: sourceIndex,
    sourceIndex,
    displayIndex,
    state,
    groupMeta,
  }
}

export function isDataGridGroupRowNode<T>(node: DataGridRowNode<T>): node is DataGridRowNode<T> & {
  kind: "group"
  groupMeta: DataGridRowGroupMeta
} {
  return node.kind === "group"
}

export function isDataGridLeafRowNode<T>(node: DataGridRowNode<T>): node is DataGridRowNode<T> & {
  kind: "leaf"
} {
  return node.kind === "leaf"
}

export function getDataGridRowRenderMeta<T>(node: DataGridRowNode<T>): DataGridRowRenderMeta {
  if (node.kind !== "group") {
    return {
      level: 0,
      isGroup: false,
    }
  }

  const level = Number.isFinite(node.groupMeta?.level)
    ? Math.max(0, Math.trunc(node.groupMeta?.level as number))
    : 0
  const childrenCount = Number.isFinite(node.groupMeta?.childrenCount)
    ? Math.max(0, Math.trunc(node.groupMeta?.childrenCount as number))
    : 0

  return {
    level,
    isGroup: true,
    isExpanded: Boolean(node.state.expanded),
    hasChildren: childrenCount > 0,
  }
}
