import {
  createProjectionStageEngine,
  prepareProjectionStageGraph,
  expandProjectionStages,
  type ProjectionRecomputeMeta,
  type ProjectionRecomputeOptions,
  type ProjectionRequestOptions,
} from "@affino/projection-engine"
import type {
  DataGridProjectionStage,
  DataGridRowId,
  DataGridRowNode,
} from "./rowModel.js"

export type DataGridClientProjectionStage = DataGridProjectionStage

const DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE: DataGridClientProjectionStage = "filter"

const DATAGRID_CLIENT_PROJECTION_GRAPH = {
  nodes: {
    filter: {},
    sort: { dependsOn: ["filter"] },
    group: { dependsOn: ["sort"] },
    paginate: { dependsOn: ["group"] },
    visible: { dependsOn: ["paginate"] },
  } as const satisfies Record<DataGridClientProjectionStage, { dependsOn?: readonly DataGridClientProjectionStage[] }>,
}
const DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH = prepareProjectionStageGraph<DataGridClientProjectionStage>(
  DATAGRID_CLIENT_PROJECTION_GRAPH,
  {
    refreshEntryStage: DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE,
  },
)

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

export function createClientRowProjectionEngine<T>(): DataGridClientProjectionEngine<T> {
  const projection = createProjectionStageEngine<DataGridClientProjectionStage>({
    ...DATAGRID_CLIENT_PROJECTION_GRAPH,
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
    let filteredRowIds = new Set<DataGridRowId>(handlers.getCurrentFilteredRowIds())

    const stageExecutors: Readonly<Record<DataGridClientProjectionStage, (shouldRecompute: boolean) => boolean>> = {
      filter: (shouldRecompute: boolean) => {
        const filterResult = handlers.runFilterStage({
          sourceById,
          filterPredicate: shouldRecompute ? handlers.resolveFilterPredicate() : undefined,
          shouldRecompute,
        })
        filteredRowIds = new Set<DataGridRowId>(filterResult.filteredRowIds)
        return filterResult.recomputed
      },
      sort: (shouldRecompute: boolean) => {
        return handlers.runSortStage({
          sourceById,
          shouldRecompute,
        })
      },
      group: (shouldRecompute: boolean) => {
        return handlers.runGroupStage({
          sourceById,
          rowMatchesFilter: (row: DataGridRowNode<T>) => filteredRowIds.has(row.rowId),
          shouldRecompute,
        })
      },
      paginate: (shouldRecompute: boolean) => {
        return handlers.runPaginateStage({
          sourceById,
          shouldRecompute,
        })
      },
      visible: (shouldRecompute: boolean) => {
        return handlers.runVisibleStage({
          sourceById,
          shouldRecompute,
        })
      },
    }

    const meta = projection.recompute((stage: DataGridClientProjectionStage, shouldRecompute: boolean) => {
      return stageExecutors[stage](shouldRecompute)
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
  return expandProjectionStages(stages, DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH)
}
