import type {
  UiTableFilterSnapshot,
  UiTableRowId,
  UiTableSortState,
  VisibleRow,
} from "../types"

export type DataGridRowModelKind = "client" | "server" | "infinite" | "viewport"

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

export interface DataGridRowNode<T = unknown> extends VisibleRow<T> {
  rowKey: UiTableRowId
  sourceIndex: number
  displayIndex: number
  state: DataGridRowNodeState
}

export interface DataGridRowModelSnapshot<T = unknown> {
  kind: DataGridRowModelKind
  rowCount: number
  loading: boolean
  error: Error | null
  viewportRange: DataGridViewportRange
  sortModel: readonly UiTableSortState[]
  filterModel: UiTableFilterSnapshot | null
}

export type DataGridRowModelListener<T = unknown> = (snapshot: DataGridRowModelSnapshot<T>) => void

export interface DataGridRowModel<T = unknown> {
  readonly kind: DataGridRowModelKind
  getSnapshot(): DataGridRowModelSnapshot<T>
  getRowCount(): number
  getRow(index: number): DataGridRowNode<T> | undefined
  getRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<T>[]
  setViewportRange(range: DataGridViewportRange): void
  setSortModel(sortModel: readonly UiTableSortState[]): void
  setFilterModel(filterModel: UiTableFilterSnapshot | null): void
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

function normalizePinnedState(node: VisibleRow<unknown>): DataGridRowPinState {
  if (node.stickyTop) {
    return "top"
  }
  if (node.stickyBottom) {
    return "bottom"
  }
  return "none"
}

function resolveSourceIndex(node: VisibleRow<unknown>, fallbackIndex: number): number {
  if (Number.isFinite(node.originalIndex)) {
    return Math.max(0, Math.trunc(node.originalIndex))
  }
  return Math.max(0, Math.trunc(fallbackIndex))
}

function resolveDisplayIndex(node: VisibleRow<unknown>, fallbackIndex: number): number {
  if (Number.isFinite(node.displayIndex)) {
    return Math.max(0, Math.trunc(node.displayIndex as number))
  }
  return Math.max(0, Math.trunc(fallbackIndex))
}

export function normalizeRowNode<T>(
  node: VisibleRow<T>,
  fallbackIndex: number,
): DataGridRowNode<T> {
  const sourceIndex = resolveSourceIndex(node, fallbackIndex)
  const displayIndex = resolveDisplayIndex(node, sourceIndex)
  const selected = Boolean((node as Partial<DataGridRowNode<T>>).state?.selected)
  const group = Boolean((node as Partial<DataGridRowNode<T>>).state?.group)
  const expanded = Boolean((node as Partial<DataGridRowNode<T>>).state?.expanded)
  const pinned = (node as Partial<DataGridRowNode<T>>).state?.pinned ?? normalizePinnedState(node)
  const normalizedPinned: DataGridRowPinState =
    pinned === "top" || pinned === "bottom" ? pinned : "none"
  const rowKey = (node as Partial<DataGridRowNode<T>>).rowKey ?? node.rowId

  return {
    ...node,
    rowId: rowKey,
    rowKey,
    originalIndex: sourceIndex,
    sourceIndex,
    displayIndex,
    state: {
      selected,
      group,
      pinned: normalizedPinned,
      expanded,
    },
  }
}
