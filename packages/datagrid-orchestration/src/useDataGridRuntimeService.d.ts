import type { DataGridColumnDef, DataGridClientRowPatch, DataGridClientRowPatchOptions, DataGridColumnModelSnapshot, DataGridRowNode, DataGridViewportRange } from "@affino/datagrid-core";
import { type CreateDataGridRuntimeOptions, type DataGridRuntime } from "./createDataGridRuntime";
export interface UseDataGridRuntimeServiceOptions<TRow = unknown> extends CreateDataGridRuntimeOptions<TRow> {
}
export interface DataGridRuntimeVirtualWindowSnapshot {
    rowStart: number;
    rowEnd: number;
    rowTotal: number;
    colStart: number;
    colEnd: number;
    colTotal: number;
    overscan: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
}
export interface UseDataGridRuntimeServiceResult<TRow = unknown> extends DataGridRuntime<TRow> {
    getColumnSnapshot: () => DataGridColumnModelSnapshot;
    subscribeColumnSnapshot: (listener: (snapshot: DataGridColumnModelSnapshot) => void) => () => void;
    getVirtualWindowSnapshot: () => DataGridRuntimeVirtualWindowSnapshot | null;
    subscribeVirtualWindow: (listener: (snapshot: DataGridRuntimeVirtualWindowSnapshot | null) => void) => () => void;
    setRows: (rows: readonly TRow[]) => void;
    patchRows: (updates: readonly DataGridClientRowPatch<TRow>[], options?: DataGridClientRowPatchOptions) => void;
    setColumns: (columns: readonly DataGridColumnDef[]) => void;
    start: () => Promise<void>;
    stop: () => void;
    syncRowsInRange: (range: DataGridViewportRange) => readonly DataGridRowNode<TRow>[];
    isStarted: () => boolean;
    isDisposed: () => boolean;
}
export declare function useDataGridRuntimeService<TRow = unknown>(options: UseDataGridRuntimeServiceOptions<TRow>): UseDataGridRuntimeServiceResult<TRow>;
//# sourceMappingURL=useDataGridRuntimeService.d.ts.map