import type { UiTableSortState } from "./types/sort";
import type { FilterStateSnapshot } from "./types/filters";
export type UiTablePinPosition = "left" | "right" | "none";
export interface UiTableGroupState {
    columns: string[];
    expansion: Record<string, boolean>;
}
export interface UiTableSettingsAdapter {
    setColumnWidth(tableId: string, columnKey: string, width: number): void;
    getColumnWidth(tableId: string, columnKey: string): number | undefined;
    setSortState(tableId: string, state: UiTableSortState[]): void;
    getSortState(tableId: string): UiTableSortState[] | undefined;
    setFilterSnapshot(tableId: string, snapshot: FilterStateSnapshot | null): void;
    getFilterSnapshot(tableId: string): FilterStateSnapshot | null;
    setPinState(tableId: string, columnKey: string, position: UiTablePinPosition): void;
    getPinState(tableId: string): Record<string, UiTablePinPosition> | null;
    setGroupState(tableId: string, columns: string[], expansion?: Record<string, boolean>): void;
    getGroupState(tableId: string): UiTableGroupState | null;
    clearTable(tableId: string): void;
}
export declare function createInMemoryTableSettingsAdapter(): UiTableSettingsAdapter;
//# sourceMappingURL=tableSettingsAdapter.d.ts.map