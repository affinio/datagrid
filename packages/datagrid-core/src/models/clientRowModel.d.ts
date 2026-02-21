import { type DataGridPaginationInput, type DataGridFilterSnapshot, type DataGridSortAndFilterModelInput, type DataGridAggregationModel, type DataGridGroupBySpec, type DataGridRowId, type DataGridRowIdResolver, type DataGridRowNodeInput, type DataGridRowModel, type DataGridSortState, type DataGridTreeDataSpec } from "./rowModel.js";
import { type DataGridClientPerformanceMode, type DataGridProjectionPolicy } from "./projectionPolicy.js";
import type { DataGridFieldDependency } from "./dependencyGraph.js";
export interface CreateClientRowModelOptions<T> {
    rows?: readonly DataGridRowNodeInput<T>[];
    resolveRowId?: DataGridRowIdResolver<T>;
    initialTreeData?: DataGridTreeDataSpec<T> | null;
    initialSortModel?: readonly DataGridSortState[];
    initialFilterModel?: DataGridFilterSnapshot | null;
    initialGroupBy?: DataGridGroupBySpec | null;
    initialAggregationModel?: DataGridAggregationModel<T> | null;
    initialPagination?: DataGridPaginationInput | null;
    performanceMode?: DataGridClientPerformanceMode;
    projectionPolicy?: DataGridProjectionPolicy;
    fieldDependencies?: readonly DataGridFieldDependency[];
}
export interface DataGridClientRowReorderInput {
    fromIndex: number;
    toIndex: number;
    count?: number;
}
export interface DataGridClientRowPatch<T = unknown> {
    rowId: DataGridRowId;
    data: Partial<T>;
}
export interface DataGridClientRowPatchOptions {
    /**
     * `false` by default for Excel-like edit flow: keep current projection order
     * until explicit reapply (`refresh`) or recompute-enabled patch.
     */
    recomputeSort?: boolean;
    /**
     * `false` by default for Excel-like edit flow: keep current filter membership
     * until explicit reapply (`refresh`) or recompute-enabled patch.
     */
    recomputeFilter?: boolean;
    /**
     * `false` by default for Excel-like edit flow: keep current grouping/aggregation
     * layout until explicit reapply (`refresh`) or recompute-enabled patch.
     */
    recomputeGroup?: boolean;
    emit?: boolean;
}
export interface ClientRowModel<T> extends DataGridRowModel<T> {
    setRows(rows: readonly DataGridRowNodeInput<T>[]): void;
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void;
    patchRows(updates: readonly DataGridClientRowPatch<T>[], options?: DataGridClientRowPatchOptions): void;
    reorderRows(input: DataGridClientRowReorderInput): boolean;
    getDerivedCacheDiagnostics(): DataGridClientRowModelDerivedCacheDiagnostics;
}
export interface DataGridClientRowModelDerivedCacheDiagnostics {
    revisions: {
        row: number;
        sort: number;
        filter: number;
        group: number;
    };
    filterPredicateHits: number;
    filterPredicateMisses: number;
    sortValueHits: number;
    sortValueMisses: number;
    groupValueHits: number;
    groupValueMisses: number;
}
export declare function createClientRowModel<T>(options?: CreateClientRowModelOptions<T>): ClientRowModel<T>;
//# sourceMappingURL=clientRowModel.d.ts.map