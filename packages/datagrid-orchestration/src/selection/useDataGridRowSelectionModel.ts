import {
  applyDataGridRowSelectionRange,
  dataGridSelectionSetsEqual,
  normalizeDataGridRowId,
  normalizeDataGridRowIds,
  reconcileDataGridRowSelection,
  resolveDataGridSafeIndex,
  toggleDataGridRowSelection,
} from "../internal/dataGridRowSelectionState"

export interface DataGridRowSelectionGesture {
  shiftKey?: boolean
}

export interface UseDataGridRowSelectionModelOptions<TRow> {
  resolveFilteredRows: () => readonly TRow[]
  resolveFilteredRowIds?: () => readonly string[]
  resolveRowId: (row: TRow, index: number) => string
  resolveAllRows?: () => readonly TRow[]
  initialSelection?: Iterable<string>
  clearSelectionWhenSourceRowsEmpty?: boolean
  onSelectionChange?: (nextSelection: ReadonlySet<string>) => void
}

export interface UseDataGridRowSelectionModelResult {
  getSelection: () => ReadonlySet<string>
  replaceSelection: (rowIds: Iterable<string>) => void
  clearSelection: () => void
  isSelected: (rowId: string) => boolean
  toggleRowById: (rowId: string, selected?: boolean) => void
  toggleRowAtFilteredIndex: (index: number, selected: boolean, gesture?: DataGridRowSelectionGesture) => void
  applyShiftRange: (toIndex: number, selected: boolean) => void
  toggleSelectAllFiltered: (selected: boolean) => void
  setAnchorIndex: (index: number | null) => void
  getAnchorIndex: () => number | null
  reconcileWithRows: (allRows?: readonly unknown[]) => void
}

export function useDataGridRowSelectionModel<TRow>(
  options: UseDataGridRowSelectionModelOptions<TRow>,
): UseDataGridRowSelectionModelResult {
  const clearSelectionWhenSourceRowsEmpty = options.clearSelectionWhenSourceRowsEmpty ?? true
  let selection = normalizeDataGridRowIds(options.initialSelection ?? [])
  let anchorIndex: number | null = null

  function emitSelection(next: Set<string>): void {
    if (dataGridSelectionSetsEqual(selection, next)) {
      return
    }
    selection = next
    options.onSelectionChange?.(selection)
  }

  function resolveFilteredRowIds(): readonly string[] {
    const fromOptions = options.resolveFilteredRowIds?.()
    if (Array.isArray(fromOptions)) {
      return fromOptions
    }
    const rows = options.resolveFilteredRows()
    return rows.map((row, index) => options.resolveRowId(row, index))
  }

  function toggleRowById(rowId: string, selected?: boolean): void {
    emitSelection(toggleDataGridRowSelection(selection, rowId, selected))
  }

  function applyShiftRange(toIndex: number, selected: boolean): void {
    const filteredRowIds = resolveFilteredRowIds()
    const next = applyDataGridRowSelectionRange(selection, filteredRowIds, anchorIndex, toIndex, selected)
    anchorIndex = next.anchorIndex
    emitSelection(next.selection)
  }

  function toggleRowAtFilteredIndex(index: number, selected: boolean, gesture?: DataGridRowSelectionGesture): void {
    const filteredRowIds = resolveFilteredRowIds()
    if (!filteredRowIds.length) {
      return
    }

    const clampedIndex = resolveDataGridSafeIndex(index, filteredRowIds.length)
    if (gesture?.shiftKey && anchorIndex !== null) {
      applyShiftRange(clampedIndex, selected)
      return
    }

    const rowId = filteredRowIds[clampedIndex]
    if (!rowId) {
      return
    }
    anchorIndex = clampedIndex
    toggleRowById(rowId, selected)
  }

  function toggleSelectAllFiltered(selected: boolean): void {
    const filteredRowIds = resolveFilteredRowIds()
    const next = new Set(selection)

    filteredRowIds.forEach((rowId) => {
      if (!rowId) {
        return
      }
      if (selected) {
        next.add(rowId)
      } else {
        next.delete(rowId)
      }
    })

    if (!selected) {
      anchorIndex = null
    }
    emitSelection(next)
  }

  function reconcileWithRows(allRows?: readonly unknown[]): void {
    if (selection.size === 0) {
      return
    }

    const sourceRows = allRows ?? options.resolveAllRows?.() ?? []
    if (!sourceRows.length) {
      if (clearSelectionWhenSourceRowsEmpty) {
        anchorIndex = null
        emitSelection(new Set())
      }
      return
    }

    const next = reconcileDataGridRowSelection(
      selection,
      sourceRows as readonly TRow[],
      (row, index) => normalizeDataGridRowId(options.resolveRowId(row, index)),
    )
    emitSelection(next)
  }

  return {
    getSelection: () => selection,
    replaceSelection: (rowIds) => {
      emitSelection(normalizeDataGridRowIds(rowIds))
      if (selection.size === 0) {
        anchorIndex = null
      }
    },
    clearSelection: () => {
      anchorIndex = null
      emitSelection(new Set())
    },
    isSelected: rowId => selection.has(normalizeDataGridRowId(rowId)),
    toggleRowById,
    toggleRowAtFilteredIndex,
    applyShiftRange,
    toggleSelectAllFiltered,
    setAnchorIndex: (index) => {
      anchorIndex = index === null ? null : Math.max(0, Math.trunc(index))
    },
    getAnchorIndex: () => anchorIndex,
    reconcileWithRows,
  }
}
