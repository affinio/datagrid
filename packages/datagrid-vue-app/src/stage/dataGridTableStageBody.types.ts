import type { ComponentPublicInstance, CSSProperties, VNodeChild } from "vue"
import type { DataGridColumnSnapshot } from "@affino/datagrid-vue"
import type {
  DataGridAppCellRenderer,
  DataGridAppGroupCellRenderer,
} from "../config/dataGridFormulaOptions"
import type { DataGridFilterableComboboxOption } from "../overlays/dataGridFilterableCombobox"
import type { DataGridTableRow } from "./dataGridTableStage.types"

export type DataGridTableStageBodyRow = DataGridTableRow<Record<string, unknown>>

export type DataGridTableStageBodyColumn = DataGridColumnSnapshot & {
  column: DataGridColumnSnapshot["column"] & {
    cellRenderer?: DataGridAppCellRenderer<Record<string, unknown>> | null
    groupCellRenderer?: DataGridAppGroupCellRenderer<Record<string, unknown>> | null
    presentation?: {
      align?: "left" | "center" | "right"
      headerAlign?: "left" | "center" | "right"
    }
    capabilities?: {
      editable?: boolean
      sortable?: boolean
      filterable?: boolean
    }
  }
}

export type DataGridTableStageOverlaySegment = {
  key: string
  style: CSSProperties
}

export type DataGridTableStageSelectEditorOption = {
  label: string
  value: string
}

export type DataGridTableStageSelectEditorOptionsLoader = (
  query: string,
) => Promise<readonly DataGridTableStageSelectEditorOption[]>

export interface DataGridTableStageBodyRenderApiBase {
  absoluteRowIndex: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  viewportRowOffset: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  rowStateClasses: (row: DataGridTableStageBodyRow, rowOffset: number) => Record<string, boolean>
  handleRowContainerClick: (row: DataGridTableStageBodyRow) => void
  setHoveredRow: (row: DataGridTableStageBodyRow, rowOffset: number) => void
  builtInCellClasses: (
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ) => Record<string, boolean>
  cellStateClasses: (row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => Record<string, boolean>
  resolveCellCustomClass: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => unknown
  columnStyle: (key: string) => CSSProperties
  bodyCellPresentationStyle: (column: DataGridTableStageBodyColumn) => CSSProperties
  bodyCellSelectionStyle: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number, columnIndex: number) => CSSProperties
  resolveCellCustomStyle: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => CSSProperties
  columnIndexByKey: (columnKey: string) => number
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
  startInlineEditIfAllowed: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number) => void
  isCellEditableSafe: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isFillHandleCellSafe: (rowOffset: number, columnIndex: number) => boolean
  isEditingCellSafe: (row: DataGridTableStageBodyRow, columnKey: string) => boolean
  handleFillHandleMouseDown: (event: MouseEvent) => void
  handleFillHandleDoubleClick: (event: MouseEvent) => void
  isSelectEditorCell: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  resolveSelectEditorValue: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => string
  resolveSelectEditorOptions: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => readonly DataGridTableStageSelectEditorOption[]
  resolveSelectEditorOptionsLoader: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => DataGridTableStageSelectEditorOptionsLoader | undefined
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
  renderResolvedCellContent: (
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ) => VNodeChild
}

export interface DataGridTableStageCenterPaneRenderApi extends DataGridTableStageBodyRenderApiBase {
  handleCenterViewportScroll: (event: Event) => void
  handleBodyViewportWheel: (event: WheelEvent) => void
  handleViewportKeydown: (event: KeyboardEvent) => void
  spacerStyle: (width: number) => CSSProperties
}

export interface DataGridTableStagePinnedPaneProps {
  side: "left" | "right"
  width: number
  style: CSSProperties
  contentStyle: CSSProperties
  contentRef?: (value: Element | ComponentPublicInstance | null) => void
  columns: readonly DataGridTableStageBodyColumn[]
  showIndexColumn: boolean
  displayRows: readonly DataGridTableStageBodyRow[]
  topSpacerHeight?: number
  bottomSpacerHeight?: number
  selectionOverlaySegments: readonly DataGridTableStageOverlaySegment[]
  fillPreviewOverlaySegments: readonly DataGridTableStageOverlaySegment[]
  movePreviewOverlaySegments: readonly DataGridTableStageOverlaySegment[]
}

export interface DataGridTableStagePinnedPaneRenderApi extends DataGridTableStageBodyRenderApiBase {
  handleLinkedViewportWheel: (event: WheelEvent) => void
  paneRowStyle: (row: DataGridTableStageBodyRow, rowOffset: number, paneWidth: number) => CSSProperties
  isFullRowSelectionSafe: (rowOffset: number) => boolean
  rowIndexColumnStyle: CSSProperties
  rowIndexCellClasses: (row: DataGridTableStageBodyRow, rowOffset: number) => Record<string, boolean>
  rowIndexCellStyle: (row: DataGridTableStageBodyRow, rowOffset: number) => CSSProperties
  rowIndexTabIndex: (row: DataGridTableStageBodyRow) => number
  isRowIndexDraggable: (row: DataGridTableStageBodyRow) => boolean
  handleRowIndexClickSafe: (row: DataGridTableStageBodyRow, rowOffset: number, event: MouseEvent) => void
  handleRowIndexKeydown: (event: KeyboardEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragStart: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragOver: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDrop: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragEnd: () => void
}
