import type { ComponentPublicInstance, CSSProperties, Ref } from "vue"
import type {
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridOverlayRange,
  DataGridRowNode,
} from "@affino/datagrid-vue"

export type DataGridTableMode = "base" | "tree" | "pivot" | "worker"
export type DataGridPendingEdge = "top" | "right" | "bottom" | "left"
export type DataGridTableRow<TRow extends Record<string, unknown>> = DataGridRowNode<TRow>
export type DataGridElementRefHandler = (value: Element | ComponentPublicInstance | null) => void
export type DataGridMaybeRef<T> = T | Ref<T>

export interface DataGridTableStageProps<TRow extends Record<string, unknown>> {
  mode: DataGridTableMode
  rowHeightMode: "fixed" | "auto"
  visibleColumns: readonly DataGridColumnSnapshot[]
  renderedColumns: readonly DataGridColumnSnapshot[]
  displayRows: readonly DataGridTableRow<TRow>[]
  sourceRows?: readonly TRow[]
  columnFilterTextByKey: Readonly<Record<string, string>>
  gridContentStyle: CSSProperties
  mainTrackStyle: CSSProperties
  indexColumnStyle: CSSProperties
  topSpacerHeight: number
  bottomSpacerHeight: number
  viewportRowStart: number
  columnWindowStart: number
  leftColumnSpacerWidth: number
  rightColumnSpacerWidth: number
  editingCellValue: string
  selectionRange: DataGridOverlayRange | null
  fillPreviewRange: DataGridOverlayRange | null
  rangeMovePreviewRange: DataGridOverlayRange | null
  isRangeMoving: boolean
  headerViewportRef: DataGridElementRefHandler
  bodyViewportRef: DataGridElementRefHandler
  columnStyle: (key: string) => CSSProperties
  toggleSortForColumn: (columnKey: string, additive?: boolean) => void
  sortIndicator: (columnKey: string) => string
  setColumnFilterText: (columnKey: string, value: string) => void
  columnMenuEnabled?: boolean
  columnMenuMaxFilterValues?: number
  isColumnFilterActive?: (columnKey: string) => boolean
  resolveColumnMenuSortDirection?: (columnKey: string) => "asc" | "desc" | null
  resolveColumnMenuSelectedTokens?: (columnKey: string) => readonly string[]
  applyColumnMenuSort?: (columnKey: string, direction: "asc" | "desc" | null) => void
  applyColumnMenuPin?: (columnKey: string, pin: DataGridColumnPin) => void
  applyColumnMenuFilter?: (columnKey: string, tokens: readonly string[]) => void
  clearColumnMenuFilter?: (columnKey: string) => void
  handleHeaderWheel: (event: WheelEvent) => void
  handleHeaderScroll: (event: Event) => void
  handleViewportScroll: (event: Event) => void
  handleViewportKeydown: (event: KeyboardEvent) => void
  rowClass: (row: DataGridTableRow<TRow>) => string
  isRowAutosizeProbe: (row: DataGridTableRow<TRow>, rowOffset: number) => boolean
  rowStyle: (row: DataGridTableRow<TRow>, rowOffset: number) => CSSProperties
  toggleGroupRow: (row: DataGridTableRow<TRow>) => void
  rowIndexLabel: (row: DataGridTableRow<TRow>, rowOffset: number) => string
  startResize: (event: MouseEvent, columnKey: string) => void
  handleResizeDoubleClick: (event: MouseEvent, columnKey: string) => void
  startRowResize: (event: MouseEvent, row: DataGridTableRow<TRow>, rowOffset: number) => void
  autosizeRow: (event: MouseEvent, row: DataGridTableRow<TRow>, rowOffset: number) => void
  isCellSelected: (rowOffset: number, columnIndex: number) => boolean
  isSelectionAnchorCell: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightSelectedCell: (rowOffset: number, columnIndex: number) => boolean
  isCellOnSelectionEdge: (rowOffset: number, columnIndex: number, edge: DataGridPendingEdge) => boolean
  isCellInFillPreview: (rowOffset: number, columnIndex: number) => boolean
  isCellInPendingClipboardRange: (rowOffset: number, columnIndex: number) => boolean
  isCellOnPendingClipboardEdge: (rowOffset: number, columnIndex: number, edge: DataGridPendingEdge) => boolean
  isEditingCell: (row: DataGridTableRow<TRow>, columnKey: string) => boolean
  handleCellMouseDown: (event: MouseEvent, row: DataGridTableRow<TRow>, rowOffset: number, columnIndex: number) => void
  handleCellKeydown: (event: KeyboardEvent, row: DataGridTableRow<TRow>, rowOffset: number, columnIndex: number) => void
  startInlineEdit: (row: DataGridTableRow<TRow>, columnKey: string) => void
  isFillHandleCell: (rowOffset: number, columnIndex: number) => boolean
  startFillHandleDrag: (event: MouseEvent) => void
  updateEditingCellValue: (value: string) => void
  handleEditorKeydown: (event: KeyboardEvent) => void
  commitInlineEdit: () => void
  readCell: (row: DataGridTableRow<TRow>, columnKey: string) => string
}

export interface UseDataGridTableStageBindingsOptions<TRow extends Record<string, unknown>>
  extends Omit<{
    [K in keyof DataGridTableStageProps<TRow>]: DataGridMaybeRef<DataGridTableStageProps<TRow>[K]>
  }, "editingCellValue" | "headerViewportRef" | "bodyViewportRef" | "updateEditingCellValue"> {
  editingCellValueRef: Ref<string>
  headerViewportRef: Ref<HTMLElement | null>
  bodyViewportRef: Ref<HTMLElement | null>
}
