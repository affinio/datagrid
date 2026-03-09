import { computed, nextTick, ref, type ComputedRef, type Ref } from "vue"
import type {
  DataGridAppRowSnapshot,
  DataGridColumnSnapshot,
  DataGridRowNode,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-vue"
import {
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
  applyRowHeightSettings: () => void
  cloneRowData: (row: TRow) => TRow
}

export interface UseDataGridTableStageRuntimeResult<TRow extends Record<string, unknown>> {
  tableStageProps: ComputedRef<DataGridTableStageProps<TRow>>
  syncViewportFromDom: () => void
}

export function useDataGridTableStageRuntime<
  TRow extends Record<string, unknown>,
>(
  options: UseDataGridTableStageRuntimeOptions<TRow>,
): UseDataGridTableStageRuntimeResult<TRow> {
  const columnWidths = ref<Record<string, number>>({})

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
    visibleColumns: options.visibleColumns,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    columnWidths,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    indexColumnWidth: INDEX_COLUMN_WIDTH,
    rowOverscan: computed(() => options.virtualization.value.rowOverscan),
    columnOverscan: computed(() => options.virtualization.value.columnOverscan),
    measureVisibleRowHeights: () => measureVisibleRowHeights(),
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
  } = useDataGridAppCellSelection<TRow>({
    mode: options.mode,
    runtime: options.runtime as never,
    totalRows: options.totalRows,
    visibleColumns: options.visibleColumns,
    viewportRowStart,
    selectionSnapshot: options.selectionSnapshot,
    selectionAnchor: options.selectionAnchor as never,
    isEditingCell: (row, columnKey) => isEditingCell(row, columnKey),
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

  const {
    captureRowsSnapshot,
    canUndo,
    canRedo,
    runHistoryAction,
    recordIntentTransaction,
    dispose: disposeIntentHistory,
  } = useDataGridAppIntentHistory<TRow>({
    runtime: options.runtime as never,
    cloneRowData: options.cloneRowData,
    syncViewport: () => syncViewportFromDom(),
  })

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
  } = useDataGridAppClipboard<TRow, DataGridAppRowSnapshot<TRow>>({
    mode: options.mode,
    runtime: options.runtime as never,
    totalRows: options.totalRows,
    visibleColumns: options.visibleColumns,
    viewportRowStart,
    resolveSelectionRange: resolveSelectionRangeForClipboard,
    resolveCurrentCellCoord: resolveCurrentCellCoordForClipboard,
    applySelectionRange: applyClipboardSelectionRange,
    clearCellSelection,
    captureRowsSnapshot,
    recordEditTransaction: beforeSnapshot => {
      void recordIntentTransaction({
        intent: "edit",
        label: "Cell edit",
      }, beforeSnapshot)
    },
    readCell: (row, columnKey) => readCell(row, columnKey),
    syncViewport: () => syncViewportFromDom(),
  })

  const {
    ensureKeyboardActiveCellVisible,
  } = useDataGridAppActiveCellViewport({
    bodyViewportRef,
    visibleColumns: options.visibleColumns,
    columnWidths,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
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
  } = useDataGridAppInlineEditing<TRow, DataGridAppRowSnapshot<TRow>>({
    mode: options.mode,
    bodyViewportRef,
    visibleColumns: options.visibleColumns,
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
    captureRowsSnapshot,
    recordEditTransaction: beforeSnapshot => {
      void recordIntentTransaction({
        intent: "edit",
        label: "Cell edit",
      }, beforeSnapshot)
    },
  })

  const editingCellRef = computed(() => editingCell.value)

  const {
    isPointerSelectingCells,
    isFillDragging,
    stopPointerSelection,
    stopFillSelection,
    startFillHandleDrag,
    handleCellMouseDown,
    handleCellKeydown,
    handleWindowMouseMove: handleInteractionWindowMouseMove,
    handleWindowMouseUp: handleInteractionWindowMouseUp,
    isCellInFillPreview,
    isFillHandleCell,
    dispose: disposeInteractionController,
  } = useDataGridAppInteractionController<TRow, DataGridAppRowSnapshot<TRow>>({
    mode: options.mode,
    runtime: options.runtime as never,
    totalRows: options.totalRows,
    visibleColumns: options.visibleColumns,
    viewportRowStart,
    selectionSnapshot: options.selectionSnapshot,
    bodyViewportRef,
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
    captureRowsSnapshot,
    recordIntentTransaction: (descriptor, beforeSnapshot) => {
      void recordIntentTransaction(descriptor, beforeSnapshot)
    },
    clearPendingClipboardOperation,
    copySelectedCells,
    pasteSelectedCells,
    cutSelectedCells,
    normalizeClipboardRange,
    applyClipboardEdits,
    rangesEqual,
    buildFillMatrixFromRange,
    syncViewport: () => syncViewportFromDom(),
    editingCell: editingCellRef,
    startInlineEdit,
    commitInlineEdit,
    canUndo: () => canUndo.value,
    canRedo: () => canRedo.value,
    runHistoryAction,
    ensureKeyboardActiveCellVisible,
  })

  const {
    isColumnResizing,
    startResize,
    handleResizeDoubleClick,
    applyColumnResizeFromPointer,
    stopColumnResize,
    dispose: disposeHeaderResize,
  } = useDataGridAppHeaderResize<TRow>({
    visibleColumns: options.visibleColumns,
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
    visibleColumns: options.visibleColumns,
    renderedColumns,
    displayRows,
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
    headerViewportRef,
    bodyViewportRef,
    columnStyle,
    toggleSortForColumn: options.toggleSortForColumn,
    sortIndicator: options.sortIndicator,
    setColumnFilterText: options.setColumnFilterText,
    handleHeaderWheel,
    handleHeaderScroll,
    handleViewportScroll,
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
    isCellInFillPreview,
    isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge,
    isEditingCell,
    handleCellMouseDown,
    handleCellKeydown,
    startInlineEdit,
    isFillHandleCell,
    startFillHandleDrag,
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
