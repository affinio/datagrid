import {
  expandProjectionStages,
  prepareProjectionStageGraph,
  type ProjectionStageGraph,
} from "@affino/projection-engine"
import type { DataGridProjectionStage } from "./rowModel.js"

export type DataGridClientProjectionStage = DataGridProjectionStage
export type DataGridClientPatchStage = Extract<DataGridClientProjectionStage, "filter" | "sort" | "group">

export const DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE: DataGridClientProjectionStage = "filter"

export const DATAGRID_CLIENT_PROJECTION_STAGE_DEPENDENCIES: Readonly<Record<
  DataGridClientProjectionStage,
  readonly DataGridClientProjectionStage[]
>> = {
  filter: [],
  sort: ["filter"],
  group: ["sort"],
  paginate: ["group"],
  visible: ["paginate"],
}

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
  "filter",
  "sort",
  "group",
]

export function expandClientProjectionStages(
  stages: readonly DataGridClientProjectionStage[],
): ReadonlySet<DataGridClientProjectionStage> {
  return expandProjectionStages(stages, DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH)
}
