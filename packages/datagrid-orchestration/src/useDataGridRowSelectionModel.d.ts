export interface DataGridRowSelectionGesture {
    shiftKey?: boolean;
}
export interface UseDataGridRowSelectionModelOptions<TRow> {
    resolveFilteredRows: () => readonly TRow[];
    resolveFilteredRowIds?: () => readonly string[];
    resolveRowId: (row: TRow, index: number) => string;
    resolveAllRows?: () => readonly TRow[];
    initialSelection?: Iterable<string>;
    clearSelectionWhenSourceRowsEmpty?: boolean;
    onSelectionChange?: (nextSelection: ReadonlySet<string>) => void;
}
export interface UseDataGridRowSelectionModelResult {
    getSelection: () => ReadonlySet<string>;
    replaceSelection: (rowIds: Iterable<string>) => void;
    clearSelection: () => void;
    isSelected: (rowId: string) => boolean;
    toggleRowById: (rowId: string, selected?: boolean) => void;
    toggleRowAtFilteredIndex: (index: number, selected: boolean, gesture?: DataGridRowSelectionGesture) => void;
    applyShiftRange: (toIndex: number, selected: boolean) => void;
    toggleSelectAllFiltered: (selected: boolean) => void;
    setAnchorIndex: (index: number | null) => void;
    getAnchorIndex: () => number | null;
    reconcileWithRows: (allRows?: readonly unknown[]) => void;
}
export declare function useDataGridRowSelectionModel<TRow>(options: UseDataGridRowSelectionModelOptions<TRow>): UseDataGridRowSelectionModelResult;
//# sourceMappingURL=useDataGridRowSelectionModel.d.ts.map