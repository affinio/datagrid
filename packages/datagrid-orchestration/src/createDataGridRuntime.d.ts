import { type CreateDataGridCoreOptions, type CreateDataGridColumnModelOptions, type DataGridApi, type DataGridColumnModel, type DataGridCore, type DataGridCoreServiceRegistry, type DataGridRowModel } from "@affino/datagrid-core";
export type DataGridRuntimeOverrides = Omit<Partial<DataGridCoreServiceRegistry>, "rowModel" | "columnModel" | "viewport"> & {
    viewport?: DataGridCoreServiceRegistry["viewport"];
};
export interface CreateDataGridRuntimeOptions<TRow = unknown> {
    rows?: readonly TRow[];
    rowModel?: DataGridRowModel<TRow>;
    columns: CreateDataGridColumnModelOptions["columns"];
    services?: DataGridRuntimeOverrides;
    startupOrder?: CreateDataGridCoreOptions["startupOrder"];
}
export interface DataGridRuntime<TRow = unknown> {
    rowModel: DataGridRowModel<TRow>;
    columnModel: DataGridColumnModel;
    core: DataGridCore;
    api: DataGridApi<TRow>;
}
export declare function createDataGridRuntime<TRow = unknown>(options: CreateDataGridRuntimeOptions<TRow>): DataGridRuntime<TRow>;
//# sourceMappingURL=createDataGridRuntime.d.ts.map