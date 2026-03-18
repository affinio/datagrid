import type { ComponentPublicInstance, CSSProperties } from "vue"
import type { DataGridColumnSnapshot } from "@affino/datagrid-vue"
import type { DataGridFilterableComboboxOption } from "../overlays/dataGridFilterableCombobox"
import type { DataGridTableRow } from "./dataGridTableStage.types"

export type DataGridTableStageBodyRow = DataGridTableRow<Record<string, unknown>>

export type DataGridTableStageBodyColumn = DataGridColumnSnapshot & {
  column: DataGridColumnSnapshot["column"] & {
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
  builtInCellClasses: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
  cellStateClasses: (row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => Record<string, boolean>
  resolveCellCustomClass: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => unknown
  columnStyle: (key: string) => CSSProperties
  bodyCellPresentationStyle: (column: DataGridTableStageBodyColumn) => CSSProperties
  bodyCellSelectionStyle: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number, columnIndex: number) => CSSProperties
  resolveCellCustomStyle: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => CSSProperties
  columnIndexByKey: (columnKey: string) => number
  cellTabIndex: (rowOffset: number, columnIndex: number) => number
  checkboxCellRole: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => string | undefined
  checkboxCellAriaChecked: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => "true" | "false" | undefined
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
  isTextEditorCell: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  updateEditingCellValue: (value: string) => void
  handleEditorKeydown: (event: KeyboardEvent) => void
  handleTextEditorBlur: () => void
  shouldRenderCheckboxCell: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => boolean
  checkboxIndicatorClass: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
  checkboxIndicatorMarkClass: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
  readResolvedDisplayCell: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => string
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
  rowIndexCellStyle: (row: DataGridTableStageBodyRow, rowOffset: number) => CSSProperties
  handleRowIndexClickSafe: (row: DataGridTableStageBodyRow, rowOffset: number, event: MouseEvent) => void
}