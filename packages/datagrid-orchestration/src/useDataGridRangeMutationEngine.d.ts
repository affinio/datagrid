export interface DataGridRangeMutationRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridRangeMutationEngineOptions<TRow, TDisplayRow, TSnapshot, TRange extends DataGridRangeMutationRange = DataGridRangeMutationRange> {
    resolveRangeMoveBaseRange: () => TRange | null;
    resolveRangeMovePreviewRange: () => TRange | null;
    resolveFillBaseRange: () => TRange | null;
    resolveFillPreviewRange: () => TRange | null;
    areRangesEqual: (left: TRange | null, right: TRange | null) => boolean;
    captureBeforeSnapshot: () => TSnapshot;
    resolveSourceRows: () => readonly TRow[];
    resolveSourceRowId: (row: TRow) => string;
    applySourceRows: (rows: readonly TRow[]) => void;
    resolveDisplayedRows: () => readonly TDisplayRow[];
    resolveDisplayedRowId: (row: TDisplayRow) => string;
    resolveColumnKeyAtIndex: (columnIndex: number) => string | null;
    resolveDisplayedCellValue: (row: TDisplayRow, columnKey: string) => unknown;
    resolveSourceCellValue: (row: TRow, columnKey: string) => unknown;
    normalizeClipboardValue: (value: unknown) => string;
    isExcludedColumn?: (columnKey: string) => boolean;
    isEditableColumn: (columnKey: string) => boolean;
    applyValueForMove: (row: TRow, columnKey: string, value: string) => boolean;
    clearValueForMove: (row: TRow, columnKey: string) => boolean;
    applyEditedValue: (row: TRow, columnKey: string, draft: string) => void;
    shouldRecomputeDerivedForColumn?: (columnKey: string) => boolean;
    recomputeDerived: (row: TRow) => void;
    isCellWithinRange: (rowIndex: number, columnIndex: number, range: TRange) => boolean;
    setSelectionFromRange: (range: TRange, activePosition: "start" | "end") => void;
    recordIntent: (descriptor: {
        intent: "move" | "fill";
        label: string;
        affectedRange: TRange;
    }, beforeSnapshot: TSnapshot) => void | Promise<void>;
    setLastAction: (message: string) => void;
}
export interface UseDataGridRangeMutationEngineResult {
    applyRangeMove: () => boolean;
    applyFillPreview: () => void;
}
export declare function useDataGridRangeMutationEngine<TRow, TDisplayRow, TSnapshot, TRange extends DataGridRangeMutationRange = DataGridRangeMutationRange>(options: UseDataGridRangeMutationEngineOptions<TRow, TDisplayRow, TSnapshot, TRange>): UseDataGridRangeMutationEngineResult;
//# sourceMappingURL=useDataGridRangeMutationEngine.d.ts.map