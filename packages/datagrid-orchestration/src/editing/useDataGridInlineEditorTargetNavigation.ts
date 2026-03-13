import type { DataGridInlineEditorMode } from "./useDataGridInlineEditOrchestration"

export interface DataGridInlineEditorNavigationColumnLike {
  key: string
}

export interface DataGridInlineEditorNavigationCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridInlineEditorNavigationTarget<TColumnKey extends string> {
  rowId: string
  columnKey: TColumnKey
  rowIndex: number
  columnIndex: number
}

export interface UseDataGridInlineEditorTargetNavigationOptions<
  TRow,
  TColumnKey extends string,
  TColumn extends DataGridInlineEditorNavigationColumnLike = DataGridInlineEditorNavigationColumnLike,
> {
  resolveRows: () => readonly TRow[]
  resolveOrderedColumns: () => readonly TColumn[]
  resolveRowId: (row: TRow) => string
  resolveColumnIndex: (columnKey: string) => number
  isEditableColumn: (columnKey: string) => columnKey is TColumnKey
  isSelectColumn?: (columnKey: string) => boolean
  applyCellSelection: (coord: DataGridInlineEditorNavigationCoord, extend: boolean) => void
  beginInlineEdit: (
    row: TRow,
    columnKey: TColumnKey,
    mode: DataGridInlineEditorMode,
    openPicker?: boolean,
  ) => boolean
}

export interface UseDataGridInlineEditorTargetNavigationResult<TColumnKey extends string> {
  resolveNextEditableTarget: (
    rowId: string,
    columnKey: string,
    direction: 1 | -1,
  ) => DataGridInlineEditorNavigationTarget<TColumnKey> | null
  focusInlineEditorTarget: (target: DataGridInlineEditorNavigationTarget<TColumnKey>) => boolean
}

export function useDataGridInlineEditorTargetNavigation<
  TRow,
  TColumnKey extends string,
  TColumn extends DataGridInlineEditorNavigationColumnLike = DataGridInlineEditorNavigationColumnLike,
>(
  options: UseDataGridInlineEditorTargetNavigationOptions<TRow, TColumnKey, TColumn>,
): UseDataGridInlineEditorTargetNavigationResult<TColumnKey> {
  function resolveNextEditableTarget(
    rowId: string,
    columnKey: string,
    direction: 1 | -1,
  ): DataGridInlineEditorNavigationTarget<TColumnKey> | null {
    const rows = options.resolveRows()
    const rowIndex = rows.findIndex(row => options.resolveRowId(row) === rowId)
    if (rowIndex < 0) {
      return null
    }

    const orderedColumns = options.resolveOrderedColumns()
    const editableIndexes = orderedColumns
      .map((column, index) => ({ column, index }))
      .filter(entry => options.isEditableColumn(entry.column.key))
      .map(entry => entry.index)
    if (editableIndexes.length === 0) {
      return null
    }

    const currentColumnIndex = options.resolveColumnIndex(columnKey)
    const currentEditablePosition = editableIndexes.indexOf(currentColumnIndex)
    if (currentEditablePosition < 0) {
      return null
    }

    let nextRowIndex = rowIndex
    let nextEditablePosition = currentEditablePosition + direction
    if (nextEditablePosition >= editableIndexes.length) {
      nextEditablePosition = 0
      nextRowIndex += 1
    } else if (nextEditablePosition < 0) {
      nextEditablePosition = editableIndexes.length - 1
      nextRowIndex -= 1
    }

    if (nextRowIndex < 0 || nextRowIndex >= rows.length) {
      return null
    }
    const nextColumnIndex = editableIndexes[nextEditablePosition]
    if (typeof nextColumnIndex !== "number") {
      return null
    }
    const nextColumn = orderedColumns[nextColumnIndex]
    const nextRow = rows[nextRowIndex]
    if (!nextColumn || !nextRow || !options.isEditableColumn(nextColumn.key)) {
      return null
    }
    return {
      rowId: options.resolveRowId(nextRow),
      columnKey: nextColumn.key,
      rowIndex: nextRowIndex,
      columnIndex: nextColumnIndex,
    }
  }

  function focusInlineEditorTarget(target: DataGridInlineEditorNavigationTarget<TColumnKey>): boolean {
    const row = options.resolveRows().find(entry => options.resolveRowId(entry) === target.rowId)
    if (!row) {
      return false
    }
    options.applyCellSelection(
      {
        rowIndex: target.rowIndex,
        columnIndex: target.columnIndex,
      },
      false,
    )
    const mode: DataGridInlineEditorMode = options.isSelectColumn?.(target.columnKey) ? "select" : "text"
    return options.beginInlineEdit(row, target.columnKey, mode, false)
  }

  return {
    resolveNextEditableTarget,
    focusInlineEditorTarget,
  }
}
