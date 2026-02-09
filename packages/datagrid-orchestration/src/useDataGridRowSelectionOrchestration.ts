export function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
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

export function toggleDataGridRowSelection(
  selection: ReadonlySet<string>,
  rowId: string,
  selected?: boolean,
): Set<string> {
  const next = new Set(selection)
  const shouldSelect = typeof selected === "boolean" ? selected : !next.has(rowId)
  if (shouldSelect) {
    next.add(rowId)
  } else {
    next.delete(rowId)
  }
  return next
}

export function toggleAllVisibleDataGridRows<TRow>(
  selection: ReadonlySet<string>,
  visibleRows: readonly TRow[],
  resolveRowId: (row: TRow) => string,
  selected: boolean,
): Set<string> {
  const next = new Set(selection)
  for (const row of visibleRows) {
    const rowId = resolveRowId(row)
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
  return visibleRows.every(row => selection.has(resolveRowId(row)))
}

export function areSomeVisibleDataGridRowsSelected<TRow>(
  selection: ReadonlySet<string>,
  visibleRows: readonly TRow[],
  resolveRowId: (row: TRow) => string,
): boolean {
  if (visibleRows.length === 0) {
    return false
  }
  return visibleRows.some(row => selection.has(resolveRowId(row)))
}

export function reconcileDataGridRowSelection<TRow>(
  selection: ReadonlySet<string>,
  allRows: readonly TRow[],
  resolveRowId: (row: TRow) => string,
): Set<string> {
  if (selection.size === 0) {
    return new Set()
  }
  const allowedIds = new Set(allRows.map(row => resolveRowId(row)))
  const next = new Set<string>()
  selection.forEach(rowId => {
    if (allowedIds.has(rowId)) {
      next.add(rowId)
    }
  })
  return next
}
