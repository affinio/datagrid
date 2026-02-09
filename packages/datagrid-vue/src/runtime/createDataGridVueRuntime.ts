import {
  createDataGridRuntime,
  type CreateDataGridRuntimeOptions,
  type DataGridRuntime,
} from "@affino/datagrid-orchestration"

export interface CreateDataGridVueRuntimeOptions<TRow = unknown> extends CreateDataGridRuntimeOptions<TRow> {}

export interface DataGridVueRuntime<TRow = unknown> extends DataGridRuntime<TRow> {}

export function createDataGridVueRuntime<TRow = unknown>(
  options: CreateDataGridVueRuntimeOptions<TRow>,
): DataGridVueRuntime<TRow> {
  return createDataGridRuntime(options)
}
