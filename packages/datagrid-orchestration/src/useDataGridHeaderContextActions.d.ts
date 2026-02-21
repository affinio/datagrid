import type { DataGridContextMenuActionId } from "./dataGridContextMenuContracts";
export interface UseDataGridHeaderContextActionsOptions {
    isSortableColumn: (columnKey: string) => boolean;
    applyExplicitSort: (columnKey: string, direction: "asc" | "desc" | null) => void;
    openColumnFilter: (columnKey: string) => void;
    estimateColumnAutoWidth: (columnKey: string) => number;
    setColumnWidth: (columnKey: string, width: number) => void;
    closeContextMenu: () => void;
    setLastAction: (message: string) => void;
}
export interface UseDataGridHeaderContextActionsResult {
    runHeaderContextAction: (action: DataGridContextMenuActionId, columnKey: string) => boolean;
}
export declare function useDataGridHeaderContextActions(options: UseDataGridHeaderContextActionsOptions): UseDataGridHeaderContextActionsResult;
//# sourceMappingURL=useDataGridHeaderContextActions.d.ts.map