import type { DataGridRowNode } from "@affino/datagrid-core"
import { inject, provide, type ComputedRef, type InjectionKey } from "vue"
import type { DataGridViewColumn, UseDataGridViewModelResult } from "./useDataGridViewModel"

export interface DataGridViewContextValue<TRow = unknown> {
  viewModel: UseDataGridViewModelResult<TRow>
  visibleRows: ComputedRef<ReadonlyArray<DataGridRowNode<TRow>>>
  visibleColumns: ComputedRef<ReadonlyArray<DataGridViewColumn>>
}

const DATA_GRID_VIEW_CONTEXT_KEY: InjectionKey<DataGridViewContextValue<any>> = Symbol(
  "AFFINO_DATA_GRID_VIEW_CONTEXT",
)

export function provideDataGridViewContext<TRow>(context: DataGridViewContextValue<TRow>): void {
  provide(DATA_GRID_VIEW_CONTEXT_KEY, context)
}

export function useDataGridViewContext<TRow = unknown>(): DataGridViewContextValue<TRow> {
  const context = inject(DATA_GRID_VIEW_CONTEXT_KEY)
  if (!context) {
    throw new Error(
      "DataGrid view context is not available. Make sure the component is used inside <DataGrid />.",
    )
  }
  return context as DataGridViewContextValue<TRow>
}
