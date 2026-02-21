import type { GridSelectionPoint, GridSelectionRange } from "./selectionState";
export interface GridSelectionSnapshotRange<TRowKey = unknown> {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
    startRowId: TRowKey | null;
    endRowId: TRowKey | null;
    anchor: GridSelectionPoint<TRowKey>;
    focus: GridSelectionPoint<TRowKey>;
}
export interface GridSelectionSnapshot<TRowKey = unknown> {
    ranges: GridSelectionSnapshotRange<TRowKey>[];
    activeRangeIndex: number;
    activeCell: GridSelectionPoint<TRowKey> | null;
}
export type DataGridSelectionSnapshotRange<TRowKey = unknown> = GridSelectionSnapshotRange<TRowKey>;
export type DataGridSelectionSnapshot<TRowKey = unknown> = GridSelectionSnapshot<TRowKey>;
export interface CreateSelectionSnapshotOptions<TRowKey = unknown> {
    ranges: readonly GridSelectionRange<TRowKey>[];
    activeRangeIndex: number;
    selectedPoint: GridSelectionPoint<TRowKey> | null;
    getRowIdByIndex?: (rowIndex: number) => TRowKey | null;
}
export declare function createSelectionSnapshot<TRowKey = unknown>(options: CreateSelectionSnapshotOptions<TRowKey>): GridSelectionSnapshot<TRowKey>;
export declare function selectionSnapshotSignature<TRowKey = unknown>(snapshot: GridSelectionSnapshot<TRowKey>): string;
//# sourceMappingURL=snapshot.d.ts.map