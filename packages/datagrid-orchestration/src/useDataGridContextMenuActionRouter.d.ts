import type { DataGridContextMenuActionId, DataGridContextMenuZone } from "./dataGridContextMenuContracts";
export interface DataGridContextMenuActionRouterState {
    zone: DataGridContextMenuZone;
    columnKey: string | null;
}
export interface UseDataGridContextMenuActionRouterOptions {
    resolveContextMenuState: () => DataGridContextMenuActionRouterState;
    runHeaderContextAction: (action: DataGridContextMenuActionId, columnKey: string) => boolean;
    copySelection: (trigger: "context-menu") => Promise<boolean>;
    pasteSelection: (trigger: "context-menu") => Promise<boolean>;
    cutSelection: (trigger: "context-menu") => Promise<boolean>;
    clearCurrentSelection: (trigger: "context-menu") => Promise<boolean>;
    closeContextMenu: () => void;
}
export interface UseDataGridContextMenuActionRouterResult {
    runContextMenuAction: (action: DataGridContextMenuActionId) => Promise<boolean>;
}
export declare function useDataGridContextMenuActionRouter(options: UseDataGridContextMenuActionRouterOptions): UseDataGridContextMenuActionRouterResult;
//# sourceMappingURL=useDataGridContextMenuActionRouter.d.ts.map