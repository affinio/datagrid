export interface UseDataGridEnumTriggerOptions<TRow, TCoord, TData> {
    isEnumColumn: (columnKey: string) => boolean;
    isInlineEditorOpen: () => boolean;
    isDragSelecting: () => boolean;
    isFillDragging: () => boolean;
    isActiveCell: (row: TRow, columnKey: string) => boolean;
    resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null;
    applyCellSelection: (coord: TCoord, extend: boolean) => void;
    resolveRowData: (row: TRow) => TData;
    beginInlineEdit: (rowData: TData, columnKey: string, mode: "select", openPicker: boolean) => void;
}
export interface UseDataGridEnumTriggerResult<TRow> {
    shouldShowEnumTrigger: (row: TRow, columnKey: string) => boolean;
    onEnumTriggerMouseDown: (row: TRow, columnKey: string, event: MouseEvent) => boolean;
}
export declare function useDataGridEnumTrigger<TRow, TCoord, TData>(options: UseDataGridEnumTriggerOptions<TRow, TCoord, TData>): UseDataGridEnumTriggerResult<TRow>;
//# sourceMappingURL=useDataGridEnumTrigger.d.ts.map