import {
  materializeTreeParentProjection,
} from "./treeProjectionParentMaterializer.js"
import { materializeTreePathProjection } from "./treeProjectionPathMaterializer.js"
import { buildTreeParentProjectionCache } from "./treeProjectionParentCache.js"
import { normalizeLeafRow } from "./treeProjectionPrimitives.js"
import { buildTreePathProjectionCache } from "./treeProjectionPathCache.js"
import {
  tryProjectTreeParentSubtreeToggle,
  tryProjectTreePathSubtreeToggle,
} from "./treeProjectionToggleRuntime.js"
import type {
  TreeParentProjectionCache,
  TreeParentProjectionCacheState,
  TreeParentSubtreeToggleInput,
  TreePathBranch,
  TreePathProjectionCache,
  TreePathProjectionCacheState,
  TreePathSubtreeToggleInput,
  TreeProjectionResult,
} from "./treeProjectionTypes.js"
export type {
  TreeParentProjectionCacheState,
  TreeParentSubtreeToggleInput,
  TreePathProjectionCache,
  TreePathProjectionCacheState,
  TreePathSubtreeToggleInput,
  TreeProjectionResult,
} from "./treeProjectionTypes.js"
import {
  type DataGridGroupExpansionSnapshot,
  type DataGridRowId,
  type DataGridRowNode,
  type DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "../aggregation/aggregationEngine.js"

export interface TreeProjectRowsFromCacheInput<T> {
  inputRows: readonly DataGridRowNode<T>[]
  treeData: DataGridTreeDataResolvedSpec<T>
  expansionSnapshot: DataGridGroupExpansionSnapshot
  expansionToggledKeys?: ReadonlySet<string>
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean
  pathCacheState: TreePathProjectionCacheState<T> | null
  parentCacheState: TreeParentProjectionCacheState<T> | null
  cacheKey: string
  computeAggregates?: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown> | null
  aggregationBasis?: "filtered" | "source"
  createLeafContribution?: (row: DataGridRowNode<T>) => DataGridIncrementalAggregationLeafContribution | null
  createEmptyGroupState?: () => DataGridIncrementalAggregationGroupState | null
  applyContributionDelta?: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void
  finalizeGroupState?: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>
  resolveTreeDataRow?: (row: DataGridRowNode<T>) => T
}

export interface TreeProjectRowsFromCacheResult<T> {
  result: TreeProjectionResult<T>
  pathCache: TreePathProjectionCacheState<T> | null
  parentCache: TreeParentProjectionCacheState<T> | null
}

export interface TreeProjectionRuntime<T> {
  buildCacheKey: (input: {
    treeCacheRevision: number
    filterRevision: number
    sortRevision: number
    treeData: DataGridTreeDataResolvedSpec<T>
  }) => string
  projectRowsFromCache: (input: TreeProjectRowsFromCacheInput<T>) => TreeProjectRowsFromCacheResult<T>
  patchPathCacheRowsByIdentity: (
    cache: TreePathProjectionCache<T>,
    sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
    changedRowIds?: readonly DataGridRowId[],
  ) => TreePathProjectionCache<T>
  patchParentCacheRowsByIdentity: (
    cache: TreeParentProjectionCache<T>,
    sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
    changedRowIds?: readonly DataGridRowId[],
  ) => TreeParentProjectionCache<T>
  tryProjectPathSubtreeToggle: (input: TreePathSubtreeToggleInput<T>) => TreeProjectionResult<T> | null
  tryProjectParentSubtreeToggle: (input: TreeParentSubtreeToggleInput<T>) => TreeProjectionResult<T> | null
}

export interface TreeProjectionRuntimeOptions<T> {
  resolveTreeDataRow?: (row: DataGridRowNode<T>) => T
}

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

function patchTreePathProjectionCacheRowsByIdentity<T>(
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

function patchTreeParentProjectionCacheRowsByIdentity<T>(
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

function buildTreeProjectionCacheKey<T>(
  treeCacheRevision: number,
  filterRevision: number,
  sortRevision: number,
  treeData: DataGridTreeDataResolvedSpec<T>,
): string {
  return [
    treeCacheRevision,
    filterRevision,
    sortRevision,
    treeData.mode,
    treeData.filterMode,
  ].join(":")
}

function isTreePathSpec<T>(
  treeData: DataGridTreeDataResolvedSpec<T>,
): treeData is Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }> {
  return treeData.mode === "path"
}

function projectTreeDataRowsFromCache<T>(
  input: TreeProjectRowsFromCacheInput<T>,
): TreeProjectRowsFromCacheResult<T> {
  const aggregationBasis = input.aggregationBasis ?? "filtered"
  if (isTreePathSpec(input.treeData)) {
    const nextPathCacheState = input.pathCacheState?.key === input.cacheKey
      ? input.pathCacheState
      : {
          key: input.cacheKey,
        cache: buildTreePathProjectionCache(
          input.inputRows,
          input.treeData,
          input.rowMatchesFilter,
          input.computeAggregates,
          aggregationBasis,
          input.createLeafContribution,
          input.createEmptyGroupState,
          input.applyContributionDelta,
          input.finalizeGroupState,
          input.resolveTreeDataRow,
        ),
      }
    return {
      result: materializeTreePathProjection(
        nextPathCacheState.cache,
        input.expansionSnapshot,
        input.treeData.filterMode,
        input.expansionToggledKeys,
      ),
      pathCache: nextPathCacheState,
      parentCache: input.parentCacheState,
    }
  }

  const nextParentCacheState = input.parentCacheState?.key === input.cacheKey
    ? input.parentCacheState
    : {
        key: input.cacheKey,
        cache: buildTreeParentProjectionCache(
          input.inputRows,
          input.treeData,
          input.rowMatchesFilter,
          input.computeAggregates,
          aggregationBasis,
          input.createLeafContribution,
          input.createEmptyGroupState,
          input.applyContributionDelta,
          input.finalizeGroupState,
          input.resolveTreeDataRow,
        ),
      }
  return {
    result: materializeTreeParentProjection(
      nextParentCacheState.cache,
      input.expansionSnapshot,
      input.expansionToggledKeys,
    ),
    pathCache: input.pathCacheState,
    parentCache: nextParentCacheState,
  }
}

export function createTreeProjectionRuntime<T>(
  options: TreeProjectionRuntimeOptions<T> = {},
): TreeProjectionRuntime<T> {
  return {
    buildCacheKey: input => {
      return buildTreeProjectionCacheKey(
        input.treeCacheRevision,
        input.filterRevision,
        input.sortRevision,
        input.treeData,
      )
    },
    projectRowsFromCache: input => projectTreeDataRowsFromCache({
      ...input,
      resolveTreeDataRow: options.resolveTreeDataRow,
    }),
    patchPathCacheRowsByIdentity: patchTreePathProjectionCacheRowsByIdentity,
    patchParentCacheRowsByIdentity: patchTreeParentProjectionCacheRowsByIdentity,
    tryProjectPathSubtreeToggle: tryProjectTreePathSubtreeToggle,
    tryProjectParentSubtreeToggle: tryProjectTreeParentSubtreeToggle,
  }
}
