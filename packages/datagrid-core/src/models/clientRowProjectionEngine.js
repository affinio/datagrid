import { createProjectionStageEngine, } from "@affino/projection-engine";
import { DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH, DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE, expandClientProjectionStages as expandClientProjectionStagesFromGraph, } from "./projectionStages.js";
const DATAGRID_CLIENT_PROJECTION_STAGE_DEFINITIONS = {
    filter: {
        compute: (context, shouldRecompute) => {
            const filterResult = context.handlers.runFilterStage({
                sourceById: context.sourceById,
                filterPredicate: shouldRecompute ? context.handlers.resolveFilterPredicate() : undefined,
                shouldRecompute,
            });
            context.setFilteredRowIds(filterResult.filteredRowIds);
            return filterResult.recomputed;
        },
    },
    sort: {
        compute: (context, shouldRecompute) => {
            return context.handlers.runSortStage({
                sourceById: context.sourceById,
                shouldRecompute,
            });
        },
    },
    group: {
        compute: (context, shouldRecompute) => {
            return context.handlers.runGroupStage({
                sourceById: context.sourceById,
                rowMatchesFilter: (row) => context.getFilteredRowIds().has(row.rowId),
                shouldRecompute,
            });
        },
    },
    aggregate: {
        compute: (context, shouldRecompute) => {
            return context.handlers.runAggregateStage({
                sourceById: context.sourceById,
                shouldRecompute,
            });
        },
    },
    paginate: {
        compute: (context, shouldRecompute) => {
            return context.handlers.runPaginateStage({
                sourceById: context.sourceById,
                shouldRecompute,
            });
        },
    },
    visible: {
        compute: (context, shouldRecompute) => {
            return context.handlers.runVisibleStage({
                sourceById: context.sourceById,
                shouldRecompute,
            });
        },
    },
};
export function createClientRowProjectionEngine() {
    const projection = createProjectionStageEngine({
        nodes: DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH.nodes,
        preparedGraph: DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH,
        refreshEntryStage: DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE,
    });
    const recompute = (handlers, options = {}) => {
        if (!projection.hasDirtyStages()) {
            return;
        }
        const sourceById = handlers.buildSourceById();
        let filteredRowIds = handlers.getCurrentFilteredRowIds();
        const stageRuntimeContext = {
            sourceById,
            handlers,
            getFilteredRowIds: () => filteredRowIds,
            setFilteredRowIds: (rowIds) => {
                filteredRowIds = rowIds;
            },
        };
        const meta = projection.recompute((stage, shouldRecompute) => {
            return DATAGRID_CLIENT_PROJECTION_STAGE_DEFINITIONS[stage]
                .compute(stageRuntimeContext, shouldRecompute);
        }, options);
        if (!meta) {
            return;
        }
        handlers.finalizeProjectionRecompute(meta);
    };
    const recomputeFromStage = (stage, handlers, options = {}) => {
        projection.requestStages([stage]);
        recompute(handlers, options);
    };
    return {
        requestStages: projection.requestStages,
        requestRefreshPass: projection.requestRefreshPass,
        hasDirtyStages: projection.hasDirtyStages,
        recompute,
        recomputeFromStage,
        getStaleStages: projection.getStaleStages,
    };
}
export function expandClientProjectionStages(stages) {
    return expandClientProjectionStagesFromGraph(stages);
}
