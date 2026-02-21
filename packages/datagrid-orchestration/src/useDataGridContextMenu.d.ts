import type { DataGridContextMenuAction, DataGridContextMenuState, OpenDataGridContextMenuInput } from "./dataGridContextMenuContracts";
export interface UseDataGridContextMenuOptions {
    isColumnResizable?: (columnKey: string) => boolean;
    onBeforeOpen?: () => void;
}
export interface DataGridContextMenuKeyboardIntentInput {
    key: string;
    activeIndex: number;
    itemCount: number;
    shiftKey?: boolean;
}
export interface DataGridContextMenuKeyboardIntentResult {
    handled: boolean;
    nextIndex: number;
    shouldTrigger: boolean;
    shouldClose: boolean;
}
export interface DataGridContextMenuSnapshot {
    contextMenu: DataGridContextMenuState;
    actions: readonly DataGridContextMenuAction[];
}
export interface UseDataGridContextMenuResult {
    getSnapshot: () => DataGridContextMenuSnapshot;
    subscribe: (listener: (snapshot: DataGridContextMenuSnapshot) => void) => () => void;
    closeContextMenu: () => void;
    openContextMenu: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void;
}
export declare function resolveDataGridContextMenuKeyboardIntent(input: DataGridContextMenuKeyboardIntentInput): DataGridContextMenuKeyboardIntentResult;
export declare function useDataGridContextMenu(options?: UseDataGridContextMenuOptions): UseDataGridContextMenuResult;
//# sourceMappingURL=useDataGridContextMenu.d.ts.map