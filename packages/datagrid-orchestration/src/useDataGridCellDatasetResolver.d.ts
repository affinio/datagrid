export interface DataGridDatasetCellCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface UseDataGridCellDatasetResolverOptions<TRow, TCoord extends DataGridDatasetCellCoord = DataGridDatasetCellCoord> {
    resolveRows: () => readonly TRow[];
    resolveRowId: (row: TRow) => string;
    resolveColumnIndex: (columnKey: string) => number;
    normalizeCellCoord: (coord: TCoord) => TCoord | null;
}
export interface UseDataGridCellDatasetResolverResult<TCoord extends DataGridDatasetCellCoord = DataGridDatasetCellCoord> {
    resolveRowIndexById: (rowId: string) => number;
    resolveCellCoordFromDataset: (rowId: string, columnKey: string) => TCoord | null;
}
export declare function useDataGridCellDatasetResolver<TRow, TCoord extends DataGridDatasetCellCoord = DataGridDatasetCellCoord>(options: UseDataGridCellDatasetResolverOptions<TRow, TCoord>): UseDataGridCellDatasetResolverResult<TCoord>;
//# sourceMappingURL=useDataGridCellDatasetResolver.d.ts.map