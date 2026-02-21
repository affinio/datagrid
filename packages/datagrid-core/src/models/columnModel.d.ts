export type DataGridColumnPin = "left" | "right" | "none";
export interface DataGridColumnDef {
    key: string;
    label?: string;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    visible?: boolean;
    pin?: DataGridColumnPin;
    meta?: Record<string, unknown>;
}
export interface DataGridColumnSnapshot {
    key: string;
    visible: boolean;
    pin: DataGridColumnPin;
    width: number | null;
    column: DataGridColumnDef;
}
export interface DataGridColumnModelSnapshot {
    columns: readonly DataGridColumnSnapshot[];
    order: readonly string[];
    visibleColumns: readonly DataGridColumnSnapshot[];
}
export type DataGridColumnModelListener = (snapshot: DataGridColumnModelSnapshot) => void;
export interface DataGridColumnModel {
    getSnapshot(): DataGridColumnModelSnapshot;
    getColumn(key: string): DataGridColumnSnapshot | undefined;
    setColumns(columns: readonly DataGridColumnDef[]): void;
    setColumnOrder(keys: readonly string[]): void;
    setColumnVisibility(key: string, visible: boolean): void;
    setColumnWidth(key: string, width: number | null): void;
    setColumnPin(key: string, pin: DataGridColumnPin): void;
    subscribe(listener: DataGridColumnModelListener): () => void;
    dispose(): void;
}
export interface CreateDataGridColumnModelOptions {
    columns?: readonly DataGridColumnDef[];
}
export declare function createDataGridColumnModel(options?: CreateDataGridColumnModelOptions): DataGridColumnModel;
//# sourceMappingURL=columnModel.d.ts.map