import type { DataGridWritableRef } from "./dataGridWritableRef";
export interface DataGridClipboardRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridClipboardBridgeOptions<TRow, TRange extends DataGridClipboardRange = DataGridClipboardRange> {
    copiedSelectionRange: DataGridWritableRef<TRange | null>;
    lastCopiedPayload: DataGridWritableRef<string>;
    resolveCopyRange: () => TRange | null;
    getRowAtIndex: (rowIndex: number) => TRow | undefined;
    getColumnKeyAtIndex: (columnIndex: number) => string | null;
    getCellValue: (row: TRow, columnKey: string) => unknown;
    setLastAction: (message: string) => void;
    closeContextMenu: () => void;
    copiedSelectionFlashMs?: number;
    isColumnCopyable?: (columnKey: string) => boolean;
    writeClipboardText?: (payload: string) => Promise<void>;
    readClipboardText?: () => Promise<string>;
}
export interface UseDataGridClipboardBridgeResult<TRange extends DataGridClipboardRange = DataGridClipboardRange> {
    copySelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>;
    readClipboardPayload: () => Promise<string>;
    parseClipboardMatrix: (payload: string) => string[][];
    clearCopiedSelectionFlash: () => void;
    flashCopiedSelection: (range: TRange) => void;
    dispose: () => void;
}
export declare function useDataGridClipboardBridge<TRow, TRange extends DataGridClipboardRange = DataGridClipboardRange>(options: UseDataGridClipboardBridgeOptions<TRow, TRange>): UseDataGridClipboardBridgeResult<TRange>;
//# sourceMappingURL=useDataGridClipboardBridge.d.ts.map