import type { DataGridGroupBySpec, DataGridViewportRange } from "../rowModel.js"
import type {
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
  DataGridDataSourceTreePullContext,
} from "./dataSourceProtocol.js"
import { serializePullState } from "./dataSourceTransportCoordinator.js"

export function buildDataSourcePullStateKey(state: {
  sortModel: unknown
  filterModel: unknown
  groupBy: unknown
  groupExpansion: unknown
  pivotModel: unknown
  aggregationModel: unknown
  pagination: unknown
  cursor: unknown
}): string {
  return serializePullState(state)
}

export function buildDataSourceCacheStoreKey(
  activeCacheStoreKey: string,
  groupBy: DataGridGroupBySpec | null,
  treePullContext: DataGridDataSourceTreePullContext | null,
): string {
  if (!treePullContext) return activeCacheStoreKey
  return groupBy ? serializePullState({ groupBy, treeData: treePullContext }) : "__root__"
}

export function buildDataSourceRequestKey(input: {
  range: DataGridViewportRange
  reason: DataGridDataSourcePullReason
  priority: DataGridDataSourcePullPriority
  treePullContext: DataGridDataSourceTreePullContext | null
  stateKey: string
}): string {
  return serializePullState({
    range: input.range,
    reason: input.reason,
    priority: input.priority,
    treeData: input.treePullContext,
    state: input.stateKey,
  })
}
