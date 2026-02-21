import { type DataGridPaginationInput, type DataGridFilterSnapshot, type DataGridGroupBySpec, type DataGridRowIdResolver, type DataGridRowModel, type DataGridSortState, type DataGridViewportRange } from "./rowModel.js";
import type { DataGridDataSource, DataGridDataSourceBackpressureDiagnostics } from "./dataSourceProtocol.js";
export interface CreateDataSourceBackedRowModelOptions<T = unknown> {
    dataSource: DataGridDataSource<T>;
    resolveRowId?: DataGridRowIdResolver<T>;
    initialSortModel?: readonly DataGridSortState[];
    initialFilterModel?: DataGridFilterSnapshot | null;
    initialGroupBy?: DataGridGroupBySpec | null;
    initialPagination?: DataGridPaginationInput | null;
    initialTotal?: number;
    rowCacheLimit?: number;
}
export interface DataSourceBackedRowModel<T = unknown> extends DataGridRowModel<T> {
    readonly dataSource: DataGridDataSource<T>;
    invalidateRange(range: DataGridViewportRange): void;
    invalidateAll(): void;
    getBackpressureDiagnostics(): DataGridDataSourceBackpressureDiagnostics;
}
export declare function createDataSourceBackedRowModel<T = unknown>(options: CreateDataSourceBackedRowModelOptions<T>): DataSourceBackedRowModel<T>;
//# sourceMappingURL=dataSourceBackedRowModel.d.ts.map