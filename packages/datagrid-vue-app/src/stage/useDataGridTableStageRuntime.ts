import { computed, nextTick, ref, type ComputedRef, type CSSProperties, type Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowSelectionSnapshot,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import {
  createDataGridAppRowHeightMetrics,
  useDataGridAppActiveCellViewport,
  useDataGridAppCellSelection,
  useDataGridAppClipboard,
  useDataGridAppHeaderResize,
  useDataGridAppInlineEditing,
  useDataGridAppInteractionController,
  useDataGridAppRowPresentation,
  useDataGridAppRowSizing,
  useDataGridAppViewport,
  useDataGridAppRuntimeSync,
  useDataGridAppViewportLifecycle,
} from "@affino/datagrid-vue/app"
import type { DataGridCellEditablePredicate } from "../dataGridEditability"
import type {
  DataGridColumnMenuActionOptions,
  DataGridColumnMenuDisabledReasons,
  DataGridColumnMenuItemKey,
  DataGridColumnMenuItemLabels,
} from "../overlays/dataGridColumnMenu"
import type { DataGridLayoutMode } from "../config/dataGridLayout"
import type { DataGridVirtualizationOptions } from "../config/dataGridVirtualization"
import type { DataGridTableStageContext } from "./dataGridTableStageContext"
import { useDataGridTableStageBindings } from "./useDataGridTableStageBindings"
import { useDataGridTableStageCellIo } from "./useDataGridTableStageCellIo"
import { useDataGridTableStageColumns } from "./useDataGridTableStageColumns"
import { useDataGridTableStageFillAction } from "./useDataGridTableStageFillAction"
import type { DataGridTableStageHistoryAdapter } from "./useDataGridTableStageHistory"
import { useDataGridTableStageHistory } from "./useDataGridTableStageHistory"
import { useDataGridTableStageRowSelection } from "./useDataGridTableStageRowSelection"
import { useDataGridTableStageScrollSync } from "./useDataGridTableStageScrollSync"
import { useDataGridTableStageViewportKeyboard } from "./useDataGridTableStageViewportKeyboard"
import { useDataGridTableStageVisualSelection } from "./useDataGridTableStageVisualSelection"
import type { DataGridTableStageProps } from "./dataGridTableStage.types"

const DEFAULT_COLUMN_WIDTH = 140
const INDEX_COLUMN_WIDTH = 72
const MIN_COLUMN_WIDTH = 80
const MIN_ROW_HEIGHT = 24
const AUTO_RESIZE_SAMPLE_LIMIT = 400

export type { DataGridTableStageHistoryAdapter } from "./useDataGridTableStageHistory"

type DataGridTableStageBodyRuntime<TRow extends Record<string, unknown>> = Pick<
  import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>,
  "api" | "syncBodyRowsInRange" | "rowPartition" | "virtualWindow" | "columnSnapshot"
> & {
  getBodyRowAtIndex: (rowIndex: number) => import("@affino/datagrid-vue").DataGridRowNode<TRow> | null
  resolveBodyRowIndexById: (rowId: string | number) => number
}

export interface UseDataGridTableStageRuntimeOptions<TRow extends Record<string, unknown>> {
  mode: Ref<"base" | "tree" | "pivot" | "worker">
  layoutMode: Ref<DataGridLayoutMode>
  minRows: Ref<number | null>
  maxRows: Ref<number | null>
  enableFillHandle: Ref<boolean>
  enableRangeMove: Ref<boolean>
  rows: Ref<readonly TRow[]>
  sourceRows?: Ref<readonly TRow[]>
  runtime: DataGridTableStageBodyRuntime<TRow>
  rowVersion: Ref<number>
  totalRuntimeRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  rowRenderMode: Ref<"virtualization" | "pagination">
  rowHeightMode: Ref<"fixed" | "auto">
  normalizedBaseRowHeight: Ref<number>
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  selectionAnchor: Ref<unknown>
  syncSelectionSnapshotFromRuntime: () => void
  rowSelectionSnapshot: Ref<DataGridRowSelectionSnapshot | null>
  rowHover?: Ref<boolean>
  stripedRows?: Ref<boolean>
  showRowIndex?: Ref<boolean>
  showRowSelection?: Ref<boolean>
  isRowInPendingClipboardCut?: (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>) => boolean
  syncRowSelectionSnapshotFromRuntime?: () => void
  firstColumnKey: Ref<string>
  columnFilterTextByKey: Ref<Record<string, string>>
  virtualization: Ref<DataGridVirtualizationOptions>
  toggleSortForColumn: (columnKey: string, additive?: boolean) => void
  sortIndicator: (columnKey: string) => string
  setColumnFilterText: (columnKey: string, value: string) => void
  columnMenuEnabled?: Ref<boolean>
  columnMenuValueFilterEnabled?: Ref<boolean>
  columnMenuValueFilterRowLimit?: Ref<number>
  columnMenuMaxFilterValues?: Ref<number>
  resolveColumnMenuItems?: (columnKey: string) => readonly DataGridColumnMenuItemKey[]
  resolveColumnMenuDisabledItems?: (columnKey: string) => readonly DataGridColumnMenuItemKey[]
  resolveColumnMenuDisabledReasons?: (columnKey: string) => DataGridColumnMenuDisabledReasons
  resolveColumnMenuLabels?: (columnKey: string) => DataGridColumnMenuItemLabels
  resolveColumnMenuActionOptions?: (columnKey: string) => DataGridColumnMenuActionOptions
  isColumnFilterActive?: (columnKey: string) => boolean
  isColumnGrouped?: (columnKey: string) => boolean
  resolveColumnGroupOrder?: (columnKey: string) => number | null
  resolveColumnMenuSortDirection?: (columnKey: string) => "asc" | "desc" | null
  resolveColumnMenuSelectedTokens?: (columnKey: string) => readonly string[]
  applyColumnMenuSort?: (columnKey: string, direction: "asc" | "desc" | null) => void
  applyColumnMenuPin?: (columnKey: string, pin: import("@affino/datagrid-vue").DataGridColumnPin) => void
  applyColumnMenuGroupBy?: (columnKey: string, grouped: boolean) => void
  applyColumnMenuFilter?: (columnKey: string, tokens: readonly string[]) => void
  clearColumnMenuFilter?: (columnKey: string) => void
  applyRowHeightSettings: () => void
  cloneRowData: (row: TRow) => TRow
  readClipboardCell?: (row: import("@affino/datagrid-core").DataGridRowNode<TRow>, columnKey: string) => string
  applyClipboardEdits?: (
    range: DataGridCopyRange,
    matrix: string[][],
    options?: { recordHistory?: boolean },
  ) => number
  buildFillMatrixFromRange?: (range: DataGridCopyRange) => string[][]
  applyRangeMove?: (baseRange: DataGridCopyRange, targetRange: DataGridCopyRange) => boolean
  isCellEditable?: DataGridCellEditablePredicate<TRow>
  history?: DataGridTableStageHistoryAdapter
  isContextMenuVisible?: () => boolean
  closeContextMenu?: () => void
  openContextMenuFromCurrentCell?: () => void
  clearExternalPendingClipboardOperation?: () => boolean
  runRowIndexKeyboardAction?: (
    action: "insert-row-above" | "copy-row" | "cut-row" | "paste-row" | "delete-selected-rows" | "open-row-menu",
    rowId: string | number,
  ) => Promise<boolean> | boolean
}

export interface UseDataGridTableStageRuntimeResult<TRow extends Record<string, unknown>> {
  tableStageProps: ComputedRef<DataGridTableStageProps<TRow>>
  tableStageContext: DataGridTableStageContext<TRow>
  syncViewportFromDom: () => void
  copySelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  cutSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  clearSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  captureHistorySnapshot: () => unknown
  recordHistoryIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
  ) => void
}

type StageInteractionControllerResult<TRow extends Record<string, unknown>> =
  ReturnType<typeof useDataGridAppInteractionController<TRow, unknown>> & {
    handleRowIndexKeydown: (
      event: KeyboardEvent,
      row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
      rowOffset: number,
    ) => void
    clearSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  }

export function useDataGridTableStageRuntime<
  TRow extends Record<string, unknown>,
>(
  options: UseDataGridTableStageRuntimeOptions<TRow>,
): UseDataGridTableStageRuntimeResult<TRow> {
  const syncRowSelectionSnapshotFromRuntime = options.syncRowSelectionSnapshotFromRuntime ?? (() => undefined)
  const rowSelectionSnapshotRef = options.rowSelectionSnapshot ?? ref<DataGridRowSelectionSnapshot | null>(null)
  const showRowIndex = computed(() => options.showRowIndex?.value !== false)
  const totalBodyRows = computed(() => options.runtime.rowPartition.value.bodyRowCount)
  const totalSelectableRows = computed(() => Math.max(0, options.totalRuntimeRows.value))
  const effectiveIndexColumnWidth = computed(() => (showRowIndex.value ? INDEX_COLUMN_WIDTH : 0))
  const columnService = useDataGridTableStageColumns<TRow>({
    runtime: options.runtime,
    visibleColumns: options.visibleColumns,
    showRowSelection: options.showRowSelection,
    isCellEditable: options.isCellEditable,
  })
  const {
    orderedVisibleColumns,
    centerColumns,
    resolveColumnWidth,
    isRowSelectionColumnKey,
    isRowSelectionColumn,
    isCellEditable,
    isCellEditableByKey,
    rowSelectionColumn,
  } = columnService

  const rowHeightMetrics = createDataGridAppRowHeightMetrics({
    totalRows: () => totalBodyRows.value,
    resolveBaseRowHeight: () => options.normalizedBaseRowHeight.value,
    resolveRowHeightOverride: rowIndex => options.runtime.api.view.getRowHeightOverride(rowIndex),
    resolveRowHeightVersion: () => options.runtime.api.view.getRowHeightVersion(),
    hasRowHeightOverrides: () => options.runtime.api.view.getRowHeightVersion() > 0,
  })
  const resolveHeightForRowSpan = (rowCount: number): number => {
    const normalizedRowCount = Math.max(0, Math.trunc(rowCount))
    if (normalizedRowCount <= 0) {
      return 0
    }
    const totalResolvedHeight = rowHeightMetrics.resolveTotalHeight()
    if (normalizedRowCount <= totalBodyRows.value) {
      return rowHeightMetrics.resolveRowOffset(normalizedRowCount)
    }
    return totalResolvedHeight + ((normalizedRowCount - totalBodyRows.value) * options.normalizedBaseRowHeight.value)
  }
  const autoHeightBodyHeight = computed<number | null>(() => {
    if (options.layoutMode.value !== "auto-height") {
      return null
    }
    let resolvedHeight = rowHeightMetrics.resolveTotalHeight()
    if (options.minRows.value !== null) {
      resolvedHeight = Math.max(resolvedHeight, resolveHeightForRowSpan(options.minRows.value))
    }
    if (options.maxRows.value !== null) {
      resolvedHeight = Math.min(resolvedHeight, resolveHeightForRowSpan(options.maxRows.value))
    }
    return Math.max(0, Math.trunc(resolvedHeight))
  })
  const stageStyle = computed<CSSProperties>(() => {
    if (options.layoutMode.value !== "auto-height") {
      return {}
    }
    return {
      height: "auto",
    }
  })
  const bodyShellStyle = computed<CSSProperties>(() => {
    if (options.layoutMode.value !== "auto-height") {
      return {}
    }
    const resolvedHeight = autoHeightBodyHeight.value ?? 0
    return {
      height: `${resolvedHeight}px`,
      maxHeight: `${resolvedHeight}px`,
    }
  })

  let isEditingCellForSelection: (
    row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
    columnKey: string,
  ) => boolean = () => false

  const {
    headerViewportRef,
    bodyViewportRef,
    displayRows,
    pinnedBottomRows,
    renderedColumns,
    viewportRowStart,
    viewportColumnStart,
    topSpacerHeight,
    bottomSpacerHeight,
    leftColumnSpacerWidth,
    rightColumnSpacerWidth,
    gridContentStyle,
    mainTrackStyle,
    indexColumnStyle,
    columnStyle: _viewportColumnStyle,
    handleViewportScroll,
    syncViewportFromDom,
    scheduleViewportSync,
    cancelScheduledViewportSync,
  } = useDataGridAppViewport<TRow>({
    runtime: options.runtime,
    mode: options.mode,
    rowRenderMode: options.rowRenderMode,
    rowVirtualizationEnabled: computed(() => options.virtualization.value.rows),
    columnVirtualizationEnabled: computed(() => options.virtualization.value.columns),
    totalRows: totalBodyRows,
    visibleColumns: centerColumns,
    sizingColumns: orderedVisibleColumns,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    resolveColumnWidth,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    indexColumnWidth: 0,
    flexFillOffsetWidth: effectiveIndexColumnWidth.value,
    rowOverscan: computed(() => options.virtualization.value.rowOverscan),
    columnOverscan: computed(() => options.virtualization.value.columnOverscan),
    measureVisibleRowHeights: () => measureVisibleRowHeights(),
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowOffset: rowHeightMetrics.resolveRowOffset,
    resolveRowIndexAtOffset: rowHeightMetrics.resolveRowIndexAtOffset,
    resolveTotalRowHeight: rowHeightMetrics.resolveTotalHeight,
  })
  const resolveStageColumnStyle = (columnKey: string): Record<string, string> => {
    return _viewportColumnStyle(columnKey)
  }

  const getSelectableRowAtIndex = (rowIndex: number): import("@affino/datagrid-vue").DataGridRowNode<TRow> | null => {
    if (totalSelectableRows.value <= 0) {
      return null
    }
    const normalizedIndex = Math.max(0, Math.min(totalSelectableRows.value - 1, Math.trunc(rowIndex)))
    return options.runtime.api.rows.get(normalizedIndex) ?? null
  }

  const resolveSelectableRowIndexById = (rowId: string | number): number => {
    for (let rowIndex = 0; rowIndex < totalSelectableRows.value; rowIndex += 1) {
      if (options.runtime.api.rows.get(rowIndex)?.rowId === rowId) {
        return rowIndex
      }
    }
    return options.runtime.resolveBodyRowIndexById(rowId)
  }

  const selectableRuntime = {
    ...options.runtime,
    getBodyRowAtIndex: getSelectableRowAtIndex,
    resolveBodyRowIndexById: resolveSelectableRowIndexById,
  }

  const {
    rowStyle,
    isRowAutosizeProbe,
    measureVisibleRowHeights,
    startRowResize,
    autosizeRow,
    dispose: disposeRowSizing,
  } = useDataGridAppRowSizing<TRow>({
    mode: options.mode,
    rowHeightMode: options.rowHeightMode,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    viewportRowStart,
    bodyViewportRef,
    runtime: options.runtime as never,
    minRowHeight: MIN_ROW_HEIGHT,
    syncViewport: () => syncViewportFromDom(),
  })

  const selectionController = useDataGridAppCellSelection<TRow>({
    mode: options.mode,
    runtime: selectableRuntime as never,
    totalRows: totalSelectableRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    selectionSnapshot: options.selectionSnapshot,
    selectionAnchor: options.selectionAnchor as never,
    isEditingCell: (row, columnKey): boolean => isEditingCellForSelection(row, columnKey),
  })

  const {
    normalizeRowId,
    normalizeCellCoord,
    resolveSelectionRange: resolveSelectionRangeForClipboard,
    resolveCurrentCellCoord: resolveCurrentCellCoordForClipboard,
    applySelectionRange: applyClipboardSelectionRange,
    applyCellSelectionByCoord,
    setCellSelection,
    clearCellSelection,
    isCellSelected: isCommittedCellSelected,
  } = selectionController
  const isCommittedSelectionAnchorCell = selectionController.isSelectionAnchorCell ?? (() => false)
  const shouldHighlightCommittedSelectedCell = selectionController.shouldHighlightSelectedCell
    ?? ((rowOffset: number, columnIndex: number) => isCommittedCellSelected(rowOffset, columnIndex))
  const isCommittedCellOnSelectionEdge = selectionController.isCellOnSelectionEdge
    ?? (() => false)
  const selectionAnchorCell = computed(() => {
    const snapshot = options.selectionSnapshot.value
    if (!snapshot || snapshot.ranges.length === 0) {
      return null
    }
    const activeIndex = snapshot.activeRangeIndex ?? 0
    const anchor = snapshot.ranges[activeIndex]?.anchor ?? snapshot.ranges[0]?.anchor ?? null
    if (
      !anchor
      || typeof anchor.rowIndex !== "number"
      || typeof anchor.colIndex !== "number"
      || !Number.isFinite(anchor.rowIndex)
      || !Number.isFinite(anchor.colIndex)
    ) {
      return null
    }
    return {
      rowIndex: Math.trunc(anchor.rowIndex),
      columnIndex: Math.trunc(anchor.colIndex),
    }
  })

  const rowSelectionService = useDataGridTableStageRowSelection<TRow>({
    runtime: options.runtime,
    rowSelectionColumn,
    orderedVisibleColumns,
    displayRows,
    rowSelectionSnapshot: rowSelectionSnapshotRef,
    viewportRowStart,
    selectionAnchorCell,
    applySelectionRange: applyClipboardSelectionRange,
  })
  const {
    readRowSelectionCell,
    readRowSelectionDisplayCell,
    toggleRowCheckboxSelected,
  } = rowSelectionService

  const stageIndexColumnStyle = computed(() => {
    const width = `${effectiveIndexColumnWidth.value}px`
    return {
      ...indexColumnStyle.value,
      width,
      minWidth: width,
      maxWidth: width,
    }
  })

  const historyService = useDataGridTableStageHistory<TRow>({
    runtime: options.runtime,
    cloneRowData: options.cloneRowData,
    syncViewport: () => syncViewportFromDom(),
    history: options.history,
  })
  const {
    captureHistorySnapshot,
    recordHistoryIntentTransaction,
    canUndoHistory,
    canRedoHistory,
    runHistoryAction,
  } = historyService

  const {
    rowIndexLabel,
    readCell,
    readDisplayCell,
    rowClass,
    toggleGroupRow,
  } = useDataGridAppRowPresentation<TRow>({
    mode: options.mode,
    runtime: options.runtime as never,
    viewportRowStart,
    firstColumnKey: options.firstColumnKey,
  })

  const cellIoService = useDataGridTableStageCellIo<TRow>({
    runtime: options.runtime,
    viewportRowStart,
    isRowSelectionColumnKey,
    isRowSelectionColumn,
    isCellEditableByKey,
    readRowSelectionCell,
    readRowSelectionDisplayCell,
    readCell,
    readDisplayCell,
    toggleRowCheckboxSelected,
    captureHistorySnapshot,
    recordHistoryIntentTransaction,
    syncViewport: () => syncViewportFromDom(),
  })
  const {
    readStageCell,
  } = cellIoService

  const clipboard = useDataGridAppClipboard<TRow, unknown>({
    mode: options.mode,
    runtime: selectableRuntime as never,
    totalRows: totalSelectableRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    resolveSelectionRange: resolveSelectionRangeForClipboard,
    resolveCurrentCellCoord: resolveCurrentCellCoordForClipboard,
    applySelectionRange: applyClipboardSelectionRange,
    clearCellSelection,
    captureRowsSnapshot: captureHistorySnapshot,
    recordEditTransaction: beforeSnapshot => {
      recordHistoryIntentTransaction({
        intent: "edit",
        label: "Cell edit",
      }, beforeSnapshot)
    },
    readCell: (row, columnKey) => readStageCell(row, columnKey),
    readClipboardCell: options.readClipboardCell
      ? (row, columnKey) => options.readClipboardCell?.(row, columnKey) ?? ""
      : undefined,
    isCellEditable: isCellEditableByKey,
    syncViewport: () => syncViewportFromDom(),
    applyClipboardEdits: options.applyClipboardEdits,
    buildFillMatrixFromRange: options.buildFillMatrixFromRange,
  })

  const {
    normalizeClipboardRange,
    applyClipboardEdits,
    rangesEqual,
    buildFillMatrixFromRange,
    clearPendingClipboardOperation,
    copySelectedCells,
    pasteSelectedCells,
    cutSelectedCells,
    isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge,
  } = clipboard

  const {
    ensureKeyboardActiveCellVisible,
  } = useDataGridAppActiveCellViewport({
    bodyViewportRef,
    visibleColumns: orderedVisibleColumns,
    resolveColumnWidth,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowOffset: rowHeightMetrics.resolveRowOffset,
    indexColumnWidth: effectiveIndexColumnWidth.value,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    syncViewport: () => syncViewportFromDom(),
  })

  const {
    editingCell,
    editingCellValue,
    editingCellInitialFilter,
    editingCellOpenOnMount,
    isEditingCell,
    startInlineEdit,
    commitInlineEdit,
    cancelInlineEdit,
    handleEditorKeydown,
  } = useDataGridAppInlineEditing<TRow, unknown>({
    mode: options.mode,
    bodyViewportRef,
    visibleColumns: orderedVisibleColumns,
    totalRows: totalSelectableRows,
    runtime: selectableRuntime as never,
    readCell: (row, columnKey) => readStageCell(row, columnKey),
    resolveRowIndexById: resolveSelectableRowIndexById,
    applyCellSelection: coord => {
      applyCellSelectionByCoord(coord, false)
    },
    ensureActiveCellVisible: (rowIndex, columnIndex) => {
      ensureKeyboardActiveCellVisible(rowIndex, columnIndex)
    },
    isCellEditable: isCellEditableByKey,
    captureRowsSnapshot: captureHistorySnapshot,
    recordEditTransaction: beforeSnapshot => {
      recordHistoryIntentTransaction({
        intent: "edit",
        label: "Cell edit",
      }, beforeSnapshot)
    },
  })

  isEditingCellForSelection = isEditingCell

  const editingCellRef = computed(() => editingCell.value)

  const interactionControllerOptions = {
    mode: options.mode,
    enableFillHandle: options.enableFillHandle,
    enableRangeMove: options.enableRangeMove,
    runtime: selectableRuntime as never,
    totalRows: totalSelectableRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    selectionSnapshot: options.selectionSnapshot,
    bodyViewportRef,
    indexColumnWidth: effectiveIndexColumnWidth.value,
    resolveColumnWidth,
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowIndexAtOffset: rowHeightMetrics.resolveRowIndexAtOffset,
    normalizeRowId,
    normalizeCellCoord,
    resolveSelectionRange: resolveSelectionRangeForClipboard,
    applySelectionRange: applyClipboardSelectionRange,
    applyCellSelectionByCoord,
    setCellSelection,
    clearCellSelection,
    readCell: (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>, columnKey: string) => readStageCell(row, columnKey),
    isCellEditable: isCellEditableByKey,
    cloneRowData: options.cloneRowData,
    resolveRowIndexById: resolveSelectableRowIndexById,
    captureRowsSnapshot: captureHistorySnapshot,
    recordIntentTransaction: (descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null }, beforeSnapshot: unknown) => {
      recordHistoryIntentTransaction(descriptor, beforeSnapshot)
    },
    clearPendingClipboardOperation,
    clearExternalPendingClipboardOperation: options.clearExternalPendingClipboardOperation,
    copySelectedCells,
    pasteSelectedCells,
    cutSelectedCells,
    normalizeClipboardRange,
    applyClipboardEdits,
    rangesEqual,
    buildFillMatrixFromRange,
    applyRangeMove: options.applyRangeMove,
    syncViewport: () => syncViewportFromDom(),
    editingCell: editingCellRef,
    startInlineEdit,
    commitInlineEdit,
    canUndo: canUndoHistory,
    canRedo: canRedoHistory,
    runHistoryAction,
    ensureKeyboardActiveCellVisible,
    isContextMenuVisible: options.isContextMenuVisible,
    closeContextMenu: options.closeContextMenu,
    openContextMenuFromCurrentCell: options.openContextMenuFromCurrentCell,
    runRowIndexKeyboardAction: options.runRowIndexKeyboardAction,
  } as Parameters<typeof useDataGridAppInteractionController<TRow, unknown>>[0]

  const interactionController = (
    useDataGridAppInteractionController<TRow, unknown>(interactionControllerOptions)
  ) as StageInteractionControllerResult<TRow>

  const {
    isPointerSelectingCells,
    isFillDragging,
    fillPreviewRange,
    lastAppliedFill,
    isRangeMoving,
    selectionRange: interactionSelectionRange,
    rangeMovePreviewRange,
    stopPointerSelection,
    stopFillSelection,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    applyLastFillBehavior,
    handleCellMouseDown,
    handleCellKeydown,
    handleRowIndexKeydown,
    handleWindowMouseMove: handleInteractionWindowMouseMove,
    handleWindowMouseUp: handleInteractionWindowMouseUp,
    isCellInFillPreview,
    isFillHandleCell,
    clearSelectedCells,
    dispose: disposeInteractionController,
  } = interactionController

  const viewportKeyboardService = useDataGridTableStageViewportKeyboard<TRow>({
    runtime: selectableRuntime,
    selectionSnapshot: options.selectionSnapshot,
    totalRows: totalSelectableRows,
    orderedVisibleColumns,
    viewportRowStart,
    applySelectionRange: applyClipboardSelectionRange,
    handleCellKeydown,
  })
  const {
    isColumnResizing,
    startResize,
    handleResizeDoubleClick,
    applyColumnResizeFromPointer,
    stopColumnResize,
    dispose: disposeHeaderResize,
  } = useDataGridAppHeaderResize<TRow>({
    visibleColumns: orderedVisibleColumns,
    rows: options.rows,
    persistColumnWidth: (columnKey, width) => {
      options.runtime.api.columns.setWidth(columnKey, width)
    },
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    minColumnWidth: MIN_COLUMN_WIDTH,
    autoSizeSampleLimit: AUTO_RESIZE_SAMPLE_LIMIT,
    autoSizeCharWidth: 7.2,
    autoSizeHorizontalPadding: 42,
    autoSizeMaxWidth: 640,
    isFillDragging: () => isFillDragging.value,
    stopFillSelection: () => {
      stopFillSelection(false)
    },
    isDragSelecting: () => isPointerSelectingCells.value,
    stopDragSelection: () => {
      stopPointerSelection()
    },
    readCellText: (row, columnKey) => {
      const value = (row as Record<string, unknown>)[columnKey]
      return value == null ? "" : String(value)
    },
  })


  const visualSelectionService = useDataGridTableStageVisualSelection({
    mode: options.mode,
    viewportRowStart,
    selectionAnchorCell,
    fillPreviewRange,
    isFillDragging,
    interactionSelectionRange,
    resolveCommittedSelectionRange: resolveSelectionRangeForClipboard,
    isCommittedSelectionAnchorCell,
    isCommittedCellSelected,
    shouldHighlightCommittedSelectedCell,
    isCommittedCellOnSelectionEdge,
  })
  const { selectionRange } = visualSelectionService

  const fillActionService = useDataGridTableStageFillAction({
    lastAppliedFill,
    selectionRange,
    isFillDragging,
  })

  const scrollSyncService = useDataGridTableStageScrollSync({
    bodyViewportRef,
    isColumnResizing,
    applyColumnResizeFromPointer,
    stopColumnResize,
    handleInteractionWindowMouseMove,
    handleInteractionWindowMouseUp,
    syncViewport: syncViewportFromDom,
  })

  const stageServices = {
    columns: columnService,
    rowSelection: rowSelectionService,
    history: historyService,
    cellIo: cellIoService,
    viewportKeyboard: viewportKeyboardService,
    visualSelection: visualSelectionService,
    fillAction: fillActionService,
    scrollSync: scrollSyncService,
  } as const

  const {
    tableStageProps,
    tableStageContext,
  } = useDataGridTableStageBindings<TRow>({
    mode: options.mode,
    rowHeightMode: options.rowHeightMode,
    layoutMode: options.layoutMode,
    visibleColumns: orderedVisibleColumns,
    renderedColumns,
    displayRows,
    pinnedBottomRows,
    sourceRows: options.sourceRows ?? options.rows,
    showRowIndex,
    rowHover: computed(() => options.rowHover?.value === true),
    stripedRows: computed(() => options.stripedRows?.value === true),
    columnFilterTextByKey: options.columnFilterTextByKey,
    gridContentStyle,
    mainTrackStyle,
    indexColumnStyle: stageIndexColumnStyle,
    stageStyle,
    bodyShellStyle,
    topSpacerHeight,
    bottomSpacerHeight,
    viewportRowStart,
    columnWindowStart: viewportColumnStart,
    leftColumnSpacerWidth,
    rightColumnSpacerWidth,
    editingCellValueRef: editingCellValue,
    editingCellInitialFilter,
    editingCellOpenOnMount,
    selectionRange,
    selectionAnchorCell,
    fillPreviewRange,
    rangeMovePreviewRange,
    fillHandleEnabled: computed(() => options.enableFillHandle.value),
    rangeMoveEnabled: computed(() => options.enableRangeMove.value),
    isFillDragging,
    isRangeMoving,
    headerViewportRef,
    bodyViewportRef,
    columnStyle: resolveStageColumnStyle,
    toggleSortForColumn: options.toggleSortForColumn,
    sortIndicator: options.sortIndicator,
    setColumnFilterText: options.setColumnFilterText,
    columnMenuEnabled: options.columnMenuEnabled,
    columnMenuValueFilterEnabled: options.columnMenuValueFilterEnabled,
    columnMenuValueFilterRowLimit: options.columnMenuValueFilterRowLimit,
    columnMenuMaxFilterValues: options.columnMenuMaxFilterValues,
    resolveColumnMenuItems: options.resolveColumnMenuItems,
    resolveColumnMenuDisabledItems: options.resolveColumnMenuDisabledItems,
    resolveColumnMenuDisabledReasons: options.resolveColumnMenuDisabledReasons,
    resolveColumnMenuLabels: options.resolveColumnMenuLabels,
    resolveColumnMenuActionOptions: options.resolveColumnMenuActionOptions,
    isColumnFilterActive: options.isColumnFilterActive,
    isColumnGrouped: options.isColumnGrouped,
    resolveColumnGroupOrder: options.resolveColumnGroupOrder,
    resolveColumnMenuSortDirection: options.resolveColumnMenuSortDirection,
    resolveColumnMenuSelectedTokens: options.resolveColumnMenuSelectedTokens,
    applyColumnMenuSort: options.applyColumnMenuSort,
    applyColumnMenuPin: options.applyColumnMenuPin,
    applyColumnMenuGroupBy: options.applyColumnMenuGroupBy,
    applyColumnMenuFilter: options.applyColumnMenuFilter,
    clearColumnMenuFilter: options.clearColumnMenuFilter,
    handleHeaderWheel: stageServices.scrollSync.handleHeaderWheel,
    handleHeaderScroll: stageServices.scrollSync.handleHeaderScroll,
    handleViewportScroll,
    handleViewportKeydown: stageServices.viewportKeyboard.handleViewportKeydown,
    rowClass,
    isRowAutosizeProbe,
    rowStyle,
    isRowInPendingClipboardCut: options.isRowInPendingClipboardCut,
    isRowFocused: stageServices.rowSelection.isRowFocused,
    isRowCheckboxSelected: stageServices.rowSelection.isRowCheckboxSelected,
    allVisibleRowsSelected: stageServices.rowSelection.areAllVisibleRowsSelected,
    someVisibleRowsSelected: stageServices.rowSelection.areSomeVisibleRowsSelected,
    handleRowClick: stageServices.rowSelection.focusRow,
    handleRowIndexClick: stageServices.rowSelection.selectRowRange,
    handleRowIndexKeydown,
    handleToggleAllVisibleRows: stageServices.rowSelection.toggleVisibleRowsSelected,
    toggleGroupRow,
    rowIndexLabel,
    startResize,
    handleResizeDoubleClick,
    startRowResize,
    autosizeRow,
    isCellSelected: stageServices.visualSelection.isCellSelected,
    isSelectionAnchorCell: stageServices.visualSelection.isSelectionAnchorCell,
    shouldHighlightSelectedCell: stageServices.visualSelection.shouldHighlightSelectedCell,
    isCellOnSelectionEdge: stageServices.visualSelection.isCellOnSelectionEdge,
    isCellInFillPreview,
    isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge,
    isEditingCell,
    isCellEditable: (row, rowOffset, column, columnIndex) => {
      void columnIndex
      return isCellEditable(row, viewportRowStart.value + rowOffset, column)
    },
    handleCellMouseDown,
    handleCellClick: stageServices.cellIo.handleCellClick,
    handleCellKeydown,
    startInlineEdit,
    isFillHandleCell,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    fillActionAnchorCell: stageServices.fillAction.fillActionAnchorCell,
    fillActionBehavior: stageServices.fillAction.fillActionBehavior,
    applyFillActionBehavior: applyLastFillBehavior,
    handleEditorKeydown,
    commitInlineEdit,
    cancelInlineEdit,
    readCell: stageServices.cellIo.readStageCell,
    readDisplayCell: stageServices.cellIo.readStageDisplayCell,
  })

  useDataGridAppRuntimeSync({
    mode: options.mode,
    rows: options.rows,
    runtime: options.runtime as never,
    totalRows: totalBodyRows,
    rowVersion: options.rowVersion,
    rowHeightMode: options.rowHeightMode,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    syncSelectionSnapshotFromRuntime: options.syncSelectionSnapshotFromRuntime,
    syncRowSelectionSnapshotFromRuntime,
    syncViewport: syncViewportFromDom,
    scheduleViewportSync,
    measureVisibleRowHeights,
    applyRowHeightSettings: options.applyRowHeightSettings,
  })

  useDataGridAppViewportLifecycle({
    bodyViewportRef,
    syncViewport: syncViewportFromDom,
    handleWindowMouseMove: stageServices.scrollSync.handleWindowMouseMove,
    handleWindowMouseUp: stageServices.scrollSync.handleWindowMouseUp,
    cancelScheduledViewportSync,
    onAfterMount: () => {
      options.syncSelectionSnapshotFromRuntime()
      syncRowSelectionSnapshotFromRuntime()
      void nextTick(() => {
        options.applyRowHeightSettings()
        syncViewportFromDom()
      })
    },
    dispose: [
      disposeRowSizing,
      disposeHeaderResize,
      disposeInteractionController,
      stageServices.history.disposeIntentHistory,
    ],
  })

  return {
    tableStageProps,
    tableStageContext,
    syncViewportFromDom,
    copySelectedCells,
    pasteSelectedCells,
    cutSelectedCells,
    clearSelectedCells,
    captureHistorySnapshot,
    recordHistoryIntentTransaction,
  }
}
