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

export interface DataGridFilterSnapshot {
  columnFilters: Record<string, string[]>
  advancedFilters: Record<string, DataGridAdvancedFilter>
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

export interface DataGridRowNode<T = unknown> {
  data: T
  row: T
  rowKey: DataGridRowId
  rowId: DataGridRowId
  sourceIndex: number
  originalIndex: number
  displayIndex: number
  state: DataGridRowNodeState
}

export interface DataGridRowModelSnapshot<T = unknown> {
  kind: DataGridRowModelKind
  rowCount: number
  loading: boolean
  error: Error | null
  viewportRange: DataGridViewportRange
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
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
  refresh(reason?: DataGridRowModelRefreshReason): Promise<void> | void
  subscribe(listener: DataGridRowModelListener<T>): () => void
  dispose(): void
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

function resolveRowState(node: DataGridRowNodeInput<unknown>): DataGridRowNodeState {
  const state = (node as { state?: Partial<DataGridRowNodeState> }).state
  return {
    selected: Boolean(state?.selected),
    group: Boolean(state?.group),
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
  const state = resolveRowState(node)
  const rowKey = resolveRowKey(node)

  return {
    data,
    row: data,
    rowKey,
    rowId: rowKey,
    originalIndex: sourceIndex,
    sourceIndex,
    displayIndex,
    state,
  }
}
