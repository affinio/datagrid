import type {
  DataGridAggregationModel,
  DataGridGroupBySpec,
  DataGridRowNode,
  DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import type { DataGridPivotSpec, DataGridPivotRuntime } from "@affino/datagrid-pivot"
import { createDataGridAggregationEngine } from "../aggregation/aggregationEngine.js"
import type {
  DataGridAggregationEngine,
  DataGridAggregationRegistry,
  DataGridAggregationRegistryInput,
} from "../aggregation/aggregationEngine.js"
import type { DataGridComparatorRegistry } from "../comparator/comparatorPolicy.js"
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
  comparatorRegistry?: DataGridComparatorRegistry<T>
  aggregationRegistry?: DataGridAggregationRegistryInput<T> | DataGridAggregationRegistry<T> | null
  maxPivotOutputCells?: number
  sparsePivotOutput?: boolean
}

export function createClientRowModelProjectionBootstrap<T>(
  options: CreateClientRowModelProjectionBootstrapOptions<T>,
): ClientRowModelProjectionBootstrapResult<T> {
  let pivotRuntimeInstance: DataGridPivotRuntime<T> | null = null
  const getPivotRuntime = (): DataGridPivotRuntime<T> => {
    if (pivotRuntimeInstance) {
      return pivotRuntimeInstance
    }
    pivotRuntimeInstance = createPivotRuntime<T>({
      readRowField: (row, key, field) => options.readProjectionRowField(row, key, field),
      aggregationRegistry: options.aggregationRegistry,
      maxOutputCells: options.maxPivotOutputCells,
      sparseOutput: options.sparsePivotOutput,
    })
    return pivotRuntimeInstance
  }
  const pivotRuntime: DataGridPivotRuntime<T> = {
    projectRows(input) {
      return getPivotRuntime().projectRows(input)
    },
    applyValueOnlyPatch(input) {
      return getPivotRuntime().applyValueOnlyPatch(input)
    },
    readCell(address) {
      return getPivotRuntime().readCell(address)
    },
    normalizeColumns(columns) {
      return getPivotRuntime().normalizeColumns(columns)
    },
  }
  let treeProjectionRuntimeInstance: TreeProjectionRuntime<T> | null = null
  const getTreeProjectionRuntime = (): TreeProjectionRuntime<T> => {
    if (treeProjectionRuntimeInstance) {
      return treeProjectionRuntimeInstance
    }
    treeProjectionRuntimeInstance = createTreeProjectionRuntime<T>({
      resolveTreeDataRow: options.resolveTreeDataRow,
    })
    return treeProjectionRuntimeInstance
  }
  const treeProjectionRuntime: TreeProjectionRuntime<T> = {
    buildCacheKey(input) {
      return getTreeProjectionRuntime().buildCacheKey(input)
    },
    projectRowsFromCache(input) {
      return getTreeProjectionRuntime().projectRowsFromCache(input)
    },
    patchPathCacheRowsByIdentity(cache, sourceById, changedRowIds) {
      return getTreeProjectionRuntime().patchPathCacheRowsByIdentity(cache, sourceById, changedRowIds)
    },
    patchParentCacheRowsByIdentity(cache, sourceById, changedRowIds) {
      return getTreeProjectionRuntime().patchParentCacheRowsByIdentity(cache, sourceById, changedRowIds)
    },
    tryProjectPathSubtreeToggle(input) {
      return getTreeProjectionRuntime().tryProjectPathSubtreeToggle(input)
    },
    tryProjectParentSubtreeToggle(input) {
      return getTreeProjectionRuntime().tryProjectParentSubtreeToggle(input)
    },
  }
  let aggregationModel = options.getAggregationModel()
  let aggregationEngineInstance: DataGridAggregationEngine<T> | null = null
  const getAggregationEngine = (): DataGridAggregationEngine<T> => {
    if (aggregationEngineInstance) {
      return aggregationEngineInstance
    }
    aggregationEngineInstance = createDataGridAggregationEngine<T>(aggregationModel, {
      readRowField: (row, key, field) => options.readProjectionRowField(row, key, field),
      aggregationRegistry: options.aggregationRegistry,
    })
    return aggregationEngineInstance
  }
  const aggregationEngine: DataGridAggregationEngine<T> = {
    setModel(nextModel) {
      aggregationModel = nextModel
      if (aggregationEngineInstance) {
        aggregationEngineInstance.setModel(nextModel)
      } else if (nextModel) {
        getAggregationEngine()
      }
    },
    getModel() {
      return aggregationModel
    },
    getCompiledColumns() {
      return aggregationEngineInstance?.getCompiledColumns() ?? []
    },
    isIncrementalAggregationSupported() {
      return aggregationEngineInstance?.isIncrementalAggregationSupported() ?? false
    },
    createEmptyGroupState() {
      return aggregationEngineInstance?.createEmptyGroupState() ?? null
    },
    createLeafContribution(row) {
      return aggregationEngineInstance?.createLeafContribution(row) ?? null
    },
    applyContributionDelta(groupState, previous, next) {
      aggregationEngineInstance?.applyContributionDelta(groupState, previous, next)
    },
    finalizeGroupState(groupState) {
      return aggregationEngineInstance?.finalizeGroupState(groupState) ?? {}
    },
    computeAggregatesForLeaves(rows) {
      return aggregationEngineInstance?.computeAggregatesForLeaves(rows) ?? {}
    },
    computeAggregatesForGroupedRows(rows) {
      return aggregationEngineInstance?.computeAggregatesForGroupedRows(rows) ?? new Map()
    },
  }
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
