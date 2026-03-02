import {
  isGroupExpanded,
  type DataGridGroupExpansionSnapshot,
  type DataGridRowId,
  type DataGridRowNode,
  type DataGridTreeDataFilterMode,
  type DataGridTreeDataResolvedSpec,
} from "./rowModel.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "./aggregationEngine.js"

interface TreePathBranch<T> {
  key: string
  value: string
  level: number
  groups: Map<string, TreePathBranch<T>>
  leaves: DataGridRowNode<T>[]
  matchedLeaves: number
}

interface TreeProjectionDiagnostics {
  orphans: number
  cycles: number
}

export interface TreeProjectionResult<T> {
  rows: DataGridRowNode<T>[]
  diagnostics: TreeProjectionDiagnostics
}

export interface TreePathProjectionCache<T> {
  diagnostics: TreeProjectionDiagnostics
  rootGroups: Map<string, TreePathBranch<T>>
  branchByKey: Map<string, TreePathBranch<T>>
  branchParentByKey: Map<string, string | null>
  branchPathByLeafRowId: Map<DataGridRowId, readonly string[]>
  rootLeaves: DataGridRowNode<T>[]
  matchedLeafRowIds: Set<DataGridRowId>
  leafOnlyRows: DataGridRowNode<T>[]
  aggregatesByGroupKey: Map<string, Record<string, unknown>>
  aggregateStateByGroupKey?: Map<string, DataGridIncrementalAggregationGroupState>
  leafContributionById?: Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>
  dirtyBranchKeys: Set<string>
}

export interface TreeParentProjectionCache<T> {
  diagnostics: TreeProjectionDiagnostics
  rowById: Map<DataGridRowId, DataGridRowNode<T>>
  parentById: Map<DataGridRowId, DataGridRowId | null>
  includedChildrenById: Map<DataGridRowId, DataGridRowId[]>
  groupRowIdByGroupKey: Map<string, DataGridRowId>
  rootIncluded: DataGridRowId[]
  aggregatesByGroupRowId: Map<DataGridRowId, Record<string, unknown>>
  aggregateStateByGroupRowId?: Map<DataGridRowId, DataGridIncrementalAggregationGroupState>
  leafContributionById?: Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>
  dirtyBranchRootIds: Set<DataGridRowId>
}

export interface TreePathProjectionCacheState<T> {
  key: string
  cache: TreePathProjectionCache<T>
}

export interface TreeParentProjectionCacheState<T> {
  key: string
  cache: TreeParentProjectionCache<T>
}

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
}

export interface TreeProjectRowsFromCacheResult<T> {
  result: TreeProjectionResult<T>
  pathCache: TreePathProjectionCacheState<T> | null
  parentCache: TreeParentProjectionCacheState<T> | null
}

export interface TreePathSubtreeToggleInput<T> {
  rows: readonly DataGridRowNode<T>[]
  cacheState: TreePathProjectionCacheState<T>
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }>
  previousExpansionSnapshot: DataGridGroupExpansionSnapshot
  nextExpansionSnapshot: DataGridGroupExpansionSnapshot
  groupIndexByRowId?: ReadonlyMap<DataGridRowId, number>
}

export interface TreeParentSubtreeToggleInput<T> {
  rows: readonly DataGridRowNode<T>[]
  cacheState: TreeParentProjectionCacheState<T>
  previousExpansionSnapshot: DataGridGroupExpansionSnapshot
  nextExpansionSnapshot: DataGridGroupExpansionSnapshot
  groupIndexByRowId?: ReadonlyMap<DataGridRowId, number>
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

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
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

function normalizeLeafRow<T>(row: DataGridRowNode<T>): DataGridRowNode<T> {
  if (row.kind === "leaf" && row.state.group === false) {
    return row
  }
  return {
    ...row,
    kind: "leaf",
    state: {
      ...row.state,
      group: false,
    },
    groupMeta: undefined,
  }
}

function normalizeTreePathSegments(raw: readonly (string | number)[]): string[] {
  const segments: string[] = []
  for (const value of raw) {
    const normalized = String(value).trim()
    if (normalized.length === 0) {
      continue
    }
    segments.push(normalized)
  }
  return segments
}

function createTreePathGroupKey(segments: readonly string[]): string {
  let encoded = "tree:path:"
  for (const segment of segments) {
    encoded += `${segment.length}:${segment}`
  }
  return encoded
}

function createTreeParentGroupKey(rowId: DataGridRowId): string {
  return `tree:parent:${String(rowId)}`
}

function patchTreePathProjectionCacheRowsByIdentity<T>(
  cache: TreePathProjectionCache<T>,
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  changedRowIds: readonly DataGridRowId[] = [],
): TreePathProjectionCache<T> {
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

function buildTreePathProjectionCache<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }>,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
  computeAggregates?: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown> | null,
  aggregationBasis: "filtered" | "source" = "filtered",
  createLeafContribution?: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null,
  createEmptyGroupState?: () => DataGridIncrementalAggregationGroupState | null,
  applyContributionDelta?: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void,
  finalizeGroupState?: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>,
): TreePathProjectionCache<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rootGroups = new Map<string, TreePathBranch<T>>()
  const branchByKey = new Map<string, TreePathBranch<T>>()
  const branchParentByKey = new Map<string, string | null>()
  const supportsIncrementalAggregation = Boolean(
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState,
  )
  const branchPathByLeafRowId = new Map<DataGridRowId, readonly string[]>()
  const rootLeaves: DataGridRowNode<T>[] = []
  const matchedLeafRowIds = new Set<DataGridRowId>()
  const leafOnlyRows: DataGridRowNode<T>[] = []
  const aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  const leafContributionById = (computeAggregates || createLeafContribution)
    ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
    : undefined
  const aggregateStateByGroupKey = supportsIncrementalAggregation
    ? new Map<string, DataGridIncrementalAggregationGroupState>()
    : undefined
  const dirtyBranchKeys = new Set<string>()

  for (const row of inputRows) {
    const normalizedLeaf = normalizeLeafRow(row)
    const path = normalizeTreePathSegments(treeData.getDataPath(normalizedLeaf.data, normalizedLeaf.sourceIndex))
    const matches = rowMatchesFilter(normalizedLeaf)
    if (matches) {
      matchedLeafRowIds.add(normalizedLeaf.rowId)
      leafOnlyRows.push(normalizedLeaf)
    }
    if (path.length === 0) {
      rootLeaves.push(normalizedLeaf)
      continue
    }
    let currentGroups = rootGroups
    const traversed: TreePathBranch<T>[] = []
    const keySegments: string[] = []
    for (let level = 0; level < path.length; level += 1) {
      const value = path[level] ?? ""
      keySegments.push(value)
      const groupKey = createTreePathGroupKey(keySegments)
      const existing = currentGroups.get(value)
      if (existing) {
        traversed.push(existing)
        currentGroups = existing.groups
        continue
      }
      const parentBranch = traversed[traversed.length - 1]
      const next: TreePathBranch<T> = {
        key: groupKey,
        value,
        level,
        groups: new Map<string, TreePathBranch<T>>(),
        leaves: [],
        matchedLeaves: 0,
      }
      currentGroups.set(value, next)
      branchByKey.set(groupKey, next)
      branchParentByKey.set(groupKey, parentBranch ? parentBranch.key : null)
      traversed.push(next)
      currentGroups = next.groups
    }
    const target = traversed[traversed.length - 1]
    if (target) {
      target.leaves.push(normalizedLeaf)
      if (supportsIncrementalAggregation) {
        branchPathByLeafRowId.set(normalizedLeaf.rowId, traversed.map(branch => branch.key))
      }
    }
    if (leafContributionById && createLeafContribution && (aggregationBasis === "source" || matches)) {
      const contribution = createLeafContribution(normalizedLeaf)
      if (contribution) {
        leafContributionById.set(normalizedLeaf.rowId, contribution)
      }
    }
    for (const branch of traversed) {
      if (matches) {
        branch.matchedLeaves += 1
      }
    }
  }

  if (
    aggregateStateByGroupKey &&
    leafContributionById &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  ) {
    const collectBranchContributions = (
      branch: TreePathBranch<T>,
    ): DataGridIncrementalAggregationLeafContribution[] => {
      const contributions: DataGridIncrementalAggregationLeafContribution[] = []
      for (const child of branch.groups.values()) {
        contributions.push(...collectBranchContributions(child))
      }
      for (const leaf of branch.leaves) {
        if (aggregationBasis !== "source" && !matchedLeafRowIds.has(leaf.rowId)) {
          continue
        }
        const contribution = leafContributionById.get(leaf.rowId)
        if (contribution) {
          contributions.push(contribution)
        }
      }
      const groupState = createEmptyGroupState()
      if (!groupState) {
        return contributions
      }
      for (const contribution of contributions) {
        applyContributionDelta(groupState, null, contribution)
      }
      aggregateStateByGroupKey.set(branch.key, groupState)
      const aggregates = finalizeGroupState(groupState)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(branch.key, { ...aggregates })
      }
      return contributions
    }
    for (const branch of rootGroups.values()) {
      collectBranchContributions(branch)
    }
  } else if (computeAggregates) {
    const collectBranchLeaves = (branch: TreePathBranch<T>): DataGridRowNode<T>[] => {
      const leafRows: DataGridRowNode<T>[] = []
      for (const child of branch.groups.values()) {
        leafRows.push(...collectBranchLeaves(child))
      }
      for (const leaf of branch.leaves) {
        if (aggregationBasis === "source" || matchedLeafRowIds.has(leaf.rowId)) {
          leafRows.push(leaf)
        }
      }
      if (leafRows.length === 0) {
        return leafRows
      }
      const aggregates = computeAggregates(leafRows)
      if (aggregates && Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(branch.key, { ...aggregates })
      }
      return leafRows
    }
    for (const branch of rootGroups.values()) {
      collectBranchLeaves(branch)
    }
  }

  return {
    diagnostics,
    rootGroups,
    branchByKey,
    branchParentByKey,
    branchPathByLeafRowId,
    rootLeaves,
    matchedLeafRowIds,
    leafOnlyRows,
    aggregatesByGroupKey,
    aggregateStateByGroupKey,
    leafContributionById,
    dirtyBranchKeys,
  }
}

function createTreePathGroupNode<T>(
  branch: TreePathBranch<T>,
  expanded: boolean,
  aggregates?: Record<string, unknown>,
): DataGridRowNode<T> {
  const rowData = ({
    __tree: true,
    key: branch.key,
    value: branch.value,
    level: branch.level,
  } as unknown as T)
  return {
    kind: "group",
    data: rowData,
    row: rowData,
    rowKey: branch.key,
    rowId: branch.key,
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: -1,
    state: {
      selected: false,
      group: true,
      pinned: "none",
      expanded,
    },
    groupMeta: {
      groupKey: branch.key,
      groupField: "path",
      groupValue: branch.value,
      level: branch.level,
      childrenCount: branch.matchedLeaves,
      ...(aggregates ? { aggregates } : {}),
    },
  }
}

function appendTreePathBranch<T>(
  cache: TreePathProjectionCache<T>,
  branch: TreePathBranch<T>,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  if (branch.matchedLeaves <= 0) {
    return
  }
  const expanded = isGroupExpanded(expansionSnapshot, branch.key, expansionToggledKeys)
  output.push(createTreePathGroupNode(branch, expanded, cache.aggregatesByGroupKey.get(branch.key)))
  if (!expanded) {
    return
  }
  appendTreePathBranchChildren(cache, branch, expansionSnapshot, expansionToggledKeys, output)
}

function appendTreePathBranchChildren<T>(
  cache: TreePathProjectionCache<T>,
  branch: TreePathBranch<T>,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  for (const child of branch.groups.values()) {
    appendTreePathBranch(cache, child, expansionSnapshot, expansionToggledKeys, output)
  }
  for (const leaf of branch.leaves) {
    if (cache.matchedLeafRowIds.has(leaf.rowId)) {
      output.push(leaf)
    }
  }
}

function materializeTreePathProjection<T>(
  cache: TreePathProjectionCache<T>,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  filterMode: DataGridTreeDataFilterMode,
  precomputedExpansionToggledKeys?: ReadonlySet<string>,
): TreeProjectionResult<T> {
  if (filterMode === "leaf-only") {
    return {
      rows: cache.leafOnlyRows,
      diagnostics: cache.diagnostics,
    }
  }
  const projected: DataGridRowNode<T>[] = []
  const expansionToggledKeys = precomputedExpansionToggledKeys ?? new Set<string>(expansionSnapshot.toggledGroupKeys)
  for (const branch of cache.rootGroups.values()) {
    appendTreePathBranch(cache, branch, expansionSnapshot, expansionToggledKeys, projected)
  }
  for (const leaf of cache.rootLeaves) {
    if (cache.matchedLeafRowIds.has(leaf.rowId)) {
      projected.push(leaf)
    }
  }
  return {
    rows: projected,
    diagnostics: cache.diagnostics,
  }
}

function buildTreeParentProjectionCache<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "parent" }>,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
  computeAggregates?: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown> | null,
  aggregationBasis: "filtered" | "source" = "filtered",
  createLeafContribution?: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null,
  createEmptyGroupState?: () => DataGridIncrementalAggregationGroupState | null,
  applyContributionDelta?: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void,
  finalizeGroupState?: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>,
): TreeParentProjectionCache<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rowById = new Map<DataGridRowId, DataGridRowNode<T>>()
  for (const row of inputRows) {
    rowById.set(row.rowId, normalizeLeafRow(row))
  }
  const rawParentById = new Map<DataGridRowId, DataGridRowId | null>()
  const dropped = new Set<DataGridRowId>()

  for (const row of inputRows) {
    const rowId = row.rowId
    const resolved = treeData.getParentId(row.data, row.sourceIndex)
    let parentId: DataGridRowId | null = resolved == null
      ? null
      : (isDataGridRowId(resolved) ? resolved : null)
    if (treeData.rootParentId != null && parentId === treeData.rootParentId) {
      parentId = null
    }
    if (parentId != null && !rowById.has(parentId)) {
      diagnostics.orphans += 1
      if (treeData.orphanPolicy === "drop") {
        dropped.add(rowId)
        continue
      }
      if (treeData.orphanPolicy === "error") {
        throw new Error(`[DataGridTreeData] Orphan row '${String(rowId)}' has missing parent '${String(parentId)}'.`)
      }
      parentId = null
    }
    if (parentId === rowId) {
      diagnostics.cycles += 1
      if (treeData.cyclePolicy === "error") {
        throw new Error(`[DataGridTreeData] Self-cycle for row '${String(rowId)}'.`)
      }
      parentId = null
    }
    rawParentById.set(rowId, parentId)
  }

  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    const rowId = row.rowId
    let parentId = rawParentById.get(rowId) ?? null
    if (parentId == null) {
      continue
    }
    const visited = new Set<DataGridRowId>([rowId])
    let cursor: DataGridRowId | null = parentId
    while (cursor != null) {
      if (visited.has(cursor)) {
        diagnostics.cycles += 1
        if (treeData.cyclePolicy === "error") {
          throw new Error(`[DataGridTreeData] Cycle detected for row '${String(rowId)}'.`)
        }
        parentId = null
        break
      }
      visited.add(cursor)
      cursor = rawParentById.get(cursor) ?? null
    }
    if (parentId == null) {
      rawParentById.set(rowId, null)
    }
  }

  const childrenById = new Map<DataGridRowId | null, DataGridRowId[]>()
  const pushChild = (parentId: DataGridRowId | null, rowId: DataGridRowId) => {
    const bucket = childrenById.get(parentId)
    if (bucket) {
      bucket.push(rowId)
      return
    }
    childrenById.set(parentId, [rowId])
  }
  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    const parentId = rawParentById.get(row.rowId) ?? null
    pushChild(parentId, row.rowId)
  }

  const matchedIds = new Set<DataGridRowId>()
  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    if (rowMatchesFilter(row)) {
      matchedIds.add(row.rowId)
    }
  }

  const includeIds = new Set<DataGridRowId>()
  const includeWithAncestors = (rowId: DataGridRowId) => {
    includeIds.add(rowId)
    let cursor = rawParentById.get(rowId) ?? null
    while (cursor != null) {
      includeIds.add(cursor)
      cursor = rawParentById.get(cursor) ?? null
    }
  }
  const includeDescendants = (rowId: DataGridRowId) => {
    const stack: DataGridRowId[] = [rowId]
    const visited = new Set<DataGridRowId>()
    while (stack.length > 0) {
      const current = stack.pop()
      if (typeof current === "undefined" || visited.has(current)) {
        continue
      }
      visited.add(current)
      includeIds.add(current)
      const children = childrenById.get(current) ?? []
      for (const childId of children) {
        stack.push(childId)
      }
    }
  }

  if (treeData.filterMode === "leaf-only") {
    for (const rowId of matchedIds) {
      const children = childrenById.get(rowId) ?? []
      if (children.length === 0) {
        includeIds.add(rowId)
      }
    }
  } else if (treeData.filterMode === "include-descendants") {
    for (const rowId of matchedIds) {
      includeWithAncestors(rowId)
      includeDescendants(rowId)
    }
  } else {
    for (const rowId of matchedIds) {
      includeWithAncestors(rowId)
    }
  }

  if (includeIds.size === 0) {
    return {
      diagnostics,
      rowById,
      parentById: new Map<DataGridRowId, DataGridRowId | null>(),
      includedChildrenById: new Map<DataGridRowId, DataGridRowId[]>(),
      groupRowIdByGroupKey: new Map<string, DataGridRowId>(),
      rootIncluded: [],
      aggregatesByGroupRowId: new Map<DataGridRowId, Record<string, unknown>>(),
      aggregateStateByGroupRowId: new Map<DataGridRowId, DataGridIncrementalAggregationGroupState>(),
      leafContributionById: (computeAggregates || createLeafContribution)
        ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
        : undefined,
      dirtyBranchRootIds: new Set<DataGridRowId>(),
    }
  }

  const parentById = new Map<DataGridRowId, DataGridRowId | null>()
  for (const rowId of includeIds) {
    parentById.set(rowId, rawParentById.get(rowId) ?? null)
  }

  const includedChildrenById = new Map<DataGridRowId, DataGridRowId[]>()
  for (const rowId of includeIds) {
    const children = childrenById.get(rowId) ?? []
    if (children.length === 0) {
      continue
    }
    const includedChildren = children.filter(childId => includeIds.has(childId))
    if (includedChildren.length > 0) {
      includedChildrenById.set(rowId, includedChildren)
    }
  }

  const rootIncluded: DataGridRowId[] = []
  for (const row of inputRows) {
    const rowId = row.rowId
    if (!includeIds.has(rowId)) {
      continue
    }
    const parentId = rawParentById.get(rowId) ?? null
    if (parentId == null || !includeIds.has(parentId)) {
      rootIncluded.push(rowId)
    }
  }

  const groupRowIdByGroupKey = new Map<string, DataGridRowId>()
  for (const [rowId, children] of includedChildrenById.entries()) {
    if (children.length === 0) {
      continue
    }
    groupRowIdByGroupKey.set(createTreeParentGroupKey(rowId), rowId)
  }

  const aggregatesByGroupRowId = new Map<DataGridRowId, Record<string, unknown>>()
  const aggregateStateByGroupRowId = (
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  )
    ? new Map<DataGridRowId, DataGridIncrementalAggregationGroupState>()
    : undefined
  const leafContributionById = (computeAggregates || createLeafContribution)
    ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
    : undefined
  if (
    aggregateStateByGroupRowId &&
    leafContributionById &&
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  ) {
    const aggregateChildrenById = aggregationBasis === "source" ? childrenById : includedChildrenById
    const collectLeafContributions = (
      rowId: DataGridRowId,
    ): DataGridIncrementalAggregationLeafContribution[] => {
      const children = aggregateChildrenById.get(rowId) ?? []
      if (children.length === 0) {
        const leaf = rowById.get(rowId)
        if (!leaf) {
          return []
        }
        const contribution = createLeafContribution(leaf)
        if (!contribution) {
          return []
        }
        leafContributionById.set(rowId, contribution)
        return [contribution]
      }
      const contributions: DataGridIncrementalAggregationLeafContribution[] = []
      for (const childId of children) {
        contributions.push(...collectLeafContributions(childId))
      }
      const groupState = createEmptyGroupState()
      if (!groupState) {
        return contributions
      }
      for (const contribution of contributions) {
        applyContributionDelta(groupState, null, contribution)
      }
      aggregateStateByGroupRowId.set(rowId, groupState)
      const aggregates = finalizeGroupState(groupState)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupRowId.set(rowId, { ...aggregates })
      }
      return contributions
    }
    for (const rootId of rootIncluded) {
      collectLeafContributions(rootId)
    }
  } else if (computeAggregates) {
    const aggregateChildrenById = aggregationBasis === "source" ? childrenById : includedChildrenById
    const leafRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    for (const [rowId, row] of rowById.entries()) {
      if ((aggregateChildrenById.get(rowId) ?? []).length === 0) {
        leafRowsById.set(rowId, row)
        if (leafContributionById) {
          leafContributionById.set(rowId, {})
        }
      }
    }
    const leafMemo = new Map<DataGridRowId, DataGridRowNode<T>[]>()
    const collectLeafRows = (rowId: DataGridRowId): DataGridRowNode<T>[] => {
      const cached = leafMemo.get(rowId)
      if (cached) {
        return cached
      }
      const children = aggregateChildrenById.get(rowId) ?? []
      if (children.length === 0) {
        const leaf = leafRowsById.get(rowId)
        const leafRows = leaf ? [leaf] : []
        leafMemo.set(rowId, leafRows)
        return leafRows
      }
      const leafRows: DataGridRowNode<T>[] = []
      for (const childId of children) {
        leafRows.push(...collectLeafRows(childId))
      }
      const aggregates = computeAggregates(leafRows)
      if (aggregates && Object.keys(aggregates).length > 0) {
        aggregatesByGroupRowId.set(rowId, { ...aggregates })
      }
      leafMemo.set(rowId, leafRows)
      return leafRows
    }
    for (const rootId of rootIncluded) {
      collectLeafRows(rootId)
    }
  }

  return {
    diagnostics,
    rowById,
    parentById,
    includedChildrenById,
    groupRowIdByGroupKey,
    rootIncluded,
    aggregatesByGroupRowId,
    aggregateStateByGroupRowId,
    leafContributionById,
    dirtyBranchRootIds: new Set<DataGridRowId>(),
  }
}

function createTreeParentGroupNode<T>(
  row: DataGridRowNode<T>,
  rowId: DataGridRowId,
  level: number,
  childrenCount: number,
  expanded: boolean,
  aggregates?: Record<string, unknown>,
): DataGridRowNode<T> {
  return {
    ...row,
    kind: "group",
    state: {
      ...row.state,
      group: true,
      expanded,
    },
    groupMeta: {
      groupKey: createTreeParentGroupKey(rowId),
      groupField: "parent",
      groupValue: String(rowId),
      level,
      childrenCount,
      ...(aggregates ? { aggregates } : {}),
    },
  }
}

function appendTreeParentRow<T>(
  cache: TreeParentProjectionCache<T>,
  rowId: DataGridRowId,
  level: number,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  const row = cache.rowById.get(rowId)
  if (!row) {
    return
  }
  const children = cache.includedChildrenById.get(rowId) ?? []
  if (children.length === 0) {
    output.push(row)
    return
  }
  const groupKey = createTreeParentGroupKey(rowId)
  const expanded = isGroupExpanded(expansionSnapshot, groupKey, expansionToggledKeys)
  output.push(
    createTreeParentGroupNode(
      row,
      rowId,
      level,
      children.length,
      expanded,
      cache.aggregatesByGroupRowId.get(rowId),
    ),
  )
  if (!expanded) {
    return
  }
  appendTreeParentRowChildren(cache, rowId, level, expansionSnapshot, expansionToggledKeys, output)
}

function appendTreeParentRowChildren<T>(
  cache: TreeParentProjectionCache<T>,
  rowId: DataGridRowId,
  level: number,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  const children = cache.includedChildrenById.get(rowId) ?? []
  for (const childId of children) {
    appendTreeParentRow(cache, childId, level + 1, expansionSnapshot, expansionToggledKeys, output)
  }
}

function materializeTreeParentProjection<T>(
  cache: TreeParentProjectionCache<T>,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  precomputedExpansionToggledKeys?: ReadonlySet<string>,
): TreeProjectionResult<T> {
  if (cache.rootIncluded.length === 0) {
    return {
      rows: [],
      diagnostics: cache.diagnostics,
    }
  }
  const projected: DataGridRowNode<T>[] = []
  const expansionToggledKeys = precomputedExpansionToggledKeys ?? new Set<string>(expansionSnapshot.toggledGroupKeys)
  for (const rootId of cache.rootIncluded) {
    appendTreeParentRow(cache, rootId, 0, expansionSnapshot, expansionToggledKeys, projected)
  }
  return {
    rows: projected,
    diagnostics: cache.diagnostics,
  }
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

function resolveSingleExpansionDelta(
  previousSnapshot: DataGridGroupExpansionSnapshot,
  nextSnapshot: DataGridGroupExpansionSnapshot,
): string | null {
  if (previousSnapshot.expandedByDefault !== nextSnapshot.expandedByDefault) {
    return null
  }
  const previous = new Set<string>(previousSnapshot.toggledGroupKeys)
  const next = new Set<string>(nextSnapshot.toggledGroupKeys)
  let changedKey: string | null = null
  let changedCount = 0
  for (const key of previous) {
    if (!next.has(key)) {
      changedCount += 1
      if (changedCount > 1) {
        return null
      }
      changedKey = key
    }
  }
  for (const key of next) {
    if (!previous.has(key)) {
      changedCount += 1
      if (changedCount > 1) {
        return null
      }
      changedKey = key
    }
  }
  return changedCount === 1 ? changedKey : null
}

function projectionSegmentMatches<T>(
  rows: readonly DataGridRowNode<T>[],
  startIndex: number,
  expectedRows: readonly DataGridRowNode<T>[],
): boolean {
  if (startIndex < 0 || startIndex + expectedRows.length > rows.length) {
    return false
  }
  for (let index = 0; index < expectedRows.length; index += 1) {
    const current = rows[startIndex + index]
    const expected = expectedRows[index]
    if (!current || !expected) {
      return false
    }
    if (current.rowId !== expected.rowId || current.kind !== expected.kind) {
      return false
    }
  }
  return true
}

function resolveGroupRowIndexByRowId<T>(
  rows: readonly DataGridRowNode<T>[],
  groupRowId: DataGridRowId,
  groupIndexByRowId?: ReadonlyMap<DataGridRowId, number>,
): number {
  const indexed = groupIndexByRowId?.get(groupRowId)
  if (typeof indexed === "number") {
    const candidate = rows[indexed]
    if (candidate?.kind === "group" && candidate.rowId === groupRowId) {
      return indexed
    }
  }
  return rows.findIndex(row => row.kind === "group" && row.rowId === groupRowId)
}

function tryProjectTreePathSubtreeToggle<T>(
  input: TreePathSubtreeToggleInput<T>,
): TreeProjectionResult<T> | null {
  if (input.treeData.filterMode === "leaf-only") {
    return null
  }
  const changedGroupKey = resolveSingleExpansionDelta(input.previousExpansionSnapshot, input.nextExpansionSnapshot)
  if (!changedGroupKey) {
    return null
  }
  const branch = input.cacheState.cache.branchByKey.get(changedGroupKey)
  if (!branch || branch.matchedLeaves <= 0) {
    return null
  }
  const previousExpanded = isGroupExpanded(
    input.previousExpansionSnapshot,
    changedGroupKey,
    new Set<string>(input.previousExpansionSnapshot.toggledGroupKeys),
  )
  const nextExpanded = isGroupExpanded(
    input.nextExpansionSnapshot,
    changedGroupKey,
    new Set<string>(input.nextExpansionSnapshot.toggledGroupKeys),
  )
  const groupIndex = resolveGroupRowIndexByRowId(input.rows, changedGroupKey, input.groupIndexByRowId)
  if (groupIndex < 0) {
    return null
  }

  const previousDescendants: DataGridRowNode<T>[] = []
  const previousExpandedKeys = new Set<string>(input.previousExpansionSnapshot.toggledGroupKeys)
  if (previousExpanded) {
    appendTreePathBranchChildren(
      input.cacheState.cache,
      branch,
      input.previousExpansionSnapshot,
      previousExpandedKeys,
      previousDescendants,
    )
  }

  const nextDescendants: DataGridRowNode<T>[] = []
  const nextExpandedKeys = new Set<string>(input.nextExpansionSnapshot.toggledGroupKeys)
  if (nextExpanded) {
    appendTreePathBranchChildren(
      input.cacheState.cache,
      branch,
      input.nextExpansionSnapshot,
      nextExpandedKeys,
      nextDescendants,
    )
  }

  const replaceStart = groupIndex + 1
  if (!projectionSegmentMatches(input.rows, replaceStart, previousDescendants)) {
    return null
  }
  const nextRows = input.rows.slice()
  const currentGroup = nextRows[groupIndex]
  if (currentGroup && currentGroup.kind === "group") {
    nextRows[groupIndex] = {
      ...currentGroup,
      state: {
        ...currentGroup.state,
        expanded: nextExpanded,
      },
    }
  }
  nextRows.splice(replaceStart, previousDescendants.length, ...nextDescendants)
  return {
    rows: nextRows,
    diagnostics: input.cacheState.cache.diagnostics,
  }
}

function tryProjectTreeParentSubtreeToggle<T>(
  input: TreeParentSubtreeToggleInput<T>,
): TreeProjectionResult<T> | null {
  const changedGroupKey = resolveSingleExpansionDelta(input.previousExpansionSnapshot, input.nextExpansionSnapshot)
  if (!changedGroupKey) {
    return null
  }
  const rowId = input.cacheState.cache.groupRowIdByGroupKey.get(changedGroupKey)
  if (typeof rowId === "undefined") {
    return null
  }
  const previousExpanded = isGroupExpanded(
    input.previousExpansionSnapshot,
    changedGroupKey,
    new Set<string>(input.previousExpansionSnapshot.toggledGroupKeys),
  )
  const nextExpanded = isGroupExpanded(
    input.nextExpansionSnapshot,
    changedGroupKey,
    new Set<string>(input.nextExpansionSnapshot.toggledGroupKeys),
  )
  const groupIndex = resolveGroupRowIndexByRowId(input.rows, rowId, input.groupIndexByRowId)
  if (groupIndex < 0) {
    return null
  }
  const groupRow = input.rows[groupIndex]
  const baseLevel = groupRow?.groupMeta?.level
  if (typeof baseLevel !== "number") {
    return null
  }

  const previousDescendants: DataGridRowNode<T>[] = []
  const previousExpandedKeys = new Set<string>(input.previousExpansionSnapshot.toggledGroupKeys)
  if (previousExpanded) {
    appendTreeParentRowChildren(
      input.cacheState.cache,
      rowId,
      baseLevel,
      input.previousExpansionSnapshot,
      previousExpandedKeys,
      previousDescendants,
    )
  }

  const nextDescendants: DataGridRowNode<T>[] = []
  const nextExpandedKeys = new Set<string>(input.nextExpansionSnapshot.toggledGroupKeys)
  if (nextExpanded) {
    appendTreeParentRowChildren(
      input.cacheState.cache,
      rowId,
      baseLevel,
      input.nextExpansionSnapshot,
      nextExpandedKeys,
      nextDescendants,
    )
  }

  const replaceStart = groupIndex + 1
  if (!projectionSegmentMatches(input.rows, replaceStart, previousDescendants)) {
    return null
  }
  const nextRows = input.rows.slice()
  const currentGroup = nextRows[groupIndex]
  if (currentGroup && currentGroup.kind === "group") {
    nextRows[groupIndex] = {
      ...currentGroup,
      state: {
        ...currentGroup.state,
        expanded: nextExpanded,
      },
    }
  }
  nextRows.splice(replaceStart, previousDescendants.length, ...nextDescendants)
  return {
    rows: nextRows,
    diagnostics: input.cacheState.cache.diagnostics,
  }
}

export function createTreeProjectionRuntime<T>(): TreeProjectionRuntime<T> {
  return {
    buildCacheKey: input => {
      return buildTreeProjectionCacheKey(
        input.treeCacheRevision,
        input.filterRevision,
        input.sortRevision,
        input.treeData,
      )
    },
    projectRowsFromCache: projectTreeDataRowsFromCache,
    patchPathCacheRowsByIdentity: patchTreePathProjectionCacheRowsByIdentity,
    patchParentCacheRowsByIdentity: patchTreeParentProjectionCacheRowsByIdentity,
    tryProjectPathSubtreeToggle: tryProjectTreePathSubtreeToggle,
    tryProjectParentSubtreeToggle: tryProjectTreeParentSubtreeToggle,
  }
}
