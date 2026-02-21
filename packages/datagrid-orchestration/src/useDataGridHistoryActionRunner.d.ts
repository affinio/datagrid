export interface UseDataGridHistoryActionRunnerOptions {
    hasInlineEditor: () => boolean;
    commitInlineEdit: () => void;
    closeContextMenu: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>;
    setLastAction: (message: string) => void;
    onError?: (direction: "undo" | "redo", error: unknown) => void;
}
export interface UseDataGridHistoryActionRunnerResult {
    runHistoryAction: (direction: "undo" | "redo", trigger: "keyboard" | "control") => Promise<boolean>;
}
export declare function useDataGridHistoryActionRunner(options: UseDataGridHistoryActionRunnerOptions): UseDataGridHistoryActionRunnerResult;
//# sourceMappingURL=useDataGridHistoryActionRunner.d.ts.map