import type { DataGridRowId } from "../models/index.js"

export interface DataGridRowSelectionSnapshot {
  focusedRow: DataGridRowId | null
  selectedRows: DataGridRowId[]
  mode?: "explicit" | "all"
  excludedRows?: DataGridRowId[]
}

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function getDataGridRowIdSignature(rowId: DataGridRowId): string {
  return `${typeof rowId}:${String(rowId)}`
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

  const selectedRows = normalizeDataGridRowIds(snapshot.selectedRows)
  const mode = snapshot.mode === "all" ? "all" : "explicit"
  const excludedRows = mode === "all" ? normalizeDataGridRowIds(snapshot.excludedRows) : []

  return {
    focusedRow: isDataGridRowId(snapshot.focusedRow) ? snapshot.focusedRow : null,
    selectedRows,
    ...(mode === "all" ? { mode, excludedRows } : {}),
  }
}

function normalizeDataGridRowIds(input: unknown): DataGridRowId[] {
  const source = Array.isArray(input) ? input : []
  const normalizedRowIds: DataGridRowId[] = []
  const seen = new Set<string>()
  for (const rowId of source) {
    if (!isDataGridRowId(rowId)) {
      continue
    }
    const signature = getDataGridRowIdSignature(rowId)
    if (seen.has(signature)) {
      continue
    }
    seen.add(signature)
    normalizedRowIds.push(rowId)
  }
  return normalizedRowIds
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
  if ((normalizedLeft.mode ?? "explicit") !== (normalizedRight.mode ?? "explicit")) {
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
  const leftExcludedRows = normalizedLeft.excludedRows ?? []
  const rightExcludedRows = normalizedRight.excludedRows ?? []
  if (leftExcludedRows.length !== rightExcludedRows.length) {
    return false
  }
  for (let index = 0; index < leftExcludedRows.length; index += 1) {
    if (leftExcludedRows[index] !== rightExcludedRows[index]) {
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
    ...(normalized.mode === "all" ? { mode: "all" as const, excludedRows: [...(normalized.excludedRows ?? [])] } : {}),
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
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  if (normalized.mode === "all") {
    return !(normalized.excludedRows ?? []).includes(rowId)
  }
  return normalized.selectedRows.includes(rowId)
}

export function setDataGridRowSelected(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
  rowId: DataGridRowId,
  selected: boolean,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  if (normalized.mode === "all") {
    const excludedRows = selected
      ? (normalized.excludedRows ?? []).filter(candidate => candidate !== rowId)
      : selectDataGridRows({ focusedRow: normalized.focusedRow, selectedRows: normalized.excludedRows ?? [] }, [rowId]).selectedRows
    return {
      focusedRow: normalized.focusedRow,
      selectedRows: [],
      mode: "all",
      excludedRows,
    }
  }
  const nextSelectedRows = normalized.selectedRows.filter(candidate => candidate !== rowId)
  if (selected) {
    nextSelectedRows.push(rowId)
  }
  return {
    focusedRow: normalized.focusedRow,
    selectedRows: nextSelectedRows,
  }
}

export function selectAllDataGridRows(
  snapshot: DataGridRowSelectionSnapshot | null | undefined,
): DataGridRowSelectionSnapshot {
  const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
  return {
    focusedRow: normalized.focusedRow,
    selectedRows: [],
    mode: "all",
    excludedRows: [],
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
  const nextRows = Array.from(rowIds)
  if (normalized.mode === "all") {
    const selected = new Set(nextRows.map(getDataGridRowIdSignature))
    return {
      focusedRow: normalized.focusedRow,
      selectedRows: [],
      mode: "all",
      excludedRows: (normalized.excludedRows ?? []).filter(rowId => !selected.has(getDataGridRowIdSignature(rowId))),
    }
  }
  const nextSelectedRows = [...normalized.selectedRows]
  const seen = new Set(normalized.selectedRows.map(getDataGridRowIdSignature))
  for (const rowId of nextRows) {
    if (!isDataGridRowId(rowId)) {
      continue
    }
    const signature = getDataGridRowIdSignature(rowId)
    if (seen.has(signature)) {
      continue
    }
    seen.add(signature)
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
  const blockedRows = Array.from(rowIds)
  const blocked = new Set(blockedRows)
  if (normalized.mode === "all") {
    return {
      focusedRow: normalized.focusedRow,
      selectedRows: [],
      mode: "all",
      excludedRows: selectDataGridRows(
        { focusedRow: normalized.focusedRow, selectedRows: normalized.excludedRows ?? [] },
        blockedRows,
      ).selectedRows,
    }
  }
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
  if (normalized.mode === "all") {
    return {
      focusedRow: normalized.focusedRow != null && allowed.has(normalized.focusedRow)
        ? normalized.focusedRow
        : null,
      selectedRows: [],
      mode: "all",
      excludedRows: (normalized.excludedRows ?? []).filter(rowId => allowed.has(rowId)),
    }
  }
  return {
    focusedRow: normalized.focusedRow != null && allowed.has(normalized.focusedRow)
      ? normalized.focusedRow
      : null,
    selectedRows: normalized.selectedRows.filter(rowId => allowed.has(rowId)),
  }
}
