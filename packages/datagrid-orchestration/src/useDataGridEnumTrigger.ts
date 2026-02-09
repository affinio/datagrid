export interface UseDataGridEnumTriggerOptions<TRow, TCoord, TData> {
  isEnumColumn: (columnKey: string) => boolean
  isInlineEditorOpen: () => boolean
  isDragSelecting: () => boolean
  isFillDragging: () => boolean
  isActiveCell: (row: TRow, columnKey: string) => boolean
  resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null
  applyCellSelection: (coord: TCoord, extend: boolean) => void
  resolveRowData: (row: TRow) => TData
  beginInlineEdit: (
    rowData: TData,
    columnKey: string,
    mode: "select",
    openPicker: boolean,
  ) => void
}

export interface UseDataGridEnumTriggerResult<TRow> {
  shouldShowEnumTrigger: (row: TRow, columnKey: string) => boolean
  onEnumTriggerMouseDown: (row: TRow, columnKey: string, event: MouseEvent) => boolean
}

export function useDataGridEnumTrigger<TRow, TCoord, TData>(
  options: UseDataGridEnumTriggerOptions<TRow, TCoord, TData>,
): UseDataGridEnumTriggerResult<TRow> {
  function shouldShowEnumTrigger(row: TRow, columnKey: string): boolean {
    if (!options.isEnumColumn(columnKey)) {
      return false
    }
    if (options.isInlineEditorOpen() || options.isDragSelecting() || options.isFillDragging()) {
      return false
    }
    return options.isActiveCell(row, columnKey)
  }

  function onEnumTriggerMouseDown(row: TRow, columnKey: string, event: MouseEvent): boolean {
    if (!options.isEnumColumn(columnKey)) {
      return false
    }
    event.preventDefault()
    event.stopPropagation()
    const coord = options.resolveCellCoord(row, columnKey)
    if (coord) {
      options.applyCellSelection(coord, false)
    }
    options.beginInlineEdit(options.resolveRowData(row), columnKey, "select", true)
    return true
  }

  return {
    shouldShowEnumTrigger,
    onEnumTriggerMouseDown,
  }
}
