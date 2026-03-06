import type { DataGridApi } from "@affino/datagrid-core"
import type { UseDataGridRuntimeOptions, UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"

export type DataGridRuntime<TRow = unknown> = UseDataGridRuntimeResult<TRow>
export type GridEventHandler = (payload?: unknown) => void
export type GridEventMap = Record<string, unknown>
export type GridFeatureMap = Record<string, unknown>
export type GridFeatureCleanup = () => void

export type GridFeatureEventHandlers<
  TFeature,
  TRow = unknown,
  TEvents extends GridEventMap = GridEventMap,
> = Partial<{
  [TEvent in Extract<keyof TEvents, string>]:
    (this: TFeature, payload: TEvents[TEvent], ctx: GridContext<TRow>) => void
}>

export type ResolveFeatureValue<TFeature> = [TFeature] extends [void] ? true : TFeature
export type GridFeatureSetupResult<TFeature> = TFeature | GridFeatureCleanup | void

export type GridFeatureAccessor<TFeatures extends GridFeatureMap> = {
  <TName extends keyof TFeatures>(name: TName): TFeatures[TName] | undefined
} & {
  [TName in keyof TFeatures]: TFeatures[TName]
}

export interface GridContext<TRow = unknown> {
  runtime: DataGridRuntime<TRow>
  api: DataGridApi<TRow>
  features: Map<string, unknown>
  on(event: string, handler: GridEventHandler): () => void
  off(event: string, handler: GridEventHandler): void
  emit(event: string, payload?: unknown): void
}

export interface DataGridFeature<
  TRow = unknown,
  TName extends string = string,
  TFeature = unknown,
> {
  name: TName
  requires?: readonly string[]
  setup(ctx: GridContext<TRow>): GridFeatureSetupResult<TFeature>
}

export interface CreateGridOptions<TRow = unknown> extends UseDataGridRuntimeOptions<TRow> {}

export interface GridInstance<
  TRow = unknown,
  TFeatures extends GridFeatureMap = {},
> {
  runtime: DataGridRuntime<TRow>
  api: DataGridApi<TRow>
  features: TFeatures
  use<TName extends string, TFeature>(
    feature: DataGridFeature<TRow, TName, TFeature>,
  ): GridInstance<TRow, TFeatures & Record<TName, ResolveFeatureValue<TFeature>>>
  has(name: string): boolean
  get<TName extends keyof TFeatures>(name: TName): TFeatures[TName] | undefined
  feature: GridFeatureAccessor<TFeatures>
  on(event: string, handler: GridEventHandler): () => void
  off(event: string, handler: GridEventHandler): void
  emit(event: string, payload?: unknown): void
}
