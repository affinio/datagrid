import { expandProjectionStages, prepareProjectionStageGraph, } from "@affino/projection-engine";
export const DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE = "filter";
export const DATAGRID_CLIENT_PROJECTION_STAGE_DEPENDENCIES = {
    filter: [],
    sort: ["filter"],
    group: ["sort"],
    aggregate: ["group"],
    paginate: ["aggregate"],
    visible: ["paginate"],
};
function buildProjectionGraph() {
    const nodes = Object.create(null);
    for (const stage of Object.keys(DATAGRID_CLIENT_PROJECTION_STAGE_DEPENDENCIES)) {
        nodes[stage] = {
            dependsOn: DATAGRID_CLIENT_PROJECTION_STAGE_DEPENDENCIES[stage],
        };
    }
    return { nodes };
}
export const DATAGRID_CLIENT_PROJECTION_GRAPH = buildProjectionGraph();
export const DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH = prepareProjectionStageGraph(DATAGRID_CLIENT_PROJECTION_GRAPH, {
    refreshEntryStage: DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE,
});
export const DATAGRID_CLIENT_ALL_PROJECTION_STAGES = [
    ...DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH.stageOrder,
];
export const DATAGRID_CLIENT_PATCH_STAGE_IDS = [
    "filter",
    "sort",
    "group",
    "aggregate",
];
export function expandClientProjectionStages(stages) {
    return expandProjectionStages(stages, DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH);
}
