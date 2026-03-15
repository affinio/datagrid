import { computed, nextTick, ref, type ComputedRef, type Ref } from "vue"
import {
  buildDataGridCellRenderModel,
  resolveDataGridCellClickAction,
  toggleDataGridCellValue,
} from "@affino/datagrid-core"
import type {
  DataGridAppRowSnapshot,
  DataGridColumnSnapshot,
  DataGridRowId,
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
  useDataGridAppIntentHistory,
  useDataGridAppRowPresentation,
  useDataGridAppRowSizing,
  useDataGridAppRuntimeSync,
  useDataGridAppViewport,
  useDataGridAppViewportLifecycle,
} from "@affino/datagrid-vue"
import type { DataGridCellEditablePredicate } from "./dataGridEditability"
import type { DataGridVirtualizationOptions } from "./dataGridVirtualization"
import { useDataGridTableStageBindings } from "./useDataGridTableStageBindings"
import type { DataGridTableStageProps } from "./dataGridTableStage.types"

const DEFAULT_COLUMN_WIDTH = 140
const INDEX_COLUMN_WIDTH = 72
const ROW_SELECTION_COLUMN_WIDTH = 36
const MIN_COLUMN_WIDTH = 80
const MIN_ROW_HEIGHT = 24
const AUTO_RESIZE_SAMPLE_LIMIT = 400
const ROW_SELECTION_COLUMN_KEY = "__datagrid_row_selection__"

export interface UseDataGridTableStageRuntimeOptions<TRow extends Record<string, unknown>> {
  mode: Ref<"base" | "tree" | "pivot" | "worker">
  rows: Ref<readonly TRow[]>
  sourceRows?: Ref<readonly TRow[]>
  runtime: Pick<
    import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>,
    "api" | "syncRowsInRange" | "virtualWindow" | "columnSnapshot"
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
  rowSelectionSnapshot: Ref<DataGridRowSelectionSnapshot | null>
  syncRowSelectionSnapshotFromRuntime?: () => void
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
  const syncRowSelectionSnapshotFromRuntime = options.syncRowSelectionSnapshotFromRuntime ?? (() => undefined)
  const rowSelectionSnapshotRef = options.rowSelectionSnapshot ?? ref<DataGridRowSelectionSnapshot | null>(null)
  const hasRowSelectionSupport = computed(() => options.runtime.api.rowSelection.hasSupport())

  const rowSelectionColumn = computed<DataGridColumnSnapshot | null>(() => {
    if (!hasRowSelectionSupport.value) {
      return null
    }
    return {
      key: ROW_SELECTION_COLUMN_KEY,
      state: {
        visible: true,
        pin: "left",
        width: ROW_SELECTION_COLUMN_WIDTH,
      },
      visible: true,
      pin: "left",
      width: ROW_SELECTION_COLUMN_WIDTH,
      column: {
        key: ROW_SELECTION_COLUMN_KEY,
        label: "",
        cellType: "checkbox",
        minWidth: ROW_SELECTION_COLUMN_WIDTH,
        maxWidth: ROW_SELECTION_COLUMN_WIDTH,
        capabilities: {
          editable: true,
          sortable: false,
          filterable: false,
          groupable: false,
          pivotable: false,
          aggregatable: false,
        },
        presentation: {
          align: "center",
          headerAlign: "center",
        },
        meta: {
          isSystem: true,
          rowSelection: true,
        },
      },
    }
  })

  const isRowSelectionColumnKey = (columnKey: string): boolean => columnKey === ROW_SELECTION_COLUMN_KEY
  const isRowSelectionColumn = (column: DataGridColumnSnapshot): boolean => isRowSelectionColumnKey(column.key)

  const orderedVisibleColumns = computed(() => {
    const selectionColumn = rowSelectionColumn.value
    const left = options.visibleColumns.value.filter(column => column.pin === "left")
    const center = options.visibleColumns.value.filter(column => column.pin !== "left" && column.pin !== "right")
    const right = options.visibleColumns.value.filter(column => column.pin === "right")
    return selectionColumn ? [selectionColumn, ...left, ...center, ...right] : [...left, ...center, ...right]
  })
  const centerColumns = computed(() => (
    orderedVisibleColumns.value.filter(column => column.pin !== "left" && column.pin !== "right")
  ))
  const resolveColumnWidth = (column: DataGridColumnSnapshot): number => {
    return column.width ?? DEFAULT_COLUMN_WIDTH
  }
  const isColumnEditable = (column: DataGridColumnSnapshot): boolean => {
    return column.column.capabilities?.editable !== false
  }
  const isCellEditable = (
    row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
    rowIndex: number,
    column: DataGridColumnSnapshot,
  ): boolean => {
    if (isRowSelectionColumn(column)) {
      return row.kind !== "group" && row.rowId != null
    }
    if (row.kind === "group" || row.rowId == null || !isColumnEditable(column)) {
      return false
    }
    if (!options.isCellEditable) {
      return true
    }
    return options.isCellEditable({
      row: row.data as TRow,
      rowId: row.rowId,
      rowIndex,
      column: column.column,
      columnKey: column.key,
    })
  }
  const resolveEditableColumn = (
    columnKey: string,
    columnIndex: number,
  ): { column: DataGridColumnSnapshot; columnIndex: number } | null => {
    const columnAtIndex = orderedVisibleColumns.value[columnIndex]
    if (columnAtIndex?.key === columnKey) {
      return { column: columnAtIndex, columnIndex }
    }
    const resolvedColumnIndex = orderedVisibleColumns.value.findIndex(column => column.key === columnKey)
    if (resolvedColumnIndex < 0) {
      return null
    }
    return {
      column: orderedVisibleColumns.value[resolvedColumnIndex] as DataGridColumnSnapshot,
      columnIndex: resolvedColumnIndex,
    }
  }
  const isCellEditableByKey = (
    row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
    rowIndex: number,
    columnKey: string,
    columnIndex: number,
  ): boolean => {
    const resolved = resolveEditableColumn(columnKey, columnIndex)
    if (!resolved) {
      return false
    }
    return isCellEditable(row, rowIndex, resolved.column)
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
    resolveColumnWidth,
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

  const rowSelectionSet = computed(() => new Set(rowSelectionSnapshotRef.value?.selectedRows ?? []))
  const stageIndexColumnStyle = computed(() => {
    const width = `${INDEX_COLUMN_WIDTH}px`
    return {
      ...indexColumnStyle.value,
      width,
      minWidth: width,
      maxWidth: width,
    }
  })

  const isRowFocused = (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>): boolean => {
    return row.rowId != null && rowSelectionSnapshotRef.value?.focusedRow === row.rowId
  }

  const isRowCheckboxSelected = (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>): boolean => {
    return row.kind !== "group" && row.rowId != null && rowSelectionSet.value.has(row.rowId)
  }

  const readRowSelectionValue = (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>): boolean => {
    return isRowCheckboxSelected(row)
  }

  const readRowSelectionCell = (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>): string => {
    return readRowSelectionValue(row) ? "true" : "false"
  }

  const readRowSelectionDisplayCell = (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>): string => {
    const column = rowSelectionColumn.value?.column
    if (!column || row.kind === "group") {
      return ""
    }
    return buildDataGridCellRenderModel({
      column,
      value: readRowSelectionValue(row),
    }).displayValue
  }

  const resolveVisibleSelectableRowIds = (): DataGridRowId[] => {
    return displayRows.value.flatMap(row => {
      if (row.kind === "group" || row.rowId == null) {
        return []
      }
      return [row.rowId]
    })
  }

  const areAllVisibleRowsSelected = computed(() => {
    const rowIds = resolveVisibleSelectableRowIds()
    return rowIds.length > 0 && rowIds.every(rowId => rowSelectionSet.value.has(rowId))
  })

  const areSomeVisibleRowsSelected = computed(() => {
    const rowIds = resolveVisibleSelectableRowIds()
    return rowIds.some(rowId => rowSelectionSet.value.has(rowId))
  })

  const focusRow = (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>): void => {
    if (row.rowId == null || !options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    options.runtime.api.rowSelection.setFocusedRow(row.rowId)
  }

  const toggleRowCheckboxSelected = (
    row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
  ): void => {
    if (row.kind === "group" || row.rowId == null || !options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    options.runtime.api.rowSelection.setSelected(row.rowId, !rowSelectionSet.value.has(row.rowId))
  }

  const toggleVisibleRowsSelected = (): void => {
    if (!options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    const rowIds = resolveVisibleSelectableRowIds()
    if (!areAllVisibleRowsSelected.value) {
      options.runtime.api.rowSelection.selectRows(rowIds)
      return
    }
    options.runtime.api.rowSelection.deselectRows(rowIds)
  }

  const selectRowRange = (
    row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
    rowOffset: number,
    extend: boolean,
  ): void => {
    focusRow(row)
    const lastColumnIndex = orderedVisibleColumns.value.length - 1
    if (lastColumnIndex < 0) {
      return
    }
    const rowIndex = viewportRowStart.value + rowOffset
    if (!extend) {
      applyClipboardSelectionRange({
        startRow: rowIndex,
        endRow: rowIndex,
        startColumn: 0,
        endColumn: lastColumnIndex,
      })
      return
    }
    const anchorRowIndex = selectionAnchorCell.value?.rowIndex ?? rowIndex
    applyClipboardSelectionRange({
      startRow: Math.min(anchorRowIndex, rowIndex),
      endRow: Math.max(anchorRowIndex, rowIndex),
      startColumn: 0,
      endColumn: lastColumnIndex,
    })
  }

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
    readDisplayCell,
    rowClass,
    toggleGroupRow,
  } = useDataGridAppRowPresentation<TRow>({
    mode: options.mode,
    runtime: options.runtime as never,
    viewportRowStart,
    firstColumnKey: options.firstColumnKey,
  })

  const readStageCell = (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>, columnKey: string): string => {
    if (isRowSelectionColumnKey(columnKey)) {
      return readRowSelectionCell(row)
    }
    return readCell(row, columnKey)
  }

  const readStageDisplayCell = (
    row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
    columnKey: string,
  ): string => {
    if (isRowSelectionColumnKey(columnKey)) {
      return readRowSelectionDisplayCell(row)
    }
    return readDisplayCell(row, columnKey)
  }

  const handleCellClick = (
    row: import("@affino/datagrid-core").DataGridRowNode<TRow>,
    rowOffset: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ): void => {
    if (isRowSelectionColumn(column)) {
      toggleRowCheckboxSelected(row)
      return
    }
    const rowIndex = viewportRowStart.value + rowOffset
    const editable = isCellEditableByKey(row, rowIndex, column.key, columnIndex)
    const clickAction = resolveDataGridCellClickAction({
      column: column.column,
      row: row.kind !== "group" ? row.data : undefined,
      editable,
    })
    if (clickAction !== "toggle") {
      return
    }
    if (row.kind === "group" || row.rowId == null) {
      return
    }
    const beforeSnapshot = captureHistorySnapshot()
    options.runtime.api.rows.applyEdits([
      {
        rowId: row.rowId,
        data: {
          [column.key]: toggleDataGridCellValue({
            column: column.column,
            row: row.data,
          }),
        } as Partial<TRow>,
      },
    ])
    recordHistoryIntentTransaction({
      intent: "edit",
      label: `Toggle ${column.key}`,
      affectedRange: {
        startRow: rowIndex,
        endRow: rowIndex,
        startColumn: columnIndex,
        endColumn: columnIndex,
      },
    }, beforeSnapshot)
    syncViewportFromDom()
  }

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
    cancelInlineEdit,
    handleEditorKeydown,
  } = useDataGridAppInlineEditing<TRow, unknown>({
    mode: options.mode,
    bodyViewportRef,
    visibleColumns: orderedVisibleColumns,
    totalRows: options.totalRows,
    runtime: options.runtime as never,
    readCell: (row, columnKey) => readStageCell(row, columnKey),
    resolveRowIndexById,
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

  const editingCellRef = computed(() => editingCell.value)

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
    readCell: (row, columnKey) => readStageCell(row, columnKey),
    isCellEditable: isCellEditableByKey,
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
    handleToggleCellAction: (row, rowIndex, columnIndex, column) => {
      if (!isRowSelectionColumn(column)) {
        return false
      }
      void rowIndex
      void columnIndex
      toggleRowCheckboxSelected(row)
      return true
    },
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

  const selectionRange = computed(() => (
    interactionSelectionRange.value ?? resolveSelectionRangeForClipboard()
  ))

  const resolveVisualSelectionRange = (): DataGridCopyRange | null => selectionRange.value

  const isVisualFillSelectionActive = (): boolean => {
    return options.mode.value === "base" && isFillDragging.value && Boolean(fillPreviewRange.value)
  }

  const isCellWithinRange = (
    range: DataGridCopyRange,
    rowOffset: number,
    columnIndex: number,
  ): boolean => {
    const rowIndex = viewportRowStart.value + rowOffset
    return (
      rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && columnIndex >= range.startColumn
      && columnIndex <= range.endColumn
    )
  }

  const isSelectionAnchorCell = (rowOffset: number, columnIndex: number): boolean => {
    if (selectionAnchorCell.value) {
      return selectionAnchorCell.value.rowIndex === viewportRowStart.value + rowOffset
        && selectionAnchorCell.value.columnIndex === columnIndex
    }
    return isCommittedSelectionAnchorCell(rowOffset, columnIndex)
  }

  const isCellSelected = (rowOffset: number, columnIndex: number): boolean => {
    if (!isVisualFillSelectionActive()) {
      return isCommittedCellSelected(rowOffset, columnIndex)
    }
    const range = resolveVisualSelectionRange()
    return range ? isCellWithinRange(range, rowOffset, columnIndex) : false
  }

  const shouldHighlightSelectedCell = (rowOffset: number, columnIndex: number): boolean => {
    if (!isVisualFillSelectionActive()) {
      return shouldHighlightCommittedSelectedCell(rowOffset, columnIndex)
    }
    const range = resolveVisualSelectionRange()
    if (!range || !isCellWithinRange(range, rowOffset, columnIndex)) {
      return false
    }
    const isSingleCell = range.startRow === range.endRow && range.startColumn === range.endColumn
    if (isSingleCell) {
      return false
    }
    return !isSelectionAnchorCell(rowOffset, columnIndex)
  }

  const isCellOnSelectionEdge = (
    rowOffset: number,
    columnIndex: number,
    edge: "top" | "right" | "bottom" | "left",
  ): boolean => {
    if (!isVisualFillSelectionActive()) {
      return isCommittedCellOnSelectionEdge(rowOffset, columnIndex, edge)
    }
    const range = resolveVisualSelectionRange()
    if (!range || !isCellWithinRange(range, rowOffset, columnIndex)) {
      return false
    }
    const rowIndex = viewportRowStart.value + rowOffset
    switch (edge) {
      case "top":
        return rowIndex === range.startRow
      case "right":
        return columnIndex === range.endColumn
      case "bottom":
        return rowIndex === range.endRow
      case "left":
        return columnIndex === range.startColumn
    }
  }

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
    indexColumnStyle: stageIndexColumnStyle,
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
    isFillDragging,
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
    isRowFocused,
    isRowCheckboxSelected,
    allVisibleRowsSelected: areAllVisibleRowsSelected,
    someVisibleRowsSelected: areSomeVisibleRowsSelected,
    handleRowClick: focusRow,
    handleRowIndexClick: selectRowRange,
    handleToggleAllVisibleRows: toggleVisibleRowsSelected,
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
    isCellEditable: (row, rowOffset, column, columnIndex) => {
      void columnIndex
      return isCellEditable(row, viewportRowStart.value + rowOffset, column)
    },
    handleCellMouseDown,
    handleCellClick,
    handleCellKeydown,
    startInlineEdit,
    isFillHandleCell,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    fillActionAnchorCell,
    fillActionBehavior,
    applyFillActionBehavior: applyLastFillBehavior,
    handleEditorKeydown,
    commitInlineEdit,
    cancelInlineEdit,
    readCell: readStageCell,
    readDisplayCell: readStageDisplayCell,
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
    syncRowSelectionSnapshotFromRuntime,
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
      disposeIntentHistory,
    ],
  })

  return {
    tableStageProps,
    syncViewportFromDom,
  }
}
