export function createClientRowRuntimeStateStore() {
    const state = {
        rows: [],
        filteredRowsProjection: [],
        sortedRowsProjection: [],
        groupedRowsProjection: [],
        aggregatedRowsProjection: [],
        paginatedRowsProjection: [],
        revision: 0,
        rowRevision: 0,
        sortRevision: 0,
        filterRevision: 0,
        groupRevision: 0,
        projectionCycleVersion: 0,
        projectionRecomputeVersion: 0,
    };
    return {
        state,
        bumpRowRevision: () => {
            state.rowRevision += 1;
            return state.rowRevision;
        },
        bumpSortRevision: () => {
            state.sortRevision += 1;
            return state.sortRevision;
        },
        bumpFilterRevision: () => {
            state.filterRevision += 1;
            return state.filterRevision;
        },
        bumpGroupRevision: () => {
            state.groupRevision += 1;
            return state.groupRevision;
        },
        commitProjectionCycle: (hadActualRecompute) => {
            state.projectionCycleVersion += 1;
            if (hadActualRecompute) {
                state.projectionRecomputeVersion += 1;
            }
            state.revision += 1;
            return state.revision;
        },
        getProjectionDiagnostics: (getStaleStages) => {
            return {
                version: state.projectionCycleVersion,
                cycleVersion: state.projectionCycleVersion,
                recomputeVersion: state.projectionRecomputeVersion,
                staleStages: getStaleStages(),
            };
        },
    };
}
