import type { DataGridRowId, DataGridRowNode } from "./rowModel.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function applyRowDataPatch<T>(current: T, patch: Partial<T>): T {
  if (!isRecord(current) || !isRecord(patch)) {
    return patch as T
  }
  let changed = false
  const next = Object.create(Object.getPrototypeOf(current)) as Record<string, unknown>
  Object.defineProperties(next, Object.getOwnPropertyDescriptors(current))
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (Object.is(next[key], value)) {
      continue
    }
    next[key] = value
    changed = true
  }
  return changed ? (next as T) : current
}

export function mergeRowPatch<T>(left: Partial<T>, right: Partial<T>): Partial<T> {
  if (isRecord(left) && isRecord(right)) {
    return {
      ...left,
      ...right,
    } as Partial<T>
  }
  return right
}

export function buildRowIdIndex<T>(inputRows: readonly DataGridRowNode<T>[]): Map<DataGridRowId, DataGridRowNode<T>> {
  const byId = new Map<DataGridRowId, DataGridRowNode<T>>()
  for (const row of inputRows) {
    byId.set(row.rowId, row)
  }
  return byId
}

export function buildRowIdPositionIndex<T>(
  inputRows: readonly DataGridRowNode<T>[],
): Map<DataGridRowId, number> {
  const byId = new Map<DataGridRowId, number>()
  for (let index = 0; index < inputRows.length; index += 1) {
    const row = inputRows[index]
    if (!row) {
      continue
    }
    byId.set(row.rowId, index)
  }
  return byId
}

export function remapRowsByIdentity<T>(
  inputRows: readonly DataGridRowNode<T>[],
  byId: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
): DataGridRowNode<T>[] {
  const remapped: DataGridRowNode<T>[] = []
  for (const row of inputRows) {
    const replacement = byId.get(row.rowId)
    if (replacement) {
      remapped.push(replacement)
    }
  }
  return remapped
}

export function preserveRowOrder<T>(
  previousRows: readonly DataGridRowNode<T>[],
  nextRows: readonly DataGridRowNode<T>[],
): DataGridRowNode<T>[] {
  if (previousRows.length === 0) {
    return [...nextRows]
  }
  const nextById = buildRowIdIndex(nextRows)
  const seen = new Set<DataGridRowId>()
  const projected: DataGridRowNode<T>[] = []
  for (const row of previousRows) {
    const candidate = nextById.get(row.rowId)
    if (!candidate || seen.has(candidate.rowId)) {
      continue
    }
    projected.push(candidate)
    seen.add(candidate.rowId)
  }
  for (const row of nextRows) {
    if (seen.has(row.rowId)) {
      continue
    }
    projected.push(row)
    seen.add(row.rowId)
  }
  return projected
}

export function patchProjectedRowsByIdentity<T>(
  inputRows: readonly DataGridRowNode<T>[],
  byId: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
): DataGridRowNode<T>[] {
  const patched: DataGridRowNode<T>[] = []
  for (const row of inputRows) {
    const next = byId.get(row.rowId)
    if (!next) {
      patched.push(row)
      continue
    }
    if (row.data === next.data && row.row === next.row) {
      patched.push(row)
      continue
    }
    patched.push({
      ...row,
      data: next.data,
      row: next.row,
    })
  }
  return patched
}

export function createRowVersionIndex<T>(rows: readonly DataGridRowNode<T>[]): Map<DataGridRowId, number> {
  const versions = new Map<DataGridRowId, number>()
  for (const row of rows) {
    versions.set(row.rowId, 0)
  }
  return versions
}

export function rebuildRowVersionIndex<T>(
  previous: ReadonlyMap<DataGridRowId, number>,
  rows: readonly DataGridRowNode<T>[],
): Map<DataGridRowId, number> {
  const versions = new Map<DataGridRowId, number>()
  for (const row of rows) {
    versions.set(
      row.rowId,
      previous.has(row.rowId)
        ? ((previous.get(row.rowId) ?? 0) + 1)
        : 0,
    )
  }
  return versions
}

export function bumpRowVersions(
  versions: Map<DataGridRowId, number>,
  rowIds: readonly DataGridRowId[],
): void {
  for (const rowId of rowIds) {
    versions.set(rowId, (versions.get(rowId) ?? 0) + 1)
  }
}

export function pruneSortCacheRows<T, V>(
  cache: Map<DataGridRowId, V>,
  rows: readonly DataGridRowNode<T>[],
): void {
  const activeRowIds = new Set<DataGridRowId>()
  for (const row of rows) {
    activeRowIds.add(row.rowId)
  }
  for (const rowId of cache.keys()) {
    if (!activeRowIds.has(rowId)) {
      cache.delete(rowId)
    }
  }
}

export function enforceCacheCap<K, V>(
  cache: Map<K, V>,
  maxSize: number,
): void {
  if (maxSize <= 0 || cache.size <= maxSize) {
    return
  }
  while (cache.size > maxSize) {
    const next = cache.keys().next()
    if (next.done) {
      break
    }
    cache.delete(next.value)
  }
}

export function assignDisplayIndexes<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] {
  const projected: DataGridRowNode<T>[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      continue
    }
    if (row.displayIndex === index) {
      projected.push(row)
    } else {
      projected.push({
        ...row,
        displayIndex: index,
      })
    }
  }
  return projected
}

export function reindexSourceRows<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] {
  const normalized: DataGridRowNode<T>[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      continue
    }
    normalized.push({
      ...row,
      sourceIndex: index,
      originalIndex: index,
      displayIndex: index,
    })
  }
  return normalized
}

export function buildGroupRowIndexByRowId<T>(
  rows: readonly DataGridRowNode<T>[],
): Map<DataGridRowId, number> {
  const indexByRowId = new Map<DataGridRowId, number>()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row || row.kind !== "group") {
      continue
    }
    indexByRowId.set(row.rowId, index)
  }
  return indexByRowId
}
