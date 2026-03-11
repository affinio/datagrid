import { computed, nextTick, ref, type ComputedRef, type Ref } from "vue"
import type {
  DataGridAppRowSnapshot,
  DataGridColumnSnapshot,
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
  useDataGridAppIntentHistory,
  useDataGridAppRowPresentation,
  useDataGridAppRowSizing,
  useDataGridAppRuntimeSync,
  useDataGridAppViewport,
  useDataGridAppViewportLifecycle,
} from "@affino/datagrid-vue"
import type { DataGridVirtualizationOptions } from "./dataGridVirtualization"
import { useDataGridTableStageBindings } from "./useDataGridTableStageBindings"
import type { DataGridTableStageProps } from "./dataGridTableStage.types"

const DEFAULT_COLUMN_WIDTH = 140
const INDEX_COLUMN_WIDTH = 72
const MIN_COLUMN_WIDTH = 80
const MIN_ROW_HEIGHT = 24
const AUTO_RESIZE_SAMPLE_LIMIT = 400

export interface UseDataGridTableStageRuntimeOptions<TRow extends Record<string, unknown>> {
  mode: Ref<"base" | "tree" | "pivot" | "worker">
  rows: Ref<readonly TRow[]>
  sourceRows?: Ref<readonly TRow[]>
  runtime: Pick<
    import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>,
    "api" | "syncRowsInRange" | "virtualWindow"
  >
  rowVersion: Ref<number>
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  rowRenderMode: Ref<"virtualization" | "pagination">
  rowHeightMode: Ref<"fixed" | "auto">
  normalizedBaseRowHeight: Ref<number>
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  selectionAnchor: Ref<unknown>
  syncSelectionSnapshotFromRuntime: () => void
  firstColumnKey: Ref<string>
  columnFilterTextByKey: Ref<Record<string, string>>
  virtualization: Ref<DataGridVirtualizationOptions>
  toggleSortForColumn: (columnKey: string, additive?: boolean) => void
  sortIndicator: (columnKey: string) => string
  setColumnFilterText: (columnKey: string, value: string) => void
  columnMenuEnabled?: Ref<boolean>
  columnMenuMaxFilterValues?: Ref<number>
  isColumnFilterActive?: (columnKey: string) => boolean
  resolveColumnMenuSortDirection?: (columnKey: string) => "asc" | "desc" | null
  resolveColumnMenuSelectedTokens?: (columnKey: string) => readonly string[]
  applyColumnMenuSort?: (columnKey: string, direction: "asc" | "desc" | null) => void
  applyColumnMenuPin?: (columnKey: string, pin: import("@affino/datagrid-vue").DataGridColumnPin) => void
  applyColumnMenuFilter?: (columnKey: string, tokens: readonly string[]) => void
  clearColumnMenuFilter?: (columnKey: string) => void
  applyRowHeightSettings: () => void
  cloneRowData: (row: TRow) => TRow
  applyClipboardEdits?: (
    range: DataGridCopyRange,
    matrix: string[][],
    options?: { recordHistory?: boolean },
  ) => number
  buildFillMatrixFromRange?: (range: DataGridCopyRange) => string[][]
  applyRangeMove?: (baseRange: DataGridCopyRange, targetRange: DataGridCopyRange) => boolean
  history?: DataGridTableStageHistoryAdapter
}

export interface UseDataGridTableStageRuntimeResult<TRow extends Record<string, unknown>> {
  tableStageProps: ComputedRef<DataGridTableStageProps<TRow>>
  syncViewportFromDom: () => void
}

export interface DataGridTableStageHistoryAdapter {
  captureSnapshot: () => unknown
  recordIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
  ) => void | Promise<void>
  canUndo: () => boolean
  canRedo: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
}

export function useDataGridTableStageRuntime<
  TRow extends Record<string, unknown>,
>(
  options: UseDataGridTableStageRuntimeOptions<TRow>,
): UseDataGridTableStageRuntimeResult<TRow> {
  const columnWidths = ref<Record<string, number>>({})
  const orderedVisibleColumns = computed(() => {
    const left = options.visibleColumns.value.filter(column => column.pin === "left")
    const center = options.visibleColumns.value.filter(column => column.pin !== "left" && column.pin !== "right")
    const right = options.visibleColumns.value.filter(column => column.pin === "right")
    return [...left, ...center, ...right]
  })
  const centerColumns = computed(() => (
    orderedVisibleColumns.value.filter(column => column.pin !== "left" && column.pin !== "right")
  ))
  const resolveColumnWidth = (column: DataGridColumnSnapshot): number => {
    return columnWidths.value[column.key] ?? column.width ?? DEFAULT_COLUMN_WIDTH
  }
  const rowHeightMetrics = createDataGridAppRowHeightMetrics({
    totalRows: () => options.totalRows.value,
    resolveBaseRowHeight: () => options.normalizedBaseRowHeight.value,
    resolveRowHeightOverride: rowIndex => options.runtime.api.view.getRowHeightOverride(rowIndex),
    resolveRowHeightVersion: () => options.runtime.api.view.getRowHeightVersion(),
  })

  const {
    headerViewportRef,
    bodyViewportRef,
    displayRows,
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
    columnStyle,
    handleViewportScroll,
    syncViewportFromDom,
    scheduleViewportSync,
    cancelScheduledViewportSync,
  } = useDataGridAppViewport<TRow>({
    runtime: options.runtime as never,
    mode: options.mode,
    rowRenderMode: options.rowRenderMode,
    rowVirtualizationEnabled: computed(() => options.virtualization.value.rows),
    columnVirtualizationEnabled: computed(() => options.virtualization.value.columns),
    totalRows: options.totalRows,
    visibleColumns: centerColumns,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    columnWidths,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    indexColumnWidth: 0,
    rowOverscan: computed(() => options.virtualization.value.rowOverscan),
    columnOverscan: computed(() => options.virtualization.value.columnOverscan),
    measureVisibleRowHeights: () => measureVisibleRowHeights(),
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowOffset: rowHeightMetrics.resolveRowOffset,
    resolveRowIndexAtOffset: rowHeightMetrics.resolveRowIndexAtOffset,
    resolveTotalRowHeight: rowHeightMetrics.resolveTotalHeight,
  })

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
    runtime: options.runtime as never,
    minRowHeight: MIN_ROW_HEIGHT,
    syncViewport: () => syncViewportFromDom(),
  })

  const selectionController = useDataGridAppCellSelection<TRow>({
    mode: options.mode,
    runtime: options.runtime as never,
    totalRows: options.totalRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    selectionSnapshot: options.selectionSnapshot,
    selectionAnchor: options.selectionAnchor as never,
    isEditingCell: (row, columnKey) => isEditingCell(row, columnKey),
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
    isCellSelected,
  } = selectionController
  const isSelectionAnchorCell = selectionController.isSelectionAnchorCell ?? (() => false)
  const shouldHighlightSelectedCell = selectionController.shouldHighlightSelectedCell
    ?? ((rowOffset: number, columnIndex: number) => isCellSelected(rowOffset, columnIndex))
  const isCellOnSelectionEdge = selectionController.isCellOnSelectionEdge
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

  const resolveRowIndexById = (rowId: string | number): number => {
    const count = options.runtime.api.rows.getCount()
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      if (options.runtime.api.rows.get(rowIndex)?.rowId === rowId) {
        return rowIndex
      }
    }
    return -1
  }

  const internalIntentHistory = options.history
    ? null
    : useDataGridAppIntentHistory<TRow>({
      runtime: options.runtime as never,
      cloneRowData: options.cloneRowData,
      syncViewport: () => syncViewportFromDom(),
    })

  const captureHistorySnapshot = (): unknown => {
    if (options.history) {
      return options.history.captureSnapshot()
    }
    return internalIntentHistory?.captureRowsSnapshot() ?? null
  }

  const recordHistoryIntentTransaction = (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
  ): void => {
    if (options.history) {
      void options.history.recordIntentTransaction(descriptor, beforeSnapshot)
      return
    }
    void internalIntentHistory?.recordIntentTransaction(
      descriptor,
      beforeSnapshot as DataGridAppRowSnapshot<TRow>,
    )
  }

  const canUndoHistory = (): boolean => {
    return options.history ? options.history.canUndo() : (internalIntentHistory?.canUndo.value ?? false)
  }

  const canRedoHistory = (): boolean => {
    return options.history ? options.history.canRedo() : (internalIntentHistory?.canRedo.value ?? false)
  }

  const runHistoryAction = (direction: "undo" | "redo"): Promise<string | null> => {
    if (options.history) {
      return options.history.runHistoryAction(direction)
    }
    return internalIntentHistory?.runHistoryAction(direction) ?? Promise.resolve(null)
  }

  const disposeIntentHistory = (): void => {
    internalIntentHistory?.dispose()
  }

  const {
    rowIndexLabel,
    readCell,
    rowClass,
    toggleGroupRow,
  } = useDataGridAppRowPresentation<TRow>({
    mode: options.mode,
    runtime: options.runtime as never,
    viewportRowStart,
    firstColumnKey: options.firstColumnKey,
  })

  const clipboard = useDataGridAppClipboard<TRow, unknown>({
    mode: options.mode,
    runtime: options.runtime as never,
    totalRows: options.totalRows,
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
    readCell: (row, columnKey) => readCell(row, columnKey),
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
    columnWidths,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowOffset: rowHeightMetrics.resolveRowOffset,
    indexColumnWidth: INDEX_COLUMN_WIDTH,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    syncViewport: () => syncViewportFromDom(),
  })

  const {
    editingCell,
    editingCellValue,
    isEditingCell,
    startInlineEdit,
    commitInlineEdit,
    handleEditorKeydown,
  } = useDataGridAppInlineEditing<TRow, unknown>({
    mode: options.mode,
    bodyViewportRef,
    visibleColumns: orderedVisibleColumns,
    totalRows: options.totalRows,
    runtime: options.runtime as never,
    readCell: (row, columnKey) => readCell(row, columnKey),
    resolveRowIndexById,
    applyCellSelection: coord => {
      applyCellSelectionByCoord(coord, false)
    },
    ensureActiveCellVisible: (rowIndex, columnIndex) => {
      ensureKeyboardActiveCellVisible(rowIndex, columnIndex)
    },
    captureRowsSnapshot: captureHistorySnapshot,
    recordEditTransaction: beforeSnapshot => {
      recordHistoryIntentTransaction({
        intent: "edit",
        label: "Cell edit",
      }, beforeSnapshot)
    },
  })

  const editingCellRef = computed(() => editingCell.value)

  const {
    isPointerSelectingCells,
    isFillDragging,
    fillPreviewRange,
    lastAppliedFill,
    isRangeMoving,
    selectionRange,
    rangeMovePreviewRange,
    stopPointerSelection,
    stopFillSelection,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    applyLastFillBehavior,
    handleCellMouseDown,
    handleCellKeydown,
    handleWindowMouseMove: handleInteractionWindowMouseMove,
    handleWindowMouseUp: handleInteractionWindowMouseUp,
    isCellInFillPreview,
    isFillHandleCell,
    dispose: disposeInteractionController,
  } = useDataGridAppInteractionController<TRow, unknown>({
    mode: options.mode,
    runtime: options.runtime as never,
    totalRows: options.totalRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    selectionSnapshot: options.selectionSnapshot,
    bodyViewportRef,
    indexColumnWidth: INDEX_COLUMN_WIDTH,
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
    readCell: (row, columnKey) => readCell(row, columnKey),
    cloneRowData: options.cloneRowData,
    resolveRowIndexById,
    captureRowsSnapshot: captureHistorySnapshot,
    recordIntentTransaction: (descriptor, beforeSnapshot) => {
      recordHistoryIntentTransaction(descriptor, beforeSnapshot)
    },
    clearPendingClipboardOperation,
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
  })

  const fillActionAnchorCell = computed(() => {
    const session = lastAppliedFill.value
    const activeSelectionRange = selectionRange.value
    if (!session || !activeSelectionRange || isFillDragging.value) {
      return null
    }
    if (session.allowBehaviorToggle === false) {
      return null
    }
    if (!rangesEqual(session.previewRange, activeSelectionRange)) {
      return null
    }
    return {
      rowIndex: session.previewRange.endRow,
      columnIndex: session.previewRange.endColumn,
    }
  })

  const fillActionBehavior = computed(() => lastAppliedFill.value?.behavior ?? null)

  const isViewportOwnedKeyboardEvent = (event: KeyboardEvent): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false
    }
    return (
      event.key.startsWith("Arrow")
      || event.key === "Home"
      || event.key === "End"
      || event.key === "PageUp"
      || event.key === "PageDown"
      || event.key === "Tab"
      || event.key === "Enter"
      || event.key === " "
      || event.key === "Spacebar"
      || event.key === "F2"
      || event.key === "Escape"
      || event.key.length === 1
    )
  }

  const isViewportSelectAllKeyboardEvent = (event: KeyboardEvent): boolean => {
    return (event.ctrlKey || event.metaKey)
      && !event.altKey
      && !event.shiftKey
      && event.key.toLowerCase() === "a"
  }

  const selectAllVisibleCells = (): void => {
    const lastRowIndex = options.totalRows.value - 1
    const lastColumnIndex = orderedVisibleColumns.value.length - 1
    if (lastRowIndex < 0 || lastColumnIndex < 0) {
      return
    }
    applyClipboardSelectionRange({
      startRow: 0,
      endRow: lastRowIndex,
      startColumn: 0,
      endColumn: lastColumnIndex,
    })
  }

  const handleViewportKeydown = (event: KeyboardEvent): void => {
    if (isViewportOwnedKeyboardEvent(event) || isViewportSelectAllKeyboardEvent(event)) {
      event.preventDefault()
    }
    const activeCell = options.selectionSnapshot.value?.activeCell
    if (!activeCell) {
      if (isViewportSelectAllKeyboardEvent(event)) {
        selectAllVisibleCells()
      }
      return
    }
    const row = options.runtime.api.rows.get(activeCell.rowIndex)
    if (!row) {
      return
    }
    handleCellKeydown(
      event,
      row,
      activeCell.rowIndex - viewportRowStart.value,
      activeCell.colIndex,
    )
  }

  const {
    isColumnResizing,
    startResize,
    handleResizeDoubleClick,
    applyColumnResizeFromPointer,
    stopColumnResize,
    dispose: disposeHeaderResize,
  } = useDataGridAppHeaderResize<TRow>({
    visibleColumns: orderedVisibleColumns,
    columnWidths,
    rows: options.rows,
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

  const {
    tableStageProps,
  } = useDataGridTableStageBindings<TRow>({
    mode: options.mode,
    rowHeightMode: options.rowHeightMode,
    visibleColumns: orderedVisibleColumns,
    renderedColumns,
    displayRows,
    sourceRows: options.sourceRows ?? options.rows,
    columnFilterTextByKey: options.columnFilterTextByKey,
    gridContentStyle,
    mainTrackStyle,
    indexColumnStyle,
    topSpacerHeight,
    bottomSpacerHeight,
    viewportRowStart,
    columnWindowStart: viewportColumnStart,
    leftColumnSpacerWidth,
    rightColumnSpacerWidth,
    editingCellValueRef: editingCellValue,
    selectionRange,
    selectionAnchorCell,
    fillPreviewRange,
    rangeMovePreviewRange,
    isRangeMoving,
    headerViewportRef,
    bodyViewportRef,
    columnStyle,
    toggleSortForColumn: options.toggleSortForColumn,
    sortIndicator: options.sortIndicator,
    setColumnFilterText: options.setColumnFilterText,
    columnMenuEnabled: options.columnMenuEnabled,
    columnMenuMaxFilterValues: options.columnMenuMaxFilterValues,
    isColumnFilterActive: options.isColumnFilterActive,
    resolveColumnMenuSortDirection: options.resolveColumnMenuSortDirection,
    resolveColumnMenuSelectedTokens: options.resolveColumnMenuSelectedTokens,
    applyColumnMenuSort: options.applyColumnMenuSort,
    applyColumnMenuPin: options.applyColumnMenuPin,
    applyColumnMenuFilter: options.applyColumnMenuFilter,
    clearColumnMenuFilter: options.clearColumnMenuFilter,
    handleHeaderWheel,
    handleHeaderScroll,
    handleViewportScroll,
    handleViewportKeydown,
    rowClass,
    isRowAutosizeProbe,
    rowStyle,
    toggleGroupRow,
    rowIndexLabel,
    startResize,
    handleResizeDoubleClick,
    startRowResize,
    autosizeRow,
    isCellSelected,
    isSelectionAnchorCell,
    shouldHighlightSelectedCell,
    isCellOnSelectionEdge,
    isCellInFillPreview,
    isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge,
    isEditingCell,
    handleCellMouseDown,
    handleCellKeydown,
    startInlineEdit,
    isFillHandleCell,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    fillActionAnchorCell,
    fillActionBehavior,
    applyFillActionBehavior: applyLastFillBehavior,
    handleEditorKeydown,
    commitInlineEdit: () => {
      commitInlineEdit()
    },
    readCell,
  })

  const handleWindowMouseMove = (event: MouseEvent): void => {
    if (isColumnResizing.value) {
      applyColumnResizeFromPointer(event.clientX)
      return
    }
    handleInteractionWindowMouseMove(event)
  }

  function handleHeaderWheel(event: WheelEvent): void {
    const bodyViewport = bodyViewportRef.value
    if (!bodyViewport) {
      return
    }

    const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : (event.shiftKey ? event.deltaY : 0)
    const verticalDelta = horizontalDelta === 0 ? event.deltaY : 0
    if (horizontalDelta === 0 && verticalDelta === 0) {
      return
    }

    event.preventDefault()
    if (horizontalDelta !== 0) {
      bodyViewport.scrollLeft += horizontalDelta
    }
    if (verticalDelta !== 0) {
      bodyViewport.scrollTop += verticalDelta
    }
    syncViewportFromDom()
  }

  function handleHeaderScroll(event: Event): void {
    const headerViewport = event.target as HTMLElement | null
    const bodyViewport = bodyViewportRef.value
    if (!headerViewport || !bodyViewport) {
      return
    }
    if (bodyViewport.scrollLeft !== headerViewport.scrollLeft) {
      bodyViewport.scrollLeft = headerViewport.scrollLeft
    }
    syncViewportFromDom()
  }

  const handleWindowMouseUp = (): void => {
    stopColumnResize()
    handleInteractionWindowMouseUp()
  }

  useDataGridAppRuntimeSync({
    mode: options.mode,
    rows: options.rows,
    runtime: options.runtime as never,
    totalRows: options.totalRows,
    rowVersion: options.rowVersion,
    rowHeightMode: options.rowHeightMode,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    syncSelectionSnapshotFromRuntime: options.syncSelectionSnapshotFromRuntime,
    syncViewport: syncViewportFromDom,
    scheduleViewportSync,
    measureVisibleRowHeights,
    applyRowHeightSettings: options.applyRowHeightSettings,
  })

  useDataGridAppViewportLifecycle({
    bodyViewportRef,
    syncViewport: syncViewportFromDom,
    handleWindowMouseMove,
    handleWindowMouseUp,
    cancelScheduledViewportSync,
    onAfterMount: () => {
      options.syncSelectionSnapshotFromRuntime()
      void nextTick(() => {
        options.applyRowHeightSettings()
        syncViewportFromDom()
      })
    },
    dispose: [
      disposeRowSizing,
      disposeHeaderResize,
      disposeInteractionController,
      disposeIntentHistory,
    ],
  })

  return {
    tableStageProps,
    syncViewportFromDom,
  }
}
