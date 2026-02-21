import type { DataGridProjectionDiagnostics, DataGridProjectionStage, DataGridRowNode } from "./rowModel.js";
export interface DataGridClientRowRuntimeState<T> {
    rows: DataGridRowNode<T>[];
    filteredRowsProjection: DataGridRowNode<T>[];
    sortedRowsProjection: DataGridRowNode<T>[];
    groupedRowsProjection: DataGridRowNode<T>[];
    aggregatedRowsProjection: DataGridRowNode<T>[];
    paginatedRowsProjection: DataGridRowNode<T>[];
    revision: number;
    rowRevision: number;
    sortRevision: number;
    filterRevision: number;
    groupRevision: number;
    projectionCycleVersion: number;
    projectionRecomputeVersion: number;
}
export interface DataGridClientRowRuntimeStateStore<T> {
    state: DataGridClientRowRuntimeState<T>;
    bumpRowRevision: () => number;
    bumpSortRevision: () => number;
    bumpFilterRevision: () => number;
    bumpGroupRevision: () => number;
    commitProjectionCycle: (hadActualRecompute: boolean) => number;
    getProjectionDiagnostics: (getStaleStages: () => readonly DataGridProjectionStage[]) => DataGridProjectionDiagnostics;
}
export declare function createClientRowRuntimeStateStore<T>(): DataGridClientRowRuntimeStateStore<T>;
//# sourceMappingURL=clientRowRuntimeStateStore.d.ts.map