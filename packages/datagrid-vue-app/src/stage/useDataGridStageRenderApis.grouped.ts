import { computed, type CSSProperties, type Ref, type VNodeChild } from "vue"
import type { DataGridTableStageCenterPaneRenderApi, DataGridTableStagePinnedPaneRenderApi } from "./dataGridTableStageBody.types"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow, DataGridTableStageSelectEditorOption, DataGridTableStageSelectEditorOptionsLoader } from "./dataGridTableStageBody.types"
import type { DataGridFilterableComboboxOption } from "../overlays/dataGridFilterableCombobox"
import type { DataGridTableMode, DataGridTableStageEditingSection } from "./dataGridTableStage.types"

type RowRuntime = Readonly<Ref<{
  rows: Readonly<Ref<{
    rowStyle: (row: DataGridTableStageBodyRow, rowOffset: number) => CSSProperties
  }>>
  resolveAbsoluteRowIndex: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  resolveViewportRowOffset: (row: DataGridTableStageBodyRow, rowOffset: number) => number
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
}>> 

type CellRuntime = Readonly<Ref<{
  visibleColumns: readonly DataGridTableStageBodyColumn[]
  cells: {
    isSelectionAnchorCell?: (rowOffset: number, columnIndex: number) => boolean
    isCellInFillPreview?: (rowOffset: number, columnIndex: number) => boolean
    isCellInPendingClipboardRange?: (rowOffset: number, columnIndex: number) => boolean
    isCellOnPendingClipboardEdge?: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
    isCellOnSelectionEdge?: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
    readCell: (row: DataGridTableStageBodyRow, columnKey: string) => string
    readDisplayCell: (row: DataGridTableStageBodyRow, columnKey: string) => string
  }
  isCellEditableSafe: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isEditingCellSafe: (row: DataGridTableStageBodyRow, columnKey: string) => boolean
  isCellSelectedSafe: (rowOffset: number, columnIndex: number) => boolean
  isTouchSelectionAnchorHandleCell: (row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => boolean
  isSelectionAnchorCellSafe: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightSelectedCellVisual: (rowOffset: number, columnIndex: number) => boolean
  isCellInFillPreviewSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellInPendingClipboardRangeSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellOnPendingClipboardEdgeSafe: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
  isCellOnSelectionEdgeSafe: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
  isFillHandleCellSafe: (rowOffset: number, columnIndex: number) => boolean
  isVisibleCellEditableByAbsoluteCoord: (rowIndex: number, columnIndex: number) => boolean
  builtInCellClasses: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => Record<string, boolean>
  cellStateClasses: (row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => Record<string, boolean>
  resolveCellCustomClass: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => unknown
  columnStyle: (key: string) => CSSProperties
  bodyCellPresentationStyle: (column: DataGridTableStageBodyColumn) => CSSProperties
  bodyCellSelectionStyle: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number, columnIndex: number) => CSSProperties
  resolveCellCustomStyle: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => CSSProperties
  cellTabIndex: (rowOffset: number, columnIndex: number) => number
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
  handleTouchSelectionHandleTouchStart: (event: TouchEvent) => void
  handleFillHandleMouseDown: (event: MouseEvent) => void
  handleFillHandleDoubleClick: (event: MouseEvent) => void
  handleFillHandleTouchStart: (event: TouchEvent) => void
  handleFillHandleTouchMove: (event: TouchEvent) => void
  handleFillHandleTouchEnd: (event: TouchEvent) => void
  shouldRenderCheckboxCell: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => boolean
  checkboxIndicatorClass: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
  checkboxIndicatorMarkClass: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
}>> 

type EditorRuntime = Readonly<Ref<{
  mode: DataGridTableMode
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
  cells: Readonly<Ref<{
    readCell: (row: DataGridTableStageBodyRow, columnKey: string) => string
    readDisplayCell: (row: DataGridTableStageBodyRow, columnKey: string) => string
  }>>
  editing: Readonly<Ref<DataGridTableStageEditingSection<Record<string, unknown>>>>
  startInlineEditIfAllowed: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number, event?: MouseEvent) => void
  resolveCellEditorMode: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => "none" | "text" | "select" | "date" | "datetime"
  resolveSelectEditorOptions: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => readonly DataGridTableStageSelectEditorOption[]
  resolveSelectEditorOptionsLoader: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => DataGridTableStageSelectEditorOptionsLoader | undefined
  handleSelectEditorOptionsResolved: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, options: ReadonlyArray<DataGridFilterableComboboxOption>) => void
  readResolvedDisplayCell: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => string
  renderResolvedCellContent: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => VNodeChild
  resolveSelectEditorValue: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => string
  isSelectEditorCell: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isDateEditorCell: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  resolveDateEditorInputType: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => "date" | "datetime-local"
  isTextEditorCell: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  handleSelectEditorCommit: (value: string, target?: "stay" | "next" | "previous") => void
  handleSelectEditorCancel: () => void
  handleDateEditorChange: (value: string, target?: "stay" | "next" | "previous") => void
  handleTextEditorBlur: () => void
  updateEditingCellValue: (value: string) => void
  handleEditorKeydown: (event: KeyboardEvent) => void
}>> 

type ViewportRuntime = Readonly<Ref<{
  handleCenterViewportScroll: (event: Event) => void
  handleBodyViewportWheel: (event: WheelEvent) => void
  handleViewportKeydown: (event: KeyboardEvent) => void
  handleLinkedViewportWheel: (event: WheelEvent) => void
}>>

export interface UseDataGridStageRenderApisOptions {
  rowRuntime: RowRuntime
  cellRuntime: CellRuntime
  editorRuntime: EditorRuntime
  viewportRuntime: ViewportRuntime
}

export function useDataGridStageRenderApis(options: UseDataGridStageRenderApisOptions) {
  function paneRowStyle(row: DataGridTableStageBodyRow, rowOffset: number, paneWidth: number): CSSProperties {
    return {
      ...options.rowRuntime.value.rows.value.rowStyle(row, options.rowRuntime.value.resolveViewportRowOffset(row, rowOffset)),
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
    handleLinkedViewportWheel: options.viewportRuntime.value.handleLinkedViewportWheel,
    absoluteRowIndex: options.rowRuntime.value.resolveAbsoluteRowIndex,
    viewportRowOffset: options.rowRuntime.value.resolveViewportRowOffset,
    rowStateClasses: options.rowRuntime.value.rowStateClasses,
    paneRowStyle,
    handleRowContainerClick: options.rowRuntime.value.handleRowContainerClick,
    setHoveredRow: options.rowRuntime.value.setHoveredRow,
    isFullRowSelectionSafe: options.rowRuntime.value.isFullRowSelectionSafe,
    get rowIndexColumnStyle() {
      return options.rowRuntime.value.rowIndexColumnStyle.value
    },
    rowIndexCellClasses: options.rowRuntime.value.rowIndexCellClasses,
    rowIndexCellStyle: options.rowRuntime.value.rowIndexCellStyle,
    rowIndexTabIndex: options.rowRuntime.value.rowIndexTabIndex,
    isRowIndexDraggable: options.rowRuntime.value.isRowIndexDraggable,
    handleRowIndexClickSafe: options.rowRuntime.value.handleRowIndexClickSafe,
    handleRowIndexKeydown: options.rowRuntime.value.handleRowIndexKeydownSafe,
    handleRowIndexDragStart: options.rowRuntime.value.handleRowIndexDragStart,
    handleRowIndexDragOver: options.rowRuntime.value.handleRowIndexDragOver,
    handleRowIndexDrop: options.rowRuntime.value.handleRowIndexDrop,
    handleRowIndexDragEnd: options.rowRuntime.value.clearRowIndexDragState,
    builtInCellClasses: options.cellRuntime.value.builtInCellClasses,
    cellStateClasses: options.cellRuntime.value.cellStateClasses,
    resolveCellCustomClass: options.cellRuntime.value.resolveCellCustomClass,
    columnStyle: options.cellRuntime.value.columnStyle,
    bodyCellPresentationStyle: options.cellRuntime.value.bodyCellPresentationStyle,
    bodyCellSelectionStyle: options.cellRuntime.value.bodyCellSelectionStyle,
    resolveCellCustomStyle: options.cellRuntime.value.resolveCellCustomStyle,
    columnIndexByKey: options.rowRuntime.value.columnIndexByKey,
    cellTabIndex: options.cellRuntime.value.cellTabIndex,
    cellAriaRole: options.cellRuntime.value.cellAriaRole,
    cellAriaChecked: options.cellRuntime.value.cellAriaChecked,
    cellAriaPressed: options.cellRuntime.value.cellAriaPressed,
    cellAriaLabel: options.cellRuntime.value.cellAriaLabel,
    cellAriaDisabled: options.cellRuntime.value.cellAriaDisabled,
    handleCellMouseDown: options.cellRuntime.value.handleCellMouseDown,
    handleBodyCellClick: options.cellRuntime.value.handleBodyCellClick,
    handleCellMouseMove: options.cellRuntime.value.handleCellMouseMove,
    clearRangeMoveHandleHover: options.cellRuntime.value.clearRangeMoveHandleHover,
    handleCellKeydown: options.cellRuntime.value.handleCellKeydown,
    startInlineEditIfAllowed: options.cellRuntime.value.startInlineEditIfAllowed,
    handleTouchSelectionHandleMouseDown: options.cellRuntime.value.handleTouchSelectionHandleMouseDown,
    handleTouchSelectionHandleTouchStart: options.cellRuntime.value.handleTouchSelectionHandleTouchStart,
    isCellEditableSafe: options.cellRuntime.value.isCellEditableSafe,
    isFillHandleCellSafe: options.cellRuntime.value.isFillHandleCellSafe,
    isTouchSelectionAnchorHandleCell: options.cellRuntime.value.isTouchSelectionAnchorHandleCell,
    isEditingCellSafe: options.cellRuntime.value.isEditingCellSafe,
    handleFillHandleMouseDown: options.cellRuntime.value.handleFillHandleMouseDown,
    handleFillHandleDoubleClick: options.cellRuntime.value.handleFillHandleDoubleClick,
    handleFillHandleTouchStart: options.cellRuntime.value.handleFillHandleTouchStart,
    handleFillHandleTouchMove: options.cellRuntime.value.handleFillHandleTouchMove,
    handleFillHandleTouchEnd: options.cellRuntime.value.handleFillHandleTouchEnd,
    isSelectEditorCell: options.editorRuntime.value.isSelectEditorCell,
    resolveSelectEditorValue: options.editorRuntime.value.resolveSelectEditorValue,
    resolveSelectEditorOptions: options.editorRuntime.value.resolveSelectEditorOptions,
    resolveSelectEditorOptionsLoader: options.editorRuntime.value.resolveSelectEditorOptionsLoader,
    handleSelectEditorCommit: options.editorRuntime.value.handleSelectEditorCommit,
    handleSelectEditorCancel: options.editorRuntime.value.handleSelectEditorCancel,
    handleSelectEditorOptionsResolved: options.editorRuntime.value.handleSelectEditorOptionsResolved,
    isDateEditorCell: options.editorRuntime.value.isDateEditorCell,
    resolveDateEditorInputType: options.editorRuntime.value.resolveDateEditorInputType,
    handleDateEditorChange: options.editorRuntime.value.handleDateEditorChange,
    isTextEditorCell: options.editorRuntime.value.isTextEditorCell,
    updateEditingCellValue: options.editorRuntime.value.updateEditingCellValue,
    handleEditorKeydown: options.editorRuntime.value.handleEditorKeydown,
    handleTextEditorBlur: options.editorRuntime.value.handleTextEditorBlur,
    shouldRenderCheckboxCell: options.cellRuntime.value.shouldRenderCheckboxCell,
    checkboxIndicatorClass: options.cellRuntime.value.checkboxIndicatorClass,
    checkboxIndicatorMarkClass: options.cellRuntime.value.checkboxIndicatorMarkClass,
    readResolvedDisplayCell: options.editorRuntime.value.readResolvedDisplayCell,
    renderResolvedCellContent: options.editorRuntime.value.renderResolvedCellContent,
  }))

  const centerPaneRenderApi = computed<DataGridTableStageCenterPaneRenderApi>(() => ({
    handleCenterViewportScroll: options.viewportRuntime.value.handleCenterViewportScroll,
    handleBodyViewportWheel: options.viewportRuntime.value.handleBodyViewportWheel,
    absoluteRowIndex: options.rowRuntime.value.resolveAbsoluteRowIndex,
    viewportRowOffset: options.rowRuntime.value.resolveViewportRowOffset,
    handleViewportKeydown: options.viewportRuntime.value.handleViewportKeydown,
    rowStateClasses: options.rowRuntime.value.rowStateClasses,
    handleRowContainerClick: options.rowRuntime.value.handleRowContainerClick,
    setHoveredRow: options.rowRuntime.value.setHoveredRow,
    spacerStyle,
    builtInCellClasses: options.cellRuntime.value.builtInCellClasses,
    cellStateClasses: options.cellRuntime.value.cellStateClasses,
    resolveCellCustomClass: options.cellRuntime.value.resolveCellCustomClass,
    columnStyle: options.cellRuntime.value.columnStyle,
    bodyCellPresentationStyle: options.cellRuntime.value.bodyCellPresentationStyle,
    bodyCellSelectionStyle: options.cellRuntime.value.bodyCellSelectionStyle,
    resolveCellCustomStyle: options.cellRuntime.value.resolveCellCustomStyle,
    columnIndexByKey: options.rowRuntime.value.columnIndexByKey,
    cellTabIndex: options.cellRuntime.value.cellTabIndex,
    cellAriaRole: options.cellRuntime.value.cellAriaRole,
    cellAriaChecked: options.cellRuntime.value.cellAriaChecked,
    cellAriaPressed: options.cellRuntime.value.cellAriaPressed,
    cellAriaLabel: options.cellRuntime.value.cellAriaLabel,
    cellAriaDisabled: options.cellRuntime.value.cellAriaDisabled,
    handleCellMouseDown: options.cellRuntime.value.handleCellMouseDown,
    handleBodyCellClick: options.cellRuntime.value.handleBodyCellClick,
    handleCellMouseMove: options.cellRuntime.value.handleCellMouseMove,
    clearRangeMoveHandleHover: options.cellRuntime.value.clearRangeMoveHandleHover,
    handleCellKeydown: options.cellRuntime.value.handleCellKeydown,
    startInlineEditIfAllowed: options.cellRuntime.value.startInlineEditIfAllowed,
    handleTouchSelectionHandleMouseDown: options.cellRuntime.value.handleTouchSelectionHandleMouseDown,
    handleTouchSelectionHandleTouchStart: options.cellRuntime.value.handleTouchSelectionHandleTouchStart,
    isCellEditableSafe: options.cellRuntime.value.isCellEditableSafe,
    isFillHandleCellSafe: options.cellRuntime.value.isFillHandleCellSafe,
    isTouchSelectionAnchorHandleCell: options.cellRuntime.value.isTouchSelectionAnchorHandleCell,
    isEditingCellSafe: options.cellRuntime.value.isEditingCellSafe,
    handleFillHandleMouseDown: options.cellRuntime.value.handleFillHandleMouseDown,
    handleFillHandleDoubleClick: options.cellRuntime.value.handleFillHandleDoubleClick,
    handleFillHandleTouchStart: options.cellRuntime.value.handleFillHandleTouchStart,
    handleFillHandleTouchMove: options.cellRuntime.value.handleFillHandleTouchMove,
    handleFillHandleTouchEnd: options.cellRuntime.value.handleFillHandleTouchEnd,
    isSelectEditorCell: options.editorRuntime.value.isSelectEditorCell,
    resolveSelectEditorValue: options.editorRuntime.value.resolveSelectEditorValue,
    resolveSelectEditorOptions: options.editorRuntime.value.resolveSelectEditorOptions,
    resolveSelectEditorOptionsLoader: options.editorRuntime.value.resolveSelectEditorOptionsLoader,
    handleSelectEditorCommit: options.editorRuntime.value.handleSelectEditorCommit,
    handleSelectEditorCancel: options.editorRuntime.value.handleSelectEditorCancel,
    handleSelectEditorOptionsResolved: options.editorRuntime.value.handleSelectEditorOptionsResolved,
    isDateEditorCell: options.editorRuntime.value.isDateEditorCell,
    resolveDateEditorInputType: options.editorRuntime.value.resolveDateEditorInputType,
    handleDateEditorChange: options.editorRuntime.value.handleDateEditorChange,
    isTextEditorCell: options.editorRuntime.value.isTextEditorCell,
    updateEditingCellValue: options.editorRuntime.value.updateEditingCellValue,
    handleEditorKeydown: options.editorRuntime.value.handleEditorKeydown,
    handleTextEditorBlur: options.editorRuntime.value.handleTextEditorBlur,
    shouldRenderCheckboxCell: options.cellRuntime.value.shouldRenderCheckboxCell,
    checkboxIndicatorClass: options.cellRuntime.value.checkboxIndicatorClass,
    checkboxIndicatorMarkClass: options.cellRuntime.value.checkboxIndicatorMarkClass,
    readResolvedDisplayCell: options.editorRuntime.value.readResolvedDisplayCell,
    renderResolvedCellContent: options.editorRuntime.value.renderResolvedCellContent,
  }))

  return {
    pinnedPaneRenderApi,
    centerPaneRenderApi,
    paneRowStyle,
    spacerStyle,
  }
}
