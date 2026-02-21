export interface DataGridGroupMetaSnapshot {
    starts: Set<string>;
    values: Map<string, string>;
    counts: Map<string, number>;
    groups: number;
}
export interface UseDataGridGroupMetaOrchestrationOptions<TRow, TGroupByKey extends string> {
    rows: readonly TRow[];
    groupBy: TGroupByKey | "none";
    resolveRowId: (row: TRow) => string | number;
    resolveGroupValue: (row: TRow, groupBy: TGroupByKey) => string | null | undefined;
}
export declare function normalizeDataGridGroupValue(value: string | null | undefined): string;
export declare function useDataGridGroupMetaOrchestration<TRow, TGroupByKey extends string>(options: UseDataGridGroupMetaOrchestrationOptions<TRow, TGroupByKey>): DataGridGroupMetaSnapshot;
export declare function isDataGridGroupStartRow(snapshot: DataGridGroupMetaSnapshot, rowId: string | number): boolean;
export declare function resolveDataGridGroupBadgeText(snapshot: DataGridGroupMetaSnapshot, rowId: string | number): string;
export declare function resolveDataGridGroupBySummary<TGroupByKey extends string>(groupBy: TGroupByKey | "none"): string;
//# sourceMappingURL=useDataGridGroupMetaOrchestration.d.ts.map