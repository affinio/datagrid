import { computed, unref, type ComputedRef, type Ref } from "vue"
import { createDataGridTableStageContext, type DataGridTableStageContext } from "./dataGridTableStageContext"
import type {
  DataGridElementRefHandler,
  DataGridTableStageCellsSection,
  DataGridTableStageColumnsSection,
  DataGridTableStageEditingSection,
  DataGridTableStageInteractionSection,
  DataGridTableStageLayoutSection,
  DataGridTableStageProps,
  DataGridTableStageRowsSection,
  DataGridTableStageSelectionSection,
  DataGridTableStageViewportSection,
  UseDataGridTableStageBindingsOptions,
} from "./dataGridTableStage.types"

export interface UseDataGridTableStageBindingsResult<TRow extends Record<string, unknown>> {
  tableStageProps: ComputedRef<DataGridTableStageProps<TRow>>
  tableStageContext: DataGridTableStageContext<TRow>
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

  const layoutSection = computed<DataGridTableStageLayoutSection>(() => ({
    gridContentStyle: unref(options.gridContentStyle),
    mainTrackStyle: unref(options.mainTrackStyle),
    indexColumnStyle: unref(options.indexColumnStyle),
    stageStyle: unref(options.stageStyle),
    bodyShellStyle: unref(options.bodyShellStyle),
    columnStyle: unref(options.columnStyle),
  }))

  const viewportSection = computed<DataGridTableStageViewportSection>(() => ({
    topSpacerHeight: unref(options.topSpacerHeight),
    bottomSpacerHeight: unref(options.bottomSpacerHeight),
    viewportRowStart: unref(options.viewportRowStart),
    columnWindowStart: unref(options.columnWindowStart),
    leftColumnSpacerWidth: unref(options.leftColumnSpacerWidth),
    rightColumnSpacerWidth: unref(options.rightColumnSpacerWidth),
    headerViewportRef: captureHeaderViewportRef,
    bodyViewportRef: captureBodyViewportRef,
    handleHeaderWheel: unref(options.handleHeaderWheel),
    handleHeaderScroll: unref(options.handleHeaderScroll),
    handleViewportScroll: unref(options.handleViewportScroll),
    handleViewportKeydown: unref(options.handleViewportKeydown),
  }))

  const columnsSection = computed<DataGridTableStageColumnsSection>(() => ({
    visibleColumns: unref(options.visibleColumns),
    renderedColumns: unref(options.renderedColumns),
    columnFilterTextByKey: unref(options.columnFilterTextByKey),
    toggleSortForColumn: unref(options.toggleSortForColumn),
    sortIndicator: unref(options.sortIndicator),
    setColumnFilterText: unref(options.setColumnFilterText),
    columnMenuEnabled: unref(options.columnMenuEnabled),
    columnMenuTrigger: unref(options.columnMenuTrigger),
    columnMenuValueFilterEnabled: unref(options.columnMenuValueFilterEnabled),
    columnMenuValueFilterRowLimit: unref(options.columnMenuValueFilterRowLimit),
    columnMenuMaxFilterValues: unref(options.columnMenuMaxFilterValues),
    resolveColumnMenuItems: unref(options.resolveColumnMenuItems),
    resolveColumnMenuDisabledItems: unref(options.resolveColumnMenuDisabledItems),
    resolveColumnMenuDisabledReasons: unref(options.resolveColumnMenuDisabledReasons),
    resolveColumnMenuLabels: unref(options.resolveColumnMenuLabels),
    resolveColumnMenuActionOptions: unref(options.resolveColumnMenuActionOptions),
    resolveColumnMenuCustomItems: unref(options.resolveColumnMenuCustomItems),
    isColumnFilterActive: unref(options.isColumnFilterActive),
    isColumnGrouped: unref(options.isColumnGrouped),
    resolveColumnGroupOrder: unref(options.resolveColumnGroupOrder),
    resolveColumnMenuSortDirection: unref(options.resolveColumnMenuSortDirection),
    resolveColumnMenuSelectedTokens: unref(options.resolveColumnMenuSelectedTokens),
    applyColumnMenuSort: unref(options.applyColumnMenuSort),
    applyColumnMenuPin: unref(options.applyColumnMenuPin),
    applyColumnMenuGroupBy: unref(options.applyColumnMenuGroupBy),
    applyColumnMenuFilter: unref(options.applyColumnMenuFilter),
    clearColumnMenuFilter: unref(options.clearColumnMenuFilter),
    startResize: unref(options.startResize),
    handleResizeDoubleClick: unref(options.handleResizeDoubleClick),
  }))

  const rowsSection = computed<DataGridTableStageRowsSection<TRow>>(() => ({
    displayRows: unref(options.displayRows),
    pinnedBottomRows: unref(options.pinnedBottomRows),
    sourceRows: unref(options.sourceRows),
    showRowIndex: unref(options.showRowIndex),
    rowHover: unref(options.rowHover),
    stripedRows: unref(options.stripedRows),
    rowClass: unref(options.rowClass),
    isRowAutosizeProbe: unref(options.isRowAutosizeProbe),
    rowStyle: unref(options.rowStyle),
    isRowInPendingClipboardCut: unref(options.isRowInPendingClipboardCut),
    isRowFocused: unref(options.isRowFocused),
    isRowCheckboxSelected: unref(options.isRowCheckboxSelected),
    allVisibleRowsSelected: unref(options.allVisibleRowsSelected),
    someVisibleRowsSelected: unref(options.someVisibleRowsSelected),
    handleRowClick: unref(options.handleRowClick),
    handleRowIndexClick: unref(options.handleRowIndexClick),
    handleRowIndexKeydown: unref(options.handleRowIndexKeydown),
    handleToggleAllVisibleRows: unref(options.handleToggleAllVisibleRows),
    toggleGroupRow: unref(options.toggleGroupRow),
    rowIndexLabel: unref(options.rowIndexLabel),
    startRowResize: unref(options.startRowResize),
    autosizeRow: unref(options.autosizeRow),
  }))

  const selectionSection = computed<DataGridTableStageSelectionSection>(() => ({
    selectionRange: unref(options.selectionRange),
    selectionAnchorCell: unref(options.selectionAnchorCell),
    fillPreviewRange: unref(options.fillPreviewRange),
    rangeMovePreviewRange: unref(options.rangeMovePreviewRange),
    fillHandleEnabled: unref(options.fillHandleEnabled),
    rangeMoveEnabled: unref(options.rangeMoveEnabled),
    isFillDragging: unref(options.isFillDragging),
    isRangeMoving: unref(options.isRangeMoving),
    fillActionAnchorCell: unref(options.fillActionAnchorCell),
    fillActionBehavior: unref(options.fillActionBehavior),
    applyFillActionBehavior: unref(options.applyFillActionBehavior),
    isFillHandleCell: unref(options.isFillHandleCell),
    startFillHandleDrag: unref(options.startFillHandleDrag),
    startFillHandleDoubleClick: unref(options.startFillHandleDoubleClick),
  }))

  const editingSection = computed<DataGridTableStageEditingSection<TRow>>(() => ({
    editingCellValue: options.editingCellValueRef.value,
    editingCellInitialFilter: unref(options.editingCellInitialFilter),
    editingCellOpenOnMount: unref(options.editingCellOpenOnMount),
    isEditingCell: unref(options.isEditingCell),
    startInlineEdit: unref(options.startInlineEdit),
    updateEditingCellValue,
    handleEditorKeydown: unref(options.handleEditorKeydown),
    handleEditorBlur: unref(options.handleEditorBlur),
    commitInlineEdit: unref(options.commitInlineEdit),
    cancelInlineEdit: unref(options.cancelInlineEdit),
  }))

  const cellsSection = computed<DataGridTableStageCellsSection<TRow>>(() => ({
    cellClass: unref(options.cellClass),
    cellStyle: unref(options.cellStyle),
    isCellSelected: unref(options.isCellSelected),
    isSelectionAnchorCell: unref(options.isSelectionAnchorCell),
    shouldHighlightSelectedCell: unref(options.shouldHighlightSelectedCell),
    isCellOnSelectionEdge: unref(options.isCellOnSelectionEdge),
    isCellInFillPreview: unref(options.isCellInFillPreview),
    isCellInPendingClipboardRange: unref(options.isCellInPendingClipboardRange),
    isCellOnPendingClipboardEdge: unref(options.isCellOnPendingClipboardEdge),
    isCellEditable: unref(options.isCellEditable),
    readCell: unref(options.readCell),
    readDisplayCell: unref(options.readDisplayCell),
  }))

  const interactionSection = computed<DataGridTableStageInteractionSection<TRow>>(() => ({
    handleCellMouseDown: unref(options.handleCellMouseDown),
    handleCellClick: unref(options.handleCellClick),
    handleCellKeydown: unref(options.handleCellKeydown),
  }))

  const tableStageProps = computed<DataGridTableStageProps<TRow>>(() => ({
    mode: unref(options.mode),
    rowHeightMode: unref(options.rowHeightMode),
    layoutMode: unref(options.layoutMode),
    chromeSignature: unref(options.chromeSignature),
    layout: layoutSection.value,
    viewport: viewportSection.value,
    columns: columnsSection.value,
    rows: rowsSection.value,
    selection: selectionSection.value,
    editing: editingSection.value,
    cells: cellsSection.value,
    interaction: interactionSection.value,
  }))

  const tableStageContext = createDataGridTableStageContext<TRow>({
    mode: computed(() => unref(options.mode)),
    rowHeightMode: computed(() => unref(options.rowHeightMode)),
    layoutMode: computed(() => unref(options.layoutMode)),
    layout: layoutSection,
    viewport: viewportSection,
    columns: columnsSection,
    rows: rowsSection,
    selection: selectionSection,
    editing: editingSection,
    cells: cellsSection,
    interaction: interactionSection,
  })

  return {
    tableStageProps,
    tableStageContext,
    captureHeaderViewportRef,
    captureBodyViewportRef,
    updateEditingCellValue,
  }
}
