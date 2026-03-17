import {
  inject,
  provide,
  toRef,
  type InjectionKey,
  type Ref,
} from "vue"
import type { DataGridTableStageProps } from "./dataGridTableStage.types"

export type DataGridTableStageSectionKey =
  | "layout"
  | "viewport"
  | "columns"
  | "rows"
  | "selection"
  | "editing"
  | "cells"
  | "interaction"

export interface DataGridTableStageContext<TRow extends Record<string, unknown>> {
  mode: Readonly<Ref<DataGridTableStageProps<TRow>["mode"]>>
  rowHeightMode: Readonly<Ref<DataGridTableStageProps<TRow>["rowHeightMode"]>>
  layout: Readonly<Ref<DataGridTableStageProps<TRow>["layout"]>>
  viewport: Readonly<Ref<DataGridTableStageProps<TRow>["viewport"]>>
  columns: Readonly<Ref<DataGridTableStageProps<TRow>["columns"]>>
  rows: Readonly<Ref<DataGridTableStageProps<TRow>["rows"]>>
  selection: Readonly<Ref<DataGridTableStageProps<TRow>["selection"]>>
  editing: Readonly<Ref<DataGridTableStageProps<TRow>["editing"]>>
  cells: Readonly<Ref<DataGridTableStageProps<TRow>["cells"]>>
  interaction: Readonly<Ref<DataGridTableStageProps<TRow>["interaction"]>>
}

export interface DataGridTableStageContextSource<TRow extends Record<string, unknown>> {
  mode: Ref<DataGridTableStageProps<TRow>["mode"]>
  rowHeightMode: Ref<DataGridTableStageProps<TRow>["rowHeightMode"]>
  layout: Ref<DataGridTableStageProps<TRow>["layout"]>
  viewport: Ref<DataGridTableStageProps<TRow>["viewport"]>
  columns: Ref<DataGridTableStageProps<TRow>["columns"]>
  rows: Ref<DataGridTableStageProps<TRow>["rows"]>
  selection: Ref<DataGridTableStageProps<TRow>["selection"]>
  editing: Ref<DataGridTableStageProps<TRow>["editing"]>
  cells: Ref<DataGridTableStageProps<TRow>["cells"]>
  interaction: Ref<DataGridTableStageProps<TRow>["interaction"]>
}

export type AnyDataGridTableStageContext = DataGridTableStageContext<Record<string, unknown>>

export const dataGridTableStageContextKey: InjectionKey<AnyDataGridTableStageContext> = Symbol("data-grid-table-stage-context")

export function createDataGridTableStageContext<TRow extends Record<string, unknown>>(
  source: DataGridTableStageContextSource<TRow>,
): DataGridTableStageContext<TRow> {
  return {
    mode: source.mode,
    rowHeightMode: source.rowHeightMode,
    layout: source.layout,
    viewport: source.viewport,
    columns: source.columns,
    rows: source.rows,
    selection: source.selection,
    editing: source.editing,
    cells: source.cells,
    interaction: source.interaction,
  }
}

export function createDataGridTableStageContextFromProps<TRow extends Record<string, unknown>>(
  props: DataGridTableStageProps<TRow>,
): DataGridTableStageContext<TRow> {
  return createDataGridTableStageContext({
    mode: toRef(props, "mode"),
    rowHeightMode: toRef(props, "rowHeightMode"),
    layout: toRef(props, "layout"),
    viewport: toRef(props, "viewport"),
    columns: toRef(props, "columns"),
    rows: toRef(props, "rows"),
    selection: toRef(props, "selection"),
    editing: toRef(props, "editing"),
    cells: toRef(props, "cells"),
    interaction: toRef(props, "interaction"),
  })
}

export function materializeDataGridTableStagePropsFromContext<TRow extends Record<string, unknown>>(
  context: DataGridTableStageContext<TRow>,
): DataGridTableStageProps<TRow> {
  return {
    mode: context.mode.value,
    rowHeightMode: context.rowHeightMode.value,
    layout: context.layout.value,
    viewport: context.viewport.value,
    columns: context.columns.value,
    rows: context.rows.value,
    selection: context.selection.value,
    editing: context.editing.value,
    cells: context.cells.value,
    interaction: context.interaction.value,
  }
}

export function provideDataGridTableStageContext<TRow extends Record<string, unknown>>(
  context: DataGridTableStageContext<TRow>,
): DataGridTableStageContext<TRow> {
  provide(
    dataGridTableStageContextKey,
    context as AnyDataGridTableStageContext,
  )
  return context
}

export function useDataGridTableStageContext<TRow extends Record<string, unknown>>(): DataGridTableStageContext<TRow> {
  const context = inject(dataGridTableStageContextKey)
  if (!context) {
    throw new Error("DataGrid table stage context is not available outside of DataGridTableStage.")
  }
  return context as DataGridTableStageContext<TRow>
}

export function useDataGridTableStageMode<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageContext<TRow>().mode
}

export function useDataGridTableStageRowHeightMode<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageContext<TRow>().rowHeightMode
}

export function useDataGridTableStageSection<
  TRow extends Record<string, unknown>,
  TSectionKey extends DataGridTableStageSectionKey,
>(sectionKey: TSectionKey): DataGridTableStageContext<TRow>[TSectionKey] {
  return useDataGridTableStageContext<TRow>()[sectionKey]
}

export function useDataGridTableStageLayoutSection<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageSection<TRow, "layout">("layout")
}

export function useDataGridTableStageViewportSection<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageSection<TRow, "viewport">("viewport")
}

export function useDataGridTableStageColumnsSection<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageSection<TRow, "columns">("columns")
}

export function useDataGridTableStageRowsSection<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageSection<TRow, "rows">("rows")
}

export function useDataGridTableStageSelectionSection<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageSection<TRow, "selection">("selection")
}

export function useDataGridTableStageEditingSection<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageSection<TRow, "editing">("editing")
}

export function useDataGridTableStageCellsSection<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageSection<TRow, "cells">("cells")
}

export function useDataGridTableStageInteractionSection<TRow extends Record<string, unknown>>() {
  return useDataGridTableStageSection<TRow, "interaction">("interaction")
}
