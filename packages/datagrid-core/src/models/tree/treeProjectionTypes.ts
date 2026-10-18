import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "../aggregation/aggregationEngine.js"
import type { TreeGroupIndexShift } from "./treeProjectionExpansion.js"

export interface TreeProjectionDiagnostics {
  orphans: number
  cycles: number
}

export interface TreeProjectionResult<T> {
  rows: DataGridRowNode<T>[]
  diagnostics: TreeProjectionDiagnostics
}

export interface TreeParentProjectionCache<T> {
  diagnostics: TreeProjectionDiagnostics
  rowById: Map<DataGridRowId, DataGridRowNode<T>>
  parentById: Map<DataGridRowId, DataGridRowId | null>
  includedChildrenById: Map<DataGridRowId, DataGridRowId[]>
  groupRowIdByGroupKey: Map<string, DataGridRowId>
  groupIndexByRowId: Map<DataGridRowId, number>
  groupIndexShiftHistory: TreeGroupIndexShift[]
  groupIndexBornAt: Map<DataGridRowId, number>
  togglePreviousDescendantsBuffer: DataGridRowNode<T>[]
  toggleNextDescendantsBuffer: DataGridRowNode<T>[]
  rootIncluded: DataGridRowId[]
  aggregatesByGroupRowId: Map<DataGridRowId, Record<string, unknown>>
  aggregateStateByGroupRowId?: Map<DataGridRowId, DataGridIncrementalAggregationGroupState>
  leafContributionById?: Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>
  dirtyBranchRootIds: Set<DataGridRowId>
}
