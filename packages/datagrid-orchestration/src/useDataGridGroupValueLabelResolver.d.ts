export interface UseDataGridGroupValueLabelResolverOptions<TRow, TGroupKey extends string> {
    resolveCellValue: (row: TRow, groupKey: TGroupKey) => unknown;
    emptyLabel?: string;
    disabledGroupKeys?: readonly TGroupKey[];
}
export interface UseDataGridGroupValueLabelResolverResult<TRow, TGroupKey extends string> {
    resolveGroupValueLabel: (row: TRow, groupKey: TGroupKey) => string;
}
export declare function useDataGridGroupValueLabelResolver<TRow, TGroupKey extends string>(options: UseDataGridGroupValueLabelResolverOptions<TRow, TGroupKey>): UseDataGridGroupValueLabelResolverResult<TRow, TGroupKey>;
//# sourceMappingURL=useDataGridGroupValueLabelResolver.d.ts.map