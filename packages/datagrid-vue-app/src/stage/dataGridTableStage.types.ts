import type { ComponentPublicInstance, CSSProperties, Ref } from "vue"
import type {
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridOverlayRange,
  DataGridRowNode,
} from "@affino/datagrid-vue"
import type { DataGridFillBehavior } from "@affino/datagrid-vue/advanced"

export type DataGridTableMode = "base" | "tree" | "pivot" | "worker"
export type DataGridPendingEdge = "top" | "right" | "bottom" | "left"
export type DataGridTableRow<TRow extends Record<string, unknown>> = DataGridRowNode<TRow>
export type DataGridElementRefHandler = (value: Element | ComponentPublicInstance | null) => void
export type DataGridMaybeRef<T> = T | Ref<T>
export type DataGridTableStageCellClass =
  | string
  | readonly string[]
  | Readonly<Record<string, boolean>>

export interface DataGridTableStageAnchorCell {
  rowIndex: number
  columnIndex: number
}

export interface DataGridTableStageLayoutSection {
  gridContentStyle: CSSProperties
  mainTrackStyle: CSSProperties
  indexColumnStyle: CSSProperties
  columnStyle: (key: string) => CSSProperties
}

export interface DataGridTableStageViewportSection {
  topSpacerHeight: number
  bottomSpacerHeight: number
  viewportRowStart: number
  columnWindowStart: number
  leftColumnSpacerWidth: number
  rightColumnSpacerWidth: number
  headerViewportRef: DataGridElementRefHandler
  bodyViewportRef: DataGridElementRefHandler
  handleHeaderWheel: (event: WheelEvent) => void
  handleHeaderScroll: (event: Event) => void
  handleViewportScroll: (event: Event) => void
  handleViewportKeydown: (event: KeyboardEvent) => void
}

export interface DataGridTableStageColumnsSection {
  visibleColumns: readonly DataGridColumnSnapshot[]
  renderedColumns: readonly DataGridColumnSnapshot[]
  columnFilterTextByKey: Readonly<Record<string, string>>
  toggleSortForColumn: (columnKey: string, additive?: boolean) => void
  sortIndicator: (columnKey: string) => string
  setColumnFilterText: (columnKey: string, value: string) => void
  columnMenuEnabled?: boolean
  columnMenuValueFilterEnabled?: boolean
  columnMenuValueFilterRowLimit?: number
  columnMenuMaxFilterValues?: number
  isColumnFilterActive?: (columnKey: string) => boolean
  resolveColumnMenuSortDirection?: (columnKey: string) => "asc" | "desc" | null
  resolveColumnMenuSelectedTokens?: (columnKey: string) => readonly string[]
  applyColumnMenuSort?: (columnKey: string, direction: "asc" | "desc" | null) => void
  applyColumnMenuPin?: (columnKey: string, pin: DataGridColumnPin) => void
  applyColumnMenuFilter?: (columnKey: string, tokens: readonly string[]) => void
  clearColumnMenuFilter?: (columnKey: string) => void
  startResize: (event: MouseEvent, columnKey: string) => void
  handleResizeDoubleClick: (event: MouseEvent, columnKey: string) => void
}

export interface DataGridTableStageRowsSection<TRow extends Record<string, unknown>> {
  displayRows: readonly DataGridTableRow<TRow>[]
  pinnedBottomRows: readonly DataGridTableRow<TRow>[]
  sourceRows?: readonly TRow[]
  showRowIndex?: boolean
  rowHover?: boolean
  stripedRows?: boolean
  rowClass: (row: DataGridTableRow<TRow>) => string
  isRowAutosizeProbe: (row: DataGridTableRow<TRow>, rowOffset: number) => boolean
  rowStyle: (row: DataGridTableRow<TRow>, rowOffset: number) => CSSProperties
  isRowFocused?: (row: DataGridTableRow<TRow>) => boolean
  isRowCheckboxSelected?: (row: DataGridTableRow<TRow>) => boolean
  allVisibleRowsSelected?: boolean
  someVisibleRowsSelected?: boolean
  handleRowClick?: (row: DataGridTableRow<TRow>) => void
  handleRowIndexClick?: (row: DataGridTableRow<TRow>, rowOffset: number, extend: boolean) => void
  handleToggleAllVisibleRows?: () => void
  toggleGroupRow: (row: DataGridTableRow<TRow>) => void
  rowIndexLabel: (row: DataGridTableRow<TRow>, rowOffset: number) => string
  startRowResize: (event: MouseEvent, row: DataGridTableRow<TRow>, rowOffset: number) => void
  autosizeRow: (event: MouseEvent, row: DataGridTableRow<TRow>, rowOffset: number) => void
}

export interface DataGridTableStageSelectionSection {
  selectionRange: DataGridOverlayRange | null
  selectionAnchorCell?: DataGridTableStageAnchorCell | null
  fillPreviewRange: DataGridOverlayRange | null
  rangeMovePreviewRange: DataGridOverlayRange | null
  isFillDragging: boolean
  isRangeMoving: boolean
  fillActionAnchorCell?: DataGridTableStageAnchorCell | null
  fillActionBehavior?: DataGridFillBehavior | null
  applyFillActionBehavior: (behavior: DataGridFillBehavior) => void
  isFillHandleCell: (rowOffset: number, columnIndex: number) => boolean
  startFillHandleDrag: (event: MouseEvent) => void
  startFillHandleDoubleClick: (event: MouseEvent) => void
}

export interface DataGridTableStageEditingSection<TRow extends Record<string, unknown>> {
  editingCellValue: string
  editingCellInitialFilter: string
  editingCellOpenOnMount: boolean
  isEditingCell: (row: DataGridTableRow<TRow>, columnKey: string) => boolean
  startInlineEdit: (
    row: DataGridTableRow<TRow>,
    columnKey: string,
    options?: { draftValue?: string; openOnMount?: boolean },
  ) => void
  updateEditingCellValue: (value: string) => void
  handleEditorKeydown: (event: KeyboardEvent) => void
  commitInlineEdit: (target?: "stay" | "next" | "previous") => void
  cancelInlineEdit: () => void
}

export interface DataGridTableStageCellsSection<TRow extends Record<string, unknown>> {
  cellClass?: (
    row: DataGridTableRow<TRow>,
    rowOffset: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ) => DataGridTableStageCellClass | null | undefined
  cellStyle?: (
    row: DataGridTableRow<TRow>,
    rowOffset: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ) => CSSProperties | null | undefined
  isCellSelected: (rowOffset: number, columnIndex: number) => boolean
  isSelectionAnchorCell: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightSelectedCell: (rowOffset: number, columnIndex: number) => boolean
  isCellOnSelectionEdge: (rowOffset: number, columnIndex: number, edge: DataGridPendingEdge) => boolean
  isCellInFillPreview: (rowOffset: number, columnIndex: number) => boolean
  isCellInPendingClipboardRange: (rowOffset: number, columnIndex: number) => boolean
  isCellOnPendingClipboardEdge: (rowOffset: number, columnIndex: number, edge: DataGridPendingEdge) => boolean
  isCellEditable: (
    row: DataGridTableRow<TRow>,
    rowOffset: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ) => boolean
  readCell: (row: DataGridTableRow<TRow>, columnKey: string) => string
  readDisplayCell: (row: DataGridTableRow<TRow>, columnKey: string) => string
}

export interface DataGridTableStageInteractionSection<TRow extends Record<string, unknown>> {
  handleCellMouseDown: (event: MouseEvent, row: DataGridTableRow<TRow>, rowOffset: number, columnIndex: number) => void
  handleCellClick: (
    row: DataGridTableRow<TRow>,
    rowOffset: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ) => void
  handleCellKeydown: (event: KeyboardEvent, row: DataGridTableRow<TRow>, rowOffset: number, columnIndex: number) => void
}

export interface DataGridTableStageSectionedProps<TRow extends Record<string, unknown>> {
  layout: DataGridTableStageLayoutSection
  viewport: DataGridTableStageViewportSection
  columns: DataGridTableStageColumnsSection
  rows: DataGridTableStageRowsSection<TRow>
  selection: DataGridTableStageSelectionSection
  editing: DataGridTableStageEditingSection<TRow>
  cells: DataGridTableStageCellsSection<TRow>
  interaction: DataGridTableStageInteractionSection<TRow>
}

export interface DataGridTableStageProps<TRow extends Record<string, unknown>>
  extends DataGridTableStageSectionedProps<TRow> {
  mode: DataGridTableMode
  rowHeightMode: "fixed" | "auto"
}

interface DataGridTableStageBindingsSource<TRow extends Record<string, unknown>>
  extends DataGridTableStageLayoutSection,
    DataGridTableStageViewportSection,
    DataGridTableStageColumnsSection,
    DataGridTableStageRowsSection<TRow>,
    DataGridTableStageSelectionSection,
    DataGridTableStageEditingSection<TRow>,
    DataGridTableStageCellsSection<TRow>,
    DataGridTableStageInteractionSection<TRow> {
  mode: DataGridTableMode
  rowHeightMode: "fixed" | "auto"
}

export interface UseDataGridTableStageBindingsOptions<TRow extends Record<string, unknown>>
  extends Omit<{
    [K in keyof DataGridTableStageBindingsSource<TRow>]: DataGridMaybeRef<DataGridTableStageBindingsSource<TRow>[K]>
  }, "editingCellValue" | "headerViewportRef" | "bodyViewportRef" | "updateEditingCellValue"> {
  editingCellValueRef: Ref<string>
  headerViewportRef: Ref<HTMLElement | null>
  bodyViewportRef: Ref<HTMLElement | null>
}
