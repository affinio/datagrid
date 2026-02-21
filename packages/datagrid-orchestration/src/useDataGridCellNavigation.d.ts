export interface DataGridNavigationCellCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface UseDataGridCellNavigationOptions<TCoord extends DataGridNavigationCellCoord = DataGridNavigationCellCoord> {
    resolveCurrentCellCoord: () => TCoord | null;
    resolveTabTarget: (current: TCoord, backwards: boolean) => TCoord | null;
    normalizeCellCoord: (coord: TCoord) => TCoord | null;
    getAdjacentNavigableColumnIndex: (columnIndex: number, direction: 1 | -1) => number;
    getFirstNavigableColumnIndex: () => number;
    getLastNavigableColumnIndex: () => number;
    getLastRowIndex: () => number;
    resolveStepRows: () => number;
    closeContextMenu: () => void;
    clearCellSelection: () => void;
    setLastAction: (message: string) => void;
    applyCellSelection: (nextCoord: TCoord, extend: boolean, fallbackAnchor?: TCoord) => void;
}
export interface UseDataGridCellNavigationResult {
    dispatchNavigation: (event: KeyboardEvent) => boolean;
}
export declare function useDataGridCellNavigation<TCoord extends DataGridNavigationCellCoord = DataGridNavigationCellCoord>(options: UseDataGridCellNavigationOptions<TCoord>): UseDataGridCellNavigationResult;
//# sourceMappingURL=useDataGridCellNavigation.d.ts.map