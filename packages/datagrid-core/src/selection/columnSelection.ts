export interface DataGridColumnSelectionSnapshot {
  readonly selectedColumnKeys: readonly string[]
}

export function normalizeDataGridColumnSelectionSnapshot(
  snapshot: DataGridColumnSelectionSnapshot | null | undefined,
): DataGridColumnSelectionSnapshot {
  const seen = new Set<string>()
  const selectedColumnKeys: string[] = []
  const source = Array.isArray(snapshot?.selectedColumnKeys) ? snapshot.selectedColumnKeys : []
  for (const key of source) {
    if (typeof key !== "string" || key.length === 0 || seen.has(key)) continue
    seen.add(key)
    selectedColumnKeys.push(key)
  }
  return Object.freeze({ selectedColumnKeys: Object.freeze(selectedColumnKeys) })
}

export function dataGridColumnSelectionSnapshotsEqual(
  left: DataGridColumnSelectionSnapshot | null | undefined,
  right: DataGridColumnSelectionSnapshot | null | undefined,
): boolean {
  const a = new Set(normalizeDataGridColumnSelectionSnapshot(left).selectedColumnKeys)
  const b = new Set(normalizeDataGridColumnSelectionSnapshot(right).selectedColumnKeys)
  if (a.size !== b.size) return false
  for (const key of a) if (!b.has(key)) return false
  return true
}

export function setDataGridColumnSelected(
  snapshot: DataGridColumnSelectionSnapshot | null | undefined,
  columnKey: string,
  selected: boolean,
): DataGridColumnSelectionSnapshot {
  const keys = normalizeDataGridColumnSelectionSnapshot(snapshot).selectedColumnKeys
  const next = keys.filter(key => key !== columnKey)
  if (selected) next.push(columnKey)
  return normalizeDataGridColumnSelectionSnapshot({ selectedColumnKeys: next })
}

export function selectDataGridColumns(
  snapshot: DataGridColumnSelectionSnapshot | null | undefined,
  columnKeys: Iterable<string>,
): DataGridColumnSelectionSnapshot {
  return normalizeDataGridColumnSelectionSnapshot({
    selectedColumnKeys: [
      ...normalizeDataGridColumnSelectionSnapshot(snapshot).selectedColumnKeys,
      ...columnKeys,
    ],
  })
}

export function deselectDataGridColumns(
  snapshot: DataGridColumnSelectionSnapshot | null | undefined,
  columnKeys: Iterable<string>,
): DataGridColumnSelectionSnapshot {
  const removed = new Set(columnKeys)
  return normalizeDataGridColumnSelectionSnapshot({
    selectedColumnKeys: normalizeDataGridColumnSelectionSnapshot(snapshot).selectedColumnKeys.filter(key => !removed.has(key)),
  })
}
