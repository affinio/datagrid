import type {
  DataGridProjectionStage,
  DataGridRowId,
  DataGridRowNode,
} from "../rowModel.js"
import type { DataGridClientProjectionComputeStageExecutionResult } from "./clientRowProjectionComputeStage.js"

export type DataGridClientProjectionStage = DataGridProjectionStage

export interface DataGridClientProjectionFilterStageResult {
  filteredRowIds: Set<DataGridRowId>
  recomputed: boolean
}

export interface DataGridClientProjectionStageContext<T> {
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  shouldRecompute: boolean
}

export interface DataGridClientProjectionFilterStageContext<T> extends DataGridClientProjectionStageContext<T> {
  filterPredicate?: (rowNode: DataGridRowNode<T>) => boolean
}

export interface DataGridClientProjectionGroupStageContext<T> extends DataGridClientProjectionStageContext<T> {
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean
}

export interface DataGridClientProjectionRuntimeStageHandlers<T> {
  buildSourceById: () => ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  getCurrentFilteredRowIds: () => ReadonlySet<DataGridRowId>
  runComputeStage: (
    context: DataGridClientProjectionStageContext<T>,
  ) => DataGridClientProjectionComputeStageExecutionResult
  resolveFilterPredicate: () => (rowNode: DataGridRowNode<T>) => boolean
  runFilterStage: (context: DataGridClientProjectionFilterStageContext<T>) => DataGridClientProjectionFilterStageResult
  runSortStage: (context: DataGridClientProjectionStageContext<T>) => boolean
  runGroupStage: (context: DataGridClientProjectionGroupStageContext<T>) => boolean
  runPivotStage: (context: DataGridClientProjectionStageContext<T>) => boolean
  runAggregateStage: (context: DataGridClientProjectionStageContext<T>) => boolean
  runPaginateStage: (context: DataGridClientProjectionStageContext<T>) => boolean
  runVisibleStage: (context: DataGridClientProjectionStageContext<T>) => boolean
}

export interface DataGridClientProjectionStageRuntimeContext<T> {
  getSourceById: () => ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  refreshSourceById: () => ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  handlers: DataGridClientProjectionRuntimeStageHandlers<T>
  getFilteredRowIds: () => ReadonlySet<DataGridRowId>
  setFilteredRowIds: (rowIds: ReadonlySet<DataGridRowId>) => void
}

export interface DataGridClientProjectionStageRegistryEntry {
  id: DataGridClientProjectionStage
  dependsOn: readonly DataGridClientProjectionStage[]
  compute: <T>(
    context: DataGridClientProjectionStageRuntimeContext<T>,
    shouldRecompute: boolean,
  ) => boolean
}

export const DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP: Readonly<
  Record<DataGridClientProjectionStage, DataGridClientProjectionStageRegistryEntry>
> = {
  compute: {
    id: "compute",
    dependsOn: [],
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      const result = context.handlers.runComputeStage({
        sourceById: context.getSourceById(),
        shouldRecompute,
      })
      if (result.refreshSourceById) {
        context.refreshSourceById()
      }
      return result.recomputed
    },
  },
  filter: {
    id: "filter",
    dependsOn: ["compute"],
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      const filterResult = context.handlers.runFilterStage({
        sourceById: context.getSourceById(),
        filterPredicate: shouldRecompute ? context.handlers.resolveFilterPredicate() : undefined,
        shouldRecompute,
      })
      context.setFilteredRowIds(filterResult.filteredRowIds)
      return filterResult.recomputed
    },
  },
  sort: {
    id: "sort",
    dependsOn: ["filter"],
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runSortStage({
        sourceById: context.getSourceById(),
        shouldRecompute,
      })
    },
  },
  group: {
    id: "group",
    dependsOn: ["sort"],
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runGroupStage({
        sourceById: context.getSourceById(),
        rowMatchesFilter: (row: DataGridRowNode<T>) => context.getFilteredRowIds().has(row.rowId),
        shouldRecompute,
      })
    },
  },
  pivot: {
    id: "pivot",
    dependsOn: ["group"],
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runPivotStage({
        sourceById: context.getSourceById(),
        shouldRecompute,
      })
    },
  },
  aggregate: {
    id: "aggregate",
    dependsOn: ["pivot"],
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runAggregateStage({
        sourceById: context.getSourceById(),
        shouldRecompute,
      })
    },
  },
  paginate: {
    id: "paginate",
    dependsOn: ["aggregate"],
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runPaginateStage({
        sourceById: context.getSourceById(),
        shouldRecompute,
      })
    },
  },
  visible: {
    id: "visible",
    dependsOn: ["paginate"],
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runVisibleStage({
        sourceById: context.getSourceById(),
        shouldRecompute,
      })
    },
  },
}

export const DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY: readonly DataGridClientProjectionStageRegistryEntry[] = [
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.compute,
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.filter,
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.sort,
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.group,
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.pivot,
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.aggregate,
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.paginate,
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.visible,
]
