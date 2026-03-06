import {
  createClientRowModel,
  createDataGridApi,
  createDataGridColumnModel,
  createDataGridCore,
  type CreateClientRowModelOptions,
  type CreateDataGridCoreOptions,
  type CreateDataGridColumnModelOptions,
  type DataGridApi,
  type DataGridApiPluginDefinition,
  type DataGridColumnModel,
  type DataGridCore,
  type DataGridCoreServiceRegistry,
  type DataGridRowModel,
  type DataGridViewportRange,
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
  plugins?: readonly DataGridApiPluginDefinition<TRow>[]
  clientRowModelOptions?: Omit<CreateClientRowModelOptions<TRow>, "rows">
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
  const rowModel = options.rowModel ?? createClientRowModel<TRow>({
    ...(options.clientRowModelOptions ?? {}),
    rows: options.rows ?? [],
  })
  const columnModel = createDataGridColumnModel({ columns: options.columns })
  let viewportRange: DataGridViewportRange = { start: 0, end: 0 }
  let virtualizationEnabled = true
  const rowHeightOverrides = new Map<number, number>()

  const defaultViewportService: DataGridCoreServiceRegistry["viewport"] & {
    setVirtualizationEnabled: (enabled: boolean) => void
    getVirtualizationEnabled: () => boolean
  } = {
    name: "viewport",
    setViewportRange(range) {
      viewportRange = range
      rowModel.setViewportRange(range)
    },
    getViewportRange() {
      return viewportRange
    },
    setVirtualizationEnabled(enabled) {
      virtualizationEnabled = Boolean(enabled)
    },
    getVirtualizationEnabled() {
      return virtualizationEnabled
    },
    setRowHeightMode() {
      // No-op in headless default runtime.
    },
    setBaseRowHeight() {
      // No-op in headless default runtime.
    },
    measureRowHeight() {
      // No-op in headless default runtime.
    },
    setRowHeightOverride(rowIndex, height) {
      if (!Number.isInteger(rowIndex) || rowIndex < 0) {
        return
      }
      if (height == null) {
        rowHeightOverrides.delete(rowIndex)
        return
      }
      if (!Number.isFinite(height)) {
        return
      }
      rowHeightOverrides.set(rowIndex, Math.max(1, Math.trunc(height)))
    },
    getRowHeightOverride(rowIndex) {
      if (!Number.isInteger(rowIndex) || rowIndex < 0) {
        return null
      }
      return rowHeightOverrides.get(rowIndex) ?? null
    },
    clearRowHeightOverrides() {
      rowHeightOverrides.clear()
    },
  }

  const services: Partial<DataGridCoreServiceRegistry> = {
    rowModel: {
      name: "rowModel",
      model: rowModel as DataGridRowModel<unknown>,
    },
    columnModel: {
      name: "columnModel",
      model: columnModel,
    },
    viewport: options.services?.viewport ?? defaultViewportService,
    ...options.services,
  }

  const core = createDataGridCore({
    services,
    startupOrder: options.startupOrder,
  })
  const api = createDataGridApi<TRow>({
    core,
    plugins: options.plugins,
  })

  return {
    rowModel,
    columnModel,
    core,
    api,
  }
}
