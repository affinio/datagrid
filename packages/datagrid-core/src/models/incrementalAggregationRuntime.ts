import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "./aggregationEngine.js"
import type { DataGridRowId, DataGridRowNode } from "./rowModel.js"
import type {
  TreeParentProjectionCacheState,
  TreePathProjectionCacheState,
} from "./treeProjectionRuntime.js"

export interface GroupByIncrementalAggregationState {
  statesByGroupKey: Map<string, DataGridIncrementalAggregationGroupState>
  aggregatesByGroupKey: Map<string, Record<string, unknown>>
  groupPathByRowId: Map<DataGridRowId, readonly string[]>
  leafContributionByRowId: Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>
}

interface GroupKeySegment {
  field: string
  value: string
}

export interface GroupByIncrementalAggregationResult {
  statesByGroupKey: Map<string, DataGridIncrementalAggregationGroupState>
  aggregatesByGroupKey: Map<string, Record<string, unknown>>
  groupPathByRowId: Map<DataGridRowId, readonly string[]>
  leafContributionByRowId: Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>
}

export interface IncrementalAggregationStageImpact {
  affectsAggregation: boolean
  affectsFilter: boolean
  affectsSort: boolean
  affectsGroup: boolean
}

export interface IncrementalAggregationPatchInput<T> {
  changedRowIds: readonly DataGridRowId[]
  previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  sourceRows: readonly DataGridRowNode<T>[]
  stageImpact: IncrementalAggregationStageImpact
  hasPivotModel: boolean
  hasAggregationModel: boolean
  hasTreeData: boolean
  hasGroupBy: boolean
  groupByState: GroupByIncrementalAggregationState
  treePathCacheState: TreePathProjectionCacheState<T> | null
  treeParentCacheState: TreeParentProjectionCacheState<T> | null
  isIncrementalAggregationSupported: () => boolean
  createLeafContribution: (row: DataGridRowNode<T>) => DataGridIncrementalAggregationLeafContribution | null
  applyContributionDelta: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void
  finalizeGroupState: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>
  patchRuntimeGroupAggregates: (resolveAggregates: (groupKey: string) => Record<string, unknown> | undefined) => void
}

function buildRowIdIndex<T>(inputRows: readonly DataGridRowNode<T>[]): Map<DataGridRowId, DataGridRowNode<T>> {
  const byId = new Map<DataGridRowId, DataGridRowNode<T>>()
  for (const row of inputRows) {
    byId.set(row.rowId, row)
  }
  return byId
}

function createGroupedRowKey(segments: readonly GroupKeySegment[]): string {
  let encoded = "group:"
  for (const segment of segments) {
    encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`
  }
  return encoded
}

export function createGroupByIncrementalAggregationState(): GroupByIncrementalAggregationState {
  return {
    statesByGroupKey: new Map<string, DataGridIncrementalAggregationGroupState>(),
    aggregatesByGroupKey: new Map<string, Record<string, unknown>>(),
    groupPathByRowId: new Map<DataGridRowId, readonly string[]>(),
    leafContributionByRowId: new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>(),
  }
}

export function computeGroupByIncrementalAggregation<T>(
  inputRows: readonly DataGridRowNode<T>[],
  groupByFields: readonly string[],
  resolveGroupValue: (row: DataGridRowNode<T>, field: string) => string,
  createLeafContribution: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null,
  createEmptyGroupState: () => DataGridIncrementalAggregationGroupState | null,
  applyContributionDelta: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void,
  finalizeGroupState: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>,
): GroupByIncrementalAggregationResult {
  const statesByGroupKey = new Map<string, DataGridIncrementalAggregationGroupState>()
  const aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  const groupPathByRowId = new Map<DataGridRowId, string[]>()
  const leafContributionByRowId = new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
  if (groupByFields.length === 0 || inputRows.length === 0) {
    return {
      statesByGroupKey,
      aggregatesByGroupKey,
      groupPathByRowId,
      leafContributionByRowId,
    }
  }

  const projectLevel = (
    rows: readonly DataGridRowNode<T>[],
    level: number,
    path: readonly GroupKeySegment[],
  ): void => {
    if (level >= groupByFields.length || rows.length === 0) {
      return
    }
    const field = groupByFields[level] ?? ""
    const buckets = new Map<string, DataGridRowNode<T>[]>()
    for (const row of rows) {
      const value = resolveGroupValue(row, field)
      const bucket = buckets.get(value)
      if (bucket) {
        bucket.push(row)
      } else {
        buckets.set(value, [row])
      }
    }
    for (const [value, bucketRows] of buckets.entries()) {
      const nextPath: GroupKeySegment[] = [...path, { field, value }]
      const groupKey = createGroupedRowKey(nextPath)
      const state = createEmptyGroupState()
      if (!state) {
        continue
      }
      for (const row of bucketRows) {
        if (row.kind !== "leaf") {
          continue
        }
        const contribution = createLeafContribution(row)
        if (!contribution) {
          continue
        }
        leafContributionByRowId.set(row.rowId, contribution)
        const existingPath = groupPathByRowId.get(row.rowId)
        if (existingPath) {
          existingPath.push(groupKey)
        } else {
          groupPathByRowId.set(row.rowId, [groupKey])
        }
        applyContributionDelta(state, null, contribution)
      }
      statesByGroupKey.set(groupKey, state)
      const aggregates = finalizeGroupState(state)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(groupKey, aggregates)
      }
      projectLevel(bucketRows, level + 1, nextPath)
    }
  }

  projectLevel(inputRows, 0, [])
  return {
    statesByGroupKey,
    aggregatesByGroupKey,
    groupPathByRowId,
    leafContributionByRowId,
  }
}

export function resetGroupByIncrementalAggregationState(
  state: GroupByIncrementalAggregationState,
): void {
  state.statesByGroupKey = new Map<string, DataGridIncrementalAggregationGroupState>()
  state.aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  state.groupPathByRowId = new Map<DataGridRowId, readonly string[]>()
  state.leafContributionByRowId = new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
}

function applyIncrementalGroupByAggregationDelta<T>(
  input: IncrementalAggregationPatchInput<T>,
): boolean {
  const {
    groupByState,
    previousRowsById,
    sourceRows,
    changedRowIds,
    isIncrementalAggregationSupported,
    createLeafContribution,
    applyContributionDelta,
    finalizeGroupState,
    patchRuntimeGroupAggregates,
  } = input
  if (
    groupByState.statesByGroupKey.size === 0 ||
    groupByState.groupPathByRowId.size === 0 ||
    !isIncrementalAggregationSupported()
  ) {
    return false
  }
  const sourceById = buildRowIdIndex(sourceRows)
  const dirtyGroupKeys = new Set<string>()
  for (const rowId of changedRowIds) {
    const groupPath = groupByState.groupPathByRowId.get(rowId)
    if (!groupPath || groupPath.length === 0) {
      continue
    }
    const previousRow = previousRowsById.get(rowId)
    const previousContribution = groupByState.leafContributionByRowId.get(rowId)
      ?? (previousRow ? createLeafContribution(previousRow) : null)
    const nextRow = sourceById.get(rowId)
    const nextContribution = nextRow
      ? createLeafContribution(nextRow)
      : null
    if (nextContribution) {
      groupByState.leafContributionByRowId.set(rowId, nextContribution)
    } else {
      groupByState.leafContributionByRowId.delete(rowId)
    }
    for (const groupKey of groupPath) {
      const state = groupByState.statesByGroupKey.get(groupKey)
      if (!state) {
        continue
      }
      applyContributionDelta(
        state,
        previousContribution ?? null,
        nextContribution,
      )
      dirtyGroupKeys.add(groupKey)
    }
  }
  if (dirtyGroupKeys.size === 0) {
    return false
  }
  for (const groupKey of dirtyGroupKeys) {
    const state = groupByState.statesByGroupKey.get(groupKey)
    if (!state) {
      continue
    }
    const aggregates = finalizeGroupState(state)
    if (Object.keys(aggregates).length > 0) {
      groupByState.aggregatesByGroupKey.set(groupKey, aggregates)
    } else {
      groupByState.aggregatesByGroupKey.delete(groupKey)
    }
  }
  patchRuntimeGroupAggregates(groupKey => groupByState.aggregatesByGroupKey.get(groupKey))
  return true
}

function applyIncrementalTreePathAggregationDelta<T>(
  input: IncrementalAggregationPatchInput<T>,
): boolean {
  const {
    treePathCacheState,
    previousRowsById,
    sourceRows,
    changedRowIds,
    isIncrementalAggregationSupported,
    createLeafContribution,
    applyContributionDelta,
    finalizeGroupState,
    patchRuntimeGroupAggregates,
  } = input
  const cache = treePathCacheState?.cache
  if (
    !cache ||
    !cache.aggregateStateByGroupKey ||
    !cache.leafContributionById ||
    !isIncrementalAggregationSupported()
  ) {
    return false
  }
  const sourceById = buildRowIdIndex(sourceRows)
  const dirtyGroupKeys = new Set<string>()
  for (const rowId of changedRowIds) {
    const groupPath = cache.branchPathByLeafRowId.get(rowId)
    if (!groupPath || groupPath.length === 0) {
      continue
    }
    const previousRow = previousRowsById.get(rowId)
    const previousContribution = cache.leafContributionById.get(rowId)
      ?? (previousRow ? createLeafContribution(previousRow) : null)
    const nextRow = sourceById.get(rowId)
    const nextContribution = nextRow
      ? createLeafContribution(nextRow)
      : null
    if (nextContribution) {
      cache.leafContributionById.set(rowId, nextContribution)
    } else {
      cache.leafContributionById.delete(rowId)
    }
    for (const groupKey of groupPath) {
      const state = cache.aggregateStateByGroupKey.get(groupKey)
      if (!state) {
        continue
      }
      applyContributionDelta(
        state,
        previousContribution ?? null,
        nextContribution,
      )
      dirtyGroupKeys.add(groupKey)
      cache.dirtyBranchKeys.add(groupKey)
    }
  }
  if (dirtyGroupKeys.size === 0) {
    return false
  }
  for (const groupKey of dirtyGroupKeys) {
    const state = cache.aggregateStateByGroupKey.get(groupKey)
    if (!state) {
      continue
    }
    const aggregates = finalizeGroupState(state)
    if (Object.keys(aggregates).length > 0) {
      cache.aggregatesByGroupKey.set(groupKey, aggregates)
    } else {
      cache.aggregatesByGroupKey.delete(groupKey)
    }
  }
  patchRuntimeGroupAggregates(groupKey => cache.aggregatesByGroupKey.get(groupKey))
  cache.dirtyBranchKeys.clear()
  return true
}

function applyIncrementalTreeParentAggregationDelta<T>(
  input: IncrementalAggregationPatchInput<T>,
): boolean {
  const {
    treeParentCacheState,
    previousRowsById,
    sourceRows,
    changedRowIds,
    isIncrementalAggregationSupported,
    createLeafContribution,
    applyContributionDelta,
    finalizeGroupState,
    patchRuntimeGroupAggregates,
  } = input
  const cache = treeParentCacheState?.cache
  if (
    !cache ||
    !cache.aggregateStateByGroupRowId ||
    !cache.leafContributionById ||
    !isIncrementalAggregationSupported()
  ) {
    return false
  }
  const sourceById = buildRowIdIndex(sourceRows)
  const dirtyGroupRowIds = new Set<DataGridRowId>()
  for (const rowId of changedRowIds) {
    const previousRow = previousRowsById.get(rowId)
    const previousContribution = cache.leafContributionById.get(rowId)
      ?? (previousRow ? createLeafContribution(previousRow) : null)
    const nextRow = sourceById.get(rowId)
    const nextContribution = nextRow
      ? createLeafContribution(nextRow)
      : null
    if (nextContribution) {
      cache.leafContributionById.set(rowId, nextContribution)
    } else {
      cache.leafContributionById.delete(rowId)
    }
    let cursor: DataGridRowId | null = rowId
    while (cursor != null) {
      const state = cache.aggregateStateByGroupRowId.get(cursor)
      if (state) {
        applyContributionDelta(
          state,
          previousContribution ?? null,
          nextContribution,
        )
        dirtyGroupRowIds.add(cursor)
        cache.dirtyBranchRootIds.add(cursor)
      }
      cursor = cache.parentById.get(cursor) ?? null
    }
  }
  if (dirtyGroupRowIds.size === 0) {
    return false
  }
  for (const rowId of dirtyGroupRowIds) {
    const state = cache.aggregateStateByGroupRowId.get(rowId)
    if (!state) {
      continue
    }
    const aggregates = finalizeGroupState(state)
    if (Object.keys(aggregates).length > 0) {
      cache.aggregatesByGroupRowId.set(rowId, aggregates)
    } else {
      cache.aggregatesByGroupRowId.delete(rowId)
    }
  }
  patchRuntimeGroupAggregates(groupKey => {
    const groupRowId = cache.groupRowIdByGroupKey.get(groupKey)
    if (typeof groupRowId === "undefined") {
      return undefined
    }
    return cache.aggregatesByGroupRowId.get(groupRowId)
  })
  cache.dirtyBranchRootIds.clear()
  return true
}

export function applyIncrementalAggregationPatch<T>(
  input: IncrementalAggregationPatchInput<T>,
): boolean {
  if (input.hasPivotModel) {
    return false
  }
  if (!input.hasAggregationModel) {
    return false
  }
  if (
    !input.stageImpact.affectsAggregation ||
    input.stageImpact.affectsFilter ||
    input.stageImpact.affectsSort ||
    input.stageImpact.affectsGroup
  ) {
    return false
  }
  if (!input.isIncrementalAggregationSupported()) {
    return false
  }
  if (input.hasTreeData) {
    return applyIncrementalTreePathAggregationDelta(input)
      || applyIncrementalTreeParentAggregationDelta(input)
  }
  if (!input.hasGroupBy) {
    return false
  }
  return applyIncrementalGroupByAggregationDelta(input)
}
