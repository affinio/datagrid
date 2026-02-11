import { computed, onBeforeUnmount, ref, watch } from "vue"
import type {
  DataGridAdvancedFilterCondition,
  DataGridAdvancedFilterExpression,
  DataGridSelectionSnapshot,
  DataGridColumnModelSnapshot,
  DataGridPaginationSnapshot,
  DataGridColumnDef,
  DataGridRowNode,
} from "@affino/datagrid-core"
import type { DataGridTransactionSnapshot } from "@affino/datagrid-core/advanced"
import {
  useDataGridCellNavigation,
  useDataGridClipboardBridge,
  useDataGridClipboardMutations,
  useDataGridRangeMutationEngine,
} from "@affino/datagrid-orchestration"
import type {
  DataGridContextMenuAction,
  DataGridContextMenuActionId,
} from "./useDataGridContextMenu"
import { DataGrid } from "../components/DataGrid"
import {
  assembleAffinoDataGridResult,
  fallbackResolveRowKey,
  normalizeAffinoDataGridFeatures,
  useAffinoDataGridBindingSuite,
  useAffinoDataGridFeatureSuite,
  useAffinoDataGridRuntimeBootstrap,
  useAffinoDataGridSortActionSuite,
} from "./internal/useAffinoDataGrid"
import type {
  AffinoDataGridActionId,
  AffinoDataGridActionResult,
  AffinoDataGridRunActionOptions,
  AffinoDataGridFeedbackEvent,
  AffinoDataGridHeaderFilterOperatorEntry,
  AffinoDataGridHeaderFilterValueEntry,
  AffinoDataGridLayoutProfile,
  AffinoDataGridStatusBarMetrics,
  AffinoDataGridFilteringHelpers,
  AffinoDataGridFilterMergeMode,
  AffinoDataGridSetFilterValueMode,
  AffinoDataGridCellRange,
  UseAffinoDataGridOptions,
  UseAffinoDataGridResult,
} from "./useAffinoDataGrid.types"

function clonePaginationSnapshot(
  snapshot: DataGridPaginationSnapshot,
): DataGridPaginationSnapshot {
  return { ...snapshot }
}

function cloneColumnModelSnapshot(
  snapshot: DataGridColumnModelSnapshot,
): DataGridColumnModelSnapshot {
  const columns = snapshot.columns.map(column => ({
    ...column,
    column: { ...column.column },
  }))
  const visibleColumnKeys = new Set(snapshot.visibleColumns.map(column => column.key))
  return {
    columns,
    order: [...snapshot.order],
    visibleColumns: columns.filter(column => visibleColumnKeys.has(column.key)),
  }
}

function cloneTransactionSnapshot(
  snapshot: DataGridTransactionSnapshot | null,
): DataGridTransactionSnapshot | null {
  if (!snapshot) {
    return null
  }
  return {
    revision: snapshot.revision,
    pendingBatch: snapshot.pendingBatch
      ? {
          id: snapshot.pendingBatch.id,
          label: snapshot.pendingBatch.label,
          size: snapshot.pendingBatch.size,
        }
      : null,
    undoDepth: snapshot.undoDepth,
    redoDepth: snapshot.redoDepth,
    lastCommittedId: snapshot.lastCommittedId,
  }
}

function isFilteringModelActive(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") {
    return false
  }
  const filterSnapshot = snapshot as {
    columnFilters?: Record<string, readonly unknown[]>
    advancedFilters?: Record<string, unknown>
    advancedExpression?: unknown
  }
  const columnFilters = filterSnapshot.columnFilters ?? {}
  for (const values of Object.values(columnFilters)) {
    if (Array.isArray(values) && values.length > 0) {
      return true
    }
  }
  const advancedFilters = filterSnapshot.advancedFilters ?? {}
  if (Object.keys(advancedFilters).length > 0) {
    return true
  }
  return filterSnapshot.advancedExpression != null
}

function reorderArrayByIndex<T>(
  source: readonly T[],
  fromIndexRaw: number,
  toIndexRaw: number,
  countRaw = 1,
): readonly T[] | null {
  const length = source.length
  if (length <= 1) {
    return null
  }
  if (!Number.isFinite(fromIndexRaw) || !Number.isFinite(toIndexRaw) || !Number.isFinite(countRaw)) {
    return null
  }

  const fromIndex = Math.max(0, Math.min(length - 1, Math.trunc(fromIndexRaw)))
  const count = Math.max(1, Math.trunc(countRaw))
  const normalizedCount = Math.max(1, Math.min(count, length - fromIndex))
  const toIndex = Math.max(0, Math.min(length, Math.trunc(toIndexRaw)))

  const nextRows = source.slice()
  const moved = nextRows.splice(fromIndex, normalizedCount)
  if (moved.length === 0) {
    return null
  }
  const adjustedTarget = toIndex > fromIndex ? Math.max(0, toIndex - moved.length) : toIndex
  nextRows.splice(adjustedTarget, 0, ...moved)
  return nextRows
}

interface AffinoDataGridCellSelectionCoord {
  rowKey: string
  columnKey: string
  rowIndex: number
  columnIndex: number
  rowId: string | number | null
}

interface InternalCellRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

interface AffinoDataGridMutationSnapshot<TRow> {
  rows: readonly TRow[]
  selection: DataGridSelectionSnapshot | null
}

function isRecordRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function coerceStringDraftToCellValue(current: unknown, draft: string): unknown {
  if (typeof current === "number") {
    const parsed = Number(draft)
    return Number.isFinite(parsed) ? parsed : current
  }
  if (typeof current === "boolean") {
    const normalized = draft.trim().toLowerCase()
    if (normalized === "true" || normalized === "1") {
      return true
    }
    if (normalized === "false" || normalized === "0") {
      return false
    }
    return current
  }
  return draft
}

function normalizeFilterColumnKey(value: string): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeFilterChildren(
  children: readonly (DataGridAdvancedFilterExpression | null | undefined)[],
): DataGridAdvancedFilterExpression[] {
  return children.filter((entry): entry is DataGridAdvancedFilterExpression => Boolean(entry))
}

function createAdvancedCondition(
  condition: Omit<DataGridAdvancedFilterCondition, "kind">,
): DataGridAdvancedFilterCondition {
  const key = normalizeFilterColumnKey(condition.key)
  return {
    ...condition,
    key,
    kind: "condition",
  }
}

function createAdvancedGroup(
  operator: "and" | "or",
  children: readonly (DataGridAdvancedFilterExpression | null | undefined)[],
): DataGridAdvancedFilterExpression | null {
  const normalizedChildren = normalizeFilterChildren(children)
  if (normalizedChildren.length === 0) {
    return null
  }
  if (normalizedChildren.length === 1) {
    return normalizedChildren[0] ?? null
  }
  return {
    kind: "group",
    operator,
    children: normalizedChildren,
  }
}

function createAdvancedNot(
  child: DataGridAdvancedFilterExpression | null | undefined,
): DataGridAdvancedFilterExpression | null {
  if (!child) {
    return null
  }
  return {
    kind: "not",
    child,
  }
}

function mergeAdvancedExpression(
  current: DataGridAdvancedFilterExpression | null | undefined,
  next: DataGridAdvancedFilterExpression | null | undefined,
  mergeMode: AffinoDataGridFilterMergeMode,
): DataGridAdvancedFilterExpression | null {
  if (mergeMode === "replace") {
    return next ?? null
  }
  if (!next) {
    return current ?? null
  }
  if (!current) {
    return next
  }
  const operator = mergeMode === "merge-or" ? "or" : "and"
  return createAdvancedGroup(operator, [current, next])
}

function removeAdvancedConditionByKey(
  expression: DataGridAdvancedFilterExpression | null | undefined,
  columnKeyRaw: string,
): DataGridAdvancedFilterExpression | null {
  if (!expression) {
    return null
  }
  const columnKey = normalizeFilterColumnKey(columnKeyRaw)
  if (!columnKey) {
    return expression
  }

  const visit = (node: DataGridAdvancedFilterExpression): DataGridAdvancedFilterExpression | null => {
    if (node.kind === "condition") {
      return normalizeFilterColumnKey(node.key) === columnKey ? null : node
    }
    if (node.kind === "not") {
      const nextChild = visit(node.child)
      if (!nextChild) {
        return null
      }
      return { ...node, child: nextChild }
    }
    const nextChildren = node.children
      .map(child => visit(child))
      .filter((child): child is DataGridAdvancedFilterExpression => Boolean(child))
    if (nextChildren.length === 0) {
      return null
    }
    if (nextChildren.length === 1) {
      return nextChildren[0] ?? null
    }
    return { ...node, children: nextChildren }
  }

  return visit(expression)
}

function findSetConditionValuesByKey(
  expression: DataGridAdvancedFilterExpression | null | undefined,
  columnKeyRaw: string,
): readonly unknown[] {
  if (!expression) {
    return []
  }
  const columnKey = normalizeFilterColumnKey(columnKeyRaw)
  if (!columnKey) {
    return []
  }
  const visit = (node: DataGridAdvancedFilterExpression): readonly unknown[] | null => {
    if (node.kind === "condition") {
      if (normalizeFilterColumnKey(node.key) !== columnKey) {
        return null
      }
      if (node.type !== "set") {
        return null
      }
      if (!Array.isArray(node.value)) {
        return []
      }
      return node.value
    }
    if (node.kind === "not") {
      return visit(node.child)
    }
    for (const child of node.children) {
      const found = visit(child)
      if (found) {
        return found
      }
    }
    return null
  }
  return visit(expression) ?? []
}

function nextSetFilterValues(
  current: readonly unknown[],
  incoming: readonly unknown[],
  mode: AffinoDataGridSetFilterValueMode,
): readonly unknown[] {
  const stableKey = (value: unknown): string => {
    if (typeof value === "string") {
      return value
    }
    const serialized = JSON.stringify(value)
    return typeof serialized === "string" ? serialized : String(value)
  }
  const incomingMap = new Map<string, unknown>()
  for (const value of incoming) {
    incomingMap.set(stableKey(value), value)
  }
  if (mode === "replace") {
    return Array.from(incomingMap.values())
  }
  const currentMap = new Map<string, unknown>()
  for (const value of current) {
    currentMap.set(stableKey(value), value)
  }
  if (mode === "append") {
    for (const [key, value] of incomingMap) {
      currentMap.set(key, value)
    }
    return Array.from(currentMap.values())
  }
  for (const key of incomingMap.keys()) {
    currentMap.delete(key)
  }
  return Array.from(currentMap.values())
}

function stableSerialize(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function stableClone<T>(value: T): T {
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value)
    }
  } catch {
    // Fallback below.
  }
  try {
    const serialized = JSON.stringify(value)
    if (typeof serialized !== "string") {
      return value
    }
    return JSON.parse(serialized) as T
  } catch {
    return value
  }
}

const DEFAULT_HEADER_FILTER_OPERATORS: Record<
  "text" | "number" | "date" | "set",
  readonly AffinoDataGridHeaderFilterOperatorEntry[]
> = {
  text: [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "startsWith", label: "Starts with" },
    { value: "endsWith", label: "Ends with" },
  ],
  number: [
    { value: "equals", label: "Equals" },
    { value: "notEquals", label: "Not equals" },
    { value: "gt", label: "Greater than" },
    { value: "gte", label: "Greater than or equal" },
    { value: "lt", label: "Less than" },
    { value: "lte", label: "Less than or equal" },
    { value: "between", label: "Between" },
  ],
  date: [
    { value: "equals", label: "Equals" },
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "between", label: "Between" },
  ],
  set: [
    { value: "in", label: "In list" },
    { value: "notIn", label: "Not in list" },
  ],
}
export type {
  AffinoDataGridEditMode,
  AffinoDataGridSelectionFeature,
  AffinoDataGridClipboardFeature,
  AffinoDataGridEditSession,
  AffinoDataGridEditingFeature,
  AffinoDataGridFeatures,
  AffinoDataGridRangeInteractionsFeature,
  AffinoDataGridInteractionsFeature,
  AffinoDataGridHeaderFiltersFeature,
  AffinoDataGridFeedbackFeature,
  AffinoDataGridStatusBarFeature,
  AffinoDataGridHeaderFilterValueEntry,
  AffinoDataGridHeaderFilterOperatorEntry,
  AffinoDataGridFeedbackEvent,
  AffinoDataGridLayoutProfile,
  AffinoDataGridStatusBarMetrics,
  AffinoDataGridFilteringFeature,
  AffinoDataGridSummaryFeature,
  AffinoDataGridVisibilityFeature,
  AffinoDataGridTreeFeature,
  AffinoDataGridRowHeightFeature,
  AffinoDataGridKeyboardNavigationFeature,
  AffinoDataGridFilterMergeMode,
  AffinoDataGridSetFilterValueMode,
  AffinoDataGridFilteringHelpers,
  UseAffinoDataGridOptions,
  AffinoDataGridActionId,
  AffinoDataGridRunActionOptions,
  AffinoDataGridActionResult,
  AffinoDataGridActionBindingOptions,
  AffinoDataGridCellCoord,
  AffinoDataGridCellRange,
  UseAffinoDataGridResult,
} from "./useAffinoDataGrid.types"

export function useAffinoDataGrid<TRow>(
  options: UseAffinoDataGridOptions<TRow>,
): UseAffinoDataGridResult<TRow> {
  const runtimeBootstrap = useAffinoDataGridRuntimeBootstrap({
    rows: options.rows,
    columns: options.columns,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart,
  })
  const { rows, columns, runtime, internalSelectionSnapshot } = runtimeBootstrap
  const normalizedFeatures = normalizeAffinoDataGridFeatures(options.features)

  const featureSuite = useAffinoDataGridFeatureSuite({
    rows,
    columns,
    runtime,
    normalizedFeatures,
    fallbackResolveRowKey,
    internalSelectionSnapshot,
  })
  const {
    selectedRowKeySet,
    resolveRowKey,
    isSelectedByKey,
    toggleSelectedByKey,
    clearSelection,
    selectOnlyRow,
    selectAllRows,
    resolveSelectedRows,
    filteringEnabled,
    clipboardEnabled,
    copySelectedRows,
    clearSelectedRows,
    cutSelectedRows,
    pasteRowsAppend,
    editingEnabled,
    editingEnum,
    enumEditorEnabled,
    enumEditorPrimitive,
    resolveEnumEditorOptions,
    activeSession,
    beginEdit,
    updateDraft,
    cancelEdit,
    commitEdit,
    isCellEditing,
    resolveCellDraft,
  } = featureSuite

  let runCopyAction: () => Promise<boolean> = () => copySelectedRows()
  let runCutAction: () => Promise<number> = () => cutSelectedRows()
  let runPasteAction: () => Promise<number> = () => pasteRowsAppend()
  let runClearAction: () => Promise<number> = () => clearSelectedRows()
  const feedbackEnabled = ref(normalizedFeatures.feedback.enabled)
  const feedbackLastAction = ref("Ready")
  const feedbackEvents = ref<readonly AffinoDataGridFeedbackEvent[]>([])
  let nextFeedbackEventId = 1

  const pushFeedback = (
    event: Omit<AffinoDataGridFeedbackEvent, "id" | "timestamp">,
  ): void => {
    if (!feedbackEnabled.value) {
      return
    }
    const nextEvent: AffinoDataGridFeedbackEvent = {
      ...event,
      id: nextFeedbackEventId++,
      timestamp: Date.now(),
    }
    feedbackLastAction.value = nextEvent.message
    const nextEvents = [...feedbackEvents.value, nextEvent]
    const limit = normalizedFeatures.feedback.maxEvents
    feedbackEvents.value = nextEvents.length > limit
      ? nextEvents.slice(nextEvents.length - limit)
      : nextEvents
  }

  const {
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
    resolveColumnSortDirection,
    runAction,
  } = useAffinoDataGridSortActionSuite({
    initialSortState: options.initialSortState,
    onSortModelChange(nextSortState) {
      runtime.api.setSortModel(nextSortState)
    },
    selectedRowKeySet,
    clearSelection,
    selectAllRows,
    resolveSelectedRows,
    resolveRows: () => rows.value,
    resolveColumns: () => columns.value,
    setColumnWidth: (columnKey, width) => {
      runtime.api.setColumnWidth(columnKey, width)
    },
    isFilteringEnabled: () => filteringEnabled.value,
    copySelectedRows: () => runCopyAction(),
    cutSelectedRows: () => runCutAction(),
    pasteRowsAppend: () => runPasteAction(),
    clearSelectedRows: () => runClearAction(),
  })

  const runActionWithFeedback = async (
    actionId: AffinoDataGridActionId,
    actionOptions?: AffinoDataGridRunActionOptions,
  ): Promise<AffinoDataGridActionResult> => {
    const result = await runAction(actionId, actionOptions)
    pushFeedback({
      source: "action",
      action: actionId,
      message: result.message,
      affected: result.affected,
      ok: result.ok,
      meta: actionOptions ? { columnKey: actionOptions.columnKey ?? null } : undefined,
    })
    return result
  }

  const componentProps = computed(() => ({
    rows: rows.value,
    columns: columns.value,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  }))

  const rowReorderSupported = computed(() => runtime.rowModel.kind === "client")
  const rowReorderReason = computed<string | null>(() => {
    if (!rowReorderSupported.value) {
      return "Row reorder is available only for client row model."
    }
    if (featureSuite.treeEnabled.value && featureSuite.groupBy.value) {
      return "Disable group-by before row reorder."
    }
    if (featureSuite.filteringEnabled.value && isFilteringModelActive(featureSuite.filterModel.value)) {
      return "Clear active filters before row reorder."
    }
    return null
  })
  const canReorderRows = computed(() => rowReorderReason.value == null)

  const moveRowsByIndex = async (
    fromIndex: number,
    toIndex: number,
    count = 1,
  ): Promise<boolean> => {
    if (!canReorderRows.value) {
      return false
    }
    const nextRows = reorderArrayByIndex(rows.value, fromIndex, toIndex, count)
    if (!nextRows || nextRows === rows.value) {
      return false
    }
    const normalizedFromIndex = Math.max(0, Math.min(rows.value.length - 1, Math.trunc(fromIndex)))
    const normalizedToIndex = Math.max(0, Math.min(rows.value.length, Math.trunc(toIndex)))
    const columnCount = Math.max(1, columns.value.length)
    return featureSuite.replaceRows(nextRows, {
      intent: "rows-reorder",
      label: "Reorder rows",
      clearSelection: false,
      affectedRange: {
        startRow: Math.min(normalizedFromIndex, normalizedToIndex),
        endRow: Math.max(normalizedFromIndex, normalizedToIndex),
        startColumn: 0,
        endColumn: columnCount - 1,
      },
    })
  }

  const moveRowsByKey = async (
    sourceRowKey: string,
    targetRowKey: string,
    position: "before" | "after" = "before",
  ): Promise<boolean> => {
    if (!canReorderRows.value) {
      return false
    }
    const order = rows.value.map((row, index) => resolveRowKey(row, index))
    const sourceIndex = order.indexOf(sourceRowKey)
    const targetIndex = order.indexOf(targetRowKey)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return false
    }
    const insertionIndex = position === "after" ? targetIndex + 1 : targetIndex
    return moveRowsByIndex(sourceIndex, insertionIndex, 1)
  }

  const cellSelectionAnchor = ref<AffinoDataGridCellSelectionCoord | null>(null)
  const cellSelectionFocus = ref<AffinoDataGridCellSelectionCoord | null>(null)
  const isPointerSelectingCells = ref(false)

  const resolveVisibleColumnIndex = (columnKey: string): number => (
    runtime.columnSnapshot.value.visibleColumns.findIndex(column => column.key === columnKey)
  )

  const resolveVisibleRowIndexByKey = (rowKey: string): number => {
    const rowCount = runtime.api.getRowCount()
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rowNode = runtime.api.getRow<TRow>(rowIndex)
      if (!rowNode) {
        continue
      }
      const candidateRowKey = rowNode.kind === "leaf"
        ? resolveRowKey(rowNode.data as TRow, rowNode.sourceIndex)
        : String(rowNode.rowId ?? rowNode.rowKey ?? rowIndex)
      if (candidateRowKey === rowKey) {
        return rowIndex
      }
    }
    return -1
  }

  const resolveCellCoordByIndex = (
    rowIndexRaw: number,
    columnIndexRaw: number,
  ): AffinoDataGridCellSelectionCoord | null => {
    const rowCount = runtime.api.getRowCount()
    const columnCount = runtime.columnSnapshot.value.visibleColumns.length
    if (rowCount <= 0 || columnCount <= 0) {
      return null
    }
    const rowIndex = Math.max(0, Math.min(rowCount - 1, Math.trunc(rowIndexRaw)))
    const columnIndex = Math.max(0, Math.min(columnCount - 1, Math.trunc(columnIndexRaw)))
    const rowNode = runtime.api.getRow<TRow>(rowIndex)
    const column = runtime.columnSnapshot.value.visibleColumns[columnIndex]
    if (!rowNode || !column) {
      return null
    }
    const rowKey = rowNode.kind === "leaf"
      ? resolveRowKey(rowNode.data as TRow, rowNode.sourceIndex)
      : String(rowNode.rowId ?? rowNode.rowKey ?? rowIndex)
    return {
      rowKey,
      columnKey: column.key,
      rowIndex,
      columnIndex,
      rowId: rowNode.rowId ?? null,
    }
  }

  const resolveCellCoordByKey = (rowKey: string, columnKey: string): AffinoDataGridCellSelectionCoord | null => {
    const rowIndex = resolveVisibleRowIndexByKey(rowKey)
    const columnIndex = resolveVisibleColumnIndex(columnKey)
    if (rowIndex < 0 || columnIndex < 0) {
      return null
    }
    return resolveCellCoordByIndex(rowIndex, columnIndex)
  }

  const activeCellSelection = computed<AffinoDataGridCellSelectionCoord | null>(() => (
    cellSelectionFocus.value ?? cellSelectionAnchor.value
  ))
  const anchorCellSelection = computed<AffinoDataGridCellSelectionCoord | null>(() => (
    cellSelectionAnchor.value
  ))
  const focusCellSelection = computed<AffinoDataGridCellSelectionCoord | null>(() => (
    cellSelectionFocus.value
  ))

  const setCellSelection = (
    coord: AffinoDataGridCellSelectionCoord,
    extend = false,
    fallbackAnchor: { rowIndex: number; columnIndex: number } | null = null,
  ): void => {
    if (!extend) {
      cellSelectionAnchor.value = coord
      cellSelectionFocus.value = coord
      return
    }

    const anchor = cellSelectionAnchor.value
      ?? (fallbackAnchor
        ? resolveCellCoordByIndex(fallbackAnchor.rowIndex, fallbackAnchor.columnIndex)
        : null)
      ?? activeCellSelection.value
      ?? coord

    cellSelectionAnchor.value = anchor
    cellSelectionFocus.value = coord
  }

  const clearCellSelection = (): void => {
    cellSelectionAnchor.value = null
    cellSelectionFocus.value = null
    isPointerSelectingCells.value = false
  }

  const cellSelectionRange = computed<{
    startRow: number
    endRow: number
    startColumn: number
    endColumn: number
  } | null>(() => {
    const anchor = cellSelectionAnchor.value
    const focus = cellSelectionFocus.value
    if (!anchor || !focus) {
      return null
    }
    return {
      startRow: Math.min(anchor.rowIndex, focus.rowIndex),
      endRow: Math.max(anchor.rowIndex, focus.rowIndex),
      startColumn: Math.min(anchor.columnIndex, focus.columnIndex),
      endColumn: Math.max(anchor.columnIndex, focus.columnIndex),
    }
  })

  const cellSelectionRanges = computed(() => (
    cellSelectionRange.value ? [cellSelectionRange.value] : []
  ))

  const isCellSelected = (rowIndex: number, columnIndex: number): boolean => {
    const range = cellSelectionRange.value
    if (!range) {
      return false
    }
    return (
      rowIndex >= range.startRow &&
      rowIndex <= range.endRow &&
      columnIndex >= range.startColumn &&
      columnIndex <= range.endColumn
    )
  }

  const setCellByKey = (
    rowKey: string,
    columnKey: string,
    options: { extend?: boolean } = {},
  ): boolean => {
    const coord = resolveCellCoordByKey(rowKey, columnKey)
    if (!coord) {
      return false
    }
    setCellSelection(coord, Boolean(options.extend))
    return true
  }

  const buildCellSelectionSnapshot = (): DataGridSelectionSnapshot | null => {
    const range = cellSelectionRange.value
    const anchor = cellSelectionAnchor.value
    const focus = cellSelectionFocus.value
    if (!range || !anchor || !focus) {
      return null
    }
    const startRowId = runtime.api.getRow(range.startRow)?.rowId ?? null
    const endRowId = runtime.api.getRow(range.endRow)?.rowId ?? null
    return {
      ranges: [
        {
          startRow: range.startRow,
          endRow: range.endRow,
          startCol: range.startColumn,
          endCol: range.endColumn,
          startRowId,
          endRowId,
          anchor: {
            rowIndex: anchor.rowIndex,
            colIndex: anchor.columnIndex,
            rowId: anchor.rowId,
          },
          focus: {
            rowIndex: focus.rowIndex,
            colIndex: focus.columnIndex,
            rowId: focus.rowId,
          },
        },
      ],
      activeRangeIndex: 0,
      activeCell: {
        rowIndex: focus.rowIndex,
        colIndex: focus.columnIndex,
        rowId: focus.rowId,
      },
    }
  }

  const syncSelectionSnapshot = (): void => {
    const nextSnapshot = buildCellSelectionSnapshot() ?? featureSuite.selectionSnapshot.value
    internalSelectionSnapshot.value = nextSnapshot
    if (!runtime.api.hasSelectionSupport()) {
      return
    }
    if (!nextSnapshot) {
      runtime.api.clearSelection()
      return
    }
    runtime.api.setSelectionSnapshot(nextSnapshot)
  }

  watch(
    [cellSelectionRange, () => featureSuite.selectionSnapshot.value],
    () => {
      syncSelectionSnapshot()
    },
    { immediate: true, flush: "sync" },
  )

  const cellNavigation = useDataGridCellNavigation({
    resolveCurrentCellCoord: () => {
      const active = activeCellSelection.value
      if (!active) {
        return null
      }
      return {
        rowIndex: active.rowIndex,
        columnIndex: active.columnIndex,
      }
    },
    resolveTabTarget: (current, backwards) => {
      const rowCount = runtime.api.getRowCount()
      const columnCount = runtime.columnSnapshot.value.visibleColumns.length
      if (rowCount <= 0 || columnCount <= 0) {
        return null
      }
      let rowIndex = current.rowIndex
      let columnIndex = current.columnIndex + (backwards ? -1 : 1)
      if (columnIndex < 0) {
        rowIndex -= 1
        columnIndex = columnCount - 1
      } else if (columnIndex >= columnCount) {
        rowIndex += 1
        columnIndex = 0
      }
      if (rowIndex < 0 || rowIndex >= rowCount) {
        return null
      }
      return {
        rowIndex,
        columnIndex,
      }
    },
    normalizeCellCoord: coord => {
      const normalized = resolveCellCoordByIndex(coord.rowIndex, coord.columnIndex)
      if (!normalized) {
        return null
      }
      return {
        rowIndex: normalized.rowIndex,
        columnIndex: normalized.columnIndex,
      }
    },
    getAdjacentNavigableColumnIndex: (columnIndex, direction) => {
      const max = Math.max(0, runtime.columnSnapshot.value.visibleColumns.length - 1)
      return Math.max(0, Math.min(max, columnIndex + direction))
    },
    getFirstNavigableColumnIndex: () => (
      runtime.columnSnapshot.value.visibleColumns.length > 0 ? 0 : -1
    ),
    getLastNavigableColumnIndex: () => (
      Math.max(-1, runtime.columnSnapshot.value.visibleColumns.length - 1)
    ),
    getLastRowIndex: () => Math.max(0, runtime.api.getRowCount() - 1),
    resolveStepRows: () => 20,
    closeContextMenu: () => {},
    clearCellSelection,
    setLastAction: () => {},
    applyCellSelection: (nextCoord, extend, fallbackAnchor) => {
      const normalized = resolveCellCoordByIndex(nextCoord.rowIndex, nextCoord.columnIndex)
      if (!normalized) {
        return
      }
      setCellSelection(normalized, extend, fallbackAnchor ?? null)
    },
  })

  const stopPointerCellSelection = (): void => {
    isPointerSelectingCells.value = false
  }

  let dispatchCellKeyboardCommands = (_event: KeyboardEvent): boolean => false

  const createCellSelectionBindings = (params: {
    row: TRow
    rowIndex: number
    columnKey: string
  }) => {
    const rowKey = resolveRowKey(params.row, params.rowIndex)

    const resolveBoundCoord = (): AffinoDataGridCellSelectionCoord | null => (
      resolveCellCoordByKey(rowKey, params.columnKey)
      ?? resolveCellCoordByIndex(params.rowIndex, resolveVisibleColumnIndex(params.columnKey))
    )

    const ensureCurrentCoord = (): AffinoDataGridCellSelectionCoord | null => {
      const coord = resolveBoundCoord()
      if (!coord) {
        return null
      }
      if (!activeCellSelection.value) {
        setCellSelection(coord, false)
      }
      return coord
    }

    return {
      "data-row-key": rowKey,
      "data-column-key": params.columnKey,
      onMousedown: (event: MouseEvent) => {
        if (event.button !== 0) {
          return
        }
        const coord = resolveBoundCoord()
        if (!coord) {
          return
        }
        event.preventDefault()
        const currentTarget = event.currentTarget
        if (currentTarget instanceof HTMLElement) {
          currentTarget.focus({ preventScroll: true })
        }
        setCellSelection(coord, event.shiftKey)
        isPointerSelectingCells.value = true
      },
      onMouseenter: (_event: MouseEvent) => {
        if (!isPointerSelectingCells.value) {
          return
        }
        const coord = resolveBoundCoord()
        if (!coord) {
          return
        }
        setCellSelection(coord, true)
      },
      onMouseup: (_event?: MouseEvent) => {
        stopPointerCellSelection()
      },
      onKeydown: (event: KeyboardEvent) => {
        ensureCurrentCoord()
        if (dispatchCellKeyboardCommands(event)) {
          return
        }
        if (cellNavigation.dispatchNavigation(event)) {
          return
        }
        if (event.key === " " || event.key === "Spacebar") {
          const coord = resolveBoundCoord()
          if (!coord) {
            return
          }
          event.preventDefault()
          setCellSelection(coord, event.shiftKey)
        }
      },
    }
  }

  const createRangeHandleBindings = (params: {
    rowIndex: number
    columnKey: string
    mode?: "fill" | "move"
  }) => ({
    "data-row-index": params.rowIndex,
    "data-column-key": params.columnKey,
    "data-range-mode": (params.mode ?? "fill") as "fill" | "move",
    onMousedown: (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      startRangePointerInteraction(params.mode ?? "fill", {
        rowIndex: params.rowIndex,
        columnKey: params.columnKey,
      })
    },
  })

  const createRangeSurfaceBindings = (params: {
    rowIndex: number
    columnKey: string
  }) => ({
    "data-row-index": params.rowIndex,
    "data-column-key": params.columnKey,
    onMouseenter: (_event?: MouseEvent) => {
      updateRangePointerPreview(params.rowIndex, params.columnKey)
    },
    onMouseup: (_event?: MouseEvent) => {
      stopRangePointerInteraction(true)
    },
  })

  const bindingSuite = useAffinoDataGridBindingSuite({
    columns,
    resolveColumnOrder: () => runtime.api.getColumnModelSnapshot().order,
    setColumnOrder: keys => {
      runtime.api.setColumnOrder(keys)
    },
    resolveRowOrder: () => rows.value.map((row, index) => resolveRowKey(row, index)),
    moveRowByKey: moveRowsByKey,
    canReorderRows: () => canReorderRows.value,
    resolveRowKey,
    resolveColumnSortDirection,
    toggleColumnSort,
    isSelectedByKey,
    toggleSelectedByKey,
    selectOnlyRow,
    editingEnabled,
    beginEdit,
    resolveCellDraft,
    isCellEditing,
    activeSession,
    updateDraft,
    cancelEdit,
    commitEdit,
    runAction,
  })

  const applyAdvancedExpression = (
    expression: DataGridAdvancedFilterExpression | null,
    options: { mergeMode?: AffinoDataGridFilterMergeMode } = {},
  ): DataGridAdvancedFilterExpression | null => {
    const mergeMode = options.mergeMode ?? "replace"
    const currentExpression = featureSuite.filterModel.value?.advancedExpression ?? null
    const nextExpression = mergeAdvancedExpression(currentExpression, expression, mergeMode)
    featureSuite.setAdvancedFilterExpression(nextExpression)
    return nextExpression
  }

  const clearAdvancedExpressionByKey = (columnKey: string): DataGridAdvancedFilterExpression | null => {
    const currentExpression = featureSuite.filterModel.value?.advancedExpression ?? null
    const nextExpression = removeAdvancedConditionByKey(currentExpression, columnKey)
    featureSuite.setAdvancedFilterExpression(nextExpression)
    return nextExpression
  }

  const setTypedAdvancedCondition = (
    condition: Omit<DataGridAdvancedFilterCondition, "kind">,
    options: { mergeMode?: AffinoDataGridFilterMergeMode } = {},
  ): DataGridAdvancedFilterExpression | null => {
    const key = normalizeFilterColumnKey(condition.key)
    if (!key) {
      return featureSuite.filterModel.value?.advancedExpression ?? null
    }
    const currentExpression = featureSuite.filterModel.value?.advancedExpression ?? null
    const withoutKey = removeAdvancedConditionByKey(currentExpression, key)
    const nextCondition = createAdvancedCondition({ ...condition, key })
    const mergeMode = options.mergeMode ?? "merge-and"
    const nextExpression = mergeAdvancedExpression(withoutKey, nextCondition, mergeMode)
    featureSuite.setAdvancedFilterExpression(nextExpression)
    return nextExpression
  }

  const filteringHelpers: AffinoDataGridFilteringHelpers = {
    condition: createAdvancedCondition,
    and: (...children) => createAdvancedGroup("and", children),
    or: (...children) => createAdvancedGroup("or", children),
    not: child => createAdvancedNot(child),
    apply: applyAdvancedExpression,
    clearByKey: clearAdvancedExpressionByKey,
    setText: (columnKey, options) => setTypedAdvancedCondition(
      {
        key: columnKey,
        type: "text",
        operator: options.operator ?? "contains",
        value: options.value ?? "",
      },
      { mergeMode: options.mergeMode },
    ),
    setNumber: (columnKey, options) => setTypedAdvancedCondition(
      {
        key: columnKey,
        type: "number",
        operator: options.operator ?? "equals",
        value: options.value,
        value2: options.value2,
      },
      { mergeMode: options.mergeMode },
    ),
    setDate: (columnKey, options) => setTypedAdvancedCondition(
      {
        key: columnKey,
        type: "date",
        operator: options.operator ?? "equals",
        value: options.value,
        value2: options.value2,
      },
      { mergeMode: options.mergeMode },
    ),
    setSet: (columnKey, values, options = {}) => {
      const key = normalizeFilterColumnKey(columnKey)
      if (!key) {
        return featureSuite.filterModel.value?.advancedExpression ?? null
      }
      const currentExpression = featureSuite.filterModel.value?.advancedExpression ?? null
      const existingValues = findSetConditionValuesByKey(currentExpression, key)
      const valueMode: AffinoDataGridSetFilterValueMode = options.valueMode ?? "replace"
      const nextValues = nextSetFilterValues(existingValues, values, valueMode)
      const withoutKey = removeAdvancedConditionByKey(currentExpression, key)
      if (nextValues.length === 0) {
        featureSuite.setAdvancedFilterExpression(withoutKey)
        return withoutKey
      }
      const nextCondition = createAdvancedCondition({
        key,
        type: "set",
        operator: options.operator ?? "in",
        value: nextValues,
      })
      const mergeMode = options.mergeMode ?? "merge-and"
      const nextExpression = mergeAdvancedExpression(withoutKey, nextCondition, mergeMode)
      featureSuite.setAdvancedFilterExpression(nextExpression)
      return nextExpression
    },
  }

  const cellRangeLastAction = ref("Ready")
  const setRangeLastAction = (
    message: string,
    options: { action?: string; affected?: number } = {},
  ): void => {
    cellRangeLastAction.value = message
    pushFeedback({
      source: "range",
      action: options.action ?? "range",
      message,
      affected: options.affected,
      ok: true,
    })
  }
  const copiedSelectionRange = ref<InternalCellRange | null>(null)
  const fillPreviewRange = ref<InternalCellRange | null>(null)
  const rangeMovePreviewRange = ref<InternalCellRange | null>(null)

  const resolveColumnKeyAtIndex = (columnIndex: number): string | null => (
    runtime.columnSnapshot.value.visibleColumns[columnIndex]?.key ?? null
  )

  const resolveDisplayNodeAtIndex = (rowIndex: number): DataGridRowNode<TRow> | undefined => (
    runtime.api.getRow<TRow>(rowIndex)
  )

  const resolveDisplayLeafRowAtIndex = (rowIndex: number): TRow | undefined => {
    const rowNode = resolveDisplayNodeAtIndex(rowIndex)
    if (!rowNode || rowNode.kind !== "leaf") {
      return undefined
    }
    return rowNode.data as TRow
  }

  const materializeDisplayRows = (): readonly DataGridRowNode<TRow>[] => {
    const rowCount = runtime.api.getRowCount()
    const rowsBuffer: DataGridRowNode<TRow>[] = []
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rowNode = resolveDisplayNodeAtIndex(rowIndex)
      if (rowNode) {
        rowsBuffer.push(rowNode)
      }
    }
    return rowsBuffer
  }

  const normalizeCellRange = (range: InternalCellRange | null): InternalCellRange | null => {
    if (!range) {
      return null
    }
    const rowTotal = runtime.api.getRowCount()
    const colTotal = runtime.columnSnapshot.value.visibleColumns.length
    if (rowTotal <= 0 || colTotal <= 0) {
      return null
    }
    const clamp = (value: number, max: number): number => (
      Math.max(0, Math.min(max, Math.trunc(value)))
    )
    const maxRow = Math.max(0, rowTotal - 1)
    const maxCol = Math.max(0, colTotal - 1)
    const startRow = clamp(Math.min(range.startRow, range.endRow), maxRow)
    const endRow = clamp(Math.max(range.startRow, range.endRow), maxRow)
    const startColumn = clamp(Math.min(range.startColumn, range.endColumn), maxCol)
    const endColumn = clamp(Math.max(range.startColumn, range.endColumn), maxCol)
    return {
      startRow,
      endRow,
      startColumn,
      endColumn,
    }
  }

  const areCellRangesEqual = (left: InternalCellRange | null, right: InternalCellRange | null): boolean => {
    if (!left && !right) {
      return true
    }
    if (!left || !right) {
      return false
    }
    return (
      left.startRow === right.startRow &&
      left.endRow === right.endRow &&
      left.startColumn === right.startColumn &&
      left.endColumn === right.endColumn
    )
  }

  const resolveCurrentCellCoord = () => {
    const active = activeCellSelection.value
    if (!active) {
      return null
    }
    return {
      rowIndex: active.rowIndex,
      columnIndex: active.columnIndex,
    }
  }

  const resolveCopyRange = (): InternalCellRange | null => (
    normalizeCellRange(cellSelectionRange.value)
  )

  const applySelectionFromRange = (range: InternalCellRange, activePosition: "start" | "end" = "end"): void => {
    const normalized = normalizeCellRange(range)
    if (!normalized) {
      clearCellSelection()
      return
    }
    const start = resolveCellCoordByIndex(normalized.startRow, normalized.startColumn)
    const end = resolveCellCoordByIndex(normalized.endRow, normalized.endColumn)
    if (!start || !end) {
      return
    }
    if (activePosition === "start") {
      cellSelectionAnchor.value = end
      cellSelectionFocus.value = start
      return
    }
    cellSelectionAnchor.value = start
    cellSelectionFocus.value = end
  }

  const resolveActiveRangeCellCount = (): number => {
    const range = resolveCopyRange()
    if (!range) {
      return 0
    }
    return Math.max(0, range.endRow - range.startRow + 1) * Math.max(0, range.endColumn - range.startColumn + 1)
  }

  const resolveCellValue = (row: TRow, columnKey: string): unknown => {
    if (!isRecordRow(row)) {
      return undefined
    }
    return row[columnKey]
  }

  const applyDraftValue = (row: TRow, columnKey: string, draft: string): boolean => {
    if (!isRecordRow(row)) {
      return false
    }
    const record = row as Record<string, unknown>
    const current = record[columnKey]
    record[columnKey] = coerceStringDraftToCellValue(current, draft)
    return true
  }

  const clearCellValue = (row: TRow, columnKey: string): boolean => {
    if (!isRecordRow(row)) {
      return false
    }
    const record = row as Record<string, unknown>
    record[columnKey] = null
    return true
  }

  const cloneRowForMutation = (row: TRow): TRow => {
    try {
      if (typeof structuredClone === "function") {
        return structuredClone(row)
      }
    } catch {
      // Fall through to shallow clone.
    }
    if (Array.isArray(row)) {
      return [...row] as TRow
    }
    if (isRecordRow(row)) {
      return { ...row } as TRow
    }
    return row
  }

  const sourceRowIdMap = ref<Map<TRow, string>>(new Map())
  watch(
    rows,
    nextRows => {
      const nextMap = new Map<TRow, string>()
      nextRows.forEach((row, index) => {
        nextMap.set(row, resolveRowKey(row, index))
      })
      sourceRowIdMap.value = nextMap
    },
    { immediate: true, flush: "sync" },
  )

  const resolveSourceRowId = (row: TRow): string => {
    const direct = sourceRowIdMap.value.get(row)
    if (direct) {
      return direct
    }
    const index = rows.value.indexOf(row)
    if (index >= 0) {
      return resolveRowKey(row, index)
    }
    return String(index)
  }

  const captureMutationSnapshot = (): AffinoDataGridMutationSnapshot<TRow> => ({
    rows: rows.value,
    selection: runtime.api.hasSelectionSupport() ? runtime.api.getSelectionSnapshot() : null,
  })

  const recordCellRangeIntent = async (
    descriptor: { intent: "paste" | "clear" | "cut" | "fill" | "move"; label: string; affectedRange: InternalCellRange },
    beforeSnapshot: AffinoDataGridMutationSnapshot<TRow>,
  ): Promise<void> => {
    if (!runtime.api.hasTransactionSupport()) {
      return
    }
    const afterSelection = runtime.api.hasSelectionSupport() ? runtime.api.getSelectionSnapshot() : null
    const affectedRange = normalizeCellRange(descriptor.affectedRange)
    await runtime.api.applyTransaction({
      label: descriptor.label,
      meta: {
        intent: `cells-${descriptor.intent}`,
        affectedRange: affectedRange
          ? {
              startRow: affectedRange.startRow,
              endRow: affectedRange.endRow,
              startColumn: affectedRange.startColumn,
              endColumn: affectedRange.endColumn,
            }
          : null,
      },
      commands: [
        {
          type: `cells.${descriptor.intent}`,
          payload: {
            rows: rows.value,
            selection: afterSelection,
          },
          rollbackPayload: {
            rows: beforeSnapshot.rows,
            selection: beforeSnapshot.selection,
          },
          meta: {
            intent: `cells-${descriptor.intent}`,
          },
        },
      ],
    })
  }

  const clipboardBridge = useDataGridClipboardBridge<TRow, InternalCellRange>({
    copiedSelectionRange,
    lastCopiedPayload: featureSuite.lastCopiedText,
    resolveCopyRange,
    getRowAtIndex: resolveDisplayLeafRowAtIndex,
    getColumnKeyAtIndex: resolveColumnKeyAtIndex,
    getCellValue: resolveCellValue,
    setLastAction(message) {
      setRangeLastAction(message, { action: "copy-range" })
    },
    closeContextMenu: () => {
      bindingSuite.closeContextMenu()
    },
    writeClipboardText: async text => {
      await featureSuite.copyText(text)
    },
    readClipboardText: featureSuite.readText,
    isColumnCopyable: columnKey => columnKey !== "select",
  })

  const clipboardMutations = useDataGridClipboardMutations<
    TRow,
    string,
    InternalCellRange,
    { rowIndex: number; columnIndex: number },
    AffinoDataGridMutationSnapshot<TRow>
  >({
    sourceRows: rows,
    setSourceRows(nextRows) {
      rows.value = nextRows
    },
    cloneRow: cloneRowForMutation,
    resolveRowId: resolveSourceRowId,
    resolveCopyRange,
    resolveCurrentCellCoord,
    normalizeCellCoord(coord) {
      const normalized = resolveCellCoordByIndex(coord.rowIndex, coord.columnIndex)
      if (!normalized) {
        return null
      }
      return {
        rowIndex: normalized.rowIndex,
        columnIndex: normalized.columnIndex,
      }
    },
    normalizeSelectionRange(range) {
      return normalizeCellRange(range)
    },
    resolveRowAtViewIndex: resolveDisplayLeafRowAtIndex,
    resolveColumnKeyAtIndex: resolveColumnKeyAtIndex,
    isEditableColumn: columnKey => columnKey !== "select",
    canApplyPastedValue: () => true,
    applyEditedValue: applyDraftValue,
    clearValueForCut: clearCellValue,
    applySelectionRange(range) {
      const current = cellSelectionRange.value
      if (
        current
        && current.startRow === current.endRow
        && current.startColumn === current.endColumn
      ) {
        applySelectionFromRange(current, "end")
        return
      }
      applySelectionFromRange(range, "end")
    },
    closeContextMenu: () => {
      bindingSuite.closeContextMenu()
    },
    setLastAction(message) {
      setRangeLastAction(message, { action: "clipboard-range" })
    },
    readClipboardPayload: clipboardBridge.readClipboardPayload,
    parseClipboardMatrix: clipboardBridge.parseClipboardMatrix,
    copySelection: clipboardBridge.copySelection,
    captureBeforeSnapshot: captureMutationSnapshot,
    async recordIntentTransaction(descriptor, beforeSnapshot) {
      try {
        await recordCellRangeIntent(descriptor, beforeSnapshot)
      } catch {
        // Keep mutation result deterministic even when history record fails.
      }
    },
  })

  const rangeMutationEngine = useDataGridRangeMutationEngine<
    TRow,
    DataGridRowNode<TRow>,
    AffinoDataGridMutationSnapshot<TRow>,
    InternalCellRange
  >({
    resolveRangeMoveBaseRange: resolveCopyRange,
    resolveRangeMovePreviewRange: () => normalizeCellRange(rangeMovePreviewRange.value),
    resolveFillBaseRange: resolveCopyRange,
    resolveFillPreviewRange: () => normalizeCellRange(fillPreviewRange.value),
    areRangesEqual: areCellRangesEqual,
    captureBeforeSnapshot: captureMutationSnapshot,
    resolveSourceRows: () => rows.value,
    resolveSourceRowId: resolveSourceRowId,
    applySourceRows(nextRows) {
      rows.value = nextRows
    },
    resolveDisplayedRows: materializeDisplayRows,
    resolveDisplayedRowId(rowNode) {
      return String(rowNode.rowId ?? rowNode.rowKey ?? rowNode.sourceIndex)
    },
    resolveColumnKeyAtIndex: resolveColumnKeyAtIndex,
    resolveDisplayedCellValue(rowNode, columnKey) {
      if (rowNode.kind !== "leaf") {
        return null
      }
      return resolveCellValue(rowNode.data as TRow, columnKey)
    },
    resolveSourceCellValue: resolveCellValue,
    normalizeClipboardValue(value) {
      if (value === null || typeof value === "undefined") {
        return ""
      }
      return String(value)
    },
    isExcludedColumn: columnKey => columnKey === "select",
    isEditableColumn: columnKey => columnKey !== "select",
    applyValueForMove: applyDraftValue,
    clearValueForMove: clearCellValue,
    applyEditedValue: applyDraftValue,
    recomputeDerived: () => {},
    isCellWithinRange(rowIndex, columnIndex, range) {
      return (
        rowIndex >= range.startRow &&
        rowIndex <= range.endRow &&
        columnIndex >= range.startColumn &&
        columnIndex <= range.endColumn
      )
    },
    setSelectionFromRange(range, activePosition) {
      applySelectionFromRange(range, activePosition)
    },
    recordIntent(descriptor, beforeSnapshot) {
      void recordCellRangeIntent(descriptor, beforeSnapshot).catch(() => {
        // Keep range mutation deterministic when history logging fails.
      })
    },
    setLastAction(message) {
      setRangeLastAction(message, { action: "range-mutation" })
    },
  })

  const setFillPreviewRange = (range: AffinoDataGridCellRange | null): void => {
    fillPreviewRange.value = normalizeCellRange(range)
  }

  const setRangeMovePreviewRange = (range: AffinoDataGridCellRange | null): void => {
    rangeMovePreviewRange.value = normalizeCellRange(range)
  }

  const interactionsEnabled = ref(normalizedFeatures.interactions.enabled)
  const rangeInteractionsEnabled = ref(normalizedFeatures.interactions.range.enabled)
  const rangeFillEnabled = ref(normalizedFeatures.interactions.range.fill)
  const rangeMoveEnabled = ref(normalizedFeatures.interactions.range.move)
  const rangePointerMode = ref<"idle" | "fill" | "move">("idle")
  const isRangePointerActive = ref(false)

  const clearRangePreviews = (): void => {
    setFillPreviewRange(null)
    setRangeMovePreviewRange(null)
  }

  const computeFillPreview = (
    baseRange: InternalCellRange,
    rowIndex: number,
    columnIndex: number,
  ): InternalCellRange => {
    const rowDistance = Math.abs(rowIndex - baseRange.endRow)
    const columnDistance = Math.abs(columnIndex - baseRange.endColumn)
    const fillAxis = rowDistance >= columnDistance ? "vertical" : "horizontal"
    if (fillAxis === "vertical") {
      return normalizeCellRange({
        startRow: Math.min(baseRange.startRow, rowIndex),
        endRow: Math.max(baseRange.endRow, rowIndex),
        startColumn: baseRange.startColumn,
        endColumn: baseRange.endColumn,
      }) ?? baseRange
    }
    return normalizeCellRange({
      startRow: baseRange.startRow,
      endRow: baseRange.endRow,
      startColumn: Math.min(baseRange.startColumn, columnIndex),
      endColumn: Math.max(baseRange.endColumn, columnIndex),
    }) ?? baseRange
  }

  const computeRangeMovePreview = (
    baseRange: InternalCellRange,
    rowIndex: number,
    columnIndex: number,
  ): InternalCellRange => {
    const rowSpan = Math.max(1, baseRange.endRow - baseRange.startRow + 1)
    const columnSpan = Math.max(1, baseRange.endColumn - baseRange.startColumn + 1)
    return normalizeCellRange({
      startRow: rowIndex,
      endRow: rowIndex + rowSpan - 1,
      startColumn: columnIndex,
      endColumn: columnIndex + columnSpan - 1,
    }) ?? baseRange
  }

  const updateRangePointerPreview = (rowIndex: number, columnKey: string): void => {
    if (!rangeInteractionsEnabled.value || !isRangePointerActive.value) {
      return
    }
    const baseRange = normalizeCellRange(cellSelectionRange.value)
    const columnIndex = resolveVisibleColumnIndex(columnKey)
    if (!baseRange || columnIndex < 0) {
      return
    }
    if (rangePointerMode.value === "fill" && rangeFillEnabled.value) {
      setFillPreviewRange(computeFillPreview(baseRange, rowIndex, columnIndex))
      return
    }
    if (rangePointerMode.value === "move" && rangeMoveEnabled.value) {
      setRangeMovePreviewRange(computeRangeMovePreview(baseRange, rowIndex, columnIndex))
    }
  }

  const stopRangePointerInteraction = (apply = true): void => {
    if (!isRangePointerActive.value) {
      return
    }
    const mode = rangePointerMode.value
    isRangePointerActive.value = false
    rangePointerMode.value = "idle"
    if (!apply) {
      clearRangePreviews()
      return
    }
    if (mode === "fill" && rangeFillEnabled.value) {
      rangeMutationEngine.applyFillPreview()
      return
    }
    if (mode === "move" && rangeMoveEnabled.value) {
      rangeMutationEngine.applyRangeMove()
    }
  }

  const startRangePointerInteraction = (
    mode: "fill" | "move",
    params: { rowIndex: number; columnKey: string },
  ): boolean => {
    if (!interactionsEnabled.value || !rangeInteractionsEnabled.value) {
      return false
    }
    if (mode === "fill" && !rangeFillEnabled.value) {
      return false
    }
    if (mode === "move" && !rangeMoveEnabled.value) {
      return false
    }
    const columnIndex = resolveVisibleColumnIndex(params.columnKey)
    if (columnIndex < 0 || !normalizeCellRange(cellSelectionRange.value)) {
      return false
    }
    rangePointerMode.value = mode
    isRangePointerActive.value = true
    updateRangePointerPreview(params.rowIndex, params.columnKey)
    return true
  }

  const stopAllPointerInteractions = (applyRange = true): void => {
    stopPointerCellSelection()
    stopRangePointerInteraction(applyRange)
  }

  const handleGlobalPointerUp = (): void => {
    stopAllPointerInteractions(true)
  }

  const handleGlobalPointerCancel = (): void => {
    stopAllPointerInteractions(false)
  }

  if (typeof window !== "undefined") {
    window.addEventListener("mouseup", handleGlobalPointerUp)
    window.addEventListener("pointerup", handleGlobalPointerUp)
    window.addEventListener("pointercancel", handleGlobalPointerCancel)
  }

  const copyCellRangeSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    clipboardBridge.copySelection(trigger)
  )
  const pasteCellRangeSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    clipboardMutations.pasteSelection(trigger)
  )
  const cutCellRangeSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    clipboardMutations.cutSelection(trigger)
  )
  const clearCellRangeSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    clipboardMutations.clearCurrentSelection(trigger)
  )

  const hasCellRangeContext = (): boolean => Boolean(resolveCopyRange() || resolveCurrentCellCoord())

  runCopyAction = () => (
    hasCellRangeContext() ? copyCellRangeSelection("context-menu") : copySelectedRows()
  )
  runCutAction = async () => {
    if (!hasCellRangeContext()) {
      return cutSelectedRows()
    }
    const ok = await cutCellRangeSelection("context-menu")
    return ok ? Math.max(1, resolveActiveRangeCellCount()) : 0
  }
  runPasteAction = async () => {
    if (!hasCellRangeContext()) {
      return pasteRowsAppend()
    }
    const ok = await pasteCellRangeSelection("context-menu")
    return ok ? Math.max(1, resolveActiveRangeCellCount()) : 0
  }
  runClearAction = async () => {
    if (!hasCellRangeContext()) {
      return clearSelectedRows()
    }
    const ok = await clearCellRangeSelection("context-menu")
    return ok ? Math.max(1, resolveActiveRangeCellCount()) : 0
  }

  let refreshHistorySnapshotBridge: () => DataGridTransactionSnapshot | null = () => null

  const isPrimaryModifierPressed = (event: KeyboardEvent): boolean => (
    event.metaKey || event.ctrlKey
  )

  const runHistoryActionFromKeyboard = (direction: "undo" | "redo"): void => {
    if (!runtime.api.hasTransactionSupport()) {
      return
    }
    void (async () => {
      if (direction === "undo") {
        if (!runtime.api.canUndoTransaction()) {
          return
        }
        await runtime.api.undoTransaction()
        pushFeedback({
          source: "history",
          action: "undo",
          message: "Undo",
          ok: true,
        })
      } else {
        if (!runtime.api.canRedoTransaction()) {
          return
        }
        await runtime.api.redoTransaction()
        pushFeedback({
          source: "history",
          action: "redo",
          message: "Redo",
          ok: true,
        })
      }
      refreshHistorySnapshotBridge()
    })()
  }

  const dispatchGridCellKeyboardCommands = (event: KeyboardEvent): boolean => {
    if (!normalizedFeatures.keyboardNavigation.enabled) {
      return false
    }
    const key = event.key.toLowerCase()
    const primary = isPrimaryModifierPressed(event)

    if (primary && !event.altKey && key === "z") {
      event.preventDefault()
      runHistoryActionFromKeyboard(event.shiftKey ? "redo" : "undo")
      return true
    }
    if (primary && !event.altKey && !event.shiftKey && key === "y") {
      event.preventDefault()
      runHistoryActionFromKeyboard("redo")
      return true
    }
    if (primary && !event.altKey && key === "c") {
      event.preventDefault()
      void copyCellRangeSelection("keyboard")
      return true
    }
    if (primary && !event.altKey && key === "v") {
      event.preventDefault()
      void pasteCellRangeSelection("keyboard")
      return true
    }
    if (primary && !event.altKey && key === "x") {
      event.preventDefault()
      void cutCellRangeSelection("keyboard")
      return true
    }
    if (!primary && !event.altKey && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault()
      void clearCellRangeSelection("keyboard")
      return true
    }
    return false
  }

  dispatchCellKeyboardCommands = dispatchGridCellKeyboardCommands

  const paginationSnapshot = ref<DataGridPaginationSnapshot>(
    clonePaginationSnapshot(runtime.api.getPaginationSnapshot()),
  )
  const columnStateSnapshot = ref<DataGridColumnModelSnapshot>(
    cloneColumnModelSnapshot(runtime.api.getColumnModelSnapshot()),
  )
  const historySupported = ref(runtime.api.hasTransactionSupport())
  const historySnapshot = ref<DataGridTransactionSnapshot | null>(
    cloneTransactionSnapshot(runtime.api.getTransactionSnapshot()),
  )

  const refreshPaginationSnapshot = (): DataGridPaginationSnapshot => {
    const nextSnapshot = clonePaginationSnapshot(runtime.api.getPaginationSnapshot())
    paginationSnapshot.value = nextSnapshot
    return nextSnapshot
  }

  const refreshColumnStateSnapshot = (): DataGridColumnModelSnapshot => {
    const nextSnapshot = cloneColumnModelSnapshot(runtime.api.getColumnModelSnapshot())
    columnStateSnapshot.value = nextSnapshot
    return nextSnapshot
  }

  const refreshHistorySnapshot = (): DataGridTransactionSnapshot | null => {
    historySupported.value = runtime.api.hasTransactionSupport()
    if (!historySupported.value) {
      historySnapshot.value = null
      return null
    }
    const nextSnapshot = cloneTransactionSnapshot(runtime.api.getTransactionSnapshot())
    historySnapshot.value = nextSnapshot
    return nextSnapshot
  }
  refreshHistorySnapshotBridge = refreshHistorySnapshot

  const headerFiltersEnabled = ref(normalizedFeatures.headerFilters.enabled)
  const headerFilterState = ref<{
    open: boolean
    columnKey: string | null
    query: string
    operator: string
    type: "text" | "number" | "date" | "set"
  }>({
    open: false,
    columnKey: null,
    query: "",
    operator: "contains",
    type: "text",
  })

  const resolveColumnByKey = (columnKey: string): DataGridColumnDef | null => (
    columns.value.find(column => column.key === columnKey) ?? null
  )

  const resolveHeaderFilterType = (columnKey: string): "text" | "number" | "date" | "set" => {
    const column = resolveColumnByKey(columnKey)
    const meta = (column?.meta ?? {}) as Record<string, unknown>
    const explicitType = meta.filterType ?? meta.filterKind
    if (explicitType === "set" || explicitType === "enum") {
      return "set"
    }
    if (explicitType === "number") {
      return "number"
    }
    if (explicitType === "date") {
      return "date"
    }
    if (Array.isArray(meta.options)) {
      return "set"
    }
    for (const row of rows.value) {
      if (!isRecordRow(row)) {
        continue
      }
      const value = row[columnKey]
      if (typeof value === "number") {
        return "number"
      }
      if (value instanceof Date) {
        return "date"
      }
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return "date"
      }
    }
    return "text"
  }

  const resolveHeaderFilterOperators = (
    columnKey: string,
  ): readonly AffinoDataGridHeaderFilterOperatorEntry[] => {
    const type = resolveHeaderFilterType(columnKey)
    return DEFAULT_HEADER_FILTER_OPERATORS[type]
  }

  const setHeaderFilterQuery = (query: string): void => {
    headerFilterState.value = {
      ...headerFilterState.value,
      query,
    }
  }

  const setHeaderFilterOperator = (operator: string): void => {
    headerFilterState.value = {
      ...headerFilterState.value,
      operator,
    }
  }

  const openHeaderFilter = (columnKey: string): boolean => {
    if (!headerFiltersEnabled.value || !columnKey) {
      return false
    }
    const type = resolveHeaderFilterType(columnKey)
    const operators = resolveHeaderFilterOperators(columnKey)
    headerFilterState.value = {
      open: true,
      columnKey,
      query: "",
      operator: operators[0]?.value ?? "contains",
      type,
    }
    pushFeedback({
      source: "header-filter",
      action: "open",
      message: `Filter menu: ${columnKey}`,
      ok: true,
    })
    return true
  }

  const closeHeaderFilter = (): void => {
    if (!headerFilterState.value.open) {
      return
    }
    headerFilterState.value = {
      ...headerFilterState.value,
      open: false,
    }
  }

  const toggleHeaderFilter = (columnKey: string): boolean => {
    if (
      headerFilterState.value.open &&
      headerFilterState.value.columnKey === columnKey
    ) {
      closeHeaderFilter()
      return false
    }
    return openHeaderFilter(columnKey)
  }

  const getHeaderFilterUniqueValues = (
    columnKey: string,
  ): readonly AffinoDataGridHeaderFilterValueEntry[] => {
    const counts = new Map<string, { value: unknown; count: number }>()
    for (const row of rows.value) {
      if (!isRecordRow(row)) {
        continue
      }
      const value = row[columnKey]
      const key = stableSerialize(value)
      const existing = counts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, { value, count: 1 })
      }
    }
    const selectedSet = new Set(findSetConditionValuesByKey(
      featureSuite.filterModel.value?.advancedExpression,
      columnKey,
    ).map(value => stableSerialize(value)))
    const query = headerFilterState.value.query.trim().toLowerCase()
    return Array.from(counts.entries())
      .map(([key, entry]) => ({
        key,
        value: entry.value,
        label: String(entry.value ?? ""),
        count: entry.count,
        selected: selectedSet.has(key),
      }))
      .filter(entry => {
        if (!query) {
          return true
        }
        return entry.label.toLowerCase().includes(query)
      })
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, normalizedFeatures.headerFilters.maxUniqueValues)
  }

  const setHeaderFilterValueSelected = (
    columnKey: string,
    value: unknown,
    selected: boolean,
    options: { mode?: AffinoDataGridSetFilterValueMode } = {},
  ): DataGridAdvancedFilterExpression | null => {
    const mode = selected ? (options.mode ?? "append") : "remove"
    const next = filteringHelpers.setSet(columnKey, [value], {
      valueMode: mode,
      mergeMode: "merge-and",
    })
    pushFeedback({
      source: "header-filter",
      action: "set-value",
      message: `${selected ? "Selected" : "Unselected"} ${String(value ?? "")}`,
      ok: true,
    })
    return next
  }

  const clearHeaderFilterValues = (columnKey: string): DataGridAdvancedFilterExpression | null => {
    const next = filteringHelpers.clearByKey(columnKey)
    pushFeedback({
      source: "header-filter",
      action: "clear",
      message: `Filter cleared: ${columnKey}`,
      ok: true,
    })
    return next
  }

  const selectAllHeaderFilterValues = (columnKey: string): DataGridAdvancedFilterExpression | null => (
    clearHeaderFilterValues(columnKey)
  )

  const selectOnlyHeaderFilterValue = (
    columnKey: string,
    value: unknown,
  ): DataGridAdvancedFilterExpression | null => {
    const next = filteringHelpers.setSet(columnKey, [value], {
      valueMode: "replace",
      mergeMode: "merge-and",
    })
    pushFeedback({
      source: "header-filter",
      action: "select-only",
      message: `Filter only: ${String(value ?? "")}`,
      ok: true,
    })
    return next
  }

  const applyHeaderTextFilter = (
    columnKey: string,
    options: { operator?: string; value?: unknown; mergeMode?: AffinoDataGridFilterMergeMode },
  ): DataGridAdvancedFilterExpression | null => {
    const next = filteringHelpers.setText(columnKey, options)
    pushFeedback({
      source: "header-filter",
      action: "apply-text",
      message: `Text filter applied: ${columnKey}`,
      ok: true,
    })
    return next
  }

  const applyHeaderNumberFilter = (
    columnKey: string,
    options: {
      operator?: string
      value?: unknown
      value2?: unknown
      mergeMode?: AffinoDataGridFilterMergeMode
    },
  ): DataGridAdvancedFilterExpression | null => {
    const next = filteringHelpers.setNumber(columnKey, options)
    pushFeedback({
      source: "header-filter",
      action: "apply-number",
      message: `Number filter applied: ${columnKey}`,
      ok: true,
    })
    return next
  }

  const applyHeaderDateFilter = (
    columnKey: string,
    options: {
      operator?: string
      value?: unknown
      value2?: unknown
      mergeMode?: AffinoDataGridFilterMergeMode
    },
  ): DataGridAdvancedFilterExpression | null => {
    const next = filteringHelpers.setDate(columnKey, options)
    pushFeedback({
      source: "header-filter",
      action: "apply-date",
      message: `Date filter applied: ${columnKey}`,
      ok: true,
    })
    return next
  }

  const layoutProfiles = ref<readonly AffinoDataGridLayoutProfile[]>([])
  const captureLayoutProfile = (
    name: string,
    options: { id?: string } = {},
  ): AffinoDataGridLayoutProfile => {
    const snapshot = runtime.api.getRowModelSnapshot()
    const profile: AffinoDataGridLayoutProfile = {
      id: options.id?.trim() || `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || "Layout",
      createdAt: Date.now(),
      sortState: [...sortState.value],
      filterModel: stableClone(featureSuite.filterModel.value),
      groupBy: stableClone(snapshot.groupBy),
      groupExpansion: stableClone(snapshot.groupExpansion),
      columnState: cloneColumnModelSnapshot(runtime.api.getColumnModelSnapshot()),
    }
    layoutProfiles.value = [...layoutProfiles.value, profile]
    pushFeedback({
      source: "layout",
      action: "capture",
      message: `Layout saved: ${profile.name}`,
      ok: true,
    })
    return profile
  }

  const applyLayoutProfile = (idOrProfile: string | AffinoDataGridLayoutProfile): boolean => {
    const profile = typeof idOrProfile === "string"
      ? layoutProfiles.value.find(entry => entry.id === idOrProfile)
      : idOrProfile
    if (!profile) {
      return false
    }
    setSortState([...profile.sortState])
    featureSuite.setFilterModel(stableClone(profile.filterModel))
    featureSuite.setGroupBy(stableClone(profile.groupBy))
    applyColumnStateSnapshot(stableClone(profile.columnState))
    const currentExpansion = runtime.api.getRowModelSnapshot().groupExpansion.toggledGroupKeys
    const targetExpansion = profile.groupExpansion.toggledGroupKeys
    const expansionSet = new Set(targetExpansion)
    for (const groupKey of currentExpansion) {
      if (!expansionSet.has(groupKey)) {
        runtime.api.toggleGroup(groupKey)
      }
    }
    for (const groupKey of targetExpansion) {
      if (!currentExpansion.includes(groupKey)) {
        runtime.api.toggleGroup(groupKey)
      }
    }
    pushFeedback({
      source: "layout",
      action: "apply",
      message: `Layout applied: ${profile.name}`,
      ok: true,
    })
    return true
  }

  const removeLayoutProfile = (id: string): boolean => {
    const current = layoutProfiles.value
    const next = current.filter(entry => entry.id !== id)
    if (next.length === current.length) {
      return false
    }
    layoutProfiles.value = next
    return true
  }

  const clearLayoutProfiles = (): void => {
    layoutProfiles.value = []
  }

  const statusBarEnabled = ref(normalizedFeatures.statusBar.enabled)
  const buildStatusBarMetrics = (): AffinoDataGridStatusBarMetrics<TRow> => {
    const range = cellSelectionRange.value
    const selectedCells = range
      ? (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1)
      : 0
    const selectedSummarySnapshot = featureSuite.summaryEnabled.value
      ? (featureSuite.selectedSummary.value ?? featureSuite.recomputeSelectedSummary())
      : null
    const metrics: AffinoDataGridStatusBarMetrics<TRow> = {
      rowsTotal: rows.value.length,
      rowsFiltered: runtime.api.getRowCount(),
      columnsVisible: runtime.columnSnapshot.value.visibleColumns.length,
      selectedCells,
      selectedRows: featureSuite.selectedCount.value,
      activeCell: activeCellSelection.value
        ? {
            rowKey: activeCellSelection.value.rowKey,
            columnKey: activeCellSelection.value.columnKey,
          }
        : null,
      anchorCell: anchorCellSelection.value
        ? {
            rowKey: anchorCellSelection.value.rowKey,
            columnKey: anchorCellSelection.value.columnKey,
          }
        : null,
      summary: selectedSummarySnapshot,
      format: (_columnKey, fallback = "") => fallback,
      getAggregate: (columnKey, aggregation) => {
        const column = selectedSummarySnapshot?.columns?.[columnKey]
        if (!column) {
          return null
        }
        return column.metrics[aggregation] ?? null
      },
      resolveRowByKey: (rowKey: string): TRow | null => {
        for (let index = 0; index < rows.value.length; index += 1) {
          const row = rows.value[index]
          if (!row) {
            continue
          }
          if (resolveRowKey(row, index) === rowKey) {
            return row
          }
        }
        return null
      },
    }
    return metrics
  }

  const statusBarMetrics = ref<AffinoDataGridStatusBarMetrics<TRow>>(buildStatusBarMetrics())

  const refreshStatusBarMetrics = (): AffinoDataGridStatusBarMetrics<TRow> => {
    const nextMetrics = buildStatusBarMetrics()
    statusBarMetrics.value = nextMetrics
    return nextMetrics
  }

  const unsubscribeRowModel = runtime.rowModel.subscribe(nextSnapshot => {
    paginationSnapshot.value = clonePaginationSnapshot(nextSnapshot.pagination)
    refreshStatusBarMetrics()
    if (historySupported.value) {
      refreshHistorySnapshot()
    }
  })

  const unsubscribeColumnModel = runtime.columnModel.subscribe(nextSnapshot => {
    columnStateSnapshot.value = cloneColumnModelSnapshot(nextSnapshot)
    refreshStatusBarMetrics()
    if (historySupported.value) {
      refreshHistorySnapshot()
    }
  })

  watch(
    [
      () => rows.value,
      () => featureSuite.selectedCount.value,
      cellSelectionRange,
      () => featureSuite.selectedSummary.value,
      () => runtime.columnSnapshot.value.visibleColumns.length,
    ],
    () => {
      refreshStatusBarMetrics()
    },
    { flush: "sync" },
  )

  onBeforeUnmount(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("mouseup", handleGlobalPointerUp)
      window.removeEventListener("pointerup", handleGlobalPointerUp)
      window.removeEventListener("pointercancel", handleGlobalPointerCancel)
      window.removeEventListener("mousemove", onColumnResizeMove)
      window.removeEventListener("mouseup", onColumnResizeEnd)
      window.removeEventListener("mousemove", onRowResizeMove)
      window.removeEventListener("mouseup", onRowResizeEnd)
    }
    clipboardBridge.dispose()
    stopAllPointerInteractions(false)
    stopColumnResize()
    stopRowResize()
    unsubscribeRowModel()
    unsubscribeColumnModel()
  })

  const baseResult = assembleAffinoDataGridResult({
    runtime,
    rows,
    columns,
    componentProps,
    sort: {
      sortState,
      setSortState,
      toggleColumnSort,
      clearSort,
    },
    runAction: runActionWithFeedback,
    filteringHelpers,
    featureSuite,
    bindingSuite,
  })

  const findCellElement = (rowKey: string, columnKey: string): HTMLElement | null => {
    if (typeof document === "undefined") {
      return null
    }
    const cells = document.querySelectorAll<HTMLElement>("[data-row-key][data-column-key]")
    for (const cell of cells) {
      if (cell.dataset.rowKey === rowKey && cell.dataset.columnKey === columnKey) {
        return cell
      }
    }
    return null
  }

  const findHeaderElement = (columnKey: string): HTMLElement | null => {
    if (typeof document === "undefined") {
      return null
    }
    const headers = document.querySelectorAll<HTMLElement>("[role='columnheader'][data-column-key]")
    for (const header of headers) {
      if (header.dataset.columnKey === columnKey) {
        return header
      }
    }
    return null
  }

  const openContextMenuForActiveCell = (
    options: { zone?: "cell" | "range"; clientX?: number; clientY?: number } = {},
  ): boolean => {
    const active = activeCellSelection.value
    if (!active) {
      return false
    }
    const zone = options.zone ?? "cell"
    const cell = findCellElement(active.rowKey, active.columnKey)
    const rect = cell?.getBoundingClientRect()
    const x = options.clientX ?? (rect ? rect.left + rect.width / 2 : 0)
    const y = options.clientY ?? (rect ? rect.top + rect.height / 2 : 0)
    baseResult.contextMenu.open(x, y, {
      zone,
      columnKey: active.columnKey,
      rowId: active.rowKey,
    })
    return true
  }

  const openContextMenuForHeader = (
    columnKey: string,
    options: { clientX?: number; clientY?: number } = {},
  ): boolean => {
    const header = findHeaderElement(columnKey)
    const rect = header?.getBoundingClientRect()
    const x = options.clientX ?? (rect ? rect.left + rect.width / 2 : 0)
    const y = options.clientY ?? (rect ? rect.top + rect.height / 2 : 0)
    baseResult.contextMenu.open(x, y, {
      zone: "header",
      columnKey,
      rowId: null,
    })
    return true
  }

  const resolveContextMenuActionDisabledReason = (
    actionId: DataGridContextMenuActionId,
  ): string | null => {
    const state = baseResult.contextMenu.state.value
    if ((actionId === "copy" || actionId === "cut" || actionId === "clear") && !hasCellRangeContext()) {
      return "No active cell range"
    }
    if (actionId === "paste" && !clipboardEnabled.value) {
      return "Clipboard feature disabled"
    }
    if ((actionId === "sort-asc" || actionId === "sort-desc" || actionId === "sort-clear" || actionId === "auto-size") && !state.columnKey) {
      return "No target column"
    }
    if (actionId === "filter" && !filteringEnabled.value) {
      return "Filtering feature disabled"
    }
    return null
  }

  const isContextMenuActionDisabled = (actionId: DataGridContextMenuActionId): boolean => (
    resolveContextMenuActionDisabledReason(actionId) != null
  )

  const groupedContextMenuActions = computed(() => {
    const actionsById = new Map(
      baseResult.contextMenu.actions.value.map(action => [action.id, action] as const),
    )
    const groups: Array<{
      id: "clipboard" | "sorting" | "filters" | "column"
      label: string
      actions: readonly DataGridContextMenuAction[]
    }> = [
      {
        id: "clipboard",
        label: "Clipboard",
        actions: ["copy", "cut", "paste", "clear"]
          .map(id => actionsById.get(id as DataGridContextMenuActionId))
          .filter((entry): entry is DataGridContextMenuAction => Boolean(entry)),
      },
      {
        id: "sorting",
        label: "Sorting",
        actions: ["sort-asc", "sort-desc", "sort-clear"]
          .map(id => actionsById.get(id as DataGridContextMenuActionId))
          .filter((entry): entry is DataGridContextMenuAction => Boolean(entry)),
      },
      {
        id: "filters",
        label: "Filters",
        actions: ["filter"]
          .map(id => actionsById.get(id as DataGridContextMenuActionId))
          .filter((entry): entry is DataGridContextMenuAction => Boolean(entry)),
      },
      {
        id: "column",
        label: "Column",
        actions: ["auto-size"]
          .map(id => actionsById.get(id as DataGridContextMenuActionId))
          .filter((entry): entry is DataGridContextMenuAction => Boolean(entry)),
      },
    ]
    return groups.filter(group => group.actions.length > 0)
  })

  const runContextMenuActionWithParity = async (
    actionId: DataGridContextMenuActionId,
  ): Promise<AffinoDataGridActionResult> => {
    const disabledReason = resolveContextMenuActionDisabledReason(actionId)
    if (disabledReason) {
      const result = {
        ok: false,
        affected: 0,
        message: disabledReason,
      } satisfies AffinoDataGridActionResult
      pushFeedback({
        source: "context-menu",
        action: actionId,
        message: disabledReason,
        ok: false,
      })
      return result
    }
    const result = await baseResult.contextMenu.runAction(actionId)
    pushFeedback({
      source: "context-menu",
      action: actionId,
      message: result.message,
      affected: result.affected,
      ok: result.ok,
    })
    return result
  }

  const setPagination = (pagination: { pageSize: number; currentPage: number } | null): void => {
    runtime.api.setPagination(pagination)
    refreshPaginationSnapshot()
  }

  const setPageSize = (pageSize: number | null): void => {
    runtime.api.setPageSize(pageSize)
    refreshPaginationSnapshot()
  }

  const setCurrentPage = (page: number): void => {
    runtime.api.setCurrentPage(page)
    refreshPaginationSnapshot()
  }

  const goToNextPage = (): void => {
    const snapshot = paginationSnapshot.value
    if (!snapshot.enabled) {
      return
    }
    setCurrentPage(snapshot.currentPage + 1)
  }

  const goToPreviousPage = (): void => {
    const snapshot = paginationSnapshot.value
    if (!snapshot.enabled) {
      return
    }
    setCurrentPage(Math.max(0, snapshot.currentPage - 1))
  }

  const goToFirstPage = (): void => {
    setCurrentPage(0)
  }

  const goToLastPage = (): void => {
    const snapshot = paginationSnapshot.value
    setCurrentPage(Math.max(0, snapshot.pageCount - 1))
  }

  const setColumnOrder = (keys: readonly string[]): void => {
    runtime.api.setColumnOrder(keys)
    refreshColumnStateSnapshot()
  }

  const setColumnVisibility = (columnKey: string, visible: boolean): void => {
    runtime.api.setColumnVisibility(columnKey, visible)
    refreshColumnStateSnapshot()
  }

  const setColumnWidth = (columnKey: string, width: number | null): void => {
    runtime.api.setColumnWidth(columnKey, width)
    refreshColumnStateSnapshot()
  }

  const setColumnPin = (columnKey: string, pin: "left" | "right" | "none"): void => {
    runtime.api.setColumnPin(columnKey, pin)
    refreshColumnStateSnapshot()
  }

  const columnResizeState = ref<{
    columnKey: string
    startX: number
    startWidth: number
  } | null>(null)

  const stopColumnResize = (): void => {
    columnResizeState.value = null
    if (typeof window !== "undefined") {
      window.removeEventListener("mousemove", onColumnResizeMove)
      window.removeEventListener("mouseup", onColumnResizeEnd)
    }
    refreshColumnStateSnapshot()
  }

  const onColumnResizeMove = (event: MouseEvent): void => {
    const state = columnResizeState.value
    if (!state) {
      return
    }
    const delta = event.clientX - state.startX
    const nextWidth = Math.max(56, Math.round(state.startWidth + delta))
    runtime.api.setColumnWidth(state.columnKey, nextWidth)
  }

  const onColumnResizeEnd = (): void => {
    if (!columnResizeState.value) {
      return
    }
    stopColumnResize()
  }

  const startColumnResize = (columnKey: string, event: MouseEvent): void => {
    event.preventDefault()
    const column = runtime.api.getColumn(columnKey)
    if (!column) {
      return
    }
    const startWidth = Number.isFinite(column.width)
      ? Number(column.width)
      : Number(column.column.width ?? 160)
    columnResizeState.value = {
      columnKey,
      startX: event.clientX,
      startWidth: Math.max(56, startWidth || 160),
    }
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", onColumnResizeMove)
      window.addEventListener("mouseup", onColumnResizeEnd)
    }
  }

  const autosizeColumn = async (columnKey: string): Promise<void> => {
    await runActionWithFeedback("auto-size", { columnKey })
    refreshColumnStateSnapshot()
  }

  const createColumnResizeHandleBindings = (columnKey: string) => ({
    role: "separator" as const,
    tabindex: 0,
    "aria-orientation": "vertical" as const,
    "data-column-key": columnKey,
    onMousedown: (event: MouseEvent) => {
      startColumnResize(columnKey, event)
    },
    onDblclick: (_event?: MouseEvent) => {
      void autosizeColumn(columnKey)
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        void autosizeColumn(columnKey)
        return
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault()
        const direction = event.key === "ArrowRight" ? 1 : -1
        const current = runtime.api.getColumn(columnKey)
        const currentWidth = Number(current?.width ?? current?.column.width ?? 160)
        runtime.api.setColumnWidth(columnKey, Math.max(56, currentWidth + direction * 12))
      }
    },
  })

  const rowResizeState = ref<{
    rowKey: string
    startY: number
    startBase: number
  } | null>(null)

  const stopRowResize = (): void => {
    rowResizeState.value = null
    if (typeof window !== "undefined") {
      window.removeEventListener("mousemove", onRowResizeMove)
      window.removeEventListener("mouseup", onRowResizeEnd)
    }
  }

  const onRowResizeMove = (event: MouseEvent): void => {
    const state = rowResizeState.value
    if (!state || !featureSuite.rowHeightEnabled.value) {
      return
    }
    featureSuite.setRowHeightMode("fixed")
    const delta = event.clientY - state.startY
    featureSuite.setBaseRowHeight(Math.max(22, Math.round(state.startBase + delta)))
  }

  const onRowResizeEnd = (): void => {
    if (!rowResizeState.value) {
      return
    }
    stopRowResize()
  }

  const startRowResize = (rowKey: string, event: MouseEvent): void => {
    if (!featureSuite.rowHeightEnabled.value) {
      return
    }
    event.preventDefault()
    rowResizeState.value = {
      rowKey,
      startY: event.clientY,
      startBase: featureSuite.baseRowHeight.value,
    }
    featureSuite.setRowHeightMode("fixed")
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", onRowResizeMove)
      window.addEventListener("mouseup", onRowResizeEnd)
    }
  }

  const autosizeRows = (): void => {
    if (!featureSuite.rowHeightEnabled.value || !featureSuite.rowHeightSupported.value) {
      return
    }
    featureSuite.setRowHeightMode("auto")
    featureSuite.measureVisibleRowHeights()
    featureSuite.applyRowHeightSettings()
    pushFeedback({
      source: "action",
      action: "autosize-rows",
      message: "Auto-sized visible rows",
      ok: true,
    })
  }

  const createRowResizeHandleBindings = (rowKey: string) => ({
    role: "separator" as const,
    tabindex: 0,
    "aria-orientation": "horizontal" as const,
    "data-row-key": rowKey,
    onMousedown: (event: MouseEvent) => {
      startRowResize(rowKey, event)
    },
    onDblclick: (_event?: MouseEvent) => {
      autosizeRows()
    },
    onKeydown: (event: KeyboardEvent) => {
      if (!featureSuite.rowHeightEnabled.value) {
        return
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        autosizeRows()
        return
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        featureSuite.setRowHeightMode("fixed")
        const delta = event.key === "ArrowDown" ? 2 : -2
        featureSuite.setBaseRowHeight(Math.max(22, featureSuite.baseRowHeight.value + delta))
      }
    },
  })

  const applyColumnStateSnapshot = (snapshot: DataGridColumnModelSnapshot): void => {
    runtime.api.setColumnOrder(snapshot.order)
    for (const column of snapshot.columns) {
      runtime.api.setColumnVisibility(column.key, column.visible)
      runtime.api.setColumnWidth(column.key, column.width)
      runtime.api.setColumnPin(column.key, column.pin)
    }
    refreshColumnStateSnapshot()
  }

  const canUndo = computed(() => (
    historySupported.value ? runtime.api.canUndoTransaction() : false
  ))
  const canRedo = computed(() => (
    historySupported.value ? runtime.api.canRedoTransaction() : false
  ))

  const undo = async (): Promise<string | null> => {
    if (!historySupported.value || !runtime.api.canUndoTransaction()) {
      return null
    }
    const committedId = await runtime.api.undoTransaction()
    refreshHistorySnapshot()
    pushFeedback({
      source: "history",
      action: "undo",
      message: "Undo",
      ok: true,
    })
    return committedId
  }

  const redo = async (): Promise<string | null> => {
    if (!historySupported.value || !runtime.api.canRedoTransaction()) {
      return null
    }
    const committedId = await runtime.api.redoTransaction()
    refreshHistorySnapshot()
    pushFeedback({
      source: "history",
      action: "redo",
      message: "Redo",
      ok: true,
    })
    return committedId
  }

  return {
    ...baseResult,
    DataGrid,
    actions: {
      ...baseResult.actions,
      runAction: runActionWithFeedback,
    },
    feedback: {
      enabled: feedbackEnabled,
      lastAction: feedbackLastAction,
      events: feedbackEvents,
      clear: () => {
        feedbackEvents.value = []
      },
    },
    layoutProfiles: {
      profiles: layoutProfiles,
      capture: captureLayoutProfile,
      apply: applyLayoutProfile,
      remove: removeLayoutProfile,
      clear: clearLayoutProfiles,
    },
    statusBar: {
      enabled: statusBarEnabled,
      metrics: statusBarMetrics,
      refresh: refreshStatusBarMetrics,
    },
    contextMenu: {
      ...baseResult.contextMenu,
      groupedActions: groupedContextMenuActions,
      openForActiveCell: openContextMenuForActiveCell,
      openForHeader: openContextMenuForHeader,
      isActionDisabled: isContextMenuActionDisabled,
      getActionDisabledReason: resolveContextMenuActionDisabledReason,
      runAction: runContextMenuActionWithParity,
    },
    cellSelection: {
      activeCell: activeCellSelection,
      anchorCell: anchorCellSelection,
      focusCell: focusCellSelection,
      range: cellSelectionRange,
      ranges: cellSelectionRanges,
      isCellSelected,
      setCellByKey,
      clear: clearCellSelection,
    },
    cellRange: {
      copiedRange: copiedSelectionRange,
      fillPreviewRange,
      rangeMovePreviewRange,
      lastAction: cellRangeLastAction,
      copy: copyCellRangeSelection,
      paste: pasteCellRangeSelection,
      cut: cutCellRangeSelection,
      clear: clearCellRangeSelection,
      setFillPreviewRange,
      setRangeMovePreviewRange,
      applyFillPreview: rangeMutationEngine.applyFillPreview,
      applyRangeMove: rangeMutationEngine.applyRangeMove,
    },
    features: {
      ...baseResult.features,
      editing: {
        ...baseResult.features.editing,
        enumEditor: {
          enabled: enumEditorEnabled,
          primitive: enumEditorPrimitive,
          resolveOptions: resolveEnumEditorOptions,
        },
      },
      interactions: {
        enabled: interactionsEnabled,
        range: {
          enabled: rangeInteractionsEnabled,
          fillEnabled: rangeFillEnabled,
          moveEnabled: rangeMoveEnabled,
          pointerMode: rangePointerMode,
          stop: () => {
            stopRangePointerInteraction(false)
          },
        },
      },
      headerFilters: {
        enabled: headerFiltersEnabled,
        state: headerFilterState,
        open: openHeaderFilter,
        close: closeHeaderFilter,
        toggle: toggleHeaderFilter,
        setQuery: setHeaderFilterQuery,
        setOperator: setHeaderFilterOperator,
        getOperators: resolveHeaderFilterOperators,
        getUniqueValues: getHeaderFilterUniqueValues,
        setValueSelected: setHeaderFilterValueSelected,
        selectOnlyValue: selectOnlyHeaderFilterValue,
        selectAllValues: selectAllHeaderFilterValues,
        clearValues: clearHeaderFilterValues,
        applyText: applyHeaderTextFilter,
        applyNumber: applyHeaderNumberFilter,
        applyDate: applyHeaderDateFilter,
        clear: clearHeaderFilterValues,
      },
    },
    bindings: {
      ...baseResult.bindings,
      cellSelection: createCellSelectionBindings,
      rangeHandle: createRangeHandleBindings,
      rangeSurface: createRangeSurfaceBindings,
      columnResizeHandle: createColumnResizeHandleBindings,
      rowResizeHandle: createRowResizeHandleBindings,
      contextMenuAction: (
        actionId,
        options = {},
      ) => ({
        onClick: () => {
          void runContextMenuActionWithParity(actionId).then(result => {
            options.onResult?.(result)
          })
        },
      }),
    },
    pagination: {
      snapshot: paginationSnapshot,
      set: setPagination,
      setPageSize,
      setCurrentPage,
      goToNextPage,
      goToPreviousPage,
      goToFirstPage,
      goToLastPage,
      refresh: refreshPaginationSnapshot,
    },
    columnState: {
      snapshot: columnStateSnapshot,
      setOrder: setColumnOrder,
      setVisibility: setColumnVisibility,
      setWidth: setColumnWidth,
      setPin: setColumnPin,
      capture: refreshColumnStateSnapshot,
      apply: applyColumnStateSnapshot,
      refresh: refreshColumnStateSnapshot,
    },
    history: {
      supported: historySupported,
      snapshot: historySnapshot,
      canUndo,
      canRedo,
      refresh: refreshHistorySnapshot,
      undo,
      redo,
    },
    rowReorder: {
      supported: rowReorderSupported,
      canReorder: canReorderRows,
      reason: rowReorderReason,
      moveByIndex: moveRowsByIndex,
      moveByKey: moveRowsByKey,
    },
  }
}
