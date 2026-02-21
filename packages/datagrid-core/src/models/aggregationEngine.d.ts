import type { DataGridAggOp, DataGridAggregationModel, DataGridRowNode } from "./rowModel.js";
export interface DataGridCompiledAggregationColumn<T = unknown> {
    key: string;
    op: DataGridAggOp;
    readValue: (row: DataGridRowNode<T>) => unknown;
    createState: () => unknown;
    add: (state: unknown, value: unknown, row: DataGridRowNode<T>) => void;
    merge?: (state: unknown, childState: unknown) => void;
    remove?: (state: unknown, value: unknown, row: DataGridRowNode<T>) => void;
    finalize: (state: unknown) => unknown;
}
export type DataGridIncrementalAggregationLeafContribution = Readonly<Record<string, unknown>>;
export type DataGridIncrementalAggregationGroupState = Record<string, unknown>;
export interface DataGridAggregationEngine<T = unknown> {
    setModel: (model: DataGridAggregationModel<T> | null) => void;
    getModel: () => DataGridAggregationModel<T> | null;
    getCompiledColumns: () => readonly DataGridCompiledAggregationColumn<T>[];
    isIncrementalAggregationSupported: () => boolean;
    createEmptyGroupState: () => DataGridIncrementalAggregationGroupState | null;
    createLeafContribution: (row: DataGridRowNode<T>) => DataGridIncrementalAggregationLeafContribution | null;
    applyContributionDelta: (groupState: DataGridIncrementalAggregationGroupState, previous: DataGridIncrementalAggregationLeafContribution | null, next: DataGridIncrementalAggregationLeafContribution | null) => void;
    finalizeGroupState: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>;
    computeAggregatesForLeaves: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown>;
    computeAggregatesForGroupedRows: (projectedRows: readonly DataGridRowNode<T>[]) => ReadonlyMap<string, Record<string, unknown>>;
}
export declare function createDataGridAggregationEngine<T>(initialModel?: DataGridAggregationModel<T> | null): DataGridAggregationEngine<T>;
//# sourceMappingURL=aggregationEngine.d.ts.map