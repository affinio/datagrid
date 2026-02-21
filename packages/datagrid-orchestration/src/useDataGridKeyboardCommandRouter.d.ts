export interface UseDataGridKeyboardCommandRouterOptions {
    isRangeMoving: () => boolean;
    isContextMenuVisible: () => boolean;
    closeContextMenu: () => void;
    focusViewport: () => void;
    openContextMenuFromCurrentCell: () => void;
    runHistoryAction: (direction: "undo" | "redo", trigger: "keyboard") => Promise<boolean>;
    copySelection: (trigger: "keyboard") => Promise<boolean>;
    pasteSelection: (trigger: "keyboard") => Promise<boolean>;
    cutSelection: (trigger: "keyboard") => Promise<boolean>;
    stopRangeMove: (commit: boolean) => void;
    setLastAction: (message: string) => void;
}
export interface UseDataGridKeyboardCommandRouterResult {
    dispatchKeyboardCommands: (event: KeyboardEvent) => boolean;
}
export declare function useDataGridKeyboardCommandRouter(options: UseDataGridKeyboardCommandRouterOptions): UseDataGridKeyboardCommandRouterResult;
//# sourceMappingURL=useDataGridKeyboardCommandRouter.d.ts.map