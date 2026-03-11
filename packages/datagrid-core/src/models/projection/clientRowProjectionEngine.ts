// Projection engine wrapper over the generic projection-stage engine. This is
// the row-engine specific stage graph and recompute entrypoint.
import {
  createProjectionStageEngine,
  type ProjectionRecomputeMeta,
  type ProjectionRecomputeOptions,
  type ProjectionRequestOptions,
} from "@affino/projection-engine"
import type {
  DataGridProjectionStageTimer,
  DataGridRowId,
} from "../rowModel.js"
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

export type DataGridClientProjectionFinalizeMeta = ProjectionRecomputeMeta<DataGridClientProjectionStage> & {
  stageTimes?: Partial<Record<DataGridClientProjectionStage, number>>
}

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

export interface CreateClientRowProjectionEngineOptions {
  stageTimer?: DataGridProjectionStageTimer
}

function roundStageTiming(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function createClientRowProjectionEngine<T>(
  engineOptions: CreateClientRowProjectionEngineOptions = {},
): DataGridClientProjectionEngine<T> {
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

    let sourceById = handlers.buildSourceById()
    let filteredRowIds: ReadonlySet<DataGridRowId> = handlers.getCurrentFilteredRowIds()
    const stageTimes: Partial<Record<DataGridClientProjectionStage, number>> = {}
    const stageRuntimeContext: DataGridClientProjectionStageRuntimeContext<T> = {
      getSourceById: () => sourceById,
      refreshSourceById: () => {
        sourceById = handlers.buildSourceById()
        return sourceById
      },
      handlers,
      getFilteredRowIds: () => filteredRowIds,
      setFilteredRowIds: (rowIds: ReadonlySet<DataGridRowId>) => {
        filteredRowIds = rowIds
      },
    }

    const meta = projection.recompute((stage: DataGridClientProjectionStage, shouldRecompute: boolean) => {
      const computeStage = () => DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP[stage]
        .compute(stageRuntimeContext, shouldRecompute)
      if (!engineOptions.stageTimer) {
        return computeStage()
      }
      const measured = engineOptions.stageTimer(stage, computeStage)
      if (Number.isFinite(measured.duration)) {
        stageTimes[stage] = roundStageTiming(Math.max(0, measured.duration))
      }
      return measured.result
    }, options)
    if (!meta) {
      return
    }
    handlers.finalizeProjectionRecompute({
      ...meta,
      stageTimes,
    })
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
