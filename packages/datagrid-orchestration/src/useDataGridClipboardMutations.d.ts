import type { DataGridClipboardRange } from "./useDataGridClipboardBridge";
import type { DataGridWritableRef } from "./dataGridWritableRef";
export interface DataGridClipboardCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridClipboardMutationResult<TRange extends DataGridClipboardRange = DataGridClipboardRange> {
    applied: number;
    blocked: number;
    range: TRange;
}
export interface UseDataGridClipboardMutationsOptions<TRow, TColumnKey extends string, TRange extends DataGridClipboardRange = DataGridClipboardRange, TCoord extends DataGridClipboardCoord = DataGridClipboardCoord, TSnapshot = unknown> {
    sourceRows: DataGridWritableRef<readonly TRow[]>;
    setSourceRows: (rows: readonly TRow[]) => void;
    cloneRow: (row: TRow) => TRow;
    resolveRowId: (row: TRow) => string;
    resolveCopyRange: () => TRange | null;
    resolveCurrentCellCoord: () => TCoord | null;
    normalizeCellCoord: (coord: TCoord) => TCoord | null;
    normalizeSelectionRange: (range: TRange) => TRange | null;
    resolveRowAtViewIndex: (rowIndex: number) => TRow | undefined;
    resolveColumnKeyAtIndex: (columnIndex: number) => TColumnKey | null;
    isEditableColumn: (columnKey: TColumnKey) => boolean;
    canApplyPastedValue: (columnKey: TColumnKey, value: string) => boolean;
    applyEditedValue: (row: TRow, columnKey: TColumnKey, value: string) => void;
    clearValueForCut: (row: TRow, columnKey: TColumnKey) => boolean;
    finalizeMutableRows?: (rowsById: Map<string, TRow>) => void;
    applySelectionRange: (range: TRange) => void;
    closeContextMenu: () => void;
    setLastAction: (message: string) => void;
    readClipboardPayload: () => Promise<string>;
    parseClipboardMatrix: (payload: string) => string[][];
    copySelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>;
    captureBeforeSnapshot?: () => TSnapshot;
    recordIntentTransaction?: (descriptor: {
        intent: "paste" | "clear" | "cut";
        label: string;
        affectedRange: TRange;
    }, beforeSnapshot: TSnapshot) => Promise<void>;
}
export interface UseDataGridClipboardMutationsResult<TRange extends DataGridClipboardRange = DataGridClipboardRange> {
    pasteSelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>;
    clearCurrentSelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>;
    cutSelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>;
}
export declare function useDataGridClipboardMutations<TRow, TColumnKey extends string, TRange extends DataGridClipboardRange = DataGridClipboardRange, TCoord extends DataGridClipboardCoord = DataGridClipboardCoord, TSnapshot = unknown>(options: UseDataGridClipboardMutationsOptions<TRow, TColumnKey, TRange, TCoord, TSnapshot>): UseDataGridClipboardMutationsResult<TRange>;
//# sourceMappingURL=useDataGridClipboardMutations.d.ts.map