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

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

export interface CreateDataGridVueRuntimeOptions<TRow = unknown> {
  rows?: readonly TRow[]
  columns: CreateDataGridColumnModelOptions["columns"]
  services?: DataGridRuntimeOverrides
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
}

export interface DataGridVueRuntime<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  core: DataGridCore
  api: DataGridApi
}

export function createDataGridVueRuntime<TRow = unknown>(
  options: CreateDataGridVueRuntimeOptions<TRow>,
): DataGridVueRuntime<TRow> {
  const rowModel = createClientRowModel<TRow>({ rows: options.rows ?? [] })
  const columnModel = createDataGridColumnModel({ columns: options.columns })

  const services: Partial<DataGridCoreServiceRegistry> = {
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
        rowModel.setViewportRange(range)
      },
    },
    ...options.services,
  }

  const core = createDataGridCore({
    services,
    startupOrder: options.startupOrder,
  })
  const api = createDataGridApi({ core })

  return {
    rowModel,
    columnModel,
    core,
    api,
  }
}
