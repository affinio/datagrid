import type {
  DataGridAggregationModel,
  DataGridGroupBySpec,
  DataGridRowNode,
  DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import type { DataGridPivotSpec, DataGridPivotRuntime } from "@affino/datagrid-pivot"
import { createDataGridAggregationEngine } from "../aggregation/aggregationEngine.js"
import { createPivotRuntime } from "../pivot/pivotRuntime.js"
import { createTreeProjectionRuntime, type TreeProjectionRuntime } from "../tree/treeProjectionRuntime.js"
import {
  createClientRowTreePivotIntegrationRuntime,
  type DataGridClientRowTreePivotIntegrationRuntime,
} from "../projection/clientRowTreePivotIntegrationRuntime.js"
import {
  createClientRowExpansionHostRuntime,
  type DataGridClientRowExpansionHostRuntime,
} from "../host/clientRowExpansionHostRuntime.js"

export interface ClientRowModelProjectionBootstrapResult<T> {
  pivotRuntime: DataGridPivotRuntime<T>
  treeProjectionRuntime: TreeProjectionRuntime<T>
  aggregationEngine: ReturnType<typeof createDataGridAggregationEngine<T>>
  treePivotIntegrationRuntime: DataGridClientRowTreePivotIntegrationRuntime<T>
  expansionHostRuntime: DataGridClientRowExpansionHostRuntime
}

export interface CreateClientRowModelProjectionBootstrapOptions<T> {
  readProjectionRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
  resolveTreeDataRow: (row: DataGridRowNode<T>) => T
  getAggregationModel: () => DataGridAggregationModel<T> | null
  getTreeData: () => DataGridTreeDataResolvedSpec<T> | null
  getSourceRows: () => readonly DataGridRowNode<T>[]
  getPivotModel: () => DataGridPivotSpec | null
  getGroupBy: () => DataGridGroupBySpec | null
}

export function createClientRowModelProjectionBootstrap<T>(
  options: CreateClientRowModelProjectionBootstrapOptions<T>,
): ClientRowModelProjectionBootstrapResult<T> {
  const pivotRuntime = createPivotRuntime<T>({
    readRowField: (row, key, field) => options.readProjectionRowField(row, key, field),
  })
  const treeProjectionRuntime = createTreeProjectionRuntime<T>({
    resolveTreeDataRow: options.resolveTreeDataRow,
  })
  const aggregationEngine = createDataGridAggregationEngine<T>(options.getAggregationModel(), {
    readRowField: (row, key, field) => options.readProjectionRowField(row, key, field),
  })
  const treePivotIntegrationRuntime = createClientRowTreePivotIntegrationRuntime<T>({
    getTreeData: options.getTreeData,
    getSourceRows: options.getSourceRows,
    treeProjectionRuntime,
  })
  const expansionHostRuntime = createClientRowExpansionHostRuntime({
    getTreeDataEnabled: () => Boolean(options.getTreeData()),
    getPivotModel: options.getPivotModel,
    getGroupBy: options.getGroupBy,
    getPivotExpansionExpandedByDefault: () => treePivotIntegrationRuntime.getPivotExpansionExpandedByDefault(),
    setPivotExpansionExpandedByDefault: (value) => {
      treePivotIntegrationRuntime.setPivotExpansionExpandedByDefault(value)
    },
    getToggledPivotGroupKeys: () => treePivotIntegrationRuntime.getToggledPivotGroupKeys(),
  })
  expansionHostRuntime.setExpansionExpandedByDefault(
    Boolean(options.getTreeData()?.expandedByDefault ?? options.getGroupBy()?.expandedByDefault),
  )

  return {
    pivotRuntime,
    treeProjectionRuntime,
    aggregationEngine,
    treePivotIntegrationRuntime,
    expansionHostRuntime,
  }
}
