import {
  createProjectionStageEngine,
  type ProjectionRecomputeMeta,
  type ProjectionRecomputeOptions,
  type ProjectionRequestOptions,
} from "@affino/projection-engine"
import type {
  DataGridRowId,
} from "./rowModel.js"
import {
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP,
  type DataGridClientProjectionRuntimeStageHandlers,
  type DataGridClientProjectionStageRuntimeContext,
} from "./clientRowProjectionStageRegistry.js"
import {
  DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH,
  DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE,
  expandClientProjectionStages as expandClientProjectionStagesFromGraph,
  type DataGridClientProjectionStage,
} from "./projectionStages.js"

export type { DataGridClientProjectionStage } from "./projectionStages.js"
export type {
  DataGridClientProjectionFilterStageResult,
  DataGridClientProjectionFilterStageContext,
  DataGridClientProjectionGroupStageContext,
  DataGridClientProjectionStageContext,
} from "./clientRowProjectionStageRegistry.js"

export interface DataGridClientProjectionStageHandlers<T> extends DataGridClientProjectionRuntimeStageHandlers<T> {
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
      return DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP[stage]
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
