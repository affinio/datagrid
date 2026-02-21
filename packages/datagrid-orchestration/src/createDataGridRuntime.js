import { createClientRowModel, createDataGridApi, createDataGridColumnModel, createDataGridCore, } from "@affino/datagrid-core";
export function createDataGridRuntime(options) {
    const rowModel = options.rowModel ?? createClientRowModel({ rows: options.rows ?? [] });
    const columnModel = createDataGridColumnModel({ columns: options.columns });
    const services = {
        rowModel: {
            name: "rowModel",
            model: rowModel,
        },
        columnModel: {
            name: "columnModel",
            model: columnModel,
        },
        viewport: options.services?.viewport ?? {
            name: "viewport",
            setViewportRange(range) {
                rowModel.setViewportRange(range);
            },
        },
        ...options.services,
    };
    const core = createDataGridCore({
        services,
        startupOrder: options.startupOrder,
    });
    const api = createDataGridApi({ core });
    return {
        rowModel,
        columnModel,
        core,
        api,
    };
}
