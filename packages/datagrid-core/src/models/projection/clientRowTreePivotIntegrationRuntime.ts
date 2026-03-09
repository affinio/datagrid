import type {
  DataGridGroupExpansionSnapshot,
  DataGridRowId,
  DataGridRowNode,
  DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import type { DataGridPivotIncrementalPatchRow } from "../pivot/pivotRuntime.js"
import type {
  TreeParentProjectionCacheState,
  TreePathProjectionCacheState,
  TreeProjectionRuntime,
} from "../tree/treeProjectionRuntime.js"
import { buildRowIdIndex } from "../clientRowRuntimeUtils.js"

export interface CreateClientRowTreePivotIntegrationRuntimeOptions<T> {
  getTreeData: () => DataGridTreeDataResolvedSpec<T> | null
  getSourceRows: () => readonly DataGridRowNode<T>[]
  treeProjectionRuntime: TreeProjectionRuntime<T>
}

export interface DataGridClientRowTreePivotIntegrationRuntime<T> {
  getPivotExpansionExpandedByDefault: () => boolean
  setPivotExpansionExpandedByDefault: (value: boolean) => void
  getToggledPivotGroupKeys: () => Set<string>
  clearToggledPivotGroupKeys: () => void
  getTreeCacheRevision: () => number
  getTreePathProjectionCacheState: () => TreePathProjectionCacheState<T> | null
  setTreePathProjectionCacheState: (state: TreePathProjectionCacheState<T> | null) => void
  getTreeParentProjectionCacheState: () => TreeParentProjectionCacheState<T> | null
  setTreeParentProjectionCacheState: (state: TreeParentProjectionCacheState<T> | null) => void
  getLastTreeProjectionCacheKey: () => string | null
  setLastTreeProjectionCacheKey: (key: string | null) => void
  getLastTreeExpansionSnapshot: () => DataGridGroupExpansionSnapshot | null
  setLastTreeExpansionSnapshot: (snapshot: DataGridGroupExpansionSnapshot | null) => void
  getPendingPivotValuePatch: () => readonly DataGridPivotIncrementalPatchRow<T>[] | null
  setPendingPivotValuePatch: (rows: readonly DataGridPivotIncrementalPatchRow<T>[] | null) => void
  clearPendingPivotValuePatch: () => void
  invalidateTreeProjectionCaches: () => void
  patchTreeProjectionCacheRowsByIdentity: (changedRowIds?: readonly DataGridRowId[]) => void
  resetPivotExpansionState: () => void
}

export function createClientRowTreePivotIntegrationRuntime<T>(
  options: CreateClientRowTreePivotIntegrationRuntimeOptions<T>,
): DataGridClientRowTreePivotIntegrationRuntime<T> {
  let pivotExpansionExpandedByDefault = true
  const toggledPivotGroupKeys = new Set<string>()
  let treeCacheRevision = 0
  let treePathProjectionCacheState: TreePathProjectionCacheState<T> | null = null
  let treeParentProjectionCacheState: TreeParentProjectionCacheState<T> | null = null
  let lastTreeProjectionCacheKey: string | null = null
  let lastTreeExpansionSnapshot: DataGridGroupExpansionSnapshot | null = null
  let pendingPivotValuePatch: readonly DataGridPivotIncrementalPatchRow<T>[] | null = null

  const invalidateTreeProjectionCaches = (): void => {
    treeCacheRevision += 1
    treePathProjectionCacheState = null
    treeParentProjectionCacheState = null
    lastTreeProjectionCacheKey = null
    lastTreeExpansionSnapshot = null
  }

  const patchTreeProjectionCacheRowsByIdentity = (
    changedRowIds: readonly DataGridRowId[] = [],
  ): void => {
    if (!options.getTreeData() || (!treePathProjectionCacheState && !treeParentProjectionCacheState)) {
      return
    }
    const sourceById = buildRowIdIndex(options.getSourceRows())
    if (treePathProjectionCacheState) {
      treePathProjectionCacheState = {
        key: treePathProjectionCacheState.key,
        cache: options.treeProjectionRuntime.patchPathCacheRowsByIdentity(
          treePathProjectionCacheState.cache,
          sourceById,
          changedRowIds,
        ),
      }
    }
    if (treeParentProjectionCacheState) {
      treeParentProjectionCacheState = {
        key: treeParentProjectionCacheState.key,
        cache: options.treeProjectionRuntime.patchParentCacheRowsByIdentity(
          treeParentProjectionCacheState.cache,
          sourceById,
          changedRowIds,
        ),
      }
    }
  }

  return {
    getPivotExpansionExpandedByDefault: () => pivotExpansionExpandedByDefault,
    setPivotExpansionExpandedByDefault: (value) => {
      pivotExpansionExpandedByDefault = value
    },
    getToggledPivotGroupKeys: () => toggledPivotGroupKeys,
    clearToggledPivotGroupKeys: () => {
      toggledPivotGroupKeys.clear()
    },
    getTreeCacheRevision: () => treeCacheRevision,
    getTreePathProjectionCacheState: () => treePathProjectionCacheState,
    setTreePathProjectionCacheState: (state) => {
      treePathProjectionCacheState = state
    },
    getTreeParentProjectionCacheState: () => treeParentProjectionCacheState,
    setTreeParentProjectionCacheState: (state) => {
      treeParentProjectionCacheState = state
    },
    getLastTreeProjectionCacheKey: () => lastTreeProjectionCacheKey,
    setLastTreeProjectionCacheKey: (key) => {
      lastTreeProjectionCacheKey = key
    },
    getLastTreeExpansionSnapshot: () => lastTreeExpansionSnapshot,
    setLastTreeExpansionSnapshot: (snapshot) => {
      lastTreeExpansionSnapshot = snapshot
    },
    getPendingPivotValuePatch: () => pendingPivotValuePatch,
    setPendingPivotValuePatch: (rows) => {
      pendingPivotValuePatch = rows
    },
    clearPendingPivotValuePatch: () => {
      pendingPivotValuePatch = null
    },
    invalidateTreeProjectionCaches,
    patchTreeProjectionCacheRowsByIdentity,
    resetPivotExpansionState: () => {
      pivotExpansionExpandedByDefault = true
      toggledPivotGroupKeys.clear()
    },
  }
}
