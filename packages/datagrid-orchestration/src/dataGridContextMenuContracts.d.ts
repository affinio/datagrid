export type DataGridContextMenuZone = "cell" | "range" | "header";
export type DataGridContextMenuActionId = "copy" | "paste" | "cut" | "clear" | "sort-asc" | "sort-desc" | "sort-clear" | "filter" | "auto-size";
export interface DataGridContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    zone: DataGridContextMenuZone;
    columnKey: string | null;
    rowId: string | null;
}
export interface DataGridContextMenuAction {
    id: DataGridContextMenuActionId;
    label: string;
}
export interface OpenDataGridContextMenuInput {
    zone: DataGridContextMenuZone;
    columnKey?: string | null;
    rowId?: string | null;
}
//# sourceMappingURL=dataGridContextMenuContracts.d.ts.map