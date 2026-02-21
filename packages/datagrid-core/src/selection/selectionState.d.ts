/**
 * Pure selection geometry helpers shared between framework adapters.
 * Encapsulates rectangular math so higher-level composables can focus on
 * wiring events and state.
 */
export interface Anchor {
    rowIndex: number;
    colIndex: number;
}
export interface SelectionArea {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
}
export interface Range extends SelectionArea {
    anchor: Anchor;
    focus: Anchor;
}
export interface SelectionGrid {
    rowCount: number;
    colCount: number;
}
export interface GridSelectionPointLike<TRowKey = unknown> {
    rowIndex: number;
    colIndex: number;
    rowId?: TRowKey | null;
}
export interface GridSelectionPoint<TRowKey = unknown> extends GridSelectionPointLike<TRowKey> {
    rowId: TRowKey | null;
}
export interface GridSelectionRangeInput<TRowKey = unknown> extends SelectionArea {
    anchor?: GridSelectionPointLike<TRowKey>;
    focus?: GridSelectionPointLike<TRowKey>;
}
export interface GridSelectionRange<TRowKey = unknown> extends SelectionArea {
    anchor: GridSelectionPoint<TRowKey>;
    focus: GridSelectionPoint<TRowKey>;
    startRowId?: TRowKey | null;
    endRowId?: TRowKey | null;
}
export interface GridSelectionContext<TRowKey = unknown> {
    grid: SelectionGrid;
    getRowIdByIndex?: (rowIndex: number) => TRowKey | null;
}
export interface GridSelectionFlattenedRow<TRowKey = unknown> {
    rowId: TRowKey | null;
    isGroup?: boolean;
    level?: number;
}
export interface CreateGridSelectionContextFromFlattenedRowsOptions<TRowKey = unknown> {
    rows: readonly GridSelectionFlattenedRow<TRowKey>[];
    colCount: number;
}
export declare function createGridSelectionContextFromFlattenedRows<TRowKey = unknown>(options: CreateGridSelectionContextFromFlattenedRowsOptions<TRowKey>): GridSelectionContext<TRowKey>;
export interface GridSelectionGroupPolicyOptions<TRowKey = unknown> {
    rows: readonly GridSelectionFlattenedRow<TRowKey>[];
    groupSelectsChildren?: boolean;
}
export declare function applyGroupSelectionPolicy<TRowKey = unknown>(range: GridSelectionRange<TRowKey>, options: GridSelectionGroupPolicyOptions<TRowKey>): GridSelectionRange<TRowKey>;
export declare function clampGridSelectionPoint<TRowKey = unknown>(point: GridSelectionPointLike<TRowKey>, context: GridSelectionContext<TRowKey>): GridSelectionPoint<TRowKey>;
export declare function createGridSelectionRange<TRowKey = unknown>(anchor: GridSelectionPointLike<TRowKey>, focus: GridSelectionPointLike<TRowKey>, context: GridSelectionContext<TRowKey>): GridSelectionRange<TRowKey>;
export declare function normalizeGridSelectionRange<TRowKey = unknown>(range: GridSelectionRange<TRowKey>, context: GridSelectionContext<TRowKey>): GridSelectionRange<TRowKey> | null;
export declare function createGridSelectionRangeFromInput<TRowKey = unknown>(input: GridSelectionRangeInput<TRowKey>, context: GridSelectionContext<TRowKey>): GridSelectionRange<TRowKey>;
export declare function clampSelectionArea<TRowKey = unknown>(area: SelectionArea, context: GridSelectionContext<TRowKey>): SelectionArea | null;
export declare function resolveSelectionBounds<TRowKey = unknown>(range: GridSelectionRange<TRowKey> | null, context: GridSelectionContext<TRowKey>, fallbackToAll?: boolean): SelectionArea | null;
export declare function mergeRanges(ranges: SelectionArea[]): SelectionArea[];
export declare function addRange(ranges: SelectionArea[], next: SelectionArea): SelectionArea[];
export declare function removeRange(ranges: SelectionArea[], target: SelectionArea): SelectionArea[];
export declare function isCellSelected(ranges: SelectionArea[], rowIndex: number, colIndex: number): boolean;
export declare function rangesFromSelection(ranges: Range[]): SelectionArea[];
export declare function selectionFromAreas(areas: SelectionArea[], createAnchor: (rowIndex: number, colIndex: number) => Anchor): Range[];
//# sourceMappingURL=selectionState.d.ts.map