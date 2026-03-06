import {
  expandProjectionStages,
  prepareProjectionStageGraph,
  type ProjectionStageGraph,
} from "@affino/projection-engine"
import type { DataGridProjectionInvalidationReason, DataGridProjectionStage } from "./rowModel.js"
import { DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP } from "./clientRowProjectionStageRegistry.js"

export type DataGridClientProjectionStage = DataGridProjectionStage
export type DataGridClientPatchStage = Extract<
  DataGridClientProjectionStage,
  "compute" | "filter" | "sort" | "group" | "pivot" | "aggregate"
>

export const DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE: DataGridClientProjectionStage = "compute"

export const DATAGRID_CLIENT_PROJECTION_STAGE_DEPENDENCIES: Readonly<Record<
  DataGridClientProjectionStage,
  readonly DataGridClientProjectionStage[]
>> = Object.freeze(
  (Object.keys(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP) as DataGridClientProjectionStage[])
    .reduce((acc, stage) => {
      acc[stage] = DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP[stage].dependsOn
      return acc
    }, Object.create(null) as Record<DataGridClientProjectionStage, readonly DataGridClientProjectionStage[]>),
)

function buildProjectionGraph(): ProjectionStageGraph<DataGridClientProjectionStage> {
  const nodes = Object.create(null) as Record<
    DataGridClientProjectionStage,
    { dependsOn?: readonly DataGridClientProjectionStage[] }
  >
  for (const stage of Object.keys(DATAGRID_CLIENT_PROJECTION_STAGE_DEPENDENCIES) as DataGridClientProjectionStage[]) {
    nodes[stage] = {
      dependsOn: DATAGRID_CLIENT_PROJECTION_STAGE_DEPENDENCIES[stage],
    }
  }
  return { nodes }
}

export const DATAGRID_CLIENT_PROJECTION_GRAPH = buildProjectionGraph()

export const DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH = prepareProjectionStageGraph<DataGridClientProjectionStage>(
  DATAGRID_CLIENT_PROJECTION_GRAPH,
  {
    refreshEntryStage: DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE,
  },
)

export const DATAGRID_CLIENT_ALL_PROJECTION_STAGES: readonly DataGridClientProjectionStage[] = [
  ...DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH.stageOrder,
]

export const DATAGRID_CLIENT_PATCH_STAGE_IDS: readonly DataGridClientPatchStage[] = [
  "compute",
  "filter",
  "sort",
  "group",
  "pivot",
  "aggregate",
]

export const DATAGRID_CLIENT_PROJECTION_INVALIDATION_ROOTS: Readonly<Record<
  DataGridProjectionInvalidationReason,
  readonly DataGridClientProjectionStage[]
>> = {
  rowsChanged: ["compute"],
  rowsPatched: ["compute"],
  computedChanged: ["compute"],
  filterChanged: ["filter"],
  sortChanged: ["sort"],
  groupChanged: ["group"],
  groupExpansionChanged: ["group"],
  pivotChanged: ["pivot"],
  aggregationChanged: ["aggregate"],
  paginationChanged: ["paginate"],
  manualRefresh: ["compute"],
}

export function expandClientProjectionStages(
  stages: readonly DataGridClientProjectionStage[],
): ReadonlySet<DataGridClientProjectionStage> {
  return expandProjectionStages(stages, DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH)
}

export function resolveClientProjectionInvalidationStages(
  reasons: readonly DataGridProjectionInvalidationReason[],
): readonly DataGridClientProjectionStage[] {
  const rootStages: DataGridClientProjectionStage[] = []
  for (const reason of reasons) {
    const roots = DATAGRID_CLIENT_PROJECTION_INVALIDATION_ROOTS[reason]
    if (!roots) {
      continue
    }
    for (const rootStage of roots) {
      rootStages.push(rootStage)
    }
  }
  const expanded = expandClientProjectionStages(rootStages)
  return DATAGRID_CLIENT_ALL_PROJECTION_STAGES.filter(stage => expanded.has(stage))
}
