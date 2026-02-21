export interface DataGridCellCoordNormalizerCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridCellCoordNormalizerVirtualWindow {
    rowStart?: number;
    rowEnd?: number;
    rowTotal: number;
    colStart?: number;
    colEnd?: number;
    colTotal: number;
    overscan?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
}
export interface UseDataGridCellCoordNormalizerOptions {
    resolveVirtualWindow: () => DataGridCellCoordNormalizerVirtualWindow | null | undefined;
}
export interface UseDataGridCellCoordNormalizerResult<TCoord extends DataGridCellCoordNormalizerCoord = DataGridCellCoordNormalizerCoord> {
    normalizeCellCoordBase: (coord: TCoord) => TCoord | null;
}
export declare function useDataGridCellCoordNormalizer<TCoord extends DataGridCellCoordNormalizerCoord = DataGridCellCoordNormalizerCoord>(options: UseDataGridCellCoordNormalizerOptions): UseDataGridCellCoordNormalizerResult<TCoord>;
//# sourceMappingURL=useDataGridCellCoordNormalizer.d.ts.map