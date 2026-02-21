import type { DataGridSortState } from "@affino/datagrid-core";
export interface DataGridGroupingSortSnapshot {
    effectiveSortModel: readonly DataGridSortState[];
    sortSummary: string;
}
export interface UseDataGridGroupingSortOrchestrationOptions<TGroupByKey extends string> {
    sortState: readonly DataGridSortState[];
    groupBy: TGroupByKey | "none";
}
export declare function withGroupingSortPriority<TGroupByKey extends string>(model: readonly DataGridSortState[], groupByKey: TGroupByKey | "none"): readonly DataGridSortState[];
export declare function resolveDataGridSortSummary(model: readonly DataGridSortState[]): string;
export declare function useDataGridGroupingSortOrchestration<TGroupByKey extends string>(options: UseDataGridGroupingSortOrchestrationOptions<TGroupByKey>): DataGridGroupingSortSnapshot;
//# sourceMappingURL=useDataGridGroupingSortOrchestration.d.ts.map