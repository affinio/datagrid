import { computed, type CSSProperties, type Ref, type VNodeChild } from "vue"
import type { DataGridTableStageCenterPaneRenderApi, DataGridTableStagePinnedPaneRenderApi } from "./dataGridTableStageBody.types"
import type { DataGridTableStageEditingSection } from "./dataGridTableStage.types"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow, DataGridTableStageSelectEditorOption, DataGridTableStageSelectEditorOptionsLoader } from "./dataGridTableStageBody.types"
import type { DataGridFilterableComboboxOption } from "../overlays/dataGridFilterableCombobox"
import type { DataGridTableMode } from "./dataGridTableStage.types"

export interface UseDataGridStageRenderApisOptions {
  mode: Readonly<Ref<DataGridTableMode>>
  rows: Readonly<Ref<{
    rowClass: (row: DataGridTableStageBodyRow) => string
    rowStyle: (row: DataGridTableStageBodyRow, rowOffset: number) => CSSProperties
    isRowAutosizeProbe: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean
    rowIndexLabel: (row: DataGridTableStageBodyRow, rowOffset: number) => string
    handleRowClick?: (row: DataGridTableStageBodyRow) => void
    isRowFocused?: (row: DataGridTableStageBodyRow) => boolean
    isRowCheckboxSelected?: (row: DataGridTableStageBodyRow) => boolean
    reorderRowsByIndex?: (payload: { sourceRowId: string | number; targetRowId: string | number; placement: "before" | "after" }) => boolean
    consumeRecentRowResizeInteraction?: () => boolean
    startRowResize: (event: MouseEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
    autosizeRow: (event: MouseEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
    showRowIndex?: boolean
    stripedRows?: boolean
    rowHover?: boolean
  }>>
  selection: Readonly<Ref<{
    isFillDragging: boolean
    rangeMoveEnabled: boolean
    startFillHandleDrag: (event: MouseEvent) => void
    startFillHandleDoubleClick: (event: MouseEvent) => void
    isFillHandleCell: (rowOffset: number, columnIndex: number) => boolean
  }>>
  selectionRange: Readonly<Ref<{ startRow: number; endRow: number; startColumn: number; endColumn: number } | null>>
  selectionRanges: Readonly<Ref<readonly { startRow: number; endRow: number; startColumn: number; endColumn: number }[]>>
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  editing: Readonly<Ref<DataGridTableStageEditingSection<Record<string, unknown>>>>
  cells: Readonly<Ref<{
    isCellSelected?: (rowOffset: number, columnIndex: number) => boolean
    isSelectionAnchorCell?: (rowOffset: number, columnIndex: number) => boolean
    isCellInFillPreview?: (rowOffset: number, columnIndex: number) => boolean
    isCellInPendingClipboardRange?: (rowOffset: number, columnIndex: number) => boolean
    isCellOnPendingClipboardEdge?: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
    isCellEditable?: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
    isCellOnSelectionEdge?: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
    readCell: (row: DataGridTableStageBodyRow, columnKey: string) => string
    readDisplayCell: (row: DataGridTableStageBodyRow, columnKey: string) => string
  }>>
  isCellEditableSafe: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isEditingCellSafe: (row: DataGridTableStageBodyRow, columnKey: string) => boolean
  isCellSelectedSafe: (rowOffset: number, columnIndex: number) => boolean
  isTouchSelectionAnchorHandleCell: (row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => boolean
  isTouchRangeMoveHandleCell: (row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => boolean
  isSelectionAnchorCellSafe: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightSelectedCellVisual: (rowOffset: number, columnIndex: number) => boolean
  isCellInFillPreviewSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellInPendingClipboardRangeSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellOnPendingClipboardEdgeSafe: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
  isCellOnSelectionEdgeSafe: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
  isFillHandleCellSafe: (rowOffset: number, columnIndex: number) => boolean
  isVisibleCellEditableByAbsoluteCoord: (rowIndex: number, columnIndex: number) => boolean
  resolveAbsoluteRowIndex: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  resolveViewportRowOffset: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  rowAriaExpanded: (row: DataGridTableStageBodyRow) => "true" | "false" | undefined
  rowAriaLabel: (row: DataGridTableStageBodyRow, rowOffset: number) => string | undefined
  rowAriaDisabled: (row: DataGridTableStageBodyRow, rowOffset: number) => "true" | undefined
  rowStateClasses: (row: DataGridTableStageBodyRow, rowOffset: number) => Record<string, boolean>
  handleRowContainerClick: (row: DataGridTableStageBodyRow) => void
  setHoveredRow: (row: DataGridTableStageBodyRow, rowOffset: number) => void
  isFullRowSelectionSafe: (rowOffset: number) => boolean
  rowIndexColumnStyle: Readonly<Ref<CSSProperties>>
  rowIndexCellClasses: (row: DataGridTableStageBodyRow, rowOffset: number) => Record<string, boolean>
  rowIndexCellStyle: (row: DataGridTableStageBodyRow, rowOffset: number) => CSSProperties
  rowIndexTabIndex: (row: DataGridTableStageBodyRow) => number
  isRowIndexDraggable: (row: DataGridTableStageBodyRow) => boolean
  handleRowIndexClickSafe: (row: DataGridTableStageBodyRow, rowOffset: number, event: MouseEvent) => void
  handleRowIndexKeydownSafe: (event: KeyboardEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragStart: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragOver: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDrop: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  clearRowIndexDragState: () => void
  columnIndexByKey: (columnKey: string) => number
  builtInCellClasses: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => Record<string, boolean>
  cellStateClasses: (row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => Record<string, boolean>
  resolveCellCustomClass: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => unknown
  columnStyle: (key: string) => CSSProperties
  bodyCellPresentationStyle: (column: DataGridTableStageBodyColumn) => CSSProperties
  bodyCellSelectionStyle: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number, columnIndex: number) => CSSProperties
  resolveCellCustomStyle: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => CSSProperties
  cellDomId: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => string
  cellTabIndex: (rowOffset: number, columnIndex: number) => number
  cellAriaSelected: (rowOffset: number, columnIndex: number) => "true" | "false"
  cellAriaRole: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => string | undefined
  cellAriaChecked: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => "true" | "false" | "mixed" | undefined
  cellAriaPressed: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => "true" | "false" | "mixed" | undefined
  cellAriaLabel: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => string | undefined
  cellAriaDisabled: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => "true" | undefined
  handleCellMouseDown: (event: MouseEvent, row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => void
  handleBodyCellClick: (event: MouseEvent, row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => void
  handleCellMouseMove: (event: MouseEvent, rowOffset: number, columnIndex: number) => void
  clearRangeMoveHandleHover: () => void
  handleCellKeydown: (event: KeyboardEvent, row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => void
  startInlineEditIfAllowed: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number, event?: MouseEvent) => void
  handleTouchSelectionHandleMouseDown: (event: MouseEvent) => void
  handleTouchSelectionHandleTouchStart: (event: TouchEvent, row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => void
  handleTouchSelectionHandleTouchMove: (event: TouchEvent) => void
  handleTouchSelectionHandleTouchEnd: (event: TouchEvent) => void
  handleTouchRangeMoveHandleMouseDown: (event: MouseEvent) => void
  handleTouchRangeMoveHandleTouchStart: (event: TouchEvent, row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => void
  handleTouchRangeMoveHandleTouchMove: (event: TouchEvent) => void
  handleTouchRangeMoveHandleTouchEnd: (event: TouchEvent) => void
  handleFillHandleMouseDown: (event: MouseEvent) => void
  handleFillHandleDoubleClick: (event: MouseEvent) => void
  handleFillHandleTouchStart: (event: TouchEvent) => void
  handleFillHandleTouchMove: (event: TouchEvent) => void
  handleFillHandleTouchEnd: (event: TouchEvent) => void
  isSelectEditorCell: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  resolveSelectEditorValue: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => string
  resolveSelectEditorOptions: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => readonly DataGridTableStageSelectEditorOption[]
  resolveSelectEditorOptionsLoader: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => DataGridTableStageSelectEditorOptionsLoader | undefined
  cellEditorAriaLabel: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => string
  handleSelectEditorCommit: (value: string, target?: "stay" | "next" | "previous") => void
  handleSelectEditorCancel: () => void
  handleSelectEditorOptionsResolved: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, options: ReadonlyArray<DataGridFilterableComboboxOption>) => void
  isDateEditorCell: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  resolveDateEditorInputType: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => "date" | "datetime-local"
  handleDateEditorChange: (value: string, target?: "stay" | "next" | "previous") => void
  isTextEditorCell: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  updateEditingCellValue: (value: string) => void
  handleEditorKeydown: (event: KeyboardEvent) => void
  handleTextEditorBlur: () => void
  shouldRenderCheckboxCell: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => boolean
  checkboxIndicatorClass: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
  checkboxIndicatorMarkClass: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
  readResolvedDisplayCell: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => string
  renderResolvedCellContent: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => VNodeChild
  handleCenterViewportScroll: (event: Event) => void
  handleBodyViewportWheel: (event: WheelEvent) => void
  handleViewportKeydown: (event: KeyboardEvent) => void
  handleLinkedViewportWheel: (event: WheelEvent) => void
}

export function useDataGridStageRenderApis(options: UseDataGridStageRenderApisOptions) {
  function paneRowStyle(row: DataGridTableStageBodyRow, rowOffset: number, paneWidth: number): CSSProperties {
    return {
      ...options.rows.value.rowStyle(row, options.resolveViewportRowOffset(row, rowOffset)),
      width: `${paneWidth}px`,
      minWidth: `${paneWidth}px`,
      maxWidth: `${paneWidth}px`,
    }
  }

  function spacerStyle(width: number): CSSProperties {
    const px = `${width}px`
    return {
      width: px,
      minWidth: px,
      maxWidth: px,
    }
  }

  const pinnedPaneRenderApi = computed<DataGridTableStagePinnedPaneRenderApi>(() => ({
    handleLinkedViewportWheel: options.handleLinkedViewportWheel,
    absoluteRowIndex: options.resolveAbsoluteRowIndex,
    viewportRowOffset: options.resolveViewportRowOffset,
    rowAriaExpanded: options.rowAriaExpanded,
    rowAriaLabel: options.rowAriaLabel,
    rowAriaDisabled: options.rowAriaDisabled,
    rowStateClasses: options.rowStateClasses,
    paneRowStyle,
    handleRowContainerClick: options.handleRowContainerClick,
    setHoveredRow: options.setHoveredRow,
    isFullRowSelectionSafe: options.isFullRowSelectionSafe,
    get rowIndexColumnStyle() {
      return options.rowIndexColumnStyle.value
    },
    rowIndexCellClasses: options.rowIndexCellClasses,
    rowIndexCellStyle: options.rowIndexCellStyle,
    rowIndexTabIndex: options.rowIndexTabIndex,
    isRowIndexDraggable: options.isRowIndexDraggable,
    handleRowIndexClickSafe: options.handleRowIndexClickSafe,
    handleRowIndexKeydown: options.handleRowIndexKeydownSafe,
    handleRowIndexDragStart: options.handleRowIndexDragStart,
    handleRowIndexDragOver: options.handleRowIndexDragOver,
    handleRowIndexDrop: options.handleRowIndexDrop,
    handleRowIndexDragEnd: options.clearRowIndexDragState,
    builtInCellClasses: options.builtInCellClasses,
    cellStateClasses: options.cellStateClasses,
    resolveCellCustomClass: options.resolveCellCustomClass,
    columnStyle: options.columnStyle,
    bodyCellPresentationStyle: options.bodyCellPresentationStyle,
    bodyCellSelectionStyle: options.bodyCellSelectionStyle,
    resolveCellCustomStyle: options.resolveCellCustomStyle,
    columnIndexByKey: options.columnIndexByKey,
    cellDomId: options.cellDomId,
    cellTabIndex: options.cellTabIndex,
    cellAriaSelected: options.cellAriaSelected,
    cellAriaRole: options.cellAriaRole,
    cellAriaChecked: options.cellAriaChecked,
    cellAriaPressed: options.cellAriaPressed,
    cellAriaLabel: options.cellAriaLabel,
    cellAriaDisabled: options.cellAriaDisabled,
    handleCellMouseDown: options.handleCellMouseDown,
    handleBodyCellClick: options.handleBodyCellClick,
    handleCellMouseMove: options.handleCellMouseMove,
    clearRangeMoveHandleHover: options.clearRangeMoveHandleHover,
    handleCellKeydown: options.handleCellKeydown,
    startInlineEditIfAllowed: options.startInlineEditIfAllowed,
    handleTouchSelectionHandleMouseDown: options.handleTouchSelectionHandleMouseDown,
    handleTouchSelectionHandleTouchStart: options.handleTouchSelectionHandleTouchStart,
    handleTouchSelectionHandleTouchMove: options.handleTouchSelectionHandleTouchMove,
    handleTouchSelectionHandleTouchEnd: options.handleTouchSelectionHandleTouchEnd,
    handleTouchRangeMoveHandleMouseDown: options.handleTouchRangeMoveHandleMouseDown,
    handleTouchRangeMoveHandleTouchStart: options.handleTouchRangeMoveHandleTouchStart,
    handleTouchRangeMoveHandleTouchMove: options.handleTouchRangeMoveHandleTouchMove,
    handleTouchRangeMoveHandleTouchEnd: options.handleTouchRangeMoveHandleTouchEnd,
    isCellEditableSafe: options.isCellEditableSafe,
    isFillHandleCellSafe: options.isFillHandleCellSafe,
    isTouchSelectionAnchorHandleCell: options.isTouchSelectionAnchorHandleCell,
    isTouchRangeMoveHandleCell: options.isTouchRangeMoveHandleCell,
    isEditingCellSafe: options.isEditingCellSafe,
    handleFillHandleMouseDown: options.handleFillHandleMouseDown,
    handleFillHandleDoubleClick: options.handleFillHandleDoubleClick,
    handleFillHandleTouchStart: options.handleFillHandleTouchStart,
    handleFillHandleTouchMove: options.handleFillHandleTouchMove,
    handleFillHandleTouchEnd: options.handleFillHandleTouchEnd,
    isSelectEditorCell: options.isSelectEditorCell,
    resolveSelectEditorValue: options.resolveSelectEditorValue,
    resolveSelectEditorOptions: options.resolveSelectEditorOptions,
    resolveSelectEditorOptionsLoader: options.resolveSelectEditorOptionsLoader,
    cellEditorAriaLabel: options.cellEditorAriaLabel,
    handleSelectEditorCommit: options.handleSelectEditorCommit,
    handleSelectEditorCancel: options.handleSelectEditorCancel,
    handleSelectEditorOptionsResolved: options.handleSelectEditorOptionsResolved,
    isDateEditorCell: options.isDateEditorCell,
    resolveDateEditorInputType: options.resolveDateEditorInputType,
    handleDateEditorChange: options.handleDateEditorChange,
    isTextEditorCell: options.isTextEditorCell,
    updateEditingCellValue: options.updateEditingCellValue,
    handleEditorKeydown: options.handleEditorKeydown,
    handleTextEditorBlur: options.handleTextEditorBlur,
    shouldRenderCheckboxCell: options.shouldRenderCheckboxCell,
    checkboxIndicatorClass: options.checkboxIndicatorClass,
    checkboxIndicatorMarkClass: options.checkboxIndicatorMarkClass,
    readResolvedDisplayCell: options.readResolvedDisplayCell,
    renderResolvedCellContent: options.renderResolvedCellContent,
  }))

  const centerPaneRenderApi = computed<DataGridTableStageCenterPaneRenderApi>(() => ({
    handleCenterViewportScroll: options.handleCenterViewportScroll,
    handleBodyViewportWheel: options.handleBodyViewportWheel,
    absoluteRowIndex: options.resolveAbsoluteRowIndex,
    viewportRowOffset: options.resolveViewportRowOffset,
    rowAriaExpanded: options.rowAriaExpanded,
    rowAriaLabel: options.rowAriaLabel,
    rowAriaDisabled: options.rowAriaDisabled,
    handleViewportKeydown: options.handleViewportKeydown,
    rowStateClasses: options.rowStateClasses,
    handleRowContainerClick: options.handleRowContainerClick,
    setHoveredRow: options.setHoveredRow,
    spacerStyle,
    builtInCellClasses: options.builtInCellClasses,
    cellStateClasses: options.cellStateClasses,
    resolveCellCustomClass: options.resolveCellCustomClass,
    columnStyle: options.columnStyle,
    bodyCellPresentationStyle: options.bodyCellPresentationStyle,
    bodyCellSelectionStyle: options.bodyCellSelectionStyle,
    resolveCellCustomStyle: options.resolveCellCustomStyle,
    columnIndexByKey: options.columnIndexByKey,
    cellDomId: options.cellDomId,
    cellTabIndex: options.cellTabIndex,
    cellAriaSelected: options.cellAriaSelected,
    cellAriaRole: options.cellAriaRole,
    cellAriaChecked: options.cellAriaChecked,
    cellAriaPressed: options.cellAriaPressed,
    cellAriaLabel: options.cellAriaLabel,
    cellAriaDisabled: options.cellAriaDisabled,
    handleCellMouseDown: options.handleCellMouseDown,
    handleBodyCellClick: options.handleBodyCellClick,
    handleCellMouseMove: options.handleCellMouseMove,
    clearRangeMoveHandleHover: options.clearRangeMoveHandleHover,
    handleCellKeydown: options.handleCellKeydown,
    startInlineEditIfAllowed: options.startInlineEditIfAllowed,
    handleTouchSelectionHandleMouseDown: options.handleTouchSelectionHandleMouseDown,
    handleTouchSelectionHandleTouchStart: options.handleTouchSelectionHandleTouchStart,
    handleTouchSelectionHandleTouchMove: options.handleTouchSelectionHandleTouchMove,
    handleTouchSelectionHandleTouchEnd: options.handleTouchSelectionHandleTouchEnd,
    handleTouchRangeMoveHandleMouseDown: options.handleTouchRangeMoveHandleMouseDown,
    handleTouchRangeMoveHandleTouchStart: options.handleTouchRangeMoveHandleTouchStart,
    handleTouchRangeMoveHandleTouchMove: options.handleTouchRangeMoveHandleTouchMove,
    handleTouchRangeMoveHandleTouchEnd: options.handleTouchRangeMoveHandleTouchEnd,
    isCellEditableSafe: options.isCellEditableSafe,
    isFillHandleCellSafe: options.isFillHandleCellSafe,
    isTouchSelectionAnchorHandleCell: options.isTouchSelectionAnchorHandleCell,
    isTouchRangeMoveHandleCell: options.isTouchRangeMoveHandleCell,
    isEditingCellSafe: options.isEditingCellSafe,
    handleFillHandleMouseDown: options.handleFillHandleMouseDown,
    handleFillHandleDoubleClick: options.handleFillHandleDoubleClick,
    handleFillHandleTouchStart: options.handleFillHandleTouchStart,
    handleFillHandleTouchMove: options.handleFillHandleTouchMove,
    handleFillHandleTouchEnd: options.handleFillHandleTouchEnd,
    isSelectEditorCell: options.isSelectEditorCell,
    resolveSelectEditorValue: options.resolveSelectEditorValue,
    resolveSelectEditorOptions: options.resolveSelectEditorOptions,
    resolveSelectEditorOptionsLoader: options.resolveSelectEditorOptionsLoader,
    cellEditorAriaLabel: options.cellEditorAriaLabel,
    handleSelectEditorCommit: options.handleSelectEditorCommit,
    handleSelectEditorCancel: options.handleSelectEditorCancel,
    handleSelectEditorOptionsResolved: options.handleSelectEditorOptionsResolved,
    isDateEditorCell: options.isDateEditorCell,
    resolveDateEditorInputType: options.resolveDateEditorInputType,
    handleDateEditorChange: options.handleDateEditorChange,
    isTextEditorCell: options.isTextEditorCell,
    updateEditingCellValue: options.updateEditingCellValue,
    handleEditorKeydown: options.handleEditorKeydown,
    handleTextEditorBlur: options.handleTextEditorBlur,
    shouldRenderCheckboxCell: options.shouldRenderCheckboxCell,
    checkboxIndicatorClass: options.checkboxIndicatorClass,
    checkboxIndicatorMarkClass: options.checkboxIndicatorMarkClass,
    readResolvedDisplayCell: options.readResolvedDisplayCell,
    renderResolvedCellContent: options.renderResolvedCellContent,
  }))

  return {
    pinnedPaneRenderApi,
    centerPaneRenderApi,
    paneRowStyle,
    spacerStyle,
  }
}
