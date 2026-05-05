import { computed, nextTick, ref, type ComputedRef, type Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowNode,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import {
  invokeDataGridCellInteraction,
  resolveDataGridCellKeyboardAction,
  toggleDataGridCellValue,
} from "@affino/datagrid-core"
import {
  type DataGridFillBehavior,
  buildDataGridFillMatrix,
  canToggleDataGridFillBehavior,
  resolveDataGridDefaultFillBehavior,
} from "../composables/dataGridFillBehavior"
import {
  useDataGridAxisAutoScrollDelta,
  useDataGridCellNavigation,
  useDataGridCellPointerDownRouter,
  useDataGridDragPointerSelection,
  useDataGridFillHandleStart,
  useDataGridFillSelectionLifecycle,
  useDataGridHistoryActionRunner,
  useDataGridKeyboardCommandRouter,
  useDataGridPointerCellCoordResolver,
  useDataGridPointerAutoScroll,
  useDataGridPointerPreviewRouter,
  useDataGridRangeMoveLifecycle,
  useDataGridRangeMoveStart,
  useDataGridRangeMutationEngine,
  type DataGridCopyRange,
} from "../advanced"
import { resolveMissingRowIndexInRange } from "./useDataGridAppClipboard"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type {
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationSnapshot,
  DataGridSortState,
} from "@affino/datagrid-core"

interface DataGridAppFillProjectionContext {
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
  treeData: null
  pivot: null
  pagination: DataGridPaginationSnapshot
}

interface DataGridAppResolveFillBoundaryRequest {
  direction: "up" | "down" | "left" | "right"
  baseRange: DataGridCopyRange
  fillColumns: readonly string[]
  referenceColumns: readonly string[]
  projection: DataGridAppFillProjectionContext
  startRowIndex: number
  startColumnIndex: number
  limit?: number | null
}

interface DataGridAppResolveFillBoundaryResult {
  endRowIndex: number | null
  endRowId?: string | number | null
  boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
  scannedRowCount?: number
  truncated?: boolean
}

interface DataGridAppFillDataSource {
  resolveFillBoundary?: (
    request: DataGridAppResolveFillBoundaryRequest,
  ) => Promise<DataGridAppResolveFillBoundaryResult> | DataGridAppResolveFillBoundaryResult
  commitFillOperation?: (request: {
    operationId?: string | null
    revision?: string | number | null
    projection: DataGridAppFillProjectionContext
    sourceRange: DataGridCopyRange
    targetRange: DataGridCopyRange
    sourceRowIds?: readonly (string | number)[]
    targetRowIds?: readonly (string | number)[]
    fillColumns: readonly string[]
    referenceColumns: readonly string[]
    mode: DataGridFillBehavior
    metadata?: { origin?: "drag-fill" | "double-click-fill" | "menu-reapply"; behaviorSource?: "default" | "explicit" } | null
  }) => Promise<{ operationId: string; revision?: string | number | null; affectedRowCount: number; affectedCellCount?: number; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
  undoFillOperation?: (request: {
    operationId: string
    revision?: string | number | null
    projection: DataGridAppFillProjectionContext
  }) => Promise<{ operationId: string; revision?: string | number | null; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
  redoFillOperation?: (request: {
    operationId: string
    revision?: string | number | null
    projection: DataGridAppFillProjectionContext
  }) => Promise<{ operationId: string; revision?: string | number | null; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
}

interface DataGridAppProjectedFillRowIds {
  rowIds: Array<string | number>
  requestedRowCount: number
  missingCount: number
  firstMissingRowIndex: number | null
  lastResolvedRowIndex: number | null
  fullyMaterialized: boolean
}

const SERVER_FILL_SERIES_UNSUPPORTED_WARNING = "Series fill is not supported by the server datasource yet; using copy fill."

function resolveServerFillCommitBehavior(
  behavior: DataGridFillBehavior,
): { behavior: DataGridFillBehavior; downgraded: boolean } {
  return behavior === "series"
    ? { behavior: "copy", downgraded: true }
    : { behavior, downgraded: false }
}

function normalizeServerFillOperationId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null
}

function getFillRangeStart(range: DataGridCopyRange | { start?: number; end?: number }): number {
  const candidate = range as { startRow?: unknown; start?: unknown }
  return Number.isFinite(candidate.startRow)
    ? Math.max(0, Math.trunc(Number(candidate.startRow)))
    : Math.max(0, Math.trunc(Number(candidate.start ?? 0)))
}

function getFillRangeEnd(range: DataGridCopyRange | { start?: number; end?: number }): number {
  const candidate = range as { endRow?: unknown; end?: unknown }
  return Number.isFinite(candidate.endRow)
    ? Math.max(0, Math.trunc(Number(candidate.endRow)))
    : Math.max(0, Math.trunc(Number(candidate.end ?? getFillRangeStart(range))))
}

function formatServerFillAffectedRange(
  range: DataGridCopyRange | { start?: number; end?: number },
  fallbackColumns: DataGridCopyRange,
): string {
  const start = getFillRangeStart(range)
  const end = getFillRangeEnd(range)
  const startColumn = Number.isFinite((range as DataGridCopyRange).startColumn)
    ? (range as DataGridCopyRange).startColumn
    : fallbackColumns.startColumn
  const endColumn = Number.isFinite((range as DataGridCopyRange).endColumn)
    ? (range as DataGridCopyRange).endColumn
    : fallbackColumns.endColumn
  return `${start}..${end} x ${startColumn}..${endColumn}`
}

function normalizeServerFillInvalidationRange(
  range: DataGridCopyRange | { start?: unknown; end?: unknown; startRow?: unknown; endRow?: unknown } | null | undefined,
): { start: number; end: number } | null {
  if (!range) {
    return null
  }
  const candidate = range as { start?: unknown; end?: unknown; startRow?: unknown; endRow?: unknown }
  const rawStart = Number.isFinite(candidate.startRow)
    ? candidate.startRow
    : candidate.start
  const rawEnd = Number.isFinite(candidate.endRow)
    ? candidate.endRow
    : candidate.end
  const start = Number(rawStart)
  const end = Number(rawEnd ?? rawStart)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }
  return {
    start: Math.max(0, Math.trunc(start)),
    end: Math.max(Math.max(0, Math.trunc(start)), Math.trunc(end)),
  }
}

const ROW_SELECTION_COLUMN_KEY = "__datagrid_row_selection__"
import {
  useDataGridAppFill,
  type DataGridAppAppliedFillSession,
} from "./useDataGridAppFill"
import { restoreDataGridFocus } from "./dataGridFocusRestore"
import type {
  DataGridAppCellCoord,
  DataGridAppSelectionAnchorLike,
} from "./useDataGridAppCellSelection"
import type { DataGridAppMode } from "./useDataGridAppControls"

interface DataGridAppPointer {
  clientX: number
  clientY: number
}

type DataGridAppRowWithId<TRow> = TRow & { rowId: string | number }
type DataGridAppPinnedOrigin = "left" | "right" | "center"
type DataGridRowIndexKeyboardAction = "insert-row-above" | "copy-row" | "cut-row" | "paste-row" | "delete-selected-rows" | "open-row-menu"

const DRAG_SELECTION_POINTER_THRESHOLD_PX = 4

export interface UseDataGridAppInteractionControllerOptions<
  TRow extends Record<string, unknown>,
  TSnapshot,
> {
  mode: Ref<DataGridAppMode>
  enableFillHandle?: Ref<boolean>
  enableRangeMove?: Ref<boolean>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "getBodyRowAtIndex" | "resolveBodyRowIndexById" | "rowModel">
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  viewportRowStart: Ref<number>
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  bodyViewportRef: Ref<HTMLElement | null>
  indexColumnWidth?: number
  resolveColumnWidth: (column: DataGridColumnSnapshot) => number
  resolveRowHeight: (rowIndex: number) => number
  resolveRowIndexAtOffset: (offset: number) => number
  normalizeRowId: (value: unknown) => string | number | null
  normalizeCellCoord: (coord: DataGridAppCellCoord) => DataGridAppCellCoord | null
  resolveSelectionRange: () => DataGridCopyRange | null
  applySelectionRange: (range: DataGridCopyRange) => void
  recordServerFillTransaction?: (descriptor: {
    intent: "fill"
    label: string
    affectedRange?: DataGridCopyRange | null
    operationId: string
    revision?: string | number | null
    mode: DataGridFillBehavior
  }) => void
  applyCellSelectionByCoord: (
    coord: DataGridAppCellCoord,
    extend: boolean,
    fallbackAnchor?: DataGridAppSelectionAnchorLike,
    additive?: boolean,
  ) => void
  setCellSelection: (
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
    extend: boolean,
    additive?: boolean,
  ) => void
  clearCellSelection: () => void
  readCell: (row: DataGridRowNode<TRow>, columnKey: string) => string
  ensureEditableRowAtIndex?: (rowIndex: number) => DataGridRowNode<TRow> | null
  isCellEditable: (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    columnKey: string,
    columnIndex: number,
  ) => boolean
  cloneRowData: (row: TRow) => TRow
  resolveRowIndexById?: (rowId: string | number) => number
  isRowMaterializedAtIndex?: (rowIndex: number) => boolean
  resolveFillBoundary?: (
    request: DataGridAppResolveFillBoundaryRequest,
  ) => Promise<DataGridAppResolveFillBoundaryResult> | DataGridAppResolveFillBoundaryResult
  runtimeRowModel?: {
    dataSource?: DataGridAppFillDataSource
  } | null
  reportFillWarning?: (message: string) => void
  reportFillPlumbingState?: (layer: string, present: boolean) => void
  captureRowsSnapshot: () => TSnapshot
  captureRowsSnapshotForRowIds?: (rowIds: readonly (string | number)[]) => TSnapshot
  recordIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: TSnapshot,
    afterSnapshotOverride?: TSnapshot,
  ) => void | Promise<void>
  clearPendingClipboardOperation: (clearSelection: boolean, clearBufferedClipboardPayload?: boolean) => boolean
  clearExternalPendingClipboardOperation?: () => boolean
  copySelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelectedCells: (
    trigger?: "keyboard" | "context-menu",
    options?: { mode?: "default" | "values" },
  ) => Promise<boolean>
  cutSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  normalizeClipboardRange: (range: DataGridCopyRange) => DataGridCopyRange | null
  applyClipboardEdits: (
    range: DataGridCopyRange,
    matrix: string[][],
    options?: { recordHistory?: boolean },
  ) => number | Promise<number>
  rangesEqual: (left: DataGridCopyRange | null, right: DataGridCopyRange | null) => boolean
  buildFillMatrixFromRange: (range: DataGridCopyRange) => string[][]
  applyRangeMove?: (baseRange: DataGridCopyRange, targetRange: DataGridCopyRange) => boolean | Promise<boolean>
  refreshServerFillViewport?: (range?: DataGridCopyRange | null) => void | Promise<void>
  syncViewport: () => void
  editingCell: Ref<{ rowId: string | number; columnKey: string } | null>
  startInlineEdit: (
    row: DataGridRowNode<TRow>,
    columnKey: string,
    options?: { draftValue?: string; openOnMount?: boolean },
  ) => void
  appendInlineEditTextInput?: (value: string) => boolean
  cancelInlineEdit: () => void
  commitInlineEdit: (target?: "stay" | "next" | "previous" | "none") => void
  canUndo: () => boolean
  canRedo: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<unknown> | unknown
  ensureKeyboardActiveCellVisible: (rowIndex: number, columnIndex: number) => void
  isContextMenuVisible?: () => boolean
  closeContextMenu?: () => void
  openContextMenuFromCurrentCell?: () => void
  runRowIndexKeyboardAction?: (
    action: DataGridRowIndexKeyboardAction,
    rowId: string | number,
  ) => Promise<boolean> | boolean
  reportFillPlumbingDetail?: (layer: string, value: string) => void
}

export interface UseDataGridAppInteractionControllerResult<TRow> {
  isPointerSelectingCells: Ref<boolean>
  isFillDragging: Ref<boolean>
  fillPreviewRange: Ref<DataGridCopyRange | null>
  lastAppliedFill: Ref<DataGridAppAppliedFillSession | null>
  isRangeMoving: Ref<boolean>
  selectionRange: ComputedRef<DataGridCopyRange | null>
  rangeMovePreviewRange: Ref<DataGridCopyRange | null>
  stopPointerSelection: () => void
  stopFillSelection: (commit: boolean) => void
  startFillHandleDrag: (event: MouseEvent) => void
  startFillHandleDoubleClick: (event: MouseEvent) => void
  applyLastFillBehavior: (behavior: DataGridFillBehavior) => boolean | Promise<boolean>
  handleCellMouseDown: (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number, columnIndex: number) => void
  handleCellKeydown: (event: KeyboardEvent, row: DataGridRowNode<TRow>, rowOffset: number, columnIndex: number) => void
  handleRowIndexKeydown: (event: KeyboardEvent, row: DataGridRowNode<TRow>, rowOffset: number) => void
  handleWindowMouseMove: (event: MouseEvent) => void
  handleWindowMouseUp: () => void
  isCellInFillPreview: (rowOffset: number, columnIndex: number) => boolean
  isFillHandleCell: (rowOffset: number, columnIndex: number) => boolean
  clearSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  dispose: () => void
}

export function useDataGridAppInteractionController<
  TRow extends Record<string, unknown>,
  TSnapshot,
>(
  options: UseDataGridAppInteractionControllerOptions<TRow, TSnapshot>,
): UseDataGridAppInteractionControllerResult<TRow> {
  const resolveRowIndex = (row: DataGridRowNode<TRow>, rowOffset: number): number => {
    return Number.isFinite(row.displayIndex)
      ? Math.max(0, Math.trunc(row.displayIndex))
      : options.viewportRowStart.value + rowOffset
  }

  const isContextMenuVisible = () => options.isContextMenuVisible?.() === true
  const closeContextMenu = () => {
    options.closeContextMenu?.()
  }
  const openContextMenuFromCurrentCell = () => {
    options.openContextMenuFromCurrentCell?.()
  }

  const getBodyRowAtIndex = (rowIndex: number): DataGridRowNode<TRow> | null => {
    const runtime = options.runtime as typeof options.runtime & {
      getBodyRowAtIndex?: (index: number) => DataGridRowNode<TRow> | null
    }
    return runtime.getBodyRowAtIndex?.(rowIndex) ?? options.runtime.api.rows.get(rowIndex) ?? null
  }

  const isSemanticNavigationCellNonEmpty = (rowIndex: number, columnIndex: number): boolean | null => {
    const row = getBodyRowAtIndex(rowIndex)
    const columnKey = options.visibleColumns.value[columnIndex]?.key
    if (!row || row.rowId == null || row.kind === "group" || !columnKey) {
      return null
    }
    return options.readCell(row, columnKey).trim().length > 0
  }

  const isServerBackedRowModel = (): boolean => {
    const controllerRowModel = options.runtimeRowModel as
      | { dataSource?: unknown }
      | null
      | undefined
    const runtimeRowModel = options.runtime.rowModel as
      | { dataSource?: unknown }
      | undefined
    return controllerRowModel?.dataSource != null || runtimeRowModel?.dataSource != null
  }

  const resolveSelectableColumnIndexes = (): readonly number[] => {
    return options.visibleColumns.value
      .map((column, columnIndex) => ({ column, columnIndex }))
      .filter(({ column }) => column.key !== ROW_SELECTION_COLUMN_KEY)
      .map(({ columnIndex }) => columnIndex)
  }

  const resolveDirectionalSemanticJumpTarget = (
    current: DataGridAppCellCoord,
    direction: "up" | "down" | "left" | "right",
    event: KeyboardEvent,
  ): DataGridAppCellCoord | undefined => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return undefined
    }

    if (event.shiftKey && isServerBackedRowModel()) {
      const lastRowIndex = Math.max(0, options.totalRows.value - 1)
      const selectableColumnIndexes = resolveSelectableColumnIndexes()
      const firstSelectableColumnIndex = selectableColumnIndexes[0] ?? 0
      const lastSelectableColumnIndex = selectableColumnIndexes[selectableColumnIndexes.length - 1] ?? Math.max(0, options.visibleColumns.value.length - 1)
      switch (direction) {
        case "down":
          return options.normalizeCellCoord({
            ...current,
            rowIndex: lastRowIndex,
            rowId: getBodyRowAtIndex(lastRowIndex)?.rowId ?? null,
          }) ?? current
        case "up":
          return options.normalizeCellCoord({
            ...current,
            rowIndex: 0,
            rowId: getBodyRowAtIndex(0)?.rowId ?? null,
          }) ?? current
        case "right":
          return options.normalizeCellCoord({
            ...current,
            columnIndex: lastSelectableColumnIndex,
            rowId: getBodyRowAtIndex(current.rowIndex)?.rowId ?? null,
          }) ?? current
        case "left":
          return options.normalizeCellCoord({
            ...current,
            columnIndex: firstSelectableColumnIndex,
            rowId: getBodyRowAtIndex(current.rowIndex)?.rowId ?? null,
          }) ?? current
      }
    }

    const currentCellIsNonEmpty = isSemanticNavigationCellNonEmpty(current.rowIndex, current.columnIndex)
    if (currentCellIsNonEmpty == null) {
      return undefined
    }

    const nextColumnIndex = (columnIndex: number, step: 1 | -1): number => {
      const lastColumn = Math.max(0, options.visibleColumns.value.length - 1)
      return Math.max(0, Math.min(lastColumn, columnIndex + step))
    }

    const step = (coord: DataGridAppCellCoord): DataGridAppCellCoord | null => {
      switch (direction) {
        case "up":
          return coord.rowIndex > 0
            ? { ...coord, rowIndex: coord.rowIndex - 1, rowId: getBodyRowAtIndex(coord.rowIndex - 1)?.rowId ?? null }
            : null
        case "down":
          return coord.rowIndex < Math.max(0, options.totalRows.value - 1)
            ? { ...coord, rowIndex: coord.rowIndex + 1, rowId: getBodyRowAtIndex(coord.rowIndex + 1)?.rowId ?? null }
            : null
        case "left": {
          const columnIndex = nextColumnIndex(coord.columnIndex, -1)
          return columnIndex === coord.columnIndex
            ? null
            : { ...coord, columnIndex, rowId: getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null }
        }
        case "right": {
          const columnIndex = nextColumnIndex(coord.columnIndex, 1)
          return columnIndex === coord.columnIndex
            ? null
            : { ...coord, columnIndex, rowId: getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null }
        }
      }
    }

    let lastMatchingCoord = current
    let candidate = step(current)
    while (candidate) {
      const candidateIsNonEmpty = isSemanticNavigationCellNonEmpty(candidate.rowIndex, candidate.columnIndex)
      if (candidateIsNonEmpty == null || candidateIsNonEmpty !== currentCellIsNonEmpty) {
        break
      }
      lastMatchingCoord = candidate
      candidate = step(candidate)
    }

    return options.normalizeCellCoord(lastMatchingCoord) ?? current
  }
  const resolveBodyRowIndexById = (rowId: string | number): number => {
    const runtime = options.runtime as typeof options.runtime & {
      resolveBodyRowIndexById?: (value: string | number) => number
    }
    if (typeof runtime.resolveBodyRowIndexById === "function") {
      return runtime.resolveBodyRowIndexById(rowId)
    }
    if (typeof options.resolveRowIndexById === "function") {
      return options.resolveRowIndexById(rowId)
    }
    const count = options.runtime.api.rows.getCount()
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      if (options.runtime.api.rows.get(rowIndex)?.rowId === rowId) {
        return rowIndex
      }
    }
    return -1
  }
  const supportsCellSelectionMode = (): boolean => {
    return options.mode.value === "base" || options.mode.value === "tree" || options.mode.value === "worker"
  }
  const isFillHandleEnabled = computed(() => options.enableFillHandle?.value !== false)
  const isRangeMoveEnabled = computed(() => options.enableRangeMove?.value !== false)

  const isPointerSelectingCells = ref(false)
  const keyboardNavigationExtendsSelection = ref(false)
  const dragPointer = ref<DataGridAppPointer | null>(null)
  const lastDragCoord = ref<DataGridAppCellCoord | null>(null)
  const dragSelectionOriginPin = ref<DataGridAppPinnedOrigin | null>(null)
  const pendingDragSelection = ref(false)
  const pendingDragPointerStart = ref<DataGridAppPointer | null>(null)
  const pendingDragCoord = ref<DataGridAppCellCoord | null>(null)
  const isFillDragging = ref(false)
  const fillDragStartPointer = ref<DataGridAppPointer | null>(null)
  const fillPointer = ref<DataGridAppPointer | null>(null)
  const fillBaseRange = ref<DataGridCopyRange | null>(null)
  const fillPreviewRange = ref<DataGridCopyRange | null>(null)
  const activeFillBehavior = ref<DataGridFillBehavior | null>(null)
  const lastAppliedFill = ref<DataGridAppAppliedFillSession | null>(null)
  const activeRestartFillSession = ref<DataGridAppAppliedFillSession | null>(null)
  const fillOriginFocusCoord = ref<DataGridAppCellCoord | null>(null)
  const isRangeMoving = ref(false)
  const pendingRangeMove = ref(false)
  const pendingRangeMoveCoord = ref<DataGridAppCellCoord | null>(null)
  const pendingRangeMovePointerStart = ref<DataGridAppPointer | null>(null)
  const rangeMovePointer = ref<DataGridAppPointer | null>(null)
  const rangeMoveBaseRange = ref<DataGridCopyRange | null>(null)
  const rangeMoveOrigin = ref<DataGridAppCellCoord | null>(null)
  const rangeMovePreviewRange = ref<DataGridCopyRange | null>(null)
  let fillPreviewCancelVersion = 0
  let lastServerFillMaterializationWarning: string | null = null

  const hasActiveFillPreviewState = (): boolean => {
    return isFillDragging.value || fillBaseRange.value != null || fillPreviewRange.value != null
  }

  const clearFillPreviewState = (
    expectedBaseRange?: DataGridCopyRange | null,
    expectedPreviewRange?: DataGridCopyRange | null,
  ): boolean => {
    if (
      expectedBaseRange !== undefined
      && !options.rangesEqual(fillBaseRange.value, expectedBaseRange)
    ) {
      return false
    }
    if (
      expectedPreviewRange !== undefined
      && !options.rangesEqual(fillPreviewRange.value, expectedPreviewRange)
    ) {
      return false
    }
    isFillDragging.value = false
    fillDragStartPointer.value = null
    fillPointer.value = null
    fillBaseRange.value = null
    fillPreviewRange.value = null
    fillOriginFocusCoord.value = null
    return true
  }

  const cancelFillPreviewState = (): boolean => {
    if (!hasActiveFillPreviewState()) {
      return false
    }
    fillPreviewCancelVersion += 1
    return clearFillPreviewState()
  }

  const focusViewport = (): void => {
    options.bodyViewportRef.value?.focus({ preventScroll: true })
  }

  const restoreRowIndexFocus = (
    rowId: string | number,
    fallbackTarget: HTMLElement | null = null,
  ): void => {
    const applyFocus = (): void => {
      const bodyShell = options.bodyViewportRef.value?.closest<HTMLElement>(".grid-body-shell")
      const rowIndexCell = bodyShell?.querySelector<HTMLElement>(`.datagrid-stage__row-index-cell[data-row-id="${String(rowId)}"]`)
      const fallbackRowIndex = Number.parseInt(fallbackTarget?.dataset.rowIndex ?? "", 10)
      const closestVisualIndexCell = Number.isFinite(fallbackRowIndex)
        ? Array.from(bodyShell?.querySelectorAll<HTMLElement>(".datagrid-stage__row-index-cell") ?? []).reduce<HTMLElement | null>(
            (closest, candidate) => {
              const candidateRowIndex = Number.parseInt(candidate.dataset.rowIndex ?? "", 10)
              if (!Number.isFinite(candidateRowIndex)) {
                return closest
              }
              if (!closest) {
                return candidate
              }
              const closestRowIndex = Number.parseInt(closest.dataset.rowIndex ?? "", 10)
              if (!Number.isFinite(closestRowIndex)) {
                return candidate
              }
              return Math.abs(candidateRowIndex - fallbackRowIndex) < Math.abs(closestRowIndex - fallbackRowIndex)
                ? candidate
                : closest
            },
            null,
          )
        : null
      const sameVisualIndexCell = Number.isFinite(fallbackRowIndex)
        ? bodyShell?.querySelector<HTMLElement>(`.datagrid-stage__row-index-cell[data-row-index="${fallbackRowIndex}"]`)
        : null
      const target = rowIndexCell
        ?? (fallbackTarget?.isConnected ? fallbackTarget : null)
        ?? sameVisualIndexCell
        ?? closestVisualIndexCell
      if (target) {
        if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1")
        }
        target.focus({ preventScroll: true })
        return
      }
      focusViewport()
    }

    void restoreDataGridFocus(applyFocus)
  }

  const isPrintableEditingKey = (event: KeyboardEvent): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false
    }
    return event.key.length === 1
  }

  const applyDirectCellEdit = async (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    columnIndex: number,
    columnKey: string,
    nextValue: unknown,
    label: string,
  ): Promise<boolean> => {
    if (row.kind === "group" || row.rowId == null) {
      return false
    }
    const beforeSnapshot = options.captureRowsSnapshot()
    const resolvedRow = options.ensureEditableRowAtIndex?.(rowIndex) ?? row
    if (resolvedRow.kind === "group" || resolvedRow.rowId == null) {
      return false
    }
    await options.runtime.api.rows.applyEdits([
      {
        rowId: resolvedRow.rowId,
        data: {
          [columnKey]: nextValue,
        } as Partial<TRow>,
      },
    ])
    void options.recordIntentTransaction({
      intent: "edit",
      label,
      affectedRange: {
        startRow: rowIndex,
        endRow: rowIndex,
        startColumn: columnIndex,
        endColumn: columnIndex,
      },
    }, beforeSnapshot)
    options.syncViewport()
    restoreActiveCellFocus({
      rowIndex,
      columnIndex,
      rowId: resolvedRow.rowId,
    })
    return true
  }

  const restoreActiveCellFocus = (preferredCoord: DataGridAppCellCoord | null = null): void => {
    const applyFocus = (): void => {
      if (preferredCoord) {
        options.ensureKeyboardActiveCellVisible(preferredCoord.rowIndex, preferredCoord.columnIndex)
        return
      }
      const activeCell = options.selectionSnapshot.value?.activeCell
      if (activeCell) {
        options.ensureKeyboardActiveCellVisible(activeCell.rowIndex, activeCell.colIndex)
        return
      }
      focusViewport()
    }

    applyFocus()
    void nextTick(() => {
      applyFocus()
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          applyFocus()
        })
      }
    })
  }

  const clearPendingDragSelection = (): void => {
    pendingDragSelection.value = false
    pendingDragPointerStart.value = null
    pendingDragCoord.value = null
  }

  const clearPendingRangeMove = (): void => {
    pendingRangeMove.value = false
    pendingRangeMoveCoord.value = null
    pendingRangeMovePointerStart.value = null
  }

  const selectionRange = computed(() => {
    if (isFillDragging.value && fillPreviewRange.value) {
      return fillPreviewRange.value
    }
    return options.resolveSelectionRange()
  })

  const stopPointerSelection = (): void => {
    isPointerSelectingCells.value = false
    dragPointer.value = null
    lastDragCoord.value = null
    dragSelectionOriginPin.value = null
    clearPendingDragSelection()
    clearPendingRangeMove()
  }

  const resolveColumnPin = (columnIndex: number): DataGridAppPinnedOrigin => {
    const pin = options.visibleColumns.value[columnIndex]?.pin
    if (pin === "left" || pin === "right") {
      return pin
    }
    return "center"
  }

  const shouldActivateDragSelection = (pointer: DataGridAppPointer): boolean => {
    const startPointer = pendingDragPointerStart.value
    if (!startPointer) {
      return false
    }
    const deltaX = Math.abs(pointer.clientX - startPointer.clientX)
    const deltaY = Math.abs(pointer.clientY - startPointer.clientY)
    return Math.max(deltaX, deltaY) >= DRAG_SELECTION_POINTER_THRESHOLD_PX
  }

  const shouldActivateRangeMove = (pointer: DataGridAppPointer): boolean => {
    const startPointer = pendingRangeMovePointerStart.value
    if (!startPointer) {
      return false
    }
    const deltaX = Math.abs(pointer.clientX - startPointer.clientX)
    const deltaY = Math.abs(pointer.clientY - startPointer.clientY)
    return Math.max(deltaX, deltaY) >= DRAG_SELECTION_POINTER_THRESHOLD_PX
  }

  const activatePendingDragSelection = (pointer: DataGridAppPointer): boolean => {
    if (!pendingDragSelection.value || !pendingDragCoord.value) {
      return false
    }
    isPointerSelectingCells.value = true
    dragPointer.value = pointer
    lastDragCoord.value = pendingDragCoord.value
    clearPendingDragSelection()
    return true
  }

  const activatePendingRangeMove = (pointer: DataGridAppPointer): boolean => {
    const coord = pendingRangeMoveCoord.value
    if (!isRangeMoveEnabled.value || !pendingRangeMove.value || !coord) {
      clearPendingRangeMove()
      return false
    }
    clearPendingRangeMove()
    return rangeMoveStart.startRangeMove(coord, pointer)
  }

  const isCoordInsideRange = (coord: DataGridAppCellCoord, range: DataGridCopyRange): boolean => {
    return (
      coord.rowIndex >= range.startRow
      && coord.rowIndex <= range.endRow
      && coord.columnIndex >= range.startColumn
      && coord.columnIndex <= range.endColumn
    )
  }

  const resolveBaseDataRows = (): Array<DataGridAppRowWithId<TRow>> => {
    const count = options.runtime.api.rows.getCount()
    const result: Array<DataGridAppRowWithId<TRow>> = []
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      const node = getBodyRowAtIndex(rowIndex)
      if (!node || node.rowId == null || node.kind === "group") {
        continue
      }
      result.push({
        ...options.cloneRowData(node.data as TRow),
        rowId: node.rowId,
      })
    }
    return result
  }

  const collectRowIdsInRange = (range: DataGridCopyRange | null): Array<string | number> => {
    const normalizedRange = range ? options.normalizeClipboardRange(range) : null
    if (!normalizedRange) {
      return []
    }
    const rowIds: Array<string | number> = []
    const seen = new Set<string | number>()
    for (let rowIndex = normalizedRange.startRow; rowIndex <= normalizedRange.endRow; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
      if (!row || row.rowId == null || row.kind === "group" || seen.has(row.rowId)) {
        continue
      }
      seen.add(row.rowId)
      rowIds.push(row.rowId)
    }
    return rowIds
  }

  const captureRowsSnapshotForRanges = (ranges: readonly (DataGridCopyRange | null)[]): TSnapshot => {
    const rowIds: Array<string | number> = []
    for (const range of ranges) {
      rowIds.push(...collectRowIdsInRange(range))
    }
    return options.captureRowsSnapshotForRowIds?.(rowIds) ?? options.captureRowsSnapshot()
  }

  const applyServerBackedRangeMove = async (
    baseRange: DataGridCopyRange,
    targetRange: DataGridCopyRange,
  ): Promise<boolean> => {
    const editsByRowId = new Map<string | number, Record<string, string>>()
    let appliedCells = 0
    let blockedCells = 0

    for (let rowOffset = 0; rowOffset <= baseRange.endRow - baseRange.startRow; rowOffset += 1) {
      const sourceRowIndex = baseRange.startRow + rowOffset
      const targetRowIndex = targetRange.startRow + rowOffset
      const sourceRow = getBodyRowAtIndex(sourceRowIndex)
      const targetRow = getBodyRowAtIndex(targetRowIndex)
      if (
        !sourceRow
        || !targetRow
        || sourceRow.kind === "group"
        || targetRow.kind === "group"
        || sourceRow.rowId == null
        || targetRow.rowId == null
      ) {
        blockedCells += Math.max(0, baseRange.endColumn - baseRange.startColumn + 1)
        continue
      }

      for (let columnOffset = 0; columnOffset <= baseRange.endColumn - baseRange.startColumn; columnOffset += 1) {
        const sourceColumnIndex = baseRange.startColumn + columnOffset
        const targetColumnIndex = targetRange.startColumn + columnOffset
        const sourceColumnKey = options.visibleColumns.value[sourceColumnIndex]?.key
        const targetColumnKey = options.visibleColumns.value[targetColumnIndex]?.key
        if (
          !sourceColumnKey
          || !targetColumnKey
          || sourceColumnKey === ROW_SELECTION_COLUMN_KEY
          || targetColumnKey === ROW_SELECTION_COLUMN_KEY
          || !options.isCellEditable(sourceRow, sourceRowIndex, sourceColumnKey, sourceColumnIndex)
          || !options.isCellEditable(targetRow, targetRowIndex, targetColumnKey, targetColumnIndex)
        ) {
          blockedCells += 1
          continue
        }

        const sourceValue = options.readCell(sourceRow, sourceColumnKey)
        const sourcePatch = editsByRowId.get(sourceRow.rowId) ?? {}
        sourcePatch[sourceColumnKey] = ""
        editsByRowId.set(sourceRow.rowId, sourcePatch)

        const targetPatch = editsByRowId.get(targetRow.rowId) ?? {}
        targetPatch[targetColumnKey] = sourceValue
        editsByRowId.set(targetRow.rowId, targetPatch)
        appliedCells += 1
      }
    }

    if (appliedCells === 0) {
      return false
    }

    const updates = Array.from(editsByRowId.entries(), ([rowId, data]) => ({
      rowId,
      data: data as Partial<TRow>,
    }))
    const beforeSnapshot = captureRowsSnapshotForRanges([baseRange, targetRange])

    try {
      await Promise.resolve(options.runtime.api.rows.applyEdits(updates))
    } catch (error) {
      options.reportFillWarning?.(
        error instanceof Error ? error.message : "range move commit failed",
      )
      return false
    }

    const afterSnapshot = captureRowsSnapshotForRanges([baseRange, targetRange])
    void options.recordIntentTransaction({
      intent: "move",
      label: blockedCells > 0
        ? `Move ${appliedCells} cells (blocked ${blockedCells})`
        : `Move ${appliedCells} cells`,
      affectedRange: targetRange,
    }, beforeSnapshot, afterSnapshot)
    options.applySelectionRange(targetRange)
    options.syncViewport()
    return true
  }

  const rangeMutationEngine = useDataGridRangeMutationEngine<
    DataGridAppRowWithId<TRow>,
    { rowId: string },
    TSnapshot,
    DataGridCopyRange
  >({
    resolveRangeMoveBaseRange: () => rangeMoveBaseRange.value,
    resolveRangeMovePreviewRange: () => rangeMovePreviewRange.value,
    resolveFillBaseRange: () => fillBaseRange.value,
    resolveFillPreviewRange: () => fillPreviewRange.value,
    areRangesEqual: options.rangesEqual,
    captureBeforeSnapshot: options.captureRowsSnapshot,
    resolveSourceRows: resolveBaseDataRows,
    resolveSourceRowId: row => String(row.rowId),
    applySourceRows: nextRows => {
      options.runtime.api.rows.setData(nextRows.map((row, index) => ({
        rowId: row.rowId,
        originalIndex: index,
        row: options.cloneRowData(row),
      })))
      options.syncViewport()
    },
    resolveDisplayedRows: () => resolveBaseDataRows().map(row => ({ rowId: String(row.rowId) })),
    resolveDisplayedRowId: row => row.rowId,
    resolveColumnKeyAtIndex: columnIndex => options.visibleColumns.value[columnIndex]?.key ?? null,
    resolveDisplayedCellValue: (row, columnKey) => {
      const rowIndex = resolveBodyRowIndexById(row.rowId)
      const node = rowIndex >= 0 ? getBodyRowAtIndex(rowIndex) : null
      if (!node || node.kind === "group") {
        return ""
      }
      return (node.data as Record<string, unknown>)[columnKey]
    },
    resolveSourceCellValue: (row, columnKey) => row[columnKey],
    normalizeClipboardValue: value => String(value ?? ""),
    isEditableColumn: () => true,
    applyValueForMove: (row, columnKey, value) => {
      ;(row as Record<string, unknown>)[columnKey] = value
      return true
    },
    clearValueForMove: (row, columnKey) => {
      ;(row as Record<string, unknown>)[columnKey] = ""
      return true
    },
    applyEditedValue: (row, columnKey, draft) => {
      ;(row as Record<string, unknown>)[columnKey] = draft
    },
    recomputeDerived: () => undefined,
    isCellWithinRange: (rowIndex, columnIndex, range) => {
      return isCoordInsideRange({ rowIndex, columnIndex, rowId: null }, range)
    },
    setSelectionFromRange: (range, activePosition) => {
      applySelectionRangeWithActivePosition(range, activePosition)
    },
    recordIntent: (descriptor, beforeSnapshot, afterSnapshotOverride) => {
      void options.recordIntentTransaction({
        intent: descriptor.intent,
        label: descriptor.label,
        affectedRange: descriptor.affectedRange ?? null,
      }, beforeSnapshot, afterSnapshotOverride)
    },
    setLastAction: () => undefined,
  })

  const {
    applyFillRange,
    isCellInFillPreview,
    isFillHandleCell,
  } = useDataGridAppFill({
    mode: options.mode,
    viewportRowStart: options.viewportRowStart,
    isFillDragging,
    fillBaseRange,
    fillPreviewRange,
    activeFillBehavior,
    resolveSelectionRange: options.resolveSelectionRange,
    rangesEqual: options.rangesEqual,
    buildFillMatrixFromRange: options.buildFillMatrixFromRange,
    shouldUseServerFill: (_baseRange, _previewRange) => {
      const controllerRowModel = options.runtimeRowModel as
        | { dataSource?: { commitFillOperation?: unknown; resolveFillBoundary?: unknown } }
        | null
        | undefined
      const runtimeRowModelFromRuntime = (options.runtime.rowModel as
        | { dataSource?: { commitFillOperation?: unknown; resolveFillBoundary?: unknown } }
        | undefined)?.dataSource
      options.reportFillPlumbingState?.("controller_runtimeRowModel_exists", controllerRowModel != null)
      options.reportFillPlumbingState?.("controller_runtimeRowModel_dataSource_exists", controllerRowModel?.dataSource != null)
      options.reportFillPlumbingState?.("controller_runtimeRowModel_dataSource_keys", Object.keys(controllerRowModel?.dataSource ?? {}).length > 0)
      options.reportFillPlumbingDetail?.("controller_runtimeRowModel_dataSource_keys", Object.keys(controllerRowModel?.dataSource ?? {}).join(","))
      options.reportFillPlumbingState?.("controller_runtimeRowModel_commit_type", typeof controllerRowModel?.dataSource?.commitFillOperation === "function")
      options.reportFillPlumbingState?.("controller_runtime_rowModel_keys", Object.keys(runtimeRowModelFromRuntime ?? {}).length > 0)
      options.reportFillPlumbingDetail?.("controller_runtime_rowModel_keys", Object.keys(runtimeRowModelFromRuntime ?? {}).join(","))
      options.reportFillPlumbingState?.("controller_runtime_rowModel_commit_type", typeof runtimeRowModelFromRuntime?.commitFillOperation === "function")
      const dataSource = resolveServerFillDataSource()
      options.reportFillPlumbingState?.("commitFillOperation_available", typeof dataSource?.commitFillOperation === "function")
      options.reportFillPlumbingState?.("server_fill_dispatch_attempted", true)
      return typeof dataSource?.commitFillOperation === "function"
    },
    commitServerFill: async ({ baseRange, previewRange, behavior }) => {
      lastServerFillMaterializationWarning = null
      const serverFillBehavior = resolveServerFillCommitBehavior(behavior)
      if (serverFillBehavior.downgraded) {
        options.reportFillWarning?.(SERVER_FILL_SERIES_UNSUPPORTED_WARNING)
        options.reportFillPlumbingState?.("server_fill_series_downgraded_to_copy", true)
      }
      const clearCurrentFillPreview = (): void => {
        clearFillPreviewState(baseRange, previewRange)
      }
      const dataSource = resolveServerFillDataSource()
      if (!dataSource?.commitFillOperation) {
        options.reportFillWarning?.("server fill execution not implemented yet")
        clearCurrentFillPreview()
        return null
      }
      const snapshot = options.runtime.api.rows.getSnapshot() as {
        sortModel?: readonly DataGridSortState[]
        filterModel?: DataGridFilterSnapshot | null
        groupBy?: DataGridGroupBySpec | null
        groupExpansion?: DataGridGroupExpansionSnapshot
        pagination?: DataGridPaginationSnapshot
      }
      const operationId = `fill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const sourceMatrix = options.buildFillMatrixFromRange(baseRange)
      const fillMatrix = buildDataGridFillMatrix({
        baseRange,
        previewRange,
        sourceMatrix,
        behavior: serverFillBehavior.behavior,
      })
      const materializedTargetRowIds: Array<string | number> = []
      const optimisticUpdatesByRowId = new Map<string | number, Record<string, unknown>>()
      let optimisticFillCandidate = options.captureRowsSnapshotForRowIds != null

      if (optimisticFillCandidate) {
        for (let rowIndex = previewRange.startRow; rowIndex <= previewRange.endRow; rowIndex += 1) {
          const targetRow = getBodyRowAtIndex(rowIndex)
          const isMaterialized = options.isRowMaterializedAtIndex
            ? options.isRowMaterializedAtIndex(rowIndex)
            : !!targetRow && (targetRow as { __placeholder?: boolean }).__placeholder !== true
          if (!isMaterialized || !targetRow || targetRow.kind === "group" || targetRow.rowId == null || (targetRow as { __placeholder?: boolean }).__placeholder === true) {
            optimisticFillCandidate = false
            break
          }
          materializedTargetRowIds.push(targetRow.rowId)
          for (let columnIndex = previewRange.startColumn; columnIndex <= previewRange.endColumn; columnIndex += 1) {
            const columnKey = options.visibleColumns.value[columnIndex]?.key
            if (!columnKey || columnKey === ROW_SELECTION_COLUMN_KEY) {
              continue
            }
            const rowOffset = rowIndex - previewRange.startRow
            const columnOffset = columnIndex - previewRange.startColumn
            const nextValue = fillMatrix[rowOffset]?.[columnOffset] ?? ""
            const current = optimisticUpdatesByRowId.get(targetRow.rowId) ?? {}
            current[columnKey] = nextValue
            optimisticUpdatesByRowId.set(targetRow.rowId, current)
          }
        }
      }

      const sourceResolution = resolveProjectedFillRowIds(baseRange)
      reportProjectedFillRowIdResolution("source", sourceResolution)
      if (!sourceResolution.fullyMaterialized) {
        options.reportFillWarning?.(`server fill source row ids are not fully materialized (${sourceResolution.missingCount} source rows missing)`)
        clearCurrentFillPreview()
        return null
      }
      const sourceRowIds = sourceResolution.rowIds

      let targetResolution = resolveProjectedFillRowIds(previewRange)
      reportProjectedFillRowIdResolution("target", targetResolution)
      if (!targetResolution.fullyMaterialized) {
        const materialized = await materializeProjectedFillRows(previewRange)
        if (materialized) {
          targetResolution = resolveProjectedFillRowIds(previewRange)
          reportProjectedFillRowIdResolution("target", targetResolution)
        }
      }

      const missingTargetRows = targetResolution.missingCount
      const boundedTargetEndRow = targetResolution.lastResolvedRowIndex
      if (boundedTargetEndRow == null || boundedTargetEndRow <= baseRange.endRow || targetResolution.rowIds.length <= sourceRowIds.length) {
        options.reportFillWarning?.(`server fill target row ids are not fully materialized (${missingTargetRows} target rows missing)`)
        clearCurrentFillPreview()
        return null
      }

      const commitTargetRange = targetResolution.fullyMaterialized
        ? previewRange
        : options.normalizeClipboardRange({
          ...previewRange,
          endRow: boundedTargetEndRow,
        }) ?? {
          ...previewRange,
          endRow: boundedTargetEndRow,
        }
      const targetRowIds = targetResolution.rowIds
      const partialMaterializedWarning = targetResolution.fullyMaterialized
        ? null
        : `Fill applied only to loaded rows; server range was truncated/not fully materialized (${missingTargetRows} target rows missing).`
      if (partialMaterializedWarning) {
        lastServerFillMaterializationWarning = partialMaterializedWarning
        options.reportFillPlumbingState?.("server_fill_bounded_to_materialized_rows", true)
        options.reportFillPlumbingDetail?.("server_fill_bounded_target_range", `${commitTargetRange.startRow}..${commitTargetRange.endRow}`)
      }

      let optimisticRollbackUpdates: Array<{ rowId: string | number; data: Partial<TRow> }> | null = null
      if (optimisticFillCandidate && materializedTargetRowIds.length > 0 && optimisticUpdatesByRowId.size > 0) {
        const baselineSnapshot = options.captureRowsSnapshotForRowIds?.(materializedTargetRowIds) as
          | { rows?: Array<{ rowId: string | number; row: TRow }> }
          | null
          | undefined
        const baselineRows = baselineSnapshot?.rows ?? []
        if (baselineRows.length === materializedTargetRowIds.length) {
          const baselineByRowId = new Map<string | number, TRow>()
          for (const entry of baselineRows) {
            baselineByRowId.set(entry.rowId, entry.row)
          }
          optimisticRollbackUpdates = materializedTargetRowIds.flatMap(rowId => {
            const row = baselineByRowId.get(rowId)
            return row ? [{ rowId, data: row as Partial<TRow> }] : []
          })
          if (optimisticRollbackUpdates.length > 0) {
            options.reportFillPlumbingState?.("server_fill_optimistic_applied", true)
            await Promise.resolve(options.runtime.api.rows.applyEdits(Array.from(optimisticUpdatesByRowId.entries()).map(([rowId, data]) => ({
              rowId,
              data: data as Partial<TRow>,
            }))))
          }
          else {
            optimisticRollbackUpdates = null
          }
        }
        else {
          optimisticFillCandidate = false
        }
      }

      let result: Awaited<ReturnType<NonNullable<typeof dataSource.commitFillOperation>>> | null = null
      try {
        result = await dataSource.commitFillOperation({
          operationId,
          projection: {
            sortModel: snapshot.sortModel ?? [],
            filterModel: snapshot.filterModel ?? null,
            groupBy: snapshot.groupBy ?? null,
            groupExpansion: snapshot.groupExpansion ?? { expandedByDefault: false, toggledGroupKeys: [] },
            treeData: null,
            pivot: null,
            pagination: snapshot.pagination ?? {
              enabled: false,
              pageSize: 0,
              currentPage: 0,
              pageCount: 0,
              totalRowCount: 0,
              startIndex: 0,
              endIndex: 0,
            },
          },
          sourceRange: baseRange,
          targetRange: commitTargetRange,
          sourceRowIds,
          targetRowIds,
          fillColumns: options.visibleColumns.value
            .slice(previewRange.startColumn, previewRange.endColumn + 1)
            .map(column => String(column.key)),
          referenceColumns: options.visibleColumns.value
            .slice(baseRange.startColumn, baseRange.endColumn + 1)
            .map(column => String(column.key)),
          mode: serverFillBehavior.behavior,
          metadata: { origin: "double-click-fill", behaviorSource: "default" },
        })
        options.reportFillPlumbingState?.("commitFillOperation_called", true)
        options.reportFillPlumbingState?.("server_fill_operationId", true)
      }
      catch {
        if (optimisticRollbackUpdates && optimisticRollbackUpdates.length > 0) {
          await Promise.resolve(options.runtime.api.rows.applyEdits(optimisticRollbackUpdates))
        }
        options.reportFillWarning?.("server fill commit failed")
        return null
      }
      finally {
        clearCurrentFillPreview()
      }
      if (!result) {
        if (optimisticRollbackUpdates && optimisticRollbackUpdates.length > 0) {
          await Promise.resolve(options.runtime.api.rows.applyEdits(optimisticRollbackUpdates))
        }
        options.reportFillWarning?.("server fill commit failed")
        return null
      }
      const affectedRowCount = result.affectedRowCount ?? 0
      const affectedCellCount = result.affectedCellCount ?? affectedRowCount
      const warnings = result.warnings ?? []
      if (affectedCellCount <= 0) {
        if (optimisticRollbackUpdates && optimisticRollbackUpdates.length > 0) {
          await Promise.resolve(options.runtime.api.rows.applyEdits(optimisticRollbackUpdates))
        }
        options.reportFillWarning?.(warnings[0] ?? "server fill no-op")
        options.reportFillPlumbingState?.("server_fill_affectedRowCount", false)
        return null
      }
      const committedOperationId = normalizeServerFillOperationId(result.operationId)
      const invalidationRange = result.invalidation?.kind === "range" ? result.invalidation.range : commitTargetRange
      const normalizedInvalidationRange = normalizeServerFillInvalidationRange(invalidationRange)
      options.reportFillPlumbingDetail?.("server_fill_raw_invalidation", JSON.stringify(invalidationRange ?? null))
      options.reportFillPlumbingDetail?.("server_fill_normalized_invalidation", normalizedInvalidationRange ? `${normalizedInvalidationRange.start}..${normalizedInvalidationRange.end}` : "none")
      options.reportFillPlumbingDetail?.("server_fill_affected_range", formatServerFillAffectedRange(normalizedInvalidationRange ?? invalidationRange, previewRange))
      if (!committedOperationId) {
        options.reportFillWarning?.("server fill committed without operation id; undo/redo disabled")
        options.reportFillPlumbingState?.("server_fill_operationId", false)
        if (options.refreshServerFillViewport) {
          await Promise.resolve(options.refreshServerFillViewport(result.invalidation?.kind === "range" ? result.invalidation.range : invalidationRange))
        }
        else {
          const runtimeRowModel = options.runtimeRowModel as unknown as {
            invalidateRange?: (range: { start: number; end: number }) => void
          } | undefined
          const runtimeRowModelFallback = options.runtime.rowModel as unknown as {
            invalidateRange?: (range: { start: number; end: number }) => void
          } | undefined
          const rowsApi = options.runtime.api.rows as unknown as {
            refresh?: () => void | Promise<void>
          }
          const invalidateTarget = runtimeRowModel?.invalidateRange ?? runtimeRowModelFallback?.invalidateRange
          if (normalizedInvalidationRange && typeof invalidateTarget === "function") {
            invalidateTarget(normalizedInvalidationRange)
            options.reportFillPlumbingState?.("server_fill_invalidation_applied", true)
          }
          await Promise.resolve(rowsApi.refresh?.())
        }
        return null
      }
      options.reportFillWarning?.(
        warnings[0] ?? partialMaterializedWarning ?? "server fill committed",
      )
      options.reportFillPlumbingState?.("server_fill_affectedRowCount", true)
      options.reportFillPlumbingState?.("server-fill-committed", true)
      if (!options.refreshServerFillViewport) {
        const runtimeRowModel = options.runtimeRowModel as unknown as {
          invalidateRange?: (range: { start: number; end: number }) => void
        } | undefined
        const runtimeRowModelFallback = options.runtime.rowModel as unknown as {
          invalidateRange?: (range: { start: number; end: number }) => void
        } | undefined
        const rowsApi = options.runtime.api.rows as unknown as {
          refresh?: () => void | Promise<void>
        }
        const invalidateTarget = runtimeRowModel?.invalidateRange ?? runtimeRowModelFallback?.invalidateRange
        if (normalizedInvalidationRange && typeof invalidateTarget === "function") {
          invalidateTarget(normalizedInvalidationRange)
          options.reportFillPlumbingState?.("server_fill_invalidation_applied", true)
        }
        await Promise.resolve(rowsApi.refresh?.())
      }
      return {
        operationId: committedOperationId,
        revision: result.revision,
        affectedRange: invalidationRange,
        invalidation: result.invalidation ?? null,
        affectedRowCount,
        affectedCellCount,
        warnings,
      }
    },
    applyClipboardEdits: options.applyClipboardEdits,
    isCellEditableAt: (rowIndex, columnIndex) => {
      const row = getBodyRowAtIndex(rowIndex)
      const columnKey = options.visibleColumns.value[columnIndex]?.key
      if (!row || !columnKey) {
        return false
      }
      return options.isCellEditable(row, rowIndex, columnKey, columnIndex)
    },
    setLastAppliedFillSession: session => {
      lastAppliedFill.value = session
      activeFillBehavior.value = session?.behavior ?? activeFillBehavior.value
    },
    setLastServerFillSession: session => {
      if (!session) {
        return
      }
      options.recordServerFillTransaction?.({
        intent: "fill",
        label: "Server fill",
        affectedRange: session.affectedRange ?? null,
        operationId: session.operationId,
        revision: session.revision,
        mode: session.behavior,
      })
    },
    syncServerFillViewport: options.refreshServerFillViewport,
    syncViewport: options.syncViewport,
  })

  const applyCommittedFillRange = async (
    baseRange: DataGridCopyRange,
    previewRange: DataGridCopyRange,
    behavior?: DataGridFillBehavior,
  ): Promise<boolean> => {
    const resolveRemovedFillRange = (
      previousRange: DataGridCopyRange,
      nextRange: DataGridCopyRange,
    ): DataGridCopyRange | null => {
      if (options.rangesEqual(previousRange, nextRange)) {
        return null
      }
      const nextWithinPrevious = (
        nextRange.startRow >= previousRange.startRow
        && nextRange.endRow <= previousRange.endRow
        && nextRange.startColumn >= previousRange.startColumn
        && nextRange.endColumn <= previousRange.endColumn
      )
      if (!nextWithinPrevious) {
        return null
      }
      if (
        previousRange.startColumn === nextRange.startColumn
        && previousRange.endColumn === nextRange.endColumn
      ) {
        if (previousRange.startRow === nextRange.startRow && previousRange.endRow > nextRange.endRow) {
          return {
            startRow: nextRange.endRow + 1,
            endRow: previousRange.endRow,
            startColumn: previousRange.startColumn,
            endColumn: previousRange.endColumn,
          }
        }
        if (previousRange.endRow === nextRange.endRow && previousRange.startRow < nextRange.startRow) {
          return {
            startRow: previousRange.startRow,
            endRow: nextRange.startRow - 1,
            startColumn: previousRange.startColumn,
            endColumn: previousRange.endColumn,
          }
        }
      }
      if (
        previousRange.startRow === nextRange.startRow
        && previousRange.endRow === nextRange.endRow
      ) {
        if (previousRange.startColumn === nextRange.startColumn && previousRange.endColumn > nextRange.endColumn) {
          return {
            startRow: previousRange.startRow,
            endRow: previousRange.endRow,
            startColumn: nextRange.endColumn + 1,
            endColumn: previousRange.endColumn,
          }
        }
        if (previousRange.endColumn === nextRange.endColumn && previousRange.startColumn < nextRange.startColumn) {
          return {
            startRow: previousRange.startRow,
            endRow: previousRange.endRow,
            startColumn: previousRange.startColumn,
            endColumn: nextRange.startColumn - 1,
          }
        }
      }
      return null
    }

    const restartSession = activeRestartFillSession.value
    if (restartSession && options.rangesEqual(restartSession.baseRange, baseRange)) {
      const removedRange = resolveRemovedFillRange(restartSession.previewRange, previewRange)
      if (removedRange) {
        const beforeSnapshot = captureRowsSnapshotForRanges([removedRange, previewRange])
        const sourceMatrix = options.buildFillMatrixFromRange(baseRange)
        const resolvedBehavior = behavior
          ?? activeFillBehavior.value
          ?? restartSession.behavior
          ?? resolveDataGridDefaultFillBehavior({
            baseRange,
            previewRange,
            sourceMatrix,
          })

        await options.applyClipboardEdits(removedRange, [[""]], { recordHistory: false })

        if (options.rangesEqual(baseRange, previewRange)) {
          options.applySelectionRange(baseRange)
          lastAppliedFill.value = null
        } else {
          await options.applyClipboardEdits(previewRange, buildDataGridFillMatrix({
            baseRange,
            previewRange,
            sourceMatrix,
            behavior: resolvedBehavior,
          }), { recordHistory: false })
          lastAppliedFill.value = {
            baseRange: { ...baseRange },
            previewRange: { ...previewRange },
            behavior: resolvedBehavior,
            allowBehaviorToggle: canToggleDataGridFillBehavior({
              baseRange,
              previewRange,
              sourceMatrix,
            }),
          }
        }

        const afterSnapshot = captureRowsSnapshotForRanges([removedRange, previewRange])
        options.syncViewport()
        void options.recordIntentTransaction({
          intent: "fill",
          label: "Fill edit",
          affectedRange: previewRange,
        }, beforeSnapshot, afterSnapshot)
        if (behavior) {
          activeFillBehavior.value = behavior
        }
        return true
      }
    }

    const applied = await applyFillRange(baseRange, previewRange, behavior)
    if (applied && behavior) {
      activeFillBehavior.value = behavior
    }
    return applied
  }

  const resolveCellCoordFromElement = (element: HTMLElement | null): DataGridAppCellCoord | null => {
    if (!element) {
      return null
    }
    const rowIndex = Number.parseInt(element.dataset.rowIndex ?? "", 10)
    const columnIndex = Number.parseInt(element.dataset.columnIndex ?? "", 10)
    if (!Number.isFinite(rowIndex) || !Number.isFinite(columnIndex)) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex,
      columnIndex,
      rowId: getBodyRowAtIndex(rowIndex)?.rowId ?? null,
    })
  }

  const pointerCellCoordResolver = useDataGridPointerCellCoordResolver<DataGridAppCellCoord>({
    resolveViewportElement: () => {
      const bodyViewport = options.bodyViewportRef.value
      const bodyShell = bodyViewport?.closest(".grid-body-shell")
      if (!(bodyViewport instanceof HTMLElement) || !(bodyShell instanceof HTMLElement)) {
        return bodyViewport
      }
      return {
        scrollTop: bodyViewport.scrollTop,
        scrollLeft: bodyViewport.scrollLeft,
        getBoundingClientRect: () => {
          const rect = bodyShell.getBoundingClientRect()
          const indexInset = Math.max(0, Math.min(options.indexColumnWidth ?? 0, rect.width))
          const width = Math.max(0, rect.width - indexInset)
          const left = rect.left + indexInset
          return {
            left,
            top: rect.top,
            width,
            height: rect.height,
            right: left + width,
            bottom: rect.bottom,
            x: left,
            y: rect.top,
            toJSON: () => ({}),
          }
        },
      } as unknown as HTMLElement
    },
    resolveColumnMetrics: () => {
      let currentOffset = 0
      return options.visibleColumns.value.map((column, columnIndex) => {
        const width = options.resolveColumnWidth(column)
        const start = currentOffset
        currentOffset += width
        return {
          columnIndex,
          start,
          end: currentOffset,
          width,
        }
      })
    },
    resolveColumns: () => options.visibleColumns.value,
    resolveVirtualWindow: () => ({
      rowTotal: options.totalRows.value,
      colTotal: options.visibleColumns.value.length,
    }),
    resolveHeaderHeight: () => 0,
    resolveRowHeight: () => options.resolveRowHeight(0),
    resolveRowIndexAtOffset: offset => options.resolveRowIndexAtOffset(offset),
    resolveNearestNavigableColumnIndex: columnIndex => {
      const lastColumnIndex = Math.max(0, options.visibleColumns.value.length - 1)
      return Math.max(0, Math.min(lastColumnIndex, columnIndex))
    },
    normalizeCellCoord: coord => options.normalizeCellCoord({
      ...coord,
      rowId: getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null,
    }),
  })

  const resolveCellCoordFromPointer = (clientX: number, clientY: number): DataGridAppCellCoord | null => {
    if (typeof document !== "undefined" && typeof document.elementFromPoint === "function") {
      const pointerTarget = document.elementFromPoint(clientX, clientY)
      const pointerCell = pointerTarget instanceof HTMLElement
        ? pointerTarget.closest<HTMLElement>(".grid-cell[data-row-index][data-column-index]")
        : null
      const domResolvedCoord = resolveCellCoordFromElement(pointerCell)
      if (domResolvedCoord) {
        return domResolvedCoord
      }
    }
    return pointerCellCoordResolver.resolveCellCoordFromPointer(clientX, clientY)
  }

  const resolveSelectionFocusCoord = (): DataGridAppCellCoord | null => {
    const snapshot = options.selectionSnapshot.value
    const activeRange = snapshot?.ranges[snapshot.activeRangeIndex ?? 0] ?? snapshot?.ranges[0] ?? null
    const focus = activeRange?.focus
    if (!focus) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex: focus.rowIndex,
      columnIndex: focus.colIndex,
      rowId: options.normalizeRowId(focus.rowId),
    })
  }

  const cellNavigation = useDataGridCellNavigation<DataGridAppCellCoord>({
    resolveCurrentCellCoord: () => {
      if (keyboardNavigationExtendsSelection.value) {
        const focusCoord = resolveSelectionFocusCoord()
        if (focusCoord) {
          return focusCoord
        }
      }
      const anchorCoord = resolveSelectionAnchorCoord()
      if (anchorCoord) {
        return anchorCoord
      }
      const activeCell = options.selectionSnapshot.value?.activeCell
      if (!activeCell) {
        return null
      }
      return options.normalizeCellCoord({
        rowIndex: activeCell.rowIndex,
        columnIndex: activeCell.colIndex,
        rowId: options.normalizeRowId(activeCell.rowId),
      })
    },
    resolveTabTarget: (current, backwards) => {
      const lastRow = Math.max(0, options.totalRows.value - 1)
      const lastColumn = Math.max(0, options.visibleColumns.value.length - 1)
      if (backwards) {
        if (current.columnIndex > 0) {
          return { ...current, columnIndex: current.columnIndex - 1 }
        }
        if (current.rowIndex <= 0) {
          return current
        }
        return { ...current, rowIndex: current.rowIndex - 1, columnIndex: lastColumn }
      }
      if (current.columnIndex < lastColumn) {
        return { ...current, columnIndex: current.columnIndex + 1 }
      }
      if (current.rowIndex >= lastRow) {
        return current
      }
      return { ...current, rowIndex: current.rowIndex + 1, columnIndex: 0 }
    },
    normalizeCellCoord: coord => options.normalizeCellCoord({
      ...coord,
      rowId: getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null,
    }),
    getAdjacentNavigableColumnIndex: (columnIndex, direction) => {
      const lastColumn = Math.max(0, options.visibleColumns.value.length - 1)
      return Math.max(0, Math.min(lastColumn, columnIndex + direction))
    },
    getFirstNavigableColumnIndex: () => 0,
    getLastNavigableColumnIndex: () => Math.max(0, options.visibleColumns.value.length - 1),
    getLastRowIndex: () => Math.max(0, options.totalRows.value - 1),
    resolveStepRows: () => 20,
    closeContextMenu,
    clearCellSelection: () => {
      options.clearCellSelection()
    },
    setLastAction: () => undefined,
    resolveDirectionalJumpTarget: (current, direction, event) => {
      return resolveDirectionalSemanticJumpTarget(current, direction, event)
    },
    applyCellSelection: (nextCoord, extend, fallbackAnchor) => {
      options.applyCellSelectionByCoord(nextCoord, extend, fallbackAnchor)
    },
    onNavigationApplied: nextCoord => {
      void nextTick(() => {
        options.ensureKeyboardActiveCellVisible(nextCoord.rowIndex, nextCoord.columnIndex)
      })
    },
  })

  const dragPointerSelection = useDataGridDragPointerSelection<DataGridAppCellCoord>({
    isDragSelecting: () => isPointerSelectingCells.value,
    resolveDragPointer: () => dragPointer.value,
    resolveCellCoordFromPointer,
    resolveLastDragCoord: () => lastDragCoord.value,
    setLastDragCoord: coord => {
      lastDragCoord.value = coord
    },
    cellCoordsEqual: (left, right) => (
      left?.rowIndex === right?.rowIndex
      && left?.columnIndex === right?.columnIndex
    ),
    applyCellSelection: (coord, extend, fallbackAnchor) => {
      options.applyCellSelectionByCoord(coord, extend, fallbackAnchor)
    },
  })

  const pointerPreviewRouter = useDataGridPointerPreviewRouter<DataGridAppCellCoord, DataGridCopyRange>({
    isFillDragging: () => isFillDragging.value,
    resolveFillDragStartPointer: () => fillDragStartPointer.value,
    resolveFillPointer: () => fillPointer.value,
    resolveFillBaseRange: () => fillBaseRange.value,
    resolveFillPreviewRange: () => fillPreviewRange.value,
    setFillPreviewRange: range => {
      fillPreviewRange.value = options.normalizeClipboardRange(range)
    },
    isRangeMoving: () => isRangeMoving.value,
    resolveRangeMovePointer: () => rangeMovePointer.value,
    resolveRangeMoveBaseRange: () => rangeMoveBaseRange.value,
    resolveRangeMoveOrigin: () => rangeMoveOrigin.value,
    resolveRangeMovePreviewRange: () => rangeMovePreviewRange.value,
    setRangeMovePreviewRange: range => {
      rangeMovePreviewRange.value = options.normalizeClipboardRange(range)
    },
    resolveCellCoordFromPointer,
    buildExtendedRange: (baseRange, coord, fillAxis) => {
      const rowDistance = Math.abs(coord.rowIndex - baseRange.endRow)
      const columnDistance = Math.abs(coord.columnIndex - baseRange.endColumn)
      const resolvedFillAxis = fillAxis ?? (rowDistance >= columnDistance ? "vertical" : "horizontal")
      if (resolvedFillAxis === "vertical") {
        return options.normalizeClipboardRange({
          startRow: Math.min(baseRange.startRow, coord.rowIndex),
          endRow: Math.max(baseRange.endRow, coord.rowIndex),
          startColumn: baseRange.startColumn,
          endColumn: baseRange.endColumn,
        })
      }
      return options.normalizeClipboardRange({
        startRow: baseRange.startRow,
        endRow: baseRange.endRow,
        startColumn: Math.min(baseRange.startColumn, coord.columnIndex),
        endColumn: Math.max(baseRange.endColumn, coord.columnIndex),
      })
    },
    normalizeSelectionRange: range => options.normalizeClipboardRange(range),
    rangesEqual: options.rangesEqual,
  })

  const axisAutoScroll = useDataGridAxisAutoScrollDelta({
    edgePx: 28,
    maxStepPx: 22,
  })

  const pointerAutoScroll = useDataGridPointerAutoScroll({
    resolveInteractionState: () => ({
      isDragSelecting: options.mode.value === "base" && isPointerSelectingCells.value,
      isFillDragging: options.mode.value === "base" && isFillDragging.value,
      isRangeMoving: options.mode.value === "base" && isRangeMoving.value,
    }),
    resolveRangeMovePointer: () => rangeMovePointer.value,
    resolveFillPointer: () => fillPointer.value,
    resolveDragPointer: () => dragPointer.value,
    resolveAllowHorizontalAutoScroll: () => {
      if (!isPointerSelectingCells.value) {
        return true
      }
      return dragSelectionOriginPin.value === null || dragSelectionOriginPin.value === "center"
    },
    resolveViewportElement: () => options.bodyViewportRef.value,
    resolveHeaderHeight: () => 0,
    resolveAxisAutoScrollDelta: axisAutoScroll.resolveAxisAutoScrollDelta,
    setScrollPosition: () => {
      options.syncViewport()
    },
    applyRangeMovePreviewFromPointer: () => {
      pointerPreviewRouter.applyRangeMovePreviewFromPointer()
    },
    applyFillPreviewFromPointer: () => {
      pointerPreviewRouter.applyFillPreviewFromPointer()
    },
    applyDragSelectionFromPointer: () => {
      dragPointerSelection.applyDragSelectionFromPointer()
    },
  })

  const fillSelectionLifecycle = useDataGridFillSelectionLifecycle<DataGridCopyRange>({
    applyFillPreview: () => {
      const baseRange = fillBaseRange.value
      const previewRange = fillPreviewRange.value
      if (!baseRange || !previewRange) {
        return
      }
    void applyCommittedFillRange(baseRange, previewRange)
    },
    setFillDragging: value => {
      isFillDragging.value = value
    },
    clearFillDragStartPointer: () => {
      fillDragStartPointer.value = null
    },
    clearFillPointer: () => {
      fillPointer.value = null
    },
    clearFillBaseRange: () => {
      fillBaseRange.value = null
    },
    clearFillPreviewRange: () => {
      fillPreviewRange.value = null
    },
    stopAutoScrollFrameIfIdle: () => {
      pointerAutoScroll.stopAutoScrollFrameIfIdle()
    },
    resolveFillPreviewRange: () => fillPreviewRange.value,
  })

  const stopFillSelection = (commit: boolean): void => {
    const preferredFocusCoord = fillOriginFocusCoord.value
    fillSelectionLifecycle.stopFillSelection(commit)
    activeRestartFillSession.value = null
    const restoredCoord = preferredFocusCoord
      ? restoreSelectionActiveCellToCoord(preferredFocusCoord)
      : null
    fillOriginFocusCoord.value = null
    restoreActiveCellFocus(restoredCoord ?? preferredFocusCoord)
  }

  const resolveSelectionAnchorCoord = (): DataGridAppCellCoord | null => {
    const snapshot = options.selectionSnapshot.value
    const activeRange = snapshot?.ranges[snapshot.activeRangeIndex ?? 0] ?? snapshot?.ranges[0] ?? null
    const anchor = activeRange?.anchor
    if (!anchor) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex: anchor.rowIndex,
      columnIndex: anchor.colIndex,
      rowId: options.normalizeRowId(anchor.rowId),
    })
  }

  const restoreSelectionActiveCellToAnchor = (): DataGridAppCellCoord | null => {
    const snapshot = options.selectionSnapshot.value
    const activeRangeIndex = snapshot?.activeRangeIndex ?? 0
    const activeRange = snapshot?.ranges[activeRangeIndex] ?? snapshot?.ranges[0] ?? null
    const anchor = activeRange?.anchor
    if (!snapshot || !anchor) {
      return null
    }
    const nextSnapshot = {
      ...snapshot,
      activeCell: {
        rowIndex: anchor.rowIndex,
        colIndex: anchor.colIndex,
        rowId: anchor.rowId ?? null,
      },
    }
    options.selectionSnapshot.value = nextSnapshot
    options.runtime.api.selection.setSnapshot(nextSnapshot)
    return options.normalizeCellCoord({
      rowIndex: anchor.rowIndex,
      columnIndex: anchor.colIndex,
      rowId: options.normalizeRowId(anchor.rowId),
    })
  }

  const restoreSelectionActiveCellToCoord = (
    coord: DataGridAppCellCoord | null,
  ): DataGridAppCellCoord | null => {
    const snapshot = options.selectionSnapshot.value
    const normalizedCoord = coord ? options.normalizeCellCoord(coord) : null
    if (!snapshot || !normalizedCoord) {
      return null
    }
    const nextSnapshot = {
      ...snapshot,
      activeCell: {
        rowIndex: normalizedCoord.rowIndex,
        colIndex: normalizedCoord.columnIndex,
        rowId: normalizedCoord.rowId ?? null,
      },
    }
    options.selectionSnapshot.value = nextSnapshot
    options.runtime.api.selection.setSnapshot(nextSnapshot)
    return normalizedCoord
  }

  const applySelectionRangeWithActivePosition = (
    range: DataGridCopyRange,
    activePosition: "start" | "end",
  ): void => {
    options.applySelectionRange(range)
    if (activePosition !== "start") {
      return
    }
    const snapshot = options.selectionSnapshot.value
    const activeRangeIndex = snapshot?.activeRangeIndex ?? 0
    const activeRange = snapshot?.ranges[activeRangeIndex] ?? snapshot?.ranges[0] ?? null
    const anchor = activeRange?.anchor
    if (!snapshot || !anchor) {
      return
    }
    const nextSnapshot = {
      ...snapshot,
      activeCell: {
        rowIndex: anchor.rowIndex,
        colIndex: anchor.colIndex,
        rowId: anchor.rowId ?? null,
      },
    }
    options.selectionSnapshot.value = nextSnapshot
    options.runtime.api.selection.setSnapshot(nextSnapshot)
  }

  const resolveFillOriginFocusCoord = (): DataGridAppCellCoord | null => {
    const anchorCoord = resolveSelectionAnchorCoord()
    if (anchorCoord) {
      return anchorCoord
    }
    const activeCell = options.selectionSnapshot.value?.activeCell
    if (activeCell) {
      return options.normalizeCellCoord({
        rowIndex: activeCell.rowIndex,
        columnIndex: activeCell.colIndex,
        rowId: options.normalizeRowId(activeCell.rowId),
      })
    }
    const range = options.resolveSelectionRange()
    if (!range) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex: range.startRow,
      columnIndex: range.startColumn,
      rowId: getBodyRowAtIndex(range.startRow)?.rowId ?? null,
    })
  }

  const resolveRestartableFillSession = (
    currentRange: DataGridCopyRange,
  ): DataGridAppAppliedFillSession | null => {
    const session = lastAppliedFill.value
    if (!session) {
      return null
    }
    return options.rangesEqual(currentRange, session.previewRange)
      ? session
      : null
  }

  const rangeMoveLifecycle = useDataGridRangeMoveLifecycle({
    applyRangeMove: () => {
      const baseRange = rangeMoveBaseRange.value
      const targetRange = rangeMovePreviewRange.value
      if (options.applyRangeMove && baseRange && targetRange) {
        return options.applyRangeMove(baseRange, targetRange)
      }
      if (baseRange && targetRange && isServerBackedRowModel()) {
        return applyServerBackedRangeMove(baseRange, targetRange)
      }
      return rangeMutationEngine.applyRangeMove()
    },
    setRangeMoving: value => {
      isRangeMoving.value = value
    },
    clearRangeMovePointer: () => {
      rangeMovePointer.value = null
    },
    clearRangeMoveBaseRange: () => {
      rangeMoveBaseRange.value = null
    },
    clearRangeMoveOrigin: () => {
      rangeMoveOrigin.value = null
    },
    clearRangeMovePreviewRange: () => {
      rangeMovePreviewRange.value = null
    },
    stopAutoScrollFrameIfIdle: () => {
      pointerAutoScroll.stopAutoScrollFrameIfIdle()
    },
  })

  const rangeMoveStart = useDataGridRangeMoveStart<DataGridAppCellCoord, DataGridCopyRange>({
    resolveSelectionRange: options.resolveSelectionRange,
    isCoordInsideRange,
    closeContextMenu,
    focusViewport,
    stopDragSelection: () => {
      stopPointerSelection()
    },
    stopFillSelection: applyPreview => {
      stopFillSelection(applyPreview)
    },
    setRangeMoving: value => {
      isRangeMoving.value = value
    },
    setRangeMovePointer: pointer => {
      rangeMovePointer.value = pointer
    },
    setRangeMoveBaseRange: range => {
      rangeMoveBaseRange.value = options.normalizeClipboardRange(range)
    },
    setRangeMoveOrigin: coord => {
      rangeMoveOrigin.value = options.normalizeCellCoord(coord)
    },
    setRangeMovePreviewRange: range => {
      rangeMovePreviewRange.value = options.normalizeClipboardRange(range)
    },
    startInteractionAutoScroll: () => {
      pointerAutoScroll.startInteractionAutoScroll()
    },
    setLastAction: () => undefined,
  })

  const fillHandleStart = useDataGridFillHandleStart<DataGridCopyRange>({
    resolveSelectionRange: options.resolveSelectionRange,
    resolveInitialFillBaseRange: currentRange => {
      return resolveRestartableFillSession(currentRange)?.baseRange ?? currentRange
    },
    resolveInitialFillPreviewRange: currentRange => {
      return resolveRestartableFillSession(currentRange)?.previewRange ?? currentRange
    },
    focusViewport,
    stopRangeMove: commit => {
      rangeMoveLifecycle.stopRangeMove(commit)
    },
    setDragSelecting: value => {
      isPointerSelectingCells.value = value
    },
    setDragPointer: pointer => {
      dragPointer.value = pointer
    },
    setFillDragging: value => {
      isFillDragging.value = value
    },
    setFillBaseRange: range => {
      fillBaseRange.value = range ? options.normalizeClipboardRange(range) : null
    },
    setFillPreviewRange: range => {
      fillPreviewRange.value = range ? options.normalizeClipboardRange(range) : null
    },
    setFillDragStartPointer: pointer => {
      fillDragStartPointer.value = pointer
    },
    setFillPointer: pointer => {
      fillPointer.value = pointer
    },
    startInteractionAutoScroll: () => {
      pointerAutoScroll.startInteractionAutoScroll()
    },
    setLastAction: () => undefined,
  })

  const historyActionRunner = useDataGridHistoryActionRunner({
    hasInlineEditor: () => options.editingCell.value != null,
    commitInlineEdit: () => {
      options.commitInlineEdit()
    },
    closeContextMenu,
    canUndo: options.canUndo,
    canRedo: options.canRedo,
    runHistoryAction: direction => Promise.resolve(options.runHistoryAction(direction) as string | null),
    setLastAction: () => undefined,
  })

  const clearSelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
    if (!supportsCellSelectionMode()) {
      return false
    }
    const rawRange = options.resolveSelectionRange()
    const range = rawRange ? options.normalizeClipboardRange(rawRange) : null
    if (!range) {
      return false
    }
    const missingRowIndex = resolveMissingRowIndexInRange(getBodyRowAtIndex, range)
    if (missingRowIndex != null) {
      options.reportFillWarning?.("Selected range includes unloaded rows. Load rows or use server operation.")
      return false
    }
    const beforeSnapshot = captureRowsSnapshotForRanges([range])
    options.clearPendingClipboardOperation(false)
    const applied = await options.applyClipboardEdits(range, [[""]], { recordHistory: false })
    if (applied <= 0) {
      return false
    }
    const clearedCellCount = (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1)
    options.applySelectionRange(range)
    options.syncViewport()
    void options.recordIntentTransaction({
      intent: "clear",
      label: `Clear ${clearedCellCount} cells`,
      affectedRange: range,
    }, beforeSnapshot)
    void trigger
    return true
  }

  const keyboardCommandRouter = useDataGridKeyboardCommandRouter({
    isRangeMoving: () => isRangeMoving.value,
    isContextMenuVisible,
    closeContextMenu,
    focusViewport,
    openContextMenuFromCurrentCell,
    selectAllCells: () => {
      if (!supportsCellSelectionMode()) {
        return
      }
      const lastRowIndex = options.totalRows.value - 1
      const lastColumnIndex = options.visibleColumns.value.length - 1
      if (lastRowIndex < 0 || lastColumnIndex < 0) {
        return
      }
      options.applySelectionRange({
        startRow: 0,
        endRow: lastRowIndex,
        startColumn: 0,
        endColumn: lastColumnIndex,
      })
      focusViewport()
    },
    runHistoryAction: direction => historyActionRunner.runHistoryAction(direction, "keyboard"),
    copySelection: options.copySelectedCells,
    pasteSelection: options.pasteSelectedCells,
    cutSelection: options.cutSelectedCells,
    clearCurrentSelection: clearSelectedCells,
    stopRangeMove: commit => {
      rangeMoveLifecycle.stopRangeMove(commit)
    },
    setLastAction: () => undefined,
  })

  const cellPointerDownRouter = useDataGridCellPointerDownRouter<
    DataGridRowNode<TRow>,
    DataGridAppCellCoord,
    DataGridCopyRange
  >({
    isSelectionColumn: () => false,
    isRangeMoveModifierActive: event => isRangeMoveEnabled.value && event.button === 0 && !event.shiftKey,
    isEditorInteractionTarget: target => Boolean(target?.closest(".cell-editor-input")),
    hasInlineEditor: () => options.editingCell.value != null,
    commitInlineEdit: () => {
      if (!options.editingCell.value) {
        return false
      }
      options.commitInlineEdit("none")
      return true
    },
    resolveCellCoord: (row, columnKey) => {
      if (row.rowId == null) {
        return null
      }
      const rowIndex = resolveBodyRowIndexById(row.rowId)
      if (rowIndex < 0) {
        return null
      }
      const columnIndex = options.visibleColumns.value.findIndex(column => column.key === columnKey)
      if (columnIndex < 0) {
        return null
      }
      return options.normalizeCellCoord({
        rowIndex,
        columnIndex,
        rowId: row.rowId,
      })
    },
    resolveSelectionRange: options.resolveSelectionRange,
    isCoordInsideRange,
    startRangeMove: (coord, pointer) => {
      if (!isRangeMoveEnabled.value) {
        return
      }
      const row = getBodyRowAtIndex(coord.rowIndex)
      const columnKey = options.visibleColumns.value[coord.columnIndex]?.key
      if (!row || !columnKey || !options.isCellEditable(row, coord.rowIndex, columnKey, coord.columnIndex)) {
        return
      }
      rangeMoveStart.startRangeMove(coord, pointer)
    },
    closeContextMenu,
    focusViewport,
    isFillDragging: () => isFillDragging.value,
    stopFillSelection: commit => {
      stopFillSelection(commit)
    },
    setDragSelecting: value => {
      pendingDragSelection.value = value
      if (!value) {
        clearPendingDragSelection()
      }
    },
    setLastDragCoord: coord => {
      pendingDragCoord.value = coord
    },
    setDragPointer: pointer => {
      pendingDragPointerStart.value = pointer
    },
    applyCellSelection: (coord, extend, fallbackAnchor, additive) => {
      if (additive) {
        options.applyCellSelectionByCoord(coord, extend, fallbackAnchor, true)
        return
      }
      options.applyCellSelectionByCoord(coord, extend, fallbackAnchor)
    },
    startInteractionAutoScroll: () => {
      pointerAutoScroll.startInteractionAutoScroll()
    },
    setLastAction: () => undefined,
  })

  const startFillHandleDrag = (event: MouseEvent): void => {
    if (options.mode.value !== "base" || !isFillHandleEnabled.value) {
      return
    }
    const baseRange = options.resolveSelectionRange()
    const anchorRow = baseRange ? getBodyRowAtIndex(baseRange.endRow) : null
    const anchorColumnKey = baseRange ? options.visibleColumns.value[baseRange.endColumn]?.key : null
    if (!baseRange || !anchorRow || !anchorColumnKey) {
      return
    }
    if (!options.isCellEditable(anchorRow, baseRange.endRow, anchorColumnKey, baseRange.endColumn)) {
      return
    }
    const originCoord = resolveFillOriginFocusCoord()
    const restartSession = resolveRestartableFillSession(baseRange)
    if (fillHandleStart.onSelectionHandleMouseDown(event)) {
      fillPreviewCancelVersion += 1
      activeRestartFillSession.value = restartSession
      fillOriginFocusCoord.value = originCoord
    }
  }

  const isNonEmptyFillReferenceValue = (row: DataGridRowNode<TRow>, columnKey: string): boolean => {
    return options.readCell(row, columnKey).trim().length > 0
  }

  const buildFillProjectionContext = (): DataGridAppFillProjectionContext | null => {
    const getSnapshot = options.runtime.api.rows.getSnapshot
    if (typeof getSnapshot !== "function") {
      return null
    }
    const snapshot = getSnapshot() as {
      sortModel?: DataGridAppFillProjectionContext["sortModel"]
      filterModel?: DataGridAppFillProjectionContext["filterModel"]
      groupBy?: DataGridAppFillProjectionContext["groupBy"]
      groupExpansion?: DataGridAppFillProjectionContext["groupExpansion"]
      pagination?: DataGridAppFillProjectionContext["pagination"]
    } | null
    if (!snapshot) {
      return null
    }
    return {
      sortModel: snapshot.sortModel ?? [],
      filterModel: snapshot.filterModel ?? null,
      groupBy: snapshot.groupBy ?? null,
      groupExpansion: snapshot.groupExpansion ?? { expandedByDefault: false, toggledGroupKeys: [] },
      treeData: null,
      pivot: null,
      pagination: snapshot.pagination ?? {
        enabled: false,
        pageSize: 0,
        currentPage: 0,
        pageCount: 0,
        totalRowCount: 0,
        startIndex: 0,
        endIndex: 0,
      },
    }
  }

  const resolveServerFillDataSource = (): DataGridAppFillDataSource | undefined => {
    const controllerDataSource = (options.runtimeRowModel as
      | { dataSource?: DataGridAppFillDataSource }
      | null
      | undefined)?.dataSource
    const runtimeDataSource = (options.runtime.rowModel as
      | { dataSource?: DataGridAppFillDataSource }
      | undefined)?.dataSource

    if (typeof controllerDataSource?.commitFillOperation === "function") {
      return controllerDataSource
    }
    if (typeof runtimeDataSource?.commitFillOperation === "function") {
      return runtimeDataSource
    }
    if (typeof controllerDataSource?.resolveFillBoundary === "function") {
      return controllerDataSource
    }
    if (typeof runtimeDataSource?.resolveFillBoundary === "function") {
      return runtimeDataSource
    }
    return controllerDataSource ?? runtimeDataSource
  }

  const resolveProjectedFillRowIds = (range: DataGridCopyRange): DataGridAppProjectedFillRowIds => {
    const rowIds: Array<string | number> = []
    const requestedRowCount = Math.max(0, range.endRow - range.startRow + 1)
    let firstMissingRowIndex: number | null = null
    let lastResolvedRowIndex: number | null = null
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
      const isMaterialized = options.isRowMaterializedAtIndex
        ? options.isRowMaterializedAtIndex(rowIndex)
        : !!row && (row as { __placeholder?: boolean }).__placeholder !== true
      if (!isMaterialized || !row || row.kind === "group" || row.rowId == null || (row as { __placeholder?: boolean }).__placeholder === true) {
        firstMissingRowIndex = rowIndex
        break
      }
      rowIds.push(row.rowId)
      lastResolvedRowIndex = rowIndex
    }
    const missingCount = firstMissingRowIndex == null
      ? 0
      : Math.max(0, range.endRow - firstMissingRowIndex + 1)
    return {
      rowIds,
      requestedRowCount,
      missingCount,
      firstMissingRowIndex,
      lastResolvedRowIndex,
      fullyMaterialized: missingCount === 0,
    }
  }

  const reportProjectedFillRowIdResolution = (
    label: "source" | "target",
    resolution: DataGridAppProjectedFillRowIds,
  ): void => {
    options.reportFillPlumbingDetail?.(`server_fill_${label}_rows_requested`, String(resolution.requestedRowCount))
    options.reportFillPlumbingDetail?.(`server_fill_${label}_row_ids_resolved`, String(resolution.rowIds.length))
    options.reportFillPlumbingDetail?.(`server_fill_${label}_row_ids_missing`, String(resolution.missingCount))
    options.reportFillPlumbingDetail?.(
      `server_fill_${label}_first_missing_row_index`,
      resolution.firstMissingRowIndex == null ? "none" : String(resolution.firstMissingRowIndex),
    )
  }

  const materializeProjectedFillRows = async (
    range: DataGridCopyRange,
  ): Promise<boolean> => {
    const normalizedRange = {
      start: Math.max(0, Math.trunc(range.startRow)),
      end: Math.max(Math.max(0, Math.trunc(range.startRow)), Math.trunc(range.endRow)),
    }
    const runtimeWithViewport = options.runtime as unknown as {
      setViewportRange?: (range: { start: number; end: number }) => void
      syncBodyRowsInRange?: (range: { start: number; end: number }) => readonly DataGridRowNode<TRow>[]
    }
    const rowModel = (options.runtimeRowModel ?? options.runtime.rowModel) as unknown as {
      setViewportRange?: (range: { start: number; end: number }) => void
      refresh?: (reason?: string) => Promise<void> | void
    } | null | undefined
    const rowsApi = options.runtime.api.rows as unknown as {
      refresh?: () => Promise<void> | void
    }
    let attempted = false
    try {
      if (typeof runtimeWithViewport.setViewportRange === "function") {
        runtimeWithViewport.setViewportRange(normalizedRange)
        attempted = true
      }
      else if (typeof rowModel?.setViewportRange === "function") {
        rowModel.setViewportRange(normalizedRange)
        attempted = true
      }

      if (typeof rowModel?.refresh === "function") {
        attempted = true
        await Promise.resolve(rowModel.refresh("fill-materialize"))
      }
      else if (typeof rowsApi.refresh === "function") {
        attempted = true
        await Promise.resolve(rowsApi.refresh())
      }

      if (typeof runtimeWithViewport.syncBodyRowsInRange === "function") {
        runtimeWithViewport.syncBodyRowsInRange(normalizedRange)
        attempted = true
      }
    } catch (caught: unknown) {
      options.reportFillPlumbingDetail?.("server_fill_materialize_error", caught instanceof Error ? caught.message : String(caught))
      return false
    }
    options.reportFillPlumbingState?.("server_fill_materialize_attempted", attempted)
    options.reportFillPlumbingDetail?.("server_fill_materialize_range", `${normalizedRange.start}..${normalizedRange.end}`)
    return attempted
  }

  const isAcceptedServerFillBoundaryKind = (
    boundaryKind: DataGridAppResolveFillBoundaryResult["boundaryKind"],
  ): boundaryKind is "data-end" | "gap" | "cache-boundary" => {
    return boundaryKind === "data-end" || boundaryKind === "gap" || boundaryKind === "cache-boundary"
  }

  const resolveReferenceColumnExtentEndRow = (
    baseRange: DataGridCopyRange,
    columnIndex: number,
  ): number => {
    const columnKey = options.visibleColumns.value[columnIndex]?.key
    if (!columnKey) {
      return baseRange.endRow
    }

    for (let rowIndex = baseRange.startRow; rowIndex <= baseRange.endRow; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
      if (!row || row.rowId == null || row.kind === "group") {
        return baseRange.endRow
      }
      if (!isNonEmptyFillReferenceValue(row, columnKey)) {
        return baseRange.endRow
      }
    }

    let contiguousEndRow = baseRange.endRow
    for (let rowIndex = baseRange.endRow + 1; rowIndex < options.totalRows.value; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
      if (!row || row.rowId == null || row.kind === "group") {
        break
      }
      if (!isNonEmptyFillReferenceValue(row, columnKey)) {
        break
      }
      contiguousEndRow = rowIndex
    }

    return contiguousEndRow
  }

  const resolveBestNeighborFillEndRow = (baseRange: DataGridCopyRange): number => {
    const evaluateDirection = (startColumnIndex: number, step: -1 | 1): number => {
      let bestEndRow = baseRange.endRow
      let foundCandidate = false
      for (
        let columnIndex = startColumnIndex;
        columnIndex >= 0 && columnIndex < options.visibleColumns.value.length;
        columnIndex += step
      ) {
        const candidateEndRow = resolveReferenceColumnExtentEndRow(baseRange, columnIndex)
        if (candidateEndRow <= baseRange.endRow) {
          if (foundCandidate) {
            break
          }
          continue
        }
        foundCandidate = true
        bestEndRow = Math.max(bestEndRow, candidateEndRow)
      }
      return bestEndRow
    }

    const leftEndRow = evaluateDirection(baseRange.startColumn - 1, -1)
    if (leftEndRow > baseRange.endRow) {
      return leftEndRow
    }

    return evaluateDirection(baseRange.endColumn + 1, 1)
  }

  const resolveServerAwareFillBoundary = async (
    baseRange: DataGridCopyRange,
  ): Promise<{ endRow: number; boundaryKind: DataGridAppResolveFillBoundaryResult["boundaryKind"]; resolvedByServer: boolean; truncated?: boolean } | null> => {
    if (!options.resolveFillBoundary) {
      options.reportFillPlumbingState?.("interaction_controller_option", false)
      return null
    }
    options.reportFillPlumbingState?.("interaction_controller_option", true)
    const fillColumns: string[] = []
    for (let columnIndex = baseRange.startColumn; columnIndex <= baseRange.endColumn; columnIndex += 1) {
      const columnKey = options.visibleColumns.value[columnIndex]?.key
      if (columnKey) {
        fillColumns.push(columnKey)
      }
    }
    const leftReferenceColumns: string[] = []
    for (let columnIndex = baseRange.startColumn - 1; columnIndex >= 0; columnIndex -= 1) {
      const columnKey = options.visibleColumns.value[columnIndex]?.key
      if (columnKey) {
        leftReferenceColumns.push(columnKey)
      }
    }
    const rightReferenceColumns: string[] = []
    for (let columnIndex = baseRange.endColumn + 1; columnIndex < options.visibleColumns.value.length; columnIndex += 1) {
      const columnKey = options.visibleColumns.value[columnIndex]?.key
      if (columnKey) {
        rightReferenceColumns.push(columnKey)
      }
    }
    const projection = buildFillProjectionContext()
    options.reportFillPlumbingState?.("double_click_fill_columns", fillColumns.length > 0)
    options.reportFillPlumbingState?.("double_click_left_refs", leftReferenceColumns.length > 0)
    options.reportFillPlumbingState?.("double_click_right_refs", rightReferenceColumns.length > 0)
    options.reportFillPlumbingState?.("double_click_projection", projection != null)
    if (!projection) {
      return null
    }
    const resolve = async (referenceColumns: readonly string[], direction: "left" | "right") => {
      if (referenceColumns.length === 0) {
        options.reportFillPlumbingState?.(`double_click_resolve_${direction}_skipped_no_refs`, true)
        return null
      }
      options.reportFillPlumbingState?.(`double_click_resolve_${direction}_called`, true)
      return options.resolveFillBoundary!({
        direction,
        baseRange,
        fillColumns,
        referenceColumns,
        projection,
        startRowIndex: baseRange.startRow,
        startColumnIndex: direction === "left" ? baseRange.startColumn - 1 : baseRange.endColumn + 1,
        limit: 500,
      })
    }
    const left = await resolve(leftReferenceColumns, "left")
    options.reportFillPlumbingState?.("double_click_left_result", left != null)
    if (left && isAcceptedServerFillBoundaryKind(left.boundaryKind) && left.endRowIndex != null) {
      options.reportFillPlumbingState?.("double_click_left_selected", true)
      return { endRow: left.endRowIndex, boundaryKind: left.boundaryKind, resolvedByServer: true, truncated: left.truncated === true }
    }
    const right = await resolve(rightReferenceColumns, "right")
    options.reportFillPlumbingState?.("double_click_right_result", right != null)
    if (right && isAcceptedServerFillBoundaryKind(right.boundaryKind) && right.endRowIndex != null) {
      options.reportFillPlumbingState?.("double_click_right_selected", true)
      return { endRow: right.endRowIndex, boundaryKind: right.boundaryKind, resolvedByServer: true, truncated: right.truncated === true }
    }
    if (left?.boundaryKind === "unresolved" || right?.boundaryKind === "unresolved") {
      options.reportFillWarning?.("server fill boundary unresolved; using loaded-cache fallback")
    }
    return null
  }

  const startFillHandleDoubleClick = (event: MouseEvent): void => {
    options.reportFillPlumbingState?.("double_click_handler", true)
    if (options.mode.value !== "base" || !isFillHandleEnabled.value) {
      options.reportFillPlumbingState?.("double_click_handler_skipped", true)
      return
    }
    const baseRange = options.resolveSelectionRange()
    if (!baseRange) {
      options.reportFillPlumbingState?.("double_click_handler_skipped_no_range", true)
      return
    }
    const anchorRow = getBodyRowAtIndex(baseRange.endRow)
    const anchorColumnKey = options.visibleColumns.value[baseRange.endColumn]?.key
    if (!anchorRow || !anchorColumnKey) {
      options.reportFillPlumbingState?.("double_click_handler_skipped_no_anchor", true)
      return
    }
    if (!options.isCellEditable(anchorRow, baseRange.endRow, anchorColumnKey, baseRange.endColumn)) {
      options.reportFillPlumbingState?.("double_click_handler_skipped_not_editable", true)
      return
    }
    const preferredFocusCoord = resolveFillOriginFocusCoord()
    event.preventDefault()
    event.stopPropagation()
    void resolveServerAwareFillBoundary(baseRange).then(resolved => {
      options.reportFillPlumbingState?.("double_click_resolved_server_branch", !!resolved?.resolvedByServer)
      options.reportFillPlumbingState?.("double_click_resolved_endrow", typeof resolved?.endRow === "number")
      const targetEndRow = resolved?.endRow ?? resolveBestNeighborFillEndRow(baseRange)
      const previewRange = targetEndRow > baseRange.endRow
        ? options.normalizeClipboardRange({
          startRow: baseRange.startRow,
          endRow: targetEndRow,
          startColumn: baseRange.startColumn,
          endColumn: baseRange.endColumn,
        })
        : null
      if (!previewRange || options.rangesEqual(baseRange, previewRange)) {
        if (resolved?.resolvedByServer && resolved.truncated) {
          options.reportFillWarning?.("Fill truncated at cache boundary")
        }
        return
      }
      const sourceMatrix = options.buildFillMatrixFromRange(baseRange)
      const behavior = activeFillBehavior.value ?? resolveDataGridDefaultFillBehavior({
        baseRange,
        previewRange,
        sourceMatrix,
      })
      if (resolved?.resolvedByServer) {
        options.reportFillPlumbingState?.("double_click_server_branch_entered", true)
        const normalizedFillBaseRange = options.normalizeClipboardRange(baseRange)
        if (!options.rangesEqual(options.resolveSelectionRange(), baseRange)) {
          return
        }
        if (normalizedFillBaseRange) {
          fillBaseRange.value = normalizedFillBaseRange
          fillPreviewRange.value = previewRange
        }
        const fillPreviewCancelVersionAtCommitStart = fillPreviewCancelVersion
        const rowModel = options.runtimeRowModel as
          | { dataSource?: { commitFillOperation?: unknown; resolveFillBoundary?: unknown } }
          | null
          | undefined
        const runtimeRowModel = options.runtime.rowModel as
          | { dataSource?: { commitFillOperation?: unknown; resolveFillBoundary?: unknown } }
          | undefined
        const dataSource = resolveServerFillDataSource()
        options.reportFillPlumbingState?.("controller_runtimeRowModel_exists", rowModel != null)
        options.reportFillPlumbingState?.("controller_runtimeRowModel_dataSource_exists", rowModel?.dataSource != null)
        options.reportFillPlumbingState?.("controller_runtimeRowModel_commit_type", typeof rowModel?.dataSource?.commitFillOperation === "function")
        options.reportFillPlumbingState?.("controller_runtime_rowModel_commit_type", typeof runtimeRowModel?.dataSource?.commitFillOperation === "function")
        const canCommitServerFill = typeof dataSource?.commitFillOperation === "function"
        options.reportFillPlumbingState?.("commitFillOperation_available", canCommitServerFill)
        const serverFillBehavior = resolveServerFillCommitBehavior(behavior)
        let allLoaded = true
        for (let rowIndex = previewRange.startRow; rowIndex <= previewRange.endRow; rowIndex += 1) {
          const isMaterialized = options.isRowMaterializedAtIndex
            ? options.isRowMaterializedAtIndex(rowIndex)
            : !!getBodyRowAtIndex(rowIndex) && (getBodyRowAtIndex(rowIndex) as { __placeholder?: boolean }).__placeholder !== true
          if (!isMaterialized) {
            allLoaded = false
            break
          }
        }
        if (!allLoaded && !canCommitServerFill) {
          options.reportFillPlumbingState?.("double_click_blocked_unloaded", true)
          options.reportFillWarning?.("server fill execution not implemented yet")
          clearFillPreviewState(normalizedFillBaseRange, previewRange)
          return
        }
        if (canCommitServerFill) {
          if (serverFillBehavior.downgraded) {
            options.reportFillWarning?.(SERVER_FILL_SERIES_UNSUPPORTED_WARNING)
            options.reportFillPlumbingState?.("server_fill_series_downgraded_to_copy", true)
          }
          void Promise.resolve(applyFillRange(baseRange, previewRange, serverFillBehavior.behavior))
            .then((applied: boolean) => {
              if (!applied) {
                return
              }
              if (fillPreviewCancelVersion !== fillPreviewCancelVersionAtCommitStart) {
                return
              }
              applySelectionRangeWithActivePosition(previewRange, "start")
              if (
                normalizedFillBaseRange
                && options.rangesEqual(fillBaseRange.value, normalizedFillBaseRange)
                && options.rangesEqual(fillPreviewRange.value, previewRange)
              ) {
                fillBaseRange.value = null
                fillPreviewRange.value = null
              }
              activeFillBehavior.value = serverFillBehavior.behavior
              if (resolved.truncated && !lastServerFillMaterializationWarning) {
                options.reportFillWarning?.("Fill truncated at cache boundary")
              }
              const restoredCoord = preferredFocusCoord
                ? restoreSelectionActiveCellToCoord(preferredFocusCoord)
                : null
              restoreActiveCellFocus(restoredCoord ?? preferredFocusCoord)
            })
            .catch((caught: unknown) => {
              options.reportFillWarning?.(`server fill commit failed: ${caught instanceof Error ? caught.message : String(caught)}`)
            })
            .finally(() => {
              clearFillPreviewState(normalizedFillBaseRange, previewRange)
            })
          return
        }
        options.reportFillPlumbingState?.("double_click_blocked_unloaded", true)
        options.reportFillWarning?.("server fill execution not implemented yet")
        clearFillPreviewState(normalizedFillBaseRange, previewRange)
        return
      }
      options.reportFillPlumbingState?.("double_click_batch_commit_path", true)
      void applyCommittedFillRange(baseRange, previewRange, behavior)
        .then(applied => {
          if (!applied) {
            return
          }
          activeFillBehavior.value = behavior
          const restoredCoord = preferredFocusCoord
            ? restoreSelectionActiveCellToCoord(preferredFocusCoord)
            : null
          restoreActiveCellFocus(restoredCoord ?? preferredFocusCoord)
        })
        .catch((caught: unknown) => {
          options.reportFillWarning?.(`fill commit failed: ${caught instanceof Error ? caught.message : String(caught)}`)
        })
    }).catch((caught: unknown) => {
      options.reportFillWarning?.(`server fill boundary failed: ${caught instanceof Error ? caught.message : String(caught)}`)
    })
  }

  const applyLastFillBehavior = async (behavior: DataGridFillBehavior): Promise<boolean> => {
    if (!isFillHandleEnabled.value) {
      return false
    }
    const session = lastAppliedFill.value
    if (!session) {
      return false
    }
    const preferredFocusCoord = resolveFillOriginFocusCoord()
    const applied = await applyCommittedFillRange(session.baseRange, session.previewRange, behavior)
    if (applied) {
      activeFillBehavior.value = behavior
      const restoredCoord = preferredFocusCoord
        ? restoreSelectionActiveCellToCoord(preferredFocusCoord)
        : null
      restoreActiveCellFocus(restoredCoord ?? preferredFocusCoord)
    }
    return applied
  }

  const handleCellMouseDown = (
    event: MouseEvent,
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
  ): void => {
    const columnKey = options.visibleColumns.value[columnIndex]?.key
    if (!columnKey) {
      return
    }
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    const rowIndex = resolveRowIndex(row, rowOffset)
    const coord = options.normalizeCellCoord({
      rowIndex,
      columnIndex,
      rowId: row.rowId ?? null,
    })
    if (hasActiveFillPreviewState()) {
      cancelFillPreviewState()
      if (event.button === 0 && coord) {
        event.preventDefault()
        options.setCellSelection(row, rowOffset, columnIndex, false, false)
        target?.focus({ preventScroll: true })
      }
      return
    }
    const currentRange = options.resolveSelectionRange()

    if (
      options.mode.value === "base"
      && isRangeMoveEnabled.value
      && event.button === 0
      && !event.shiftKey
      && coord
      && currentRange
      && isCoordInsideRange(coord, currentRange)
    ) {
      if (!options.isCellEditable(row, rowIndex, columnKey, columnIndex)) {
        return
      }
      event.preventDefault()
      focusViewport()
      pendingRangeMove.value = true
      pendingRangeMoveCoord.value = coord
      pendingRangeMovePointerStart.value = { clientX: event.clientX, clientY: event.clientY }
      target?.focus({ preventScroll: true })
      return
    }

    if (supportsCellSelectionMode()) {
      const handled = cellPointerDownRouter.dispatchCellPointerDown(row, columnKey, event)
      if (handled) {
        dragSelectionOriginPin.value = resolveColumnPin(columnIndex)
        target?.focus({ preventScroll: true })
        return
      }
    }

    if (event.button !== 0) {
      return
    }
    options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey, event.ctrlKey || event.metaKey)
    if (!supportsCellSelectionMode()) {
      return
    }
    pendingDragSelection.value = true
    pendingDragPointerStart.value = { clientX: event.clientX, clientY: event.clientY }
    dragSelectionOriginPin.value = resolveColumnPin(columnIndex)
    target?.focus({ preventScroll: true })
    pendingDragCoord.value = resolveCellCoordFromElement(target)
  }

  const handleCellKeydown = (
    event: KeyboardEvent,
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
  ): void => {
    const rowIndex = resolveRowIndex(row, rowOffset)
    if (hasActiveFillPreviewState() && event.key === "Escape") {
      event.preventDefault()
      cancelFillPreviewState()
      return
    }
    if (!supportsCellSelectionMode()) {
      return
    }
    if (!isRangeMoving.value && event.key === "Escape") {
      const clearedCellClipboard = options.clearPendingClipboardOperation(true, true)
      const clearedExternalClipboard = options.clearExternalPendingClipboardOperation?.() === true
      if (clearedCellClipboard || clearedExternalClipboard) {
        event.preventDefault()
        return
      }
    }
    if (!options.selectionSnapshot.value?.activeCell) {
      options.setCellSelection(row, rowOffset, columnIndex, false)
    }
    if (keyboardCommandRouter.dispatchKeyboardCommands(event)) {
      return
    }
    if (
      row.kind === "group"
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && !event.shiftKey
    ) {
      const groupKey = row.groupMeta?.groupKey
      if (groupKey && (event.key === " " || event.key === "Spacebar") && row.state.expanded !== true) {
        event.preventDefault()
        event.stopPropagation()
        options.runtime.api.rows.expandGroup(groupKey)
        return
      }
      if (groupKey && (event.key === " " || event.key === "Spacebar") && row.state.expanded === true) {
        event.preventDefault()
        event.stopPropagation()
        options.runtime.api.rows.collapseGroup(groupKey)
        return
      }
    }
    const columnSnapshot = options.visibleColumns.value[columnIndex]
    const columnKey = columnSnapshot?.key
    const currentEditingCell = options.editingCell.value
    if (
      event.key === "Escape"
      && columnKey
      && currentEditingCell?.rowId === row.rowId
      && currentEditingCell.columnKey === columnKey
    ) {
      event.preventDefault()
      options.cancelInlineEdit()
      return
    }
    const editable = Boolean(columnKey) && options.isCellEditable(row, rowIndex, columnKey as string, columnIndex)
    const printable = isPrintableEditingKey(event)
    const keyboardAction = columnSnapshot && columnKey
      ? resolveDataGridCellKeyboardAction({
        column: columnSnapshot.column,
        row: row.kind !== "group" ? row.data : undefined,
        rowId: row.rowId,
        editable,
        key: event.key,
        printable,
      })
      : "none"

    // Mirror Excel: Enter navigates vertically for editable cells; typing/F2/double-click opens edit mode.
    if (
      event.key === "Enter"
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && (keyboardAction !== "invoke" || editable)
    ) {
      keyboardNavigationExtendsSelection.value = event.shiftKey
      const navigationHandled = cellNavigation.dispatchNavigation(event)
      keyboardNavigationExtendsSelection.value = false
      if (navigationHandled) {
        return
      }
    }

    if (keyboardAction === "toggle" && columnSnapshot && columnKey) {
      event.preventDefault()
      options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
      void applyDirectCellEdit(
        row,
        rowIndex,
        columnIndex,
        columnKey,
        toggleDataGridCellValue({
          column: columnSnapshot.column,
          row: row.kind !== "group" ? row.data : undefined,
        }),
        `Toggle ${columnKey}`,
      )
      return
    }
    if (keyboardAction === "invoke" && columnSnapshot) {
      event.preventDefault()
      options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
      invokeDataGridCellInteraction({
        column: columnSnapshot.column,
        row: row.kind !== "group" ? row.data : undefined,
        rowId: row.rowId,
        editable,
        trigger: event.key === "Enter" ? "keyboard-enter" : "keyboard-space",
      })
      restoreActiveCellFocus({
        rowIndex,
        columnIndex,
        rowId: row.rowId,
      })
      return
    }
    if ((keyboardAction === "startEdit" || keyboardAction === "openSelect") && columnKey) {
      event.preventDefault()
      if (editable) {
        if (
          printable
          && currentEditingCell?.rowId === row.rowId
          && currentEditingCell.columnKey === columnKey
        ) {
          options.appendInlineEditTextInput?.(event.key)
          return
        }
        options.startInlineEdit(
          row,
          columnKey,
          printable || keyboardAction === "openSelect"
            ? {
              draftValue: printable ? event.key : undefined,
              openOnMount: true,
            }
            : undefined,
        )
      }
      return
    }
    keyboardNavigationExtendsSelection.value = event.shiftKey
    const navigationHandled = cellNavigation.dispatchNavigation(event)
    keyboardNavigationExtendsSelection.value = false
    if (navigationHandled) {
      return
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault()
      options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
    }
  }

  const handleRowIndexKeydown = (
    event: KeyboardEvent,
    row: DataGridRowNode<TRow>,
    rowOffset: number,
  ): void => {
    void rowOffset
    if (row.rowId == null || !options.runRowIndexKeyboardAction) {
      return
    }

    const isPrimaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey
    const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const opensContextMenu = event.key === "ContextMenu"
      || (event.key === "F10" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey)

    if (opensContextMenu) {
      event.preventDefault()
      event.stopPropagation()
      void options.runRowIndexKeyboardAction("open-row-menu", row.rowId)
      return
    }

    if (row.kind === "group") {
      return
    }

    let action: DataGridRowIndexKeyboardAction | null = null

    if (isPrimaryModifier && !event.shiftKey && normalizedKey === "c") {
      action = "copy-row"
    } else if (isPrimaryModifier && !event.shiftKey && normalizedKey === "x") {
      action = "cut-row"
    } else if (isPrimaryModifier && !event.shiftKey && normalizedKey === "v") {
      action = "paste-row"
    } else if (isPrimaryModifier && !event.shiftKey && normalizedKey === "i") {
      action = "insert-row-above"
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && (event.key === "Delete" || event.key === "Backspace")) {
      action = "delete-selected-rows"
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === "Insert") {
      action = "insert-row-above"
    }

    if (!action) {
      return
    }

    const fallbackTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    event.preventDefault()
    event.stopPropagation()
    void Promise.resolve(options.runRowIndexKeyboardAction(action, row.rowId)).then(handled => {
      if (handled) {
        restoreRowIndexFocus(row.rowId as string | number, fallbackTarget)
      }
    })
  }

  const handleWindowMouseMove = (event: MouseEvent): void => {
    const pointer = { clientX: event.clientX, clientY: event.clientY }
    if (pendingRangeMove.value && !isRangeMoving.value) {
      if (!isRangeMoveEnabled.value) {
        clearPendingRangeMove()
        return
      }
      if (!shouldActivateRangeMove(pointer)) {
        return
      }
      if (activatePendingRangeMove(pointer)) {
        rangeMovePointer.value = pointer
        pointerPreviewRouter.applyRangeMovePreviewFromPointer()
        return
      }
    }
    if (isRangeMoving.value) {
      rangeMovePointer.value = { clientX: event.clientX, clientY: event.clientY }
      pointerPreviewRouter.applyRangeMovePreviewFromPointer()
      return
    }
    if (isFillDragging.value) {
      fillPointer.value = { clientX: event.clientX, clientY: event.clientY }
      pointerPreviewRouter.applyFillPreviewFromPointer()
      return
    }
    if (pendingDragSelection.value && !isPointerSelectingCells.value) {
      if (!shouldActivateDragSelection(pointer)) {
        return
      }
      activatePendingDragSelection(pointer)
    }
    if (!isPointerSelectingCells.value) {
      return
    }
    dragPointer.value = pointer
    pointerAutoScroll.startInteractionAutoScroll()
    dragPointerSelection.applyDragSelectionFromPointer()
  }

  const handleWindowMouseUp = (): void => {
    if (pendingRangeMove.value && !isRangeMoving.value) {
      const coord = pendingRangeMoveCoord.value
      clearPendingRangeMove()
      if (coord) {
        options.applyCellSelectionByCoord(coord, false)
      }
    }
    if (isRangeMoving.value) {
      rangeMoveLifecycle.stopRangeMove(true)
    }
    if (isFillDragging.value) {
      stopFillSelection(true)
    }
    if (isPointerSelectingCells.value) {
      const anchorCoord = restoreSelectionActiveCellToAnchor()
      restoreActiveCellFocus(anchorCoord)
    }
    stopPointerSelection()
    pointerAutoScroll.stopAutoScrollFrameIfIdle()
  }

  return {
    isPointerSelectingCells,
    isFillDragging,
    fillPreviewRange,
    lastAppliedFill,
    isRangeMoving,
    selectionRange,
    rangeMovePreviewRange,
    stopPointerSelection: () => {
      stopPointerSelection()
      pointerAutoScroll.stopAutoScrollFrameIfIdle()
    },
    stopFillSelection,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    applyLastFillBehavior,
    handleCellMouseDown,
    handleCellKeydown,
    handleRowIndexKeydown,
    handleWindowMouseMove,
    handleWindowMouseUp,
    isCellInFillPreview,
    isFillHandleCell: (rowOffset: number, columnIndex: number) => {
      if (!isFillHandleEnabled.value) {
        return false
      }
      return isFillHandleCell(rowOffset, columnIndex)
    },
    clearSelectedCells,
    dispose: () => {
      pointerAutoScroll.dispose()
    },
  }
}
