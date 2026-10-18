import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "../aggregation/aggregationEngine.js"
import type { TreeGroupIndexShift } from "./treeProjectionExpansion.js"

export interface TreePathBranch<T> {
  key: string
  value: string
  level: number
  parent: TreePathBranch<T> | null
  groupRowData?: T
  groupRowNoAggExpanded?: DataGridRowNode<T>
  groupRowNoAggCollapsed?: DataGridRowNode<T>
  groupRowAggRef?: Record<string, unknown>
  groupRowAggExpanded?: DataGridRowNode<T>
  groupRowAggCollapsed?: DataGridRowNode<T>
  groups: Map<string, TreePathBranch<T>>
  leaves: DataGridRowNode<T>[]
  matchedLeaves: number
}

export interface TreeProjectionDiagnostics {
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
  leafBranchByLeafRowId: Map<DataGridRowId, TreePathBranch<T>>
  branchLeafIndexByLeafRowId: Map<DataGridRowId, number>
  branchParentByKey: Map<string, string | null>
  branchPathByLeafRowId: Map<DataGridRowId, readonly string[]>
  groupIndexByRowId: Map<DataGridRowId, number>
  groupIndexShiftHistory: TreeGroupIndexShift[]
  groupIndexBornAt: Map<DataGridRowId, number>
  togglePreviousDescendantsBuffer: DataGridRowNode<T>[]
  toggleNextDescendantsBuffer: DataGridRowNode<T>[]
  rootLeaves: DataGridRowNode<T>[]
  rootLeafIndexByRowId: Map<DataGridRowId, number>
  matchedLeafRowIds: Set<DataGridRowId>
  leafOnlyRows: DataGridRowNode<T>[]
  leafOnlyRowIndexByRowId: Map<DataGridRowId, number>
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
