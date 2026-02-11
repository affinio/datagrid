import { computed, onBeforeUnmount, ref, watch } from "vue"
import type {
  DataGridAdvancedFilterCondition,
  DataGridAdvancedFilterExpression,
  DataGridColumnModelSnapshot,
  DataGridPaginationSnapshot,
} from "@affino/datagrid-core"
import type { DataGridTransactionSnapshot } from "@affino/datagrid-core/advanced"
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
  useAffinoDataGridEventHub,
  useAffinoDataGridFeatureSuite,
  useAffinoDataGridHeaderFilters,
  useAffinoDataGridLayoutProfiles,
  useAffinoDataGridKeyboardDispatcher,
  useAffinoDataGridRangeClipboard,
  useAffinoDataGridSelectionEngine,
  useAffinoDataGridRuntimeBootstrap,
  useAffinoDataGridSortActionSuite,
  useAffinoDataGridStatusBar,
  useAffinoDataGridPointerLifecycle,
} from "./internal/useAffinoDataGrid"
import type {
  AffinoDataGridActionId,
  AffinoDataGridActionResult,
  AffinoDataGridRunActionOptions,
  AffinoDataGridFeedbackEvent,
  AffinoDataGridEmitEventInput,
  AffinoDataGridFilteringHelpers,
  AffinoDataGridFilterMergeMode,
  AffinoDataGridSetFilterValueMode,
  UseAffinoDataGridOptions,
  UseAffinoDataGridResult,
  UseAffinoDataGridMinimalOptions,
  UseAffinoDataGridMinimalResult,
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
  UseAffinoDataGridMinimalOptions,
  UseAffinoDataGridMinimalResult,
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
    selectedRowKeys,
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
  const eventHub = useAffinoDataGridEventHub({
    maxEvents: normalizedFeatures.feedback.maxEvents * 4,
  })
  const eventHubEnabled = computed(() => eventHub.enabled.value ?? true)
  const eventHubLast = computed(() => eventHub.last.value ?? null)
  const eventHubLog = computed(() => eventHub.log.value ?? [])
  const emitGridEvent = (input: AffinoDataGridEmitEventInput) => eventHub.emit(input)
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
    emitGridEvent({
      tier: "internal",
      name: "sugar:feedback",
      args: [nextEvent],
      source: "system",
      phase: "change",
    })
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
    emitGridEvent({
      tier: "advanced",
      name: "sugar:action",
      args: [{ actionId, options: actionOptions ?? null }],
      source: "api",
      phase: "start",
    })
    const result = await runAction(actionId, actionOptions)
    pushFeedback({
      source: "action",
      action: actionId,
      message: result.message,
      affected: result.affected,
      ok: result.ok,
      meta: actionOptions ? { columnKey: actionOptions.columnKey ?? null } : undefined,
    })
    emitGridEvent({
      tier: "advanced",
      name: "sugar:action",
      args: [{ actionId, result }],
      source: "api",
      phase: "end",
    })
    return result
  }

  watch(
    sortState,
    nextSortState => {
      emitGridEvent({
        tier: "stable",
        name: "sortChange",
        args: [nextSortState[0] ?? null, nextSortState],
        source: "ui",
        phase: "change",
      })
    },
    { immediate: true, flush: "sync" },
  )

  watch(
    () => featureSuite.filterModel.value,
    nextFilterModel => {
      const nextColumnFilters = nextFilterModel?.columnFilters ?? {}
      const hasColumnFilters = Object.values(nextColumnFilters).some(values => Array.isArray(values) && values.length > 0)
      const hasAdvancedFilters = Boolean(nextFilterModel?.advancedExpression)
        || Boolean(nextFilterModel?.advancedFilters && Object.keys(nextFilterModel.advancedFilters).length > 0)
      if (!hasColumnFilters && !hasAdvancedFilters) {
        emitGridEvent({
          tier: "stable",
          name: "filtersReset",
          args: [],
          source: "ui",
          phase: "change",
        })
        return
      }
      emitGridEvent({
        tier: "stable",
        name: "filterChange",
        args: [nextColumnFilters, nextFilterModel],
        source: "ui",
        phase: "change",
      })
    },
    { immediate: true, flush: "sync" },
  )

  watch(
    selectedRowKeys,
    nextSelectedRowKeys => {
      emitGridEvent({
        tier: "advanced",
        name: "sugar:selection",
        args: [{ selectedRowKeys: nextSelectedRowKeys, selectedCount: nextSelectedRowKeys.length }],
        source: "ui",
        phase: "change",
      })
    },
    { flush: "sync" },
  )

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

  const selectionEngine = useAffinoDataGridSelectionEngine({
    runtime,
    rows,
    resolveRowKey,
    internalSelectionSnapshot,
    selectionSnapshot: featureSuite.selectionSnapshot,
    emitSelectionChange: snapshot => {
      emitGridEvent({
        tier: "stable",
        name: "selectionChange",
        args: [snapshot],
        source: "ui",
        phase: "change",
      })
    },
    emitRangeChange: range => {
      emitGridEvent({
        tier: "advanced",
        name: "sugar:cell-selection",
        args: [range],
        source: "ui",
        phase: "change",
      })
    },
    resolveStepRows: () => 20,
  })

  const {
    activeCellSelection,
    anchorCellSelection,
    focusCellSelection,
    cellSelectionRange,
    cellSelectionRanges,
    isPointerSelectingCells,
    isCellSelected,
    setCellSelection,
    setCellByKey,
    clearCellSelection,
    stopPointerCellSelection,
    resolveVisibleColumnIndex,
    resolveCellCoordByIndex,
    resolveCellCoordByKey,
    cellNavigation,
    applySelectionFromRange,
  } = selectionEngine

  let dispatchCellKeyboardCommands = (_event: KeyboardEvent): boolean => false

  const createCellSelectionBindings = (params: {
    row: TRow
    rowIndex: number
    columnKey: string
  }) => {
    const rowKey = resolveRowKey(params.row, params.rowIndex)

    const resolveBoundCoord = () => (
      resolveCellCoordByKey(rowKey, params.columnKey)
      ?? resolveCellCoordByIndex(params.rowIndex, resolveVisibleColumnIndex(params.columnKey))
    )

    const ensureCurrentCoord = () => {
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
      rangeClipboard.startRangePointerInteraction(params.mode ?? "fill", {
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
      rangeClipboard.updateRangePointerPreview(params.rowIndex, params.columnKey)
    },
    onMouseup: (_event?: MouseEvent) => {
      rangeClipboard.stopRangePointerInteraction(true)
    },
  })

  const commitEditWithEvents = async (): Promise<boolean> => {
    const session = activeSession.value
    if (!session) {
      return false
    }
    emitGridEvent({
      tier: "advanced",
      name: "sugar:edit",
      args: [{ session }],
      source: "ui",
      phase: "start",
    })
    const ok = await commitEdit()
    emitGridEvent({
      tier: ok ? "stable" : "advanced",
      name: ok ? "cellEdit" : "sugar:edit",
      args: ok
        ? [{ rowKey: session.rowKey, columnKey: session.columnKey, draft: session.draft, mode: session.mode }]
        : [{ session }],
      source: "ui",
      phase: ok ? "commit" : "cancel",
    })
    return ok
  }

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
    commitEdit: commitEditWithEvents,
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

  const rangeClipboard = useAffinoDataGridRangeClipboard({
    rows,
    runtime,
    featureSuite,
    resolveRowKey,
    resolveVisibleColumnIndex,
    resolveCellCoordByIndex,
    cellSelectionRange,
    activeCellSelection,
    clearCellSelection,
    applySelectionFromRange,
    closeContextMenu: () => {
      bindingSuite.closeContextMenu()
    },
    interactions: {
      enabled: normalizedFeatures.interactions.enabled,
      rangeEnabled: normalizedFeatures.interactions.range.enabled,
      fillEnabled: normalizedFeatures.interactions.range.fill,
      moveEnabled: normalizedFeatures.interactions.range.move,
    },
    pushFeedback,
  })

  const stopAllPointerInteractions = (applyRange = true): void => {
    stopPointerCellSelection()
    rangeClipboard.stopRangePointerInteraction(applyRange)
  }

  const handleGlobalPointerUp = (): void => {
    stopAllPointerInteractions(true)
  }

  const handleGlobalPointerCancel = (): void => {
    stopAllPointerInteractions(false)
  }
  const pointerLifecycle = useAffinoDataGridPointerLifecycle({
    onPointerUp: handleGlobalPointerUp,
    onPointerCancel: handleGlobalPointerCancel,
  })

  const copyCellRangeSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    rangeClipboard.copySelection(trigger)
  )
  const pasteCellRangeSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    rangeClipboard.pasteSelection(trigger)
  )
  const cutCellRangeSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    rangeClipboard.cutSelection(trigger)
  )
  const clearCellRangeSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    rangeClipboard.clearSelection(trigger)
  )

  const hasCellRangeContext = (): boolean => rangeClipboard.hasCellRangeContext()

  runCopyAction = () => (
    hasCellRangeContext() ? copyCellRangeSelection("context-menu") : copySelectedRows()
  )
  runCutAction = async () => {
    if (!hasCellRangeContext()) {
      return cutSelectedRows()
    }
    const ok = await cutCellRangeSelection("context-menu")
    return ok ? Math.max(1, rangeClipboard.resolveActiveRangeCellCount()) : 0
  }
  runPasteAction = async () => {
    if (!hasCellRangeContext()) {
      return pasteRowsAppend()
    }
    const ok = await pasteCellRangeSelection("context-menu")
    return ok ? Math.max(1, rangeClipboard.resolveActiveRangeCellCount()) : 0
  }
  runClearAction = async () => {
    if (!hasCellRangeContext()) {
      return clearSelectedRows()
    }
    const ok = await clearCellRangeSelection("context-menu")
    return ok ? Math.max(1, rangeClipboard.resolveActiveRangeCellCount()) : 0
  }

  let refreshHistorySnapshotBridge: () => DataGridTransactionSnapshot | null = () => null

  const keyboardDispatcher = useAffinoDataGridKeyboardDispatcher({
    enabled: ref(normalizedFeatures.keyboardNavigation.enabled),
    runtime,
    onHistoryRefresh: () => {
      refreshHistorySnapshotBridge()
    },
    pushFeedback,
    copySelection: () => copyCellRangeSelection("keyboard"),
    pasteSelection: () => pasteCellRangeSelection("keyboard"),
    cutSelection: () => cutCellRangeSelection("keyboard"),
    clearSelection: () => clearCellRangeSelection("keyboard"),
  })
  dispatchCellKeyboardCommands = keyboardDispatcher.dispatch

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

  const statusBar = useAffinoDataGridStatusBar({
    enabled: normalizedFeatures.statusBar.enabled,
    rows,
    runtime,
    featureSuite,
    cellSelectionRange,
    activeCellSelection,
    anchorCellSelection,
    resolveRowKey,
  })

  const headerFilters = useAffinoDataGridHeaderFilters({
    enabled: normalizedFeatures.headerFilters.enabled,
    maxUniqueValues: normalizedFeatures.headerFilters.maxUniqueValues,
    rows,
    columns,
    featureSuite,
    filteringHelpers,
    stableSerialize,
    findSetConditionValuesByKey,
    pushFeedback,
  })

  const unsubscribeRowModel = runtime.rowModel.subscribe(nextSnapshot => {
    paginationSnapshot.value = clonePaginationSnapshot(nextSnapshot.pagination)
    statusBar.refresh()
    if (historySupported.value) {
      refreshHistorySnapshot()
    }
  })

  const unsubscribeColumnModel = runtime.columnModel.subscribe(nextSnapshot => {
    columnStateSnapshot.value = cloneColumnModelSnapshot(nextSnapshot)
    statusBar.refresh()
    if (historySupported.value) {
      refreshHistorySnapshot()
    }
  })

  onBeforeUnmount(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("mousemove", onColumnResizeMove)
      window.removeEventListener("mouseup", onColumnResizeEnd)
      window.removeEventListener("mousemove", onRowResizeMove)
      window.removeEventListener("mouseup", onRowResizeEnd)
    }
    pointerLifecycle.dispose()
    rangeClipboard.dispose()
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

  const openContextMenuForActiveCell = (
    options: { zone?: "cell" | "range"; clientX?: number; clientY?: number } = {},
  ): boolean => {
    const active = activeCellSelection.value
    if (!active) {
      return false
    }
    const zone = options.zone ?? "cell"
    const cell = bindingSuite.findCellElement(active.rowKey, active.columnKey)
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
    const header = bindingSuite.findHeaderElement(columnKey)
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
    emitGridEvent({
      tier: "advanced",
      name: "sugar:context-menu-action",
      args: [{ actionId }],
      source: "context-menu",
      phase: "start",
    })
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
      emitGridEvent({
        tier: "advanced",
        name: "sugar:context-menu-action",
        args: [{ actionId, result }],
        source: "context-menu",
        phase: "cancel",
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
    emitGridEvent({
      tier: "advanced",
      name: "sugar:context-menu-action",
      args: [{ actionId, result }],
      source: "context-menu",
      phase: "end",
    })
    return result
  }

  const setPagination = (pagination: { pageSize: number; currentPage: number } | null): void => {
    runtime.api.setPagination(pagination)
    refreshPaginationSnapshot()
    emitGridEvent({
      tier: "advanced",
      name: "sugar:pagination",
      args: [paginationSnapshot.value ?? runtime.api.getPaginationSnapshot()],
      source: "api",
      phase: "change",
    })
  }

  const setPageSize = (pageSize: number | null): void => {
    runtime.api.setPageSize(pageSize)
    refreshPaginationSnapshot()
    emitGridEvent({
      tier: "advanced",
      name: "sugar:pagination",
      args: [paginationSnapshot.value ?? runtime.api.getPaginationSnapshot()],
      source: "api",
      phase: "change",
    })
  }

  const setCurrentPage = (page: number): void => {
    runtime.api.setCurrentPage(page)
    const snapshot = refreshPaginationSnapshot()
    emitGridEvent({
      tier: "advanced",
      name: "sugar:pagination",
      args: [snapshot],
      source: "api",
      phase: "change",
    })
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
    const state = columnResizeState.value
    if (!state) {
      return
    }
    const column = runtime.api.getColumn(state.columnKey)
    emitGridEvent({
      tier: "stable",
      name: "columnResize",
      args: [{
        key: state.columnKey,
        width: Number(column?.width ?? column?.column.width ?? state.startWidth),
      }],
      source: "pointer",
      phase: "end",
    })
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

  const layoutProfiles = useAffinoDataGridLayoutProfiles({
    runtime,
    sortState,
    setSortState,
    featureSuite,
    applyColumnStateSnapshot,
    cloneColumnModelSnapshot,
    stableClone,
    pushFeedback,
  })

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
    emitGridEvent({
      tier: "advanced",
      name: "sugar:history",
      args: [{ direction: "undo" }],
      source: "keyboard",
      phase: "start",
    })
    const committedId = await runtime.api.undoTransaction()
    refreshHistorySnapshot()
    pushFeedback({
      source: "history",
      action: "undo",
      message: "Undo",
      ok: true,
    })
    emitGridEvent({
      tier: "advanced",
      name: "sugar:history",
      args: [{ direction: "undo", committedId }],
      source: "keyboard",
      phase: "end",
    })
    return committedId
  }

  const redo = async (): Promise<string | null> => {
    if (!historySupported.value || !runtime.api.canRedoTransaction()) {
      return null
    }
    emitGridEvent({
      tier: "advanced",
      name: "sugar:history",
      args: [{ direction: "redo" }],
      source: "keyboard",
      phase: "start",
    })
    const committedId = await runtime.api.redoTransaction()
    refreshHistorySnapshot()
    pushFeedback({
      source: "history",
      action: "redo",
      message: "Redo",
      ok: true,
    })
    emitGridEvent({
      tier: "advanced",
      name: "sugar:history",
      args: [{ direction: "redo", committedId }],
      source: "keyboard",
      phase: "end",
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
      profiles: layoutProfiles.profiles,
      capture: layoutProfiles.capture,
      apply: layoutProfiles.apply,
      remove: layoutProfiles.remove,
      clear: layoutProfiles.clear,
    },
    statusBar: {
      enabled: statusBar.enabled,
      metrics: statusBar.metrics,
      refresh: statusBar.refresh,
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
    events: {
      enabled: eventHubEnabled,
      last: eventHubLast,
      log: eventHubLog,
      on: eventHub.on,
      off: eventHub.off,
      emit: eventHub.emit,
      clear: eventHub.clear,
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
      copiedRange: rangeClipboard.copiedRange,
      fillPreviewRange: rangeClipboard.fillPreviewRange,
      rangeMovePreviewRange: rangeClipboard.rangeMovePreviewRange,
      lastAction: rangeClipboard.lastAction,
      copy: copyCellRangeSelection,
      paste: pasteCellRangeSelection,
      cut: cutCellRangeSelection,
      clear: clearCellRangeSelection,
      setFillPreviewRange: rangeClipboard.setFillPreviewRange,
      setRangeMovePreviewRange: rangeClipboard.setRangeMovePreviewRange,
      applyFillPreview: rangeClipboard.applyFillPreview,
      applyRangeMove: rangeClipboard.applyRangeMove,
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
        enabled: rangeClipboard.interactionsEnabled,
        range: {
          enabled: rangeClipboard.rangeInteractionsEnabled,
          fillEnabled: rangeClipboard.rangeFillEnabled,
          moveEnabled: rangeClipboard.rangeMoveEnabled,
          pointerMode: rangeClipboard.rangePointerMode,
          stop: () => {
            rangeClipboard.stopRangePointerInteraction(false)
          },
        },
      },
      headerFilters: {
        enabled: headerFilters.enabled,
        state: headerFilters.state,
        open: headerFilters.open,
        close: headerFilters.close,
        toggle: headerFilters.toggle,
        setQuery: headerFilters.setQuery,
        setOperator: headerFilters.setOperator,
        getOperators: headerFilters.getOperators,
        getUniqueValues: headerFilters.getUniqueValues,
        setValueSelected: headerFilters.setValueSelected,
        selectOnlyValue: headerFilters.selectOnlyValue,
        selectAllValues: headerFilters.selectAllValues,
        clearValues: headerFilters.clearValues,
        applyText: headerFilters.applyText,
        applyNumber: headerFilters.applyNumber,
        applyDate: headerFilters.applyDate,
        clear: headerFilters.clear,
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
