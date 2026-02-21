import {
  createProjectionStageEngine,
  type ProjectionRecomputeMeta,
  type ProjectionRecomputeOptions,
  type ProjectionRequestOptions,
} from "@affino/projection-engine"
import type {
  DataGridRowId,
  DataGridRowNode,
} from "./rowModel.js"
import {
  DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH,
  DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE,
  expandClientProjectionStages as expandClientProjectionStagesFromGraph,
  type DataGridClientProjectionStage,
} from "./projectionStages.js"

export type { DataGridClientProjectionStage } from "./projectionStages.js"

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

export interface DataGridClientProjectionStageHandlers<T> {
  buildSourceById: () => ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  getCurrentFilteredRowIds: () => ReadonlySet<DataGridRowId>
  resolveFilterPredicate: () => (rowNode: DataGridRowNode<T>) => boolean
  runFilterStage: (context: DataGridClientProjectionFilterStageContext<T>) => DataGridClientProjectionFilterStageResult
  runSortStage: (context: DataGridClientProjectionStageContext<T>) => boolean
  runGroupStage: (context: DataGridClientProjectionGroupStageContext<T>) => boolean
  runPaginateStage: (context: DataGridClientProjectionStageContext<T>) => boolean
  runVisibleStage: (context: DataGridClientProjectionStageContext<T>) => boolean
  finalizeProjectionRecompute: (meta: DataGridClientProjectionFinalizeMeta) => void
}

export type DataGridClientProjectionRecomputeOptions = ProjectionRecomputeOptions<DataGridClientProjectionStage>

export type DataGridClientProjectionFinalizeMeta = ProjectionRecomputeMeta<DataGridClientProjectionStage>

export type DataGridClientProjectionRequestOptions = ProjectionRequestOptions

export interface DataGridClientProjectionEngine<T> {
  requestStages: (
    stages: readonly DataGridClientProjectionStage[],
    options?: DataGridClientProjectionRequestOptions,
  ) => void
  requestRefreshPass: () => void
  hasDirtyStages: () => boolean
  recompute: (
    handlers: DataGridClientProjectionStageHandlers<T>,
    options?: DataGridClientProjectionRecomputeOptions,
  ) => void
  recomputeFromStage: (
    stage: DataGridClientProjectionStage,
    handlers: DataGridClientProjectionStageHandlers<T>,
    options?: DataGridClientProjectionRecomputeOptions,
  ) => void
  getStaleStages: () => readonly DataGridClientProjectionStage[]
}

interface DataGridClientProjectionStageRuntimeContext<T> {
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  handlers: DataGridClientProjectionStageHandlers<T>
  getFilteredRowIds: () => ReadonlySet<DataGridRowId>
  setFilteredRowIds: (rowIds: ReadonlySet<DataGridRowId>) => void
}

interface DataGridClientProjectionStageDefinition {
  compute: <T>(
    context: DataGridClientProjectionStageRuntimeContext<T>,
    shouldRecompute: boolean,
  ) => boolean
}

const DATAGRID_CLIENT_PROJECTION_STAGE_DEFINITIONS = {
  filter: {
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      const filterResult = context.handlers.runFilterStage({
        sourceById: context.sourceById,
        filterPredicate: shouldRecompute ? context.handlers.resolveFilterPredicate() : undefined,
        shouldRecompute,
      })
      context.setFilteredRowIds(filterResult.filteredRowIds)
      return filterResult.recomputed
    },
  },
  sort: {
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runSortStage({
        sourceById: context.sourceById,
        shouldRecompute,
      })
    },
  },
  group: {
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runGroupStage({
        sourceById: context.sourceById,
        rowMatchesFilter: (row: DataGridRowNode<T>) => context.getFilteredRowIds().has(row.rowId),
        shouldRecompute,
      })
    },
  },
  paginate: {
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runPaginateStage({
        sourceById: context.sourceById,
        shouldRecompute,
      })
    },
  },
  visible: {
    compute: <T>(context: DataGridClientProjectionStageRuntimeContext<T>, shouldRecompute: boolean): boolean => {
      return context.handlers.runVisibleStage({
        sourceById: context.sourceById,
        shouldRecompute,
      })
    },
  },
} as const satisfies Readonly<Record<DataGridClientProjectionStage, DataGridClientProjectionStageDefinition>>

export function createClientRowProjectionEngine<T>(): DataGridClientProjectionEngine<T> {
  const projection = createProjectionStageEngine<DataGridClientProjectionStage>({
    nodes: DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH.nodes,
    preparedGraph: DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH,
    refreshEntryStage: DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE,
  })

  const recompute = (
    handlers: DataGridClientProjectionStageHandlers<T>,
    options: DataGridClientProjectionRecomputeOptions = {},
  ): void => {
    if (!projection.hasDirtyStages()) {
      return
    }

    const sourceById = handlers.buildSourceById()
    let filteredRowIds: ReadonlySet<DataGridRowId> = handlers.getCurrentFilteredRowIds()
    const stageRuntimeContext: DataGridClientProjectionStageRuntimeContext<T> = {
      sourceById,
      handlers,
      getFilteredRowIds: () => filteredRowIds,
      setFilteredRowIds: (rowIds: ReadonlySet<DataGridRowId>) => {
        filteredRowIds = rowIds
      },
    }

    const meta = projection.recompute((stage: DataGridClientProjectionStage, shouldRecompute: boolean) => {
      return DATAGRID_CLIENT_PROJECTION_STAGE_DEFINITIONS[stage]
        .compute(stageRuntimeContext, shouldRecompute)
    }, options)
    if (!meta) {
      return
    }
    handlers.finalizeProjectionRecompute(meta)
  }

  const recomputeFromStage = (
    stage: DataGridClientProjectionStage,
    handlers: DataGridClientProjectionStageHandlers<T>,
    options: DataGridClientProjectionRecomputeOptions = {},
  ): void => {
    projection.requestStages([stage])
    recompute(handlers, options)
  }

  return {
    requestStages: projection.requestStages,
    requestRefreshPass: projection.requestRefreshPass,
    hasDirtyStages: projection.hasDirtyStages,
    recompute,
    recomputeFromStage,
    getStaleStages: projection.getStaleStages,
  }
}

export function expandClientProjectionStages(
  stages: readonly DataGridClientProjectionStage[],
): ReadonlySet<DataGridClientProjectionStage> {
  return expandClientProjectionStagesFromGraph(stages)
}
