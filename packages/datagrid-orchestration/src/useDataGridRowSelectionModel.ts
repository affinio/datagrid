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

function normalizeRowIds(rowIds: Iterable<string>): Set<string> {
  const next = new Set<string>()
  for (const rowId of rowIds) {
    const normalized = String(rowId ?? "").trim()
    if (normalized.length > 0) {
      next.add(normalized)
    }
  }
  return next
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }
  return true
}

export function useDataGridRowSelectionModel<TRow>(
  options: UseDataGridRowSelectionModelOptions<TRow>,
): UseDataGridRowSelectionModelResult {
  const clearSelectionWhenSourceRowsEmpty = options.clearSelectionWhenSourceRowsEmpty ?? true
  let selection = normalizeRowIds(options.initialSelection ?? [])
  let anchorIndex: number | null = null

  function emitSelection(next: Set<string>): void {
    if (setsEqual(selection, next)) {
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

  function resolveSafeIndex(index: number, size: number): number {
    if (size <= 0) {
      return 0
    }
    const normalized = Math.trunc(Number.isFinite(index) ? index : 0)
    return Math.max(0, Math.min(size - 1, normalized))
  }

  function toggleRowById(rowId: string, selected?: boolean): void {
    const normalizedId = String(rowId ?? "").trim()
    if (normalizedId.length === 0) {
      return
    }
    const next = new Set(selection)
    const shouldSelect = typeof selected === "boolean" ? selected : !next.has(normalizedId)
    if (shouldSelect) {
      next.add(normalizedId)
    } else {
      next.delete(normalizedId)
    }
    emitSelection(next)
  }

  function applyShiftRange(toIndex: number, selected: boolean): void {
    const filteredRowIds = resolveFilteredRowIds()
    if (!filteredRowIds.length) {
      return
    }
    const clampedTo = resolveSafeIndex(toIndex, filteredRowIds.length)
    const anchor = anchorIndex === null
      ? clampedTo
      : resolveSafeIndex(anchorIndex, filteredRowIds.length)
    const from = Math.min(anchor, clampedTo)
    const to = Math.max(anchor, clampedTo)
    const next = new Set(selection)

    for (let index = from; index <= to; index += 1) {
      const rowId = filteredRowIds[index]
      if (!rowId) {
        continue
      }
      if (selected) {
        next.add(rowId)
      } else {
        next.delete(rowId)
      }
    }

    anchorIndex = clampedTo
    emitSelection(next)
  }

  function toggleRowAtFilteredIndex(index: number, selected: boolean, gesture?: DataGridRowSelectionGesture): void {
    const filteredRowIds = resolveFilteredRowIds()
    if (!filteredRowIds.length) {
      return
    }

    const clampedIndex = resolveSafeIndex(index, filteredRowIds.length)
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

    const allowed = new Set<string>()
    sourceRows.forEach((row, index) => {
      allowed.add(options.resolveRowId(row as TRow, index))
    })

    const next = new Set<string>()
    selection.forEach((rowId) => {
      if (allowed.has(rowId)) {
        next.add(rowId)
      }
    })

    emitSelection(next)
  }

  return {
    getSelection: () => selection,
    replaceSelection: (rowIds) => {
      emitSelection(normalizeRowIds(rowIds))
      if (selection.size === 0) {
        anchorIndex = null
      }
    },
    clearSelection: () => {
      anchorIndex = null
      emitSelection(new Set())
    },
    isSelected: rowId => selection.has(String(rowId ?? "")),
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
