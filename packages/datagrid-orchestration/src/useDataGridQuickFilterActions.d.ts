export interface UseDataGridQuickFilterActionsOptions {
    resolveQuery: () => string;
    setQuery: (value: string) => void;
    setLastAction: (message: string) => void;
}
export interface UseDataGridQuickFilterActionsResult {
    clearQuickFilter: () => void;
}
export declare function useDataGridQuickFilterActions(options: UseDataGridQuickFilterActionsOptions): UseDataGridQuickFilterActionsResult;
//# sourceMappingURL=useDataGridQuickFilterActions.d.ts.map