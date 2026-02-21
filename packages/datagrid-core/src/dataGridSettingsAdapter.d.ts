import type { DataGridSortState } from "./types/sort";
import type { FilterStateSnapshot } from "./types/filters";
export type DataGridPinPosition = "left" | "right" | "none";
export interface DataGridColumnStateSnapshot {
    order: string[];
    visibility: Record<string, boolean>;
    widths: Record<string, number>;
    pinning: Record<string, DataGridPinPosition>;
}
export interface DataGridGroupState {
    columns: string[];
    expansion: Record<string, boolean>;
}
export interface DataGridSettingsAdapter {
    setColumnState(tableId: string, state: DataGridColumnStateSnapshot | null): void;
    getColumnState(tableId: string): DataGridColumnStateSnapshot | null;
    setColumnWidth(tableId: string, columnKey: string, width: number): void;
    getColumnWidth(tableId: string, columnKey: string): number | undefined;
    setSortState(tableId: string, state: DataGridSortState[]): void;
    getSortState(tableId: string): DataGridSortState[] | undefined;
    setFilterSnapshot(tableId: string, snapshot: FilterStateSnapshot | null): void;
    getFilterSnapshot(tableId: string): FilterStateSnapshot | null;
    setPinState(tableId: string, columnKey: string, position: DataGridPinPosition): void;
    getPinState(tableId: string): Record<string, DataGridPinPosition> | null;
    setGroupState(tableId: string, columns: string[], expansion?: Record<string, boolean>): void;
    getGroupState(tableId: string): DataGridGroupState | null;
    clearTable(tableId: string): void;
}
export declare function createInMemoryDataGridSettingsAdapter(): DataGridSettingsAdapter;
//# sourceMappingURL=dataGridSettingsAdapter.d.ts.map