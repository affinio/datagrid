import type { DataGridInlineEditorMode } from "./useDataGridInlineEditOrchestration";
export interface DataGridInlineEditorNavigationColumnLike {
    key: string;
}
export interface DataGridInlineEditorNavigationCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridInlineEditorNavigationTarget<TColumnKey extends string> {
    rowId: string;
    columnKey: TColumnKey;
    rowIndex: number;
    columnIndex: number;
}
export interface UseDataGridInlineEditorTargetNavigationOptions<TRow, TColumnKey extends string, TColumn extends DataGridInlineEditorNavigationColumnLike = DataGridInlineEditorNavigationColumnLike> {
    resolveRows: () => readonly TRow[];
    resolveOrderedColumns: () => readonly TColumn[];
    resolveRowId: (row: TRow) => string;
    resolveColumnIndex: (columnKey: string) => number;
    isEditableColumn: (columnKey: string) => columnKey is TColumnKey;
    isSelectColumn?: (columnKey: string) => boolean;
    applyCellSelection: (coord: DataGridInlineEditorNavigationCoord, extend: boolean) => void;
    beginInlineEdit: (row: TRow, columnKey: TColumnKey, mode: DataGridInlineEditorMode, openPicker?: boolean) => boolean;
}
export interface UseDataGridInlineEditorTargetNavigationResult<TColumnKey extends string> {
    resolveNextEditableTarget: (rowId: string, columnKey: string, direction: 1 | -1) => DataGridInlineEditorNavigationTarget<TColumnKey> | null;
    focusInlineEditorTarget: (target: DataGridInlineEditorNavigationTarget<TColumnKey>) => boolean;
}
export declare function useDataGridInlineEditorTargetNavigation<TRow, TColumnKey extends string, TColumn extends DataGridInlineEditorNavigationColumnLike = DataGridInlineEditorNavigationColumnLike>(options: UseDataGridInlineEditorTargetNavigationOptions<TRow, TColumnKey, TColumn>): UseDataGridInlineEditorTargetNavigationResult<TColumnKey>;
//# sourceMappingURL=useDataGridInlineEditorTargetNavigation.d.ts.map