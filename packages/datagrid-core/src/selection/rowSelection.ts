import type { DataGridRowId } from "../models/index.js"

export interface DataGridRowSelectionSnapshot {
  focusedRow: DataGridRowId | null
  selectedRows: DataGridRowId[]
}

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

export function normalizeDataGridRowSelectionSnapshot(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
): DataGridRowSelectionSnapshot {
  if (!snapshot) {
    return {
      focusedRow: null,
      selectedRows: [],
    }
  }

  const selectedRows: DataGridRowId[] = []
  const seen = new Set<string>()
  for (const rowId of Array.isArray(snapshot.selectedRows) ? snapshot.selectedRows : []) {
    if (!isDataGridRowId(rowId)) {
      continue
    }
    const signature = `${typeof rowId}:${String(rowId)}`
    if (seen.has(signature)) {
      continue
    }
    seen.add(signature)
    selectedRows.push(rowId)
  }

  return {
    focusedRow: isDataGridRowId(snapshot.focusedRow) ? snapshot.focusedRow : null,
    selectedRows,
  }
}

export function dataGridRowSelectionSnapshotsEqual(
  left: DataGridRowSelectionSnapshot | null | undefined,
  right: DataGridRowSelectionSnapshot | null | undefined,
): boolean {
  const normalizedLeft = normalizeDataGridRowSelectionSnapshot(left)
  const normalizedRight = normalizeDataGridRowSelectionSnapshot(right)
  if (normalizedLeft.focusedRow !== normalizedRight.focusedRow) {
    return false
  }
  if (normalizedLeft.selectedRows.length !== normalizedRight.selectedRows.length) {
    return false
  }
  for (let index = 0; index < normalizedLeft.selectedRows.length; index += 1) {
    if (normalizedLeft.selectedRows[index] !== normalizedRight.selectedRows[index]) {
      return false
    }
  }
  return true
}

export function setDataGridRowFocused(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
  rowId: DataGridRowId | null,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  return {
    focusedRow: rowId,
    selectedRows: [...normalized.selectedRows],
  }
}

export function clearDataGridRowFocus(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
): DataGridRowSelectionSnapshot {
  return setDataGridRowFocused(snapshot, null)
}

export function isDataGridRowSelected(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
  rowId: DataGridRowId,
): boolean {
  return normalizeDataGridRowSelectionSnapshot(snapshot).selectedRows.includes(rowId)
}

export function setDataGridRowSelected(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
  rowId: DataGridRowId,
  selected: boolean,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  const nextSelectedRows = normalized.selectedRows.filter(candidate => candidate !== rowId)
  if (selected) {
    nextSelectedRows.push(rowId)
  }
  return {
    focusedRow: normalized.focusedRow,
    selectedRows: nextSelectedRows,
  }
}

export function replaceDataGridSelectedRows(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
  rowIds: Iterable<DataGridRowId>,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  return {
    focusedRow: normalized.focusedRow,
    selectedRows: normalizeDataGridRowSelectionSnapshot({
      focusedRow: normalized.focusedRow,
      selectedRows: Array.from(rowIds),
    }).selectedRows,
  }
}

export function selectDataGridRows(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
  rowIds: Iterable<DataGridRowId>,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  const nextSelectedRows = [...normalized.selectedRows]
  for (const rowId of rowIds) {
    if (!isDataGridRowId(rowId) || nextSelectedRows.includes(rowId)) {
      continue
    }
    nextSelectedRows.push(rowId)
  }
  return {
    focusedRow: normalized.focusedRow,
    selectedRows: nextSelectedRows,
  }
}

export function deselectDataGridRows(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
  rowIds: Iterable<DataGridRowId>,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  const blocked = new Set(Array.from(rowIds))
  return {
    focusedRow: normalized.focusedRow,
    selectedRows: normalized.selectedRows.filter(rowId => !blocked.has(rowId)),
  }
}

export function clearDataGridSelectedRows(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  return {
    focusedRow: normalized.focusedRow,
    selectedRows: [],
  }
}

export function reconcileDataGridRowSelectionSnapshot(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
  allowedRowIds: Iterable<DataGridRowId>,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  const allowed = new Set(Array.from(allowedRowIds))
  return {
    focusedRow: normalized.focusedRow != null && allowed.has(normalized.focusedRow)
      ? normalized.focusedRow
      : null,
    selectedRows: normalized.selectedRows.filter(rowId => allowed.has(rowId)),
  }
}