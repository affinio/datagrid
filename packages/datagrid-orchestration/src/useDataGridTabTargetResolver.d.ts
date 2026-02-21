export interface DataGridTabTargetCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridTabTargetNextCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface UseDataGridTabTargetResolverOptions<TCoord extends DataGridTabTargetCoord> {
    resolveNavigableColumnIndexes: () => readonly number[];
    normalizeCellCoord: (next: DataGridTabTargetNextCoord) => TCoord | null;
}
export interface UseDataGridTabTargetResolverResult<TCoord extends DataGridTabTargetCoord> {
    resolveTabTarget: (current: TCoord, backwards: boolean) => TCoord | null;
}
export declare function useDataGridTabTargetResolver<TCoord extends DataGridTabTargetCoord>(options: UseDataGridTabTargetResolverOptions<TCoord>): UseDataGridTabTargetResolverResult<TCoord>;
//# sourceMappingURL=useDataGridTabTargetResolver.d.ts.map