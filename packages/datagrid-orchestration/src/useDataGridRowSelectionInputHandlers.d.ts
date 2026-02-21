export interface UseDataGridRowSelectionInputHandlersOptions {
    toggleSelectAllVisible: (checked: boolean) => void;
    toggleRowSelection: (rowId: string, checked: boolean) => void;
}
export interface UseDataGridRowSelectionInputHandlersResult {
    onSelectAllChange: (event: Event) => void;
    onRowSelectChange: (rowId: string, event: Event) => void;
}
export declare function useDataGridRowSelectionInputHandlers(options: UseDataGridRowSelectionInputHandlersOptions): UseDataGridRowSelectionInputHandlersResult;
//# sourceMappingURL=useDataGridRowSelectionInputHandlers.d.ts.map