import type { ServerRowModel } from "../serverRowModel/serverRowModel";
import { type DataGridRowIdResolver, type DataGridFilterSnapshot, type DataGridGroupBySpec, type DataGridPaginationInput, type DataGridRowModel, type DataGridSortState } from "./rowModel.js";
export interface CreateServerBackedRowModelOptions<T> {
    source: ServerRowModel<T>;
    resolveRowId?: DataGridRowIdResolver<T>;
    initialSortModel?: readonly DataGridSortState[];
    initialFilterModel?: DataGridFilterSnapshot | null;
    initialGroupBy?: DataGridGroupBySpec | null;
    initialPagination?: DataGridPaginationInput | null;
    rowCacheLimit?: number;
    warmupBlockStep?: number;
}
export interface ServerBackedRowModel<T> extends DataGridRowModel<T> {
    readonly source: ServerRowModel<T>;
    syncFromSource(): void;
}
export declare function createServerBackedRowModel<T>(options: CreateServerBackedRowModelOptions<T>): ServerBackedRowModel<T>;
//# sourceMappingURL=serverBackedRowModel.d.ts.map