import type { DataGridRowId } from "./rowModel.js";
export interface DataGridEditPatch {
    rowId: DataGridRowId;
    columnKey: string;
    value: unknown;
    previousValue?: unknown;
}
export interface DataGridEditModelSnapshot {
    revision: number;
    edits: readonly DataGridEditPatch[];
}
export type DataGridEditModelListener = (snapshot: DataGridEditModelSnapshot) => void;
export interface DataGridEditModel {
    getSnapshot(): DataGridEditModelSnapshot;
    getEdit(rowId: DataGridRowId, columnKey: string): DataGridEditPatch | undefined;
    setEdit(patch: DataGridEditPatch): void;
    setEdits(patches: readonly DataGridEditPatch[]): void;
    clearEdit(rowId: DataGridRowId, columnKey: string): void;
    clearAll(): void;
    subscribe(listener: DataGridEditModelListener): () => void;
    dispose(): void;
}
export interface CreateDataGridEditModelOptions {
    initialEdits?: readonly DataGridEditPatch[];
}
export declare function createDataGridEditModel(options?: CreateDataGridEditModelOptions): DataGridEditModel;
//# sourceMappingURL=editModel.d.ts.map