import { type CSSProperties, type Ref } from "vue"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "./dataGridTableStageBody.types"
import { isTouchGeneratedMouseEvent } from "./dataGridMouseEventGuards"

export interface UseDataGridStageRowStateOptions {
  rows: Readonly<Ref<{
    rowHover?: boolean
    stripedRows?: boolean
    isRowFocused?: (row: DataGridTableStageBodyRow) => boolean
    isRowCheckboxSelected?: (row: DataGridTableStageBodyRow) => boolean
    isRowInPendingClipboardCut?: (row: DataGridTableStageBodyRow) => boolean
    toggleGroupRow: (row: DataGridTableStageBodyRow) => void
  }>>
  selection: Readonly<Ref<{
    selectionAnchorCell?: { rowIndex: number; columnIndex: number } | null
    fillActionAnchorCell?: { rowIndex: number; columnIndex: number } | null
    isFillHandleCell?: (rowOffset: number, columnIndex: number) => boolean
  }>>
  selectionRange: Readonly<Ref<{ startRow: number; endRow: number; startColumn: number; endColumn: number } | null>>
  selectionRanges: Readonly<Ref<readonly { startRow: number; endRow: number; startColumn: number; endColumn: number }[]>>
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  viewportRowStart: Readonly<Ref<number>>
  isHoveredRow: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean
  isStripedRow: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean
  resolveAbsoluteRowIndex: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  isCellSelectedSafe: (rowOffset: number, columnIndex: number) => boolean
  isEditingCellSafe: (row: DataGridTableStageBodyRow, columnKey: string) => boolean
  isCellEditableSafe: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  resolveCellEditorMode: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => "none" | "text" | "select" | "date" | "datetime"
  startInlineEditIfAllowed: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number) => void
  handleCellClick: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => void
  hasExplicitGroupCellRenderer: Readonly<Ref<boolean>>
  cells: Readonly<Ref<{
    isSelectionAnchorCell?: (rowOffset: number, columnIndex: number) => boolean
    isCellInFillPreview?: (rowOffset: number, columnIndex: number) => boolean
    isCellInPendingClipboardRange?: (rowOffset: number, columnIndex: number) => boolean
    isCellOnPendingClipboardEdge?: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
    isCellOnSelectionEdge?: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
  }>>
}

export interface UseDataGridStageRowStateResult {
  rowStateClasses: (row: DataGridTableStageBodyRow, rowOffset: number) => Record<string, boolean>
  resolveInlineRowStateFill: (row: DataGridTableStageBodyRow, rowOffset: number, options?: { fullBleed?: boolean }) => CSSProperties | null
  bodyCellSelectionStyle: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number, columnIndex: number) => CSSProperties
  handleBodyCellClick: (event: MouseEvent, row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => void
  isVisualSelectionAnchorCell: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightSelectedCellVisual: (rowOffset: number, columnIndex: number) => boolean
  isSelectionAnchorCellSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellInFillPreviewSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellInPendingClipboardRangeSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellOnPendingClipboardEdgeSafe: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
  isCellOnSelectionEdgeSafe: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
  isFillHandleCellSafe: (rowOffset: number, columnIndex: number) => boolean
  isVisibleCellEditableByAbsoluteCoord: (rowIndex: number, columnIndex: number) => boolean
  isCellEditableSafe: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isEditingCellSafe: (row: DataGridTableStageBodyRow, columnKey: string) => boolean
}

function resolveVisualSelectionAnchorCell(
  selection: Readonly<Ref<{ selectionAnchorCell?: { rowIndex: number; columnIndex: number } | null }>>,
  selectionRange: Readonly<Ref<{ startRow: number; endRow: number; startColumn: number; endColumn: number } | null>>,
): { rowIndex: number; columnIndex: number } | null {
  if (
    selectionRange.value
    && selectionRange.value.startRow === selectionRange.value.endRow
    && selectionRange.value.startColumn === selectionRange.value.endColumn
  ) {
    return {
      rowIndex: selectionRange.value.startRow,
      columnIndex: selectionRange.value.startColumn,
    }
  }
  return selection.value.selectionAnchorCell ?? null
}

export function useDataGridStageRowState(
  options: UseDataGridStageRowStateOptions,
): UseDataGridStageRowStateResult {
  function isVisualSelectionAnchorCell(rowOffset: number, columnIndex: number): boolean {
    const anchorCell = resolveVisualSelectionAnchorCell(options.selection, options.selectionRange)
    return Boolean(
      anchorCell
      && options.viewportRowStart.value + rowOffset === anchorCell.rowIndex
      && columnIndex === anchorCell.columnIndex,
    )
  }

  function shouldHighlightSelectedCellVisual(rowOffset: number, columnIndex: number): boolean {
    if (!options.isCellSelectedSafe(rowOffset, columnIndex)) {
      return false
    }
    if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
      return false
    }
    const ranges = options.selectionRange.value
    if (!ranges) {
      return true
    }
    return options.selectionRanges.value.length > 1
      || !(ranges.startRow === ranges.endRow && ranges.startColumn === ranges.endColumn)
  }

  function isRowSelectionColumn(column: DataGridTableStageBodyColumn): boolean {
    return column.column.meta?.rowSelection === true
  }

  function isSelectionAnchorCellSafe(rowOffset: number, columnIndex: number): boolean {
    if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
      return true
    }
    const evaluate = options.cells.value.isSelectionAnchorCell
    return typeof evaluate === "function"
      ? evaluate(rowOffset, columnIndex)
      : false
  }

  function isCellInFillPreviewSafe(rowOffset: number, columnIndex: number): boolean {
    const evaluate = options.cells.value.isCellInFillPreview
    return typeof evaluate === "function"
      ? evaluate(rowOffset, columnIndex)
      : false
  }

  function isCellInPendingClipboardRangeSafe(rowOffset: number, columnIndex: number): boolean {
    const evaluate = options.cells.value.isCellInPendingClipboardRange
    return typeof evaluate === "function"
      ? evaluate(rowOffset, columnIndex)
      : false
  }

  function isCellOnPendingClipboardEdgeSafe(
    rowOffset: number,
    columnIndex: number,
    edge: "top" | "right" | "bottom" | "left",
  ): boolean {
    const evaluate = options.cells.value.isCellOnPendingClipboardEdge
    return typeof evaluate === "function"
      ? evaluate(rowOffset, columnIndex, edge)
      : false
  }

  function isCellOnSelectionEdgeSafe(
    rowOffset: number,
    columnIndex: number,
    edge: "top" | "right" | "bottom" | "left",
  ): boolean {
    const evaluate = options.cells.value.isCellOnSelectionEdge
    return typeof evaluate === "function"
      ? evaluate(rowOffset, columnIndex, edge)
      : false
  }

  function isFillHandleCellSafe(rowOffset: number, columnIndex: number): boolean {
    const evaluate = options.selection.value?.isFillHandleCell
    return typeof evaluate === "function"
      ? evaluate(rowOffset, columnIndex)
      : false
  }

  function isEditingCellSafe(row: DataGridTableStageBodyRow, columnKey: string): boolean {
    return options.isEditingCellSafe(row, columnKey)
  }

  function isCellEditableSafe(
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): boolean {
    return options.isCellEditableSafe(row, rowOffset, column, columnIndex)
  }

  function isVisibleCellEditableByAbsoluteCoord(rowIndex: number, columnIndex: number): boolean {
    const rowOffset = rowIndex - options.viewportRowStart.value
    const row = options.displayRows.value[rowOffset]
    const column = options.visibleColumns.value[columnIndex]
    if (rowOffset < 0 || !row || !column) {
      return false
    }
    return isCellEditableSafe(row, rowOffset, column, columnIndex)
  }

  function resolveInlineRowStateFill(
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    fillOptions: { fullBleed?: boolean } = {},
  ): CSSProperties | null {
    let overlayColor: string | null = null
    if (options.isHoveredRow(row, rowOffset)) {
      overlayColor = "var(--datagrid-row-band-hover-bg)"
    } else if (options.isStripedRow(row, rowOffset)) {
      overlayColor = "var(--datagrid-row-band-striped-bg)"
    }
    if (!overlayColor) {
      return null
    }
    if (fillOptions.fullBleed === true) {
      return {
        backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor})`,
        backgroundSize: "100% calc(100% - var(--datagrid-row-divider-size))",
        backgroundPosition: "top left",
        backgroundRepeat: "no-repeat",
      }
    }
    return {
      backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor})`,
      backgroundSize: "calc(100% - var(--datagrid-column-divider-size)) calc(100% - var(--datagrid-row-divider-size))",
      backgroundPosition: "top left",
      backgroundRepeat: "no-repeat",
    }
  }

  function rowStateClasses(row: DataGridTableStageBodyRow, rowOffset: number): Record<string, boolean> {
    const isRowInPendingClipboard = options.rows.value.isRowInPendingClipboardCut?.(row) === true
    const previousRow = options.displayRows.value[rowOffset - 1]
    const nextRow = options.displayRows.value[rowOffset + 1]
    const isPreviousRowInPendingClipboard = previousRow
      ? options.rows.value.isRowInPendingClipboardCut?.(previousRow) === true
      : false
    const isNextRowInPendingClipboard = nextRow
      ? options.rows.value.isRowInPendingClipboardCut?.(nextRow) === true
      : false
    return {
      "grid-row--hoverable": options.rows.value.rowHover === true,
      "grid-row--hovered": options.isHoveredRow(row, rowOffset),
      "grid-row--striped": options.isStripedRow(row, rowOffset),
      "grid-row--group-explicit-trigger": row.kind === "group" && options.hasExplicitGroupCellRenderer.value,
      "grid-row--clipboard-pending": isRowInPendingClipboard,
      "grid-row--clipboard-pending-top": isRowInPendingClipboard && !isPreviousRowInPendingClipboard,
      "grid-row--clipboard-pending-middle": isRowInPendingClipboard && isPreviousRowInPendingClipboard && isNextRowInPendingClipboard,
      "grid-row--clipboard-pending-bottom": isRowInPendingClipboard && !isNextRowInPendingClipboard,
      "grid-row--focused": typeof options.rows.value.isRowFocused === "function" ? options.rows.value.isRowFocused(row) : false,
      "grid-row--checkbox-selected": typeof options.rows.value.isRowCheckboxSelected === "function" ? options.rows.value.isRowCheckboxSelected(row) : false,
    }
  }

  function bodyCellSelectionStyle(row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn, rowOffset: number, columnIndex: number): CSSProperties {
    if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
      if (column.pin === "left") {
        return { background: "var(--datagrid-pinned-left-bg)" }
      }
      if (column.pin === "right") {
        return { background: "var(--datagrid-pinned-right-bg)" }
      }
      return { background: "var(--datagrid-row-background-color)" }
    }
    if (shouldHighlightSelectedCellVisual(rowOffset, columnIndex)) {
      return { background: "var(--datagrid-selection-range-bg)" }
    }
    const rowStateFill = resolveInlineRowStateFill(row, rowOffset, {
      fullBleed: column.pin === "left" || column.pin === "right",
    })
    if (rowStateFill) {
      return rowStateFill
    }
    return {}
  }

  function isSelectCellTriggerClick(event: MouseEvent, row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): boolean {
    if (row.kind === "group" || options.resolveCellEditorMode(row, column) !== "select") {
      return false
    }
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    if (!target) {
      return false
    }
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0) {
      return false
    }
    const offsetX = event.clientX - rect.left
    const triggerWidth = Math.min(24, Math.max(16, Math.floor(rect.width * 0.22)))
    return offsetX >= rect.width - triggerWidth
  }

  function isDateCellTriggerClick(event: MouseEvent, row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): boolean {
    const editorMode = row.kind === "group" ? "none" : options.resolveCellEditorMode(row, column)
    if (editorMode !== "date" && editorMode !== "datetime") {
      return false
    }
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    if (!target) {
      return false
    }
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0) {
      return false
    }
    const offsetX = event.clientX - rect.left
    const triggerWidth = Math.min(24, Math.max(16, Math.floor(rect.width * 0.22)))
    return offsetX >= rect.width - triggerWidth
  }

  function handleBodyCellClick(
    event: MouseEvent,
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): void {
    if (isRowSelectionColumn(column)) {
      if (row.kind === "group") {
        return
      }
      options.handleCellClick(row, rowOffset, column, columnIndex)
      return
    }
    if (row.kind === "group") {
      if (!options.hasExplicitGroupCellRenderer.value) {
        options.rows.value.toggleGroupRow(row)
      }
      return
    }
    if (
      !isTouchGeneratedMouseEvent(event)
      && !isEditingCellSafe(row, column.key)
      && (isSelectCellTriggerClick(event, row, column) || isDateCellTriggerClick(event, row, column))
    ) {
      options.startInlineEditIfAllowed(row, column, rowOffset)
      return
    }
    options.handleCellClick(row, rowOffset, column, columnIndex)
  }

  return {
    rowStateClasses,
    resolveInlineRowStateFill,
    bodyCellSelectionStyle,
    handleBodyCellClick,
    isVisualSelectionAnchorCell,
    shouldHighlightSelectedCellVisual,
    isSelectionAnchorCellSafe,
    isCellInFillPreviewSafe,
    isCellInPendingClipboardRangeSafe,
    isCellOnPendingClipboardEdgeSafe,
    isCellOnSelectionEdgeSafe,
    isFillHandleCellSafe,
    isVisibleCellEditableByAbsoluteCoord,
    isCellEditableSafe,
    isEditingCellSafe,
  }
}
