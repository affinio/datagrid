import { type DataGridGroupBySpec, type DataGridGroupExpansionSnapshot, type DataGridRowNode } from "./rowModel.js";
export interface BuildGroupedRowsProjectionOptions<T> {
    inputRows: readonly DataGridRowNode<T>[];
    groupBy: DataGridGroupBySpec;
    expansionSnapshot: DataGridGroupExpansionSnapshot;
    readRowField: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown;
    normalizeText: (value: unknown) => string;
    normalizeLeafRow: (row: DataGridRowNode<T>) => DataGridRowNode<T>;
    groupValueCache?: Map<string, string>;
    groupValueCounters?: {
        hits: number;
        misses: number;
    };
    maxGroupValueCacheSize?: number;
}
export declare function buildGroupedRowsProjection<T>(options: BuildGroupedRowsProjectionOptions<T>): DataGridRowNode<T>[];
//# sourceMappingURL=groupProjectionController.d.ts.map