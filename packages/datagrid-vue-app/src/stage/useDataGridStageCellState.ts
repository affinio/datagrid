import { type Ref } from "vue"
import { resolveDataGridCellInteraction } from "@affino/datagrid-vue"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageBodyRow,
} from "./dataGridTableStageBody.types"

export interface UseDataGridStageCellStateOptions {
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  cells: Readonly<Ref<{
    readCell: (row: DataGridTableStageBodyRow, columnKey: string) => string
  }>>
  isCellEditableSafe: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isEditingCellSafe: (row: DataGridTableStageBodyRow, columnKey: string) => boolean
  resolveCellEditorMode: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => "none" | "text" | "select" | "date" | "datetime"
  isCellSelectedSafe: (rowOffset: number, columnIndex: number) => boolean
  isVisualSelectionAnchorCell: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightSelectedCellVisual: (rowOffset: number, columnIndex: number) => boolean
  isRangeMoveHandleHoverCell: (rowOffset: number, columnIndex: number) => boolean
  isCellInFillPreviewSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellInPendingClipboardRangeSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellOnPendingClipboardEdgeSafe: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
}

export interface UseDataGridStageCellStateResult {
  builtInCellClasses: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => Record<string, boolean>
  cellStateClasses: (row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number) => Record<string, boolean>
  cellAriaSelected: (rowOffset: number, columnIndex: number) => "true" | "false"
  cellAriaRole: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => string | undefined
  cellAriaChecked: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => "true" | "false" | "mixed" | undefined
  cellAriaPressed: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => "true" | "false" | "mixed" | undefined
  cellAriaLabel: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => string | undefined
  cellAriaDisabled: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => "true" | undefined
  isRowSelectionColumn: (column: DataGridTableStageBodyColumn) => boolean
  shouldRenderCheckboxCell: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => boolean
  checkboxIndicatorClass: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
  checkboxIndicatorMarkClass: (row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn) => Record<string, boolean>
}

function isCheckboxColumn(column: DataGridTableStageBodyColumn): boolean {
  return column.column.cellType === "checkbox"
}

function isRowSelectionColumn(column: DataGridTableStageBodyColumn): boolean {
  return column.column.meta?.rowSelection === true
}

function isPlaceholderRow(row: DataGridTableStageBodyRow): boolean {
  return (row as { __placeholder?: unknown }).__placeholder === true
}

function checkboxValueIsChecked(options: UseDataGridStageCellStateOptions, row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): boolean {
  const value = options.cells.value.readCell(row, column.key).trim().toLowerCase()
  return value === "true" || value === "1" || value === "yes" || value === "on"
}

function resolveCellInteraction(
  options: UseDataGridStageCellStateOptions,
  row: DataGridTableStageBodyRow,
  rowOffset: number,
  column: DataGridTableStageBodyColumn,
  columnIndex: number,
) {
  return resolveDataGridCellInteraction({
    column: column.column,
    row: row.kind !== "group" ? row.data : undefined,
    rowId: row.rowId,
    editable: options.isCellEditableSafe(row, rowOffset, column, columnIndex),
  })
}

export function useDataGridStageCellState(
  options: UseDataGridStageCellStateOptions,
): UseDataGridStageCellStateResult {
  function shouldRenderCheckboxCell(row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): boolean {
    return row.kind !== "group" && isCheckboxColumn(column)
  }

  function builtInCellClasses(
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): Record<string, boolean> {
    const editorMode = row.kind !== "group" ? options.resolveCellEditorMode(row, column) : "none"
    const editable = options.isCellEditableSafe(row, rowOffset, column, columnIndex)
    const interaction = resolveCellInteraction(options, row, rowOffset, column, columnIndex)
    return {
      "grid-cell--checkbox": shouldRenderCheckboxCell(row, column),
      "grid-cell--row-selection": isRowSelectionColumn(column),
      "grid-cell--select": editable && editorMode === "select",
      "grid-cell--date": editable && (editorMode === "date" || editorMode === "datetime"),
      "grid-cell--interactive": interaction !== null,
    }
  }

  function cellStateClasses(row: DataGridTableStageBodyRow, rowOffset: number, columnIndex: number): Record<string, boolean> {
    const columnKey = options.visibleColumns.value[columnIndex]?.key ?? ""
    const isAnchorCell = options.isVisualSelectionAnchorCell(rowOffset, columnIndex)
    return {
      "grid-cell--selected": !isAnchorCell && options.shouldHighlightSelectedCellVisual(rowOffset, columnIndex),
      "grid-cell--selection-anchor": isAnchorCell,
      "grid-cell--range-move-handle-hover": options.isRangeMoveHandleHoverCell(rowOffset, columnIndex),
      "grid-cell--fill-preview": options.isCellInFillPreviewSafe(rowOffset, columnIndex),
      "grid-cell--clipboard-pending": options.isCellInPendingClipboardRangeSafe(rowOffset, columnIndex),
      "grid-cell--clipboard-pending-top": options.isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "top"),
      "grid-cell--clipboard-pending-right": options.isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "right"),
      "grid-cell--clipboard-pending-bottom": options.isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "bottom"),
      "grid-cell--clipboard-pending-left": options.isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "left"),
      "grid-cell--editing": options.isEditingCellSafe(row, columnKey),
    }
  }

  function cellAriaSelected(rowOffset: number, columnIndex: number): "true" | "false" {
    return options.isVisualSelectionAnchorCell(rowOffset, columnIndex)
      || options.isCellSelectedSafe(rowOffset, columnIndex)
      || options.shouldHighlightSelectedCellVisual(rowOffset, columnIndex)
      ? "true"
      : "false"
  }

  function cellAriaRole(
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): string | undefined {
    return resolveCellInteraction(options, row, rowOffset, column, columnIndex)?.role
      ?? (shouldRenderCheckboxCell(row, column) ? "checkbox" : undefined)
  }

  function cellAriaChecked(
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): "true" | "false" | "mixed" | undefined {
    return resolveCellInteraction(options, row, rowOffset, column, columnIndex)?.checked
      ?? (shouldRenderCheckboxCell(row, column)
        ? (checkboxValueIsChecked(options, row, column) ? "true" : "false")
        : undefined)
  }

  function cellAriaPressed(
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): "true" | "false" | "mixed" | undefined {
    return resolveCellInteraction(options, row, rowOffset, column, columnIndex)?.pressed
  }

  function cellAriaLabel(
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): string | undefined {
    return resolveCellInteraction(options, row, rowOffset, column, columnIndex)?.label
  }

  function cellAriaDisabled(
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): "true" | undefined {
    if (isPlaceholderRow(row) && !options.isCellEditableSafe(row, rowOffset, column, columnIndex)) {
      return "true"
    }
    return resolveCellInteraction(options, row, rowOffset, column, columnIndex)?.disabled ? "true" : undefined
  }

  function checkboxIndicatorClass(row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): Record<string, boolean> {
    return {
      "grid-checkbox-indicator--checked": checkboxValueIsChecked(options, row, column),
    }
  }

  function checkboxIndicatorMarkClass(row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): Record<string, boolean> {
    return {
      "grid-checkbox-indicator__mark--checked": checkboxValueIsChecked(options, row, column),
    }
  }

  return {
    builtInCellClasses,
    cellStateClasses,
    cellAriaSelected,
    cellAriaRole,
    cellAriaChecked,
    cellAriaPressed,
    cellAriaLabel,
    cellAriaDisabled,
    isRowSelectionColumn,
    shouldRenderCheckboxCell,
    checkboxIndicatorClass,
    checkboxIndicatorMarkClass,
  }
}
