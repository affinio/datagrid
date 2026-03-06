import type { DataGridEngineContextValue } from "./useDataGridEngineContext"
import {
  provideDataGridEngineContext,
  useDataGridEngineContext,
} from "./useDataGridEngineContext"
import type { DataGridViewContextValue } from "./useDataGridViewContext"
import {
  provideDataGridViewContext,
  useDataGridViewContext,
} from "./useDataGridViewContext"

export interface DataGridContextValue<TRow = unknown> {
  engine: DataGridEngineContextValue<TRow>
  view: DataGridViewContextValue<TRow>
}

export function provideDataGridContext<TRow>(context: DataGridContextValue<TRow>): void {
  provideDataGridEngineContext(context.engine)
  provideDataGridViewContext(context.view)
}

export function useDataGridContext<TRow = unknown>(): DataGridContextValue<TRow> {
  return {
    engine: useDataGridEngineContext<TRow>(),
    view: useDataGridViewContext<TRow>(),
  }
}
