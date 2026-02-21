import {
  createClientRowModel,
  createDataGridApi,
  createDataGridColumnModel,
  createDataGridCore,
  type CreateDataGridCoreOptions,
  type CreateDataGridColumnModelOptions,
  type DataGridApi,
  type DataGridColumnModel,
  type DataGridCore,
  type DataGridCoreServiceRegistry,
  type DataGridRowModel,
} from "@affino/datagrid-core"

export type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

export interface CreateDataGridRuntimeOptions<TRow = unknown> {
  rows?: readonly TRow[]
  rowModel?: DataGridRowModel<TRow>
  columns: CreateDataGridColumnModelOptions["columns"]
  services?: DataGridRuntimeOverrides
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
}

export interface DataGridRuntime<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  core: DataGridCore
  api: DataGridApi<TRow>
}

export function createDataGridRuntime<TRow = unknown>(
  options: CreateDataGridRuntimeOptions<TRow>,
): DataGridRuntime<TRow> {
  const rowModel = options.rowModel ?? createClientRowModel<TRow>({ rows: options.rows ?? [] })
  const columnModel = createDataGridColumnModel({ columns: options.columns })

  const services: Partial<DataGridCoreServiceRegistry> = {
    rowModel: {
      name: "rowModel",
      model: rowModel as DataGridRowModel<unknown>,
    },
    columnModel: {
      name: "columnModel",
      model: columnModel,
    },
    viewport: options.services?.viewport ?? {
      name: "viewport",
      setViewportRange(range) {
        rowModel.setViewportRange(range)
      },
    },
    ...options.services,
  }

  const core = createDataGridCore({
    services,
    startupOrder: options.startupOrder,
  })
  const api = createDataGridApi<TRow>({ core })

  return {
    rowModel,
    columnModel,
    core,
    api,
  }
}
