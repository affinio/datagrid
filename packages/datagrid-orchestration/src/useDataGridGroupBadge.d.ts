export interface UseDataGridGroupBadgeOptions<TRow> {
    resolveRowId: (row: TRow) => string;
    isGroupedByColumn: (columnKey: string) => boolean;
    isGroupStartRowId: (rowId: string) => boolean;
    resolveGroupBadgeTextByRowId: (rowId: string) => string;
}
export interface UseDataGridGroupBadgeResult<TRow> {
    isGroupStartRow: (row: TRow) => boolean;
    shouldShowGroupBadge: (row: TRow, columnKey: string) => boolean;
    resolveGroupBadgeText: (row: TRow) => string;
}
export declare function useDataGridGroupBadge<TRow>(options: UseDataGridGroupBadgeOptions<TRow>): UseDataGridGroupBadgeResult<TRow>;
//# sourceMappingURL=useDataGridGroupBadge.d.ts.map