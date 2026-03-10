import { computed, unref, type ComputedRef, type Ref } from "vue"
import type {
  DataGridElementRefHandler,
  DataGridTableStageProps,
  UseDataGridTableStageBindingsOptions,
} from "./dataGridTableStage.types"

export interface UseDataGridTableStageBindingsResult<TRow extends Record<string, unknown>> {
  tableStageProps: ComputedRef<DataGridTableStageProps<TRow>>
  captureHeaderViewportRef: DataGridElementRefHandler
  captureBodyViewportRef: DataGridElementRefHandler
  updateEditingCellValue: (value: string) => void
}

function createElementRefHandler(target: Ref<HTMLElement | null>): DataGridElementRefHandler {
  return value => {
    target.value = value instanceof HTMLElement ? value : null
  }
}

export function useDataGridTableStageBindings<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStageBindingsOptions<TRow>,
): UseDataGridTableStageBindingsResult<TRow> {
  const captureHeaderViewportRef = createElementRefHandler(options.headerViewportRef)
  const captureBodyViewportRef = createElementRefHandler(options.bodyViewportRef)

  const updateEditingCellValue = (value: string): void => {
    options.editingCellValueRef.value = value
  }

  const tableStageProps = computed<DataGridTableStageProps<TRow>>(() => ({
    mode: unref(options.mode),
    rowHeightMode: unref(options.rowHeightMode),
    visibleColumns: unref(options.visibleColumns),
    renderedColumns: unref(options.renderedColumns),
    displayRows: unref(options.displayRows),
    sourceRows: unref(options.sourceRows),
    columnFilterTextByKey: unref(options.columnFilterTextByKey),
    gridContentStyle: unref(options.gridContentStyle),
    mainTrackStyle: unref(options.mainTrackStyle),
    indexColumnStyle: unref(options.indexColumnStyle),
    topSpacerHeight: unref(options.topSpacerHeight),
    bottomSpacerHeight: unref(options.bottomSpacerHeight),
    viewportRowStart: unref(options.viewportRowStart),
    columnWindowStart: unref(options.columnWindowStart),
    leftColumnSpacerWidth: unref(options.leftColumnSpacerWidth),
    rightColumnSpacerWidth: unref(options.rightColumnSpacerWidth),
    editingCellValue: options.editingCellValueRef.value,
    selectionRange: unref(options.selectionRange),
    selectionAnchorCell: unref(options.selectionAnchorCell),
    fillPreviewRange: unref(options.fillPreviewRange),
    rangeMovePreviewRange: unref(options.rangeMovePreviewRange),
    isRangeMoving: unref(options.isRangeMoving),
    headerViewportRef: captureHeaderViewportRef,
    bodyViewportRef: captureBodyViewportRef,
    columnStyle: unref(options.columnStyle),
    toggleSortForColumn: unref(options.toggleSortForColumn),
    sortIndicator: unref(options.sortIndicator),
    setColumnFilterText: unref(options.setColumnFilterText),
    columnMenuEnabled: unref(options.columnMenuEnabled),
    columnMenuMaxFilterValues: unref(options.columnMenuMaxFilterValues),
    isColumnFilterActive: unref(options.isColumnFilterActive),
    resolveColumnMenuSortDirection: unref(options.resolveColumnMenuSortDirection),
    resolveColumnMenuSelectedTokens: unref(options.resolveColumnMenuSelectedTokens),
    applyColumnMenuSort: unref(options.applyColumnMenuSort),
    applyColumnMenuPin: unref(options.applyColumnMenuPin),
    applyColumnMenuFilter: unref(options.applyColumnMenuFilter),
    clearColumnMenuFilter: unref(options.clearColumnMenuFilter),
    handleHeaderWheel: unref(options.handleHeaderWheel),
    handleHeaderScroll: unref(options.handleHeaderScroll),
    handleViewportScroll: unref(options.handleViewportScroll),
    handleViewportKeydown: unref(options.handleViewportKeydown),
    rowClass: unref(options.rowClass),
    isRowAutosizeProbe: unref(options.isRowAutosizeProbe),
    rowStyle: unref(options.rowStyle),
    toggleGroupRow: unref(options.toggleGroupRow),
    rowIndexLabel: unref(options.rowIndexLabel),
    startResize: unref(options.startResize),
    handleResizeDoubleClick: unref(options.handleResizeDoubleClick),
    startRowResize: unref(options.startRowResize),
    autosizeRow: unref(options.autosizeRow),
    isCellSelected: unref(options.isCellSelected),
    isSelectionAnchorCell: unref(options.isSelectionAnchorCell),
    shouldHighlightSelectedCell: unref(options.shouldHighlightSelectedCell),
    isCellOnSelectionEdge: unref(options.isCellOnSelectionEdge),
    isCellInFillPreview: unref(options.isCellInFillPreview),
    isCellInPendingClipboardRange: unref(options.isCellInPendingClipboardRange),
    isCellOnPendingClipboardEdge: unref(options.isCellOnPendingClipboardEdge),
    isEditingCell: unref(options.isEditingCell),
    handleCellMouseDown: unref(options.handleCellMouseDown),
    handleCellKeydown: unref(options.handleCellKeydown),
    startInlineEdit: unref(options.startInlineEdit),
    isFillHandleCell: unref(options.isFillHandleCell),
    startFillHandleDrag: unref(options.startFillHandleDrag),
    updateEditingCellValue,
    handleEditorKeydown: unref(options.handleEditorKeydown),
    commitInlineEdit: unref(options.commitInlineEdit),
    readCell: unref(options.readCell),
  }))

  return {
    tableStageProps,
    captureHeaderViewportRef,
    captureBodyViewportRef,
    updateEditingCellValue,
  }
}
