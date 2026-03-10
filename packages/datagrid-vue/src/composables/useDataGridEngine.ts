import type {
  CreateDataGridCoreOptions,
  DataGridApiPluginDefinition,
  DataGridColumnInput,
  DataGridCoreServiceRegistry,
  DataGridRowModel,
} from "@affino/datagrid-core"
import type { Ref } from "vue"
import { createGrid } from "../grid/createGrid"

type MaybeRef<T> = T | Ref<T>
type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

export interface UseDataGridEngineOptions<TRow = unknown> {
  rows: MaybeRef<readonly TRow[]>
  rowModel?: DataGridRowModel<TRow>
  columns: MaybeRef<readonly DataGridColumnInput[]>
  plugins?: readonly DataGridApiPluginDefinition<TRow>[]
  services?: DataGridRuntimeOverrides
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
  autoStart?: boolean
}

export function useDataGridEngine<TRow = unknown>(options: UseDataGridEngineOptions<TRow>) {
  return createGrid<TRow>({
    rows: options.rows,
    rowModel: options.rowModel,
    columns: options.columns,
    plugins: options.plugins,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart,
  })
}
