import type { DataGridRowId } from "@affino/datagrid-core";
export interface DataGridCellRefreshOptions {
    immediate?: boolean;
    reason?: string;
}
export interface DataGridCellRefreshRange {
    rowKey: DataGridRowId;
    columnKeys: readonly string[];
}
export interface UseDataGridCellRefreshBatcherOptions {
    immediate?: boolean;
    defaultOptions?: DataGridCellRefreshOptions;
    maxBatchSize?: number;
    frameBudgetMs?: number;
    onBatchFlush?: (rangesCount: number, cellsCount: number) => void;
}
export interface UseDataGridCellRefreshBatcherResult {
    queueByRowKeys: (rowKeys: readonly DataGridRowId[], columnKeys: readonly string[], options?: DataGridCellRefreshOptions) => void;
    queueByRanges: (ranges: readonly DataGridCellRefreshRange[], options?: DataGridCellRefreshOptions) => void;
    flush: () => void;
    dispose: () => void;
}
interface RefreshApi {
    refreshCellsByRanges: (ranges: readonly DataGridCellRefreshRange[], options?: DataGridCellRefreshOptions) => void;
}
export declare function useDataGridCellRefreshBatcher(api: RefreshApi, options?: UseDataGridCellRefreshBatcherOptions): UseDataGridCellRefreshBatcherResult;
export {};
//# sourceMappingURL=useDataGridCellRefreshBatcher.d.ts.map