export interface DataGridRowSelectionRangeResult {
  selection: Set<string>
  anchorIndex: number | null
}

export function normalizeDataGridRowId(rowId: string): string {
  return String(rowId ?? "").trim()
}

export function normalizeDataGridRowIds(rowIds: Iterable<string>): Set<string> {
  const next = new Set<string>()
  for (const rowId of rowIds) {
    const normalized = normalizeDataGridRowId(rowId)
    if (normalized.length > 0) {
      next.add(normalized)
    }
  }
  return next
}

export function dataGridSelectionSetsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
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

export function resolveDataGridSafeIndex(index: number, size: number): number {
  if (size <= 0) {
    return 0
  }
  const normalized = Math.trunc(Number.isFinite(index) ? index : 0)
  return Math.max(0, Math.min(size - 1, normalized))
}

export function toggleDataGridRowSelection(
  selection: ReadonlySet<string>,
  rowId: string,
  selected?: boolean,
): Set<string> {
  const normalizedId = normalizeDataGridRowId(rowId)
  if (normalizedId.length === 0) {
    return new Set(selection)
  }
  const next = new Set(selection)
  const shouldSelect = typeof selected === "boolean" ? selected : !next.has(normalizedId)
  if (shouldSelect) {
    next.add(normalizedId)
  } else {
    next.delete(normalizedId)
  }
  return next
}

export function applyDataGridRowSelectionRange(
  selection: ReadonlySet<string>,
  filteredRowIds: readonly string[],
  anchorIndex: number | null,
  toIndex: number,
  selected: boolean,
): DataGridRowSelectionRangeResult {
  if (!filteredRowIds.length) {
    return {
      selection: new Set(selection),
      anchorIndex,
    }
  }

  const clampedTo = resolveDataGridSafeIndex(toIndex, filteredRowIds.length)
  const normalizedAnchor = anchorIndex === null
    ? clampedTo
    : resolveDataGridSafeIndex(anchorIndex, filteredRowIds.length)
  const from = Math.min(normalizedAnchor, clampedTo)
  const to = Math.max(normalizedAnchor, clampedTo)
  const next = new Set(selection)

  for (let index = from; index <= to; index += 1) {
    const rowId = normalizeDataGridRowId(filteredRowIds[index] ?? "")
    if (!rowId) {
      continue
    }
    if (selected) {
      next.add(rowId)
    } else {
      next.delete(rowId)
    }
  }

  return {
    selection: next,
    anchorIndex: clampedTo,
  }
}

export function toggleAllVisibleDataGridRows<TRow>(
  selection: ReadonlySet<string>,
  visibleRows: readonly TRow[],
  resolveRowId: (row: TRow) => string,
  selected: boolean,
): Set<string> {
  const next = new Set(selection)
  for (const row of visibleRows) {
    const rowId = normalizeDataGridRowId(resolveRowId(row))
    if (!rowId) {
      continue
    }
    if (selected) {
      next.add(rowId)
    } else {
      next.delete(rowId)
    }
  }
  return next
}

export function areAllVisibleDataGridRowsSelected<TRow>(
  selection: ReadonlySet<string>,
  visibleRows: readonly TRow[],
  resolveRowId: (row: TRow) => string,
): boolean {
  if (visibleRows.length === 0) {
    return false
  }
  return visibleRows.every(row => selection.has(normalizeDataGridRowId(resolveRowId(row))))
}

export function areSomeVisibleDataGridRowsSelected<TRow>(
  selection: ReadonlySet<string>,
  visibleRows: readonly TRow[],
  resolveRowId: (row: TRow) => string,
): boolean {
  if (visibleRows.length === 0) {
    return false
  }
  return visibleRows.some(row => selection.has(normalizeDataGridRowId(resolveRowId(row))))
}

export function reconcileDataGridRowSelection<TRow>(
  selection: ReadonlySet<string>,
  allRows: readonly TRow[],
  resolveRowId: (row: TRow, index: number) => string,
): Set<string> {
  if (selection.size === 0) {
    return new Set()
  }
  const allowedIds = new Set(allRows.map((row, index) => normalizeDataGridRowId(resolveRowId(row, index))))
  const next = new Set<string>()
  selection.forEach(rowId => {
    if (allowedIds.has(rowId)) {
      next.add(rowId)
    }
  })
  return next
}