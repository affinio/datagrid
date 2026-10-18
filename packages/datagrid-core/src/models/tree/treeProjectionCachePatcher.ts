import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"
import { normalizeLeafRow } from "./treeProjectionPrimitives.js"
import type { TreeParentProjectionCache, TreePathBranch, TreePathProjectionCache } from "./treeProjectionTypes.js"

function patchProjectedRowsByIdentity<T>(
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

export function patchTreePathProjectionCacheRowsByIdentity<T>(
  cache: TreePathProjectionCache<T>,
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  changedRowIds: readonly DataGridRowId[] = [],
): TreePathProjectionCache<T> {
  if (changedRowIds.length > 0) {
    const patchArrayIndex = (
      rows: DataGridRowNode<T>[],
      index: number | undefined,
      next: DataGridRowNode<T>,
    ): void => {
      if (typeof index !== "number" || index < 0 || index >= rows.length) {
        return
      }
      const current = rows[index]
      if (!current || current.rowId !== next.rowId || (current.data === next.data && current.row === next.row)) {
        return
      }
      rows[index] = normalizeLeafRow(next)
    }

    for (const rowId of changedRowIds) {
      const next = sourceById.get(rowId)
      if (next) {
        patchArrayIndex(cache.rootLeaves, cache.rootLeafIndexByRowId.get(rowId), next)
        patchArrayIndex(cache.leafOnlyRows, cache.leafOnlyRowIndexByRowId.get(rowId), next)
        const branch = cache.leafBranchByLeafRowId.get(rowId)
        patchArrayIndex(branch?.leaves ?? [], cache.branchLeafIndexByLeafRowId.get(rowId), next)
      }
      const branchPath = cache.branchPathByLeafRowId.get(rowId)
      if (!branchPath) {
        continue
      }
      for (const branchKey of branchPath) {
        cache.dirtyBranchKeys.add(branchKey)
      }
    }
    return cache
  }
  cache.rootLeaves = patchProjectedRowsByIdentity(cache.rootLeaves, sourceById)
  cache.leafOnlyRows = patchProjectedRowsByIdentity(cache.leafOnlyRows, sourceById)
  const patchBranch = (branch: TreePathBranch<T>) => {
    branch.leaves = patchProjectedRowsByIdentity(branch.leaves, sourceById)
    for (const child of branch.groups.values()) {
      patchBranch(child)
    }
  }
  for (const branch of cache.rootGroups.values()) {
    patchBranch(branch)
  }
  for (const rowId of changedRowIds) {
    const branchPath = cache.branchPathByLeafRowId.get(rowId)
    if (!branchPath) {
      continue
    }
    for (const branchKey of branchPath) {
      cache.dirtyBranchKeys.add(branchKey)
    }
  }
  return cache
}

export function patchTreeParentProjectionCacheRowsByIdentity<T>(
  cache: TreeParentProjectionCache<T>,
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  changedRowIds: readonly DataGridRowId[] = [],
): TreeParentProjectionCache<T> {
  if (changedRowIds.length > 0) {
    for (const rowId of changedRowIds) {
      const row = cache.rowById.get(rowId)
      const next = sourceById.get(rowId)
      if (row && next && (next.data !== row.data || next.row !== row.row)) {
        cache.rowById.set(rowId, normalizeLeafRow(next))
      }
      let cursor: DataGridRowId | null = rowId
      while (cursor != null) {
        cache.dirtyBranchRootIds.add(cursor)
        cursor = cache.parentById.get(cursor) ?? null
      }
    }
    return cache
  }
  for (const [rowId, row] of cache.rowById.entries()) {
    const next = sourceById.get(rowId)
    if (!next || (next.data === row.data && next.row === row.row)) {
      continue
    }
    cache.rowById.set(rowId, normalizeLeafRow(next))
  }
  for (const rowId of changedRowIds) {
    let cursor: DataGridRowId | null = rowId
    while (cursor != null) {
      cache.dirtyBranchRootIds.add(cursor)
      cursor = cache.parentById.get(cursor) ?? null
    }
  }
  return cache
}

