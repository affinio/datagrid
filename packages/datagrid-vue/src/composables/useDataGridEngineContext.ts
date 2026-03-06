import { inject, provide, type InjectionKey } from "vue"
import type { GridInstance } from "../grid/types"

export interface DataGridEngineContextValue<TRow = unknown> {
  grid: GridInstance<TRow, any>
}

const DATA_GRID_ENGINE_CONTEXT_KEY: InjectionKey<DataGridEngineContextValue<any>> = Symbol(
  "AFFINO_DATA_GRID_ENGINE_CONTEXT",
)

export function provideDataGridEngineContext<TRow>(context: DataGridEngineContextValue<TRow>): void {
  provide(DATA_GRID_ENGINE_CONTEXT_KEY, context)
}

export function useDataGridEngineContext<TRow = unknown>(): DataGridEngineContextValue<TRow> {
  const context = inject(DATA_GRID_ENGINE_CONTEXT_KEY)
  if (!context) {
    throw new Error(
      "DataGrid engine context is not available. Make sure the component is used inside <DataGrid />.",
    )
  }
  return context as DataGridEngineContextValue<TRow>
}

export function useGridApi<TRow = unknown>() {
  return useDataGridEngineContext<TRow>().grid.api
}
