import type { DataGridApi, DataGridSelectionSnapshotRange } from "@affino/datagrid-core"
import { createGridSelectionRange } from "@affino/datagrid-core/advanced"
import type { GridSelectionContext } from "@affino/datagrid-core/advanced"

export interface DataGridDomCellCoord {
  rowIndex: number
  colIndex: number
  rowId: unknown
}

export function createDomCellSelectionController<TRow>(options: {
  api: DataGridApi<TRow>
  getColumnCount: () => number
}) {
  const setCellSelection = (
    point: DataGridDomCellCoord,
    anchor: DataGridDomCellCoord,
    origin: string,
    mode: "replace" | "extend" | "add" = "replace",
  ): void => {
    if (!options.api.selection.hasSupport()) return
    const selectionContext: GridSelectionContext = {
      grid: {
        rowCount: options.api.rows.getCount(),
        colCount: options.getColumnCount(),
      },
      getRowIdByIndex: index => options.api.rows.get(index)?.rowId ?? null,
    }
    const range = createGridSelectionRange(anchor, point, selectionContext)
    const nextRange: DataGridSelectionSnapshotRange = {
      startRow: range.startRow,
      endRow: range.endRow,
      startCol: range.startCol,
      endCol: range.endCol,
      startRowId: range.startRowId ?? null,
      endRowId: range.endRowId ?? null,
      anchor: range.anchor,
      focus: range.focus,
    }
    const current = options.api.selection.getSnapshot()
    const activeIndex = current && current.ranges.length > 0
      ? Math.max(0, Math.min(current.activeRangeIndex ?? 0, current.ranges.length - 1))
      : 0
    let ranges: DataGridSelectionSnapshotRange[] = [nextRange]
    let activeRangeIndex = 0

    if (mode === "extend" && current && current.ranges.length > 0) {
      ranges = current.ranges.map((entry, index) => index === activeIndex ? nextRange : entry)
      activeRangeIndex = activeIndex
    } else if (mode === "add" && current && current.ranges.length > 0) {
      const duplicateIndex = current.ranges.findIndex(entry => (
        entry.startRow === nextRange.startRow
        && entry.endRow === nextRange.endRow
        && entry.startCol === nextRange.startCol
        && entry.endCol === nextRange.endCol
        && entry.anchor.rowIndex === nextRange.anchor.rowIndex
        && entry.anchor.colIndex === nextRange.anchor.colIndex
        && entry.focus.rowIndex === nextRange.focus.rowIndex
        && entry.focus.colIndex === nextRange.focus.colIndex
      ))
      ranges = duplicateIndex >= 0 ? [...current.ranges] : [...current.ranges, nextRange]
      activeRangeIndex = duplicateIndex >= 0 ? duplicateIndex : ranges.length - 1
    }

    options.api.selection.setSnapshot({
      ranges,
      activeRangeIndex,
      activeCell: range.focus,
    }, { origin })
  }

  return { setCellSelection }
}
