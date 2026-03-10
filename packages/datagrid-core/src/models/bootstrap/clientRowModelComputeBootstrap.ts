import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridPivotColumn,
  DataGridRowNode,
  DataGridSortState,
  DataGridTreeDataResolvedSpec,
  DataGridViewportRange,
} from "../rowModel.js"
import type { DataGridPivotSpec, DataGridPivotRuntime } from "@affino/datagrid-pivot"
import { createClientRowComputeModuleHost, type DataGridClientComputeModuleHost } from "../compute/clientRowComputeModule.js"
import { createClientRowComputeHostRuntime, type ClientRowComputeHostRuntime } from "../host/clientRowComputeHostRuntime.js"
import {
  createClientRowProjectionIntegrationHostRuntime,
  type DataGridClientRowProjectionIntegrationHostRuntime,
} from "../host/clientRowProjectionIntegrationHostRuntime.js"
import { createClientRowProjectionHostRuntime, type DataGridClientRowProjectionHostRuntime } from "../host/clientRowProjectionHostRuntime.js"
import {
  createClientRowFlatIdentityProjectionRefreshRuntime,
  type DataGridClientRowFlatIdentityProjectionRefreshRuntime,
} from "../projection/clientRowFlatIdentityProjectionRefreshRuntime.js"
import type { DataGridClientComputeMode, DataGridClientComputeTransport } from "../compute/clientRowComputeRuntime.js"
import type { DataGridProjectionPolicy } from "../projection/projectionPolicy.js"
import type { ClientRowProjectionTransientStateRuntime } from "../state/clientRowProjectionTransientStateRuntime.js"
import type { DataGridClientRowRuntimeState, DataGridClientRowRuntimeStateStore } from "../state/clientRowRuntimeStateStore.js"
import type { ClientRowRowVersionRuntime } from "../state/clientRowRowVersionRuntime.js"
import type { ClientRowDerivedCacheRuntime } from "../projection/clientRowDerivedCacheRuntime.js"
import type { DataGridClientRowExpansionHostRuntime } from "../host/clientRowExpansionHostRuntime.js"
import type { TreeProjectionRuntime } from "../tree/treeProjectionRuntime.js"
import type { DataGridClientRowTreePivotIntegrationRuntime } from "../projection/clientRowTreePivotIntegrationRuntime.js"
import { buildRowIdIndex } from "../clientRowRuntimeUtils.js"
import { normalizeText } from "../projection/clientRowProjectionPrimitives.js"
import type { DataGridClientRowModelDerivedCacheDiagnostics } from "../projection/clientRowDerivedCacheRuntime.js"
import { createDataGridAggregationEngine } from "../aggregation/aggregationEngine.js"

export interface ClientRowModelComputeBootstrapResult<T> {
  computeModuleHost: DataGridClientComputeModuleHost<T>
  projectionIntegrationHostRuntime: DataGridClientRowProjectionIntegrationHostRuntime<T>
  projectionHostRuntime: DataGridClientRowProjectionHostRuntime<T>
  flatIdentityProjectionRefreshRuntime: DataGridClientRowFlatIdentityProjectionRefreshRuntime
  computeHostRuntime: ClientRowComputeHostRuntime<T>
}

export interface CreateClientRowModelComputeBootstrapOptions<T> {
  runtimeState: DataGridClientRowRuntimeState<T>
  runtimeStateStore: DataGridClientRowRuntimeStateStore<T>
  treeData: DataGridTreeDataResolvedSpec<T> | null
  projectionPolicy: DataGridProjectionPolicy
  getBaseSourceRows: () => readonly DataGridRowNode<T>[]
  getSourceRowsState: () => readonly DataGridRowNode<T>[]
  getSourceRowIndexById: () => ReadonlyMap<string | number, number>
  readProjectionRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
  resolveFilterPredicate: ClientRowDerivedCacheRuntime<T>["resolveFilterPredicate"]
  rowVersionRuntime: ClientRowRowVersionRuntime<T>
  derivedCacheRuntime: ClientRowDerivedCacheRuntime<T>
  projectionTransientStateRuntime: ClientRowProjectionTransientStateRuntime
  treeProjectionRuntime: TreeProjectionRuntime<T>
  pivotRuntime: DataGridPivotRuntime<T>
  aggregationEngine: ReturnType<typeof createDataGridAggregationEngine<T>>
  expansionHostRuntime: DataGridClientRowExpansionHostRuntime
  treePivotIntegrationRuntime: DataGridClientRowTreePivotIntegrationRuntime<T>
  getSortModel: () => readonly DataGridSortState[]
  getFilterModel: () => DataGridFilterSnapshot | null
  getGroupBy: () => DataGridGroupBySpec | null
  getPivotModel: () => DataGridPivotSpec | null
  getAggregationModel: () => DataGridAggregationModel<T> | null
  getPivotColumns: () => DataGridPivotColumn[]
  setPivotColumns: (value: DataGridPivotColumn[]) => void
  getPaginationInput: () => DataGridPaginationInput
  setPaginationInput: (value: DataGridPaginationInput) => void
  getPagination: () => DataGridPaginationSnapshot
  setPagination: (value: DataGridPaginationSnapshot) => void
  getViewportRange: () => DataGridViewportRange
  setViewportRange: (value: DataGridViewportRange) => void
  normalizeViewportRange: (range: DataGridViewportRange, rowCount: number) => DataGridViewportRange
  workerPatchDispatchThreshold: number | null
  computeTransport: DataGridClientComputeTransport | null
  computeMode: DataGridClientComputeMode | undefined
  groupByIncrementalAggregationState: ReturnType<ClientRowProjectionTransientStateRuntime["getGroupByIncrementalAggregationState"]>
}

export function createClientRowModelComputeBootstrap<T>(
  options: CreateClientRowModelComputeBootstrapOptions<T>,
): ClientRowModelComputeBootstrapResult<T> {
  const computeModuleHost = createClientRowComputeModuleHost<T>({
    getModules: () => [],
  })

  const projectionIntegrationHostRuntime = createClientRowProjectionIntegrationHostRuntime<T>({
    runtimeState: options.runtimeState,
    treeData: options.treeData,
    getBaseSourceRows: options.getBaseSourceRows,
    getSourceRowIndexById: options.getSourceRowIndexById,
    getGroupBy: options.getGroupBy,
    getPivotModel: options.getPivotModel,
    getAggregationModel: options.getAggregationModel,
    aggregationEngine: options.aggregationEngine,
    projectionTransientStateRuntime: options.projectionTransientStateRuntime,
    treePivotIntegrationRuntime: options.treePivotIntegrationRuntime,
  })

  const projectionHostRuntime = createClientRowProjectionHostRuntime<T>({
    handlersContext: {
      runtimeState: options.runtimeState,
      commitProjectionCycle: (meta) => {
        options.runtimeStateStore.commitProjectionCycle({
          hadActualRecompute: meta.hadActualRecompute,
          recomputedStages: meta.recomputedStages,
          blockedStages: meta.blockedStages,
          stageTimes: meta.stageTimes,
        })
      },
      getSourceRows: options.getSourceRowsState,
      buildSourceById: () => buildRowIdIndex(options.getSourceRowsState()),
      readRowField: options.readProjectionRowField,
      normalizeText,
      computeStageExecutor: computeModuleHost.getProjectionComputeStageExecutor(),
      resolveFilterPredicate: opts => options.resolveFilterPredicate(opts),
      getTreeData: () => options.treeData,
      getFilterModel: options.getFilterModel,
      getSortModel: options.getSortModel,
      getGroupBy: options.getGroupBy,
      getPivotModel: options.getPivotModel,
      getAggregationModel: options.getAggregationModel,
      getProjectionPolicy: () => options.projectionPolicy,
      getRowVersionById: () => options.rowVersionRuntime.getIndex(),
      getTreeCacheRevision: () => options.treePivotIntegrationRuntime.getTreeCacheRevision(),
      getPaginationInput: options.getPaginationInput,
      setPaginationInput: options.setPaginationInput,
      getPagination: options.getPagination,
      setPagination: options.setPagination,
      getViewportRange: options.getViewportRange,
      setViewportRange: options.setViewportRange,
      normalizeViewportRange: options.normalizeViewportRange,
      getSortValueCacheKey: () => options.derivedCacheRuntime.getSortValueCacheKey(),
      setSortValueCacheKey: key => {
        options.derivedCacheRuntime.setSortValueCacheKey(key)
      },
      sortValueCache: options.derivedCacheRuntime.getSortValueCache(),
      getGroupValueCacheKey: () => options.derivedCacheRuntime.getGroupValueCacheKey(),
      setGroupValueCacheKey: key => {
        options.derivedCacheRuntime.setGroupValueCacheKey(key)
      },
      groupValueCache: options.derivedCacheRuntime.getGroupValueCache(),
      getGroupedProjectionGroupIndexByRowId: () => options.projectionTransientStateRuntime.getGroupedProjectionGroupIndexByRowId(),
      setGroupedProjectionGroupIndexByRowId: index => {
        options.projectionTransientStateRuntime.setGroupedProjectionGroupIndexByRowId(index)
      },
      getTreePathProjectionCacheState: () => options.treePivotIntegrationRuntime.getTreePathProjectionCacheState(),
      setTreePathProjectionCacheState: state => {
        options.treePivotIntegrationRuntime.setTreePathProjectionCacheState(state)
      },
      getTreeParentProjectionCacheState: () => options.treePivotIntegrationRuntime.getTreeParentProjectionCacheState(),
      setTreeParentProjectionCacheState: state => {
        options.treePivotIntegrationRuntime.setTreeParentProjectionCacheState(state)
      },
      getLastTreeProjectionCacheKey: () => options.treePivotIntegrationRuntime.getLastTreeProjectionCacheKey(),
      setLastTreeProjectionCacheKey: key => {
        options.treePivotIntegrationRuntime.setLastTreeProjectionCacheKey(key)
      },
      getLastTreeExpansionSnapshot: () => options.treePivotIntegrationRuntime.getLastTreeExpansionSnapshot(),
      setLastTreeExpansionSnapshot: snapshot => {
        options.treePivotIntegrationRuntime.setLastTreeExpansionSnapshot(snapshot)
      },
      getTreeDataDiagnostics: () => options.projectionTransientStateRuntime.getTreeDataDiagnostics(),
      setTreeDataDiagnostics: diagnostics => {
        options.projectionTransientStateRuntime.setTreeDataDiagnostics(diagnostics)
      },
      getPivotColumns: options.getPivotColumns,
      setPivotColumns: options.setPivotColumns,
      getPendingPivotValuePatch: () => options.treePivotIntegrationRuntime.getPendingPivotValuePatch(),
      setPendingPivotValuePatch: rows => {
        options.treePivotIntegrationRuntime.setPendingPivotValuePatch(rows)
      },
      getCurrentExpansionSnapshot: () => options.expansionHostRuntime.getCurrentExpansionSnapshot(),
      getExpansionToggledKeys: () => options.expansionHostRuntime.getActiveExpansionStateStore().toggledKeys,
      derivedCacheDiagnostics: options.derivedCacheRuntime.getMutableDiagnostics() as DataGridClientRowModelDerivedCacheDiagnostics,
      treeProjectionRuntime: options.treeProjectionRuntime,
      pivotRuntime: options.pivotRuntime,
      aggregationEngine: options.aggregationEngine,
      groupByIncrementalAggregationState: options.groupByIncrementalAggregationState,
      resetGroupByIncrementalAggregationState: () => {
        projectionIntegrationHostRuntime.resetGroupByIncrementalAggregationState()
      },
    },
  })

  const flatIdentityProjectionRefreshRuntime = createClientRowFlatIdentityProjectionRefreshRuntime<T>({
    runtimeState: options.runtimeState,
    getBaseSourceRows: options.getBaseSourceRows,
    getFilterModel: options.getFilterModel,
    getSortModel: options.getSortModel,
    isTreeDataEnabled: () => Boolean(options.treeData),
    getGroupBy: options.getGroupBy,
    getPivotModel: options.getPivotModel,
    getAggregationModel: options.getAggregationModel,
    getPagination: options.getPagination,
    getPaginationInput: options.getPaginationInput,
    setPagination: options.setPagination,
    getViewportRange: options.getViewportRange,
    setViewportRange: options.setViewportRange,
    normalizeViewportRange: options.normalizeViewportRange,
    commitProjectionCycle: hadActualRecompute => {
      options.runtimeStateStore.commitProjectionCycle(hadActualRecompute)
    },
    updateDerivedCacheRevisions: revisions => {
      options.derivedCacheRuntime.updateRevisions(revisions)
    },
  })

  const computeHostRuntime = createClientRowComputeHostRuntime<T>({
    mode: options.computeMode ?? "sync",
    transport: options.computeTransport,
    workerPatchDispatchThreshold: options.workerPatchDispatchThreshold,
    orchestrator: projectionHostRuntime.getOrchestrator(),
  })

  return {
    computeModuleHost,
    projectionIntegrationHostRuntime,
    projectionHostRuntime,
    flatIdentityProjectionRefreshRuntime,
    computeHostRuntime,
  }
}
