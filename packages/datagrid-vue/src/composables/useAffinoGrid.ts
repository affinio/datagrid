import { createGrid } from "../grid/createGrid"
import type { DataGridFeature, GridInstance, ResolveFeatureValue } from "../grid/types"
import type { UseDataGridRuntimeOptions, UseDataGridRuntimeResult } from "./useDataGridRuntime"

export type UseAffinoGridPlugins<TRow> = readonly DataGridFeature<TRow, string, unknown>[]

type Simplify<TObject> = { [TKey in keyof TObject]: TObject[TKey] }

type UnionToIntersection<TUnion> = (
  TUnion extends unknown ? (input: TUnion) => void : never
) extends ((input: infer TIntersection) => void)
  ? TIntersection
  : never

type PluginToFeatureRecord<TPlugin> = TPlugin extends DataGridFeature<any, infer TName extends string, infer TFeature>
  ? Record<TName, ResolveFeatureValue<TFeature>>
  : {}

export type AffinoGridInstalledFeatures<TPlugins extends UseAffinoGridPlugins<any>> = Simplify<
  UnionToIntersection<PluginToFeatureRecord<TPlugins[number]>>
>

export interface UseAffinoGridOptions<
  TRow,
  TPlugins extends UseAffinoGridPlugins<TRow> = readonly [],
> extends UseDataGridRuntimeOptions<TRow> {
  features?: TPlugins
}

export interface UseAffinoGridResult<
  TRow,
  TPlugins extends UseAffinoGridPlugins<TRow> = readonly [],
> {
  runtime: UseDataGridRuntimeResult<TRow>
  api: UseDataGridRuntimeResult<TRow>["api"]
  features: AffinoGridInstalledFeatures<TPlugins>
}

export function useAffinoGrid<
  TRow,
  TPlugins extends UseAffinoGridPlugins<TRow> = readonly [],
>(
  options: UseAffinoGridOptions<TRow, TPlugins>,
): UseAffinoGridResult<TRow, TPlugins> {
  const { features: configuredFeatures = [] as unknown as TPlugins, ...runtimeOptions } = options
  const grid = createGrid<TRow>(runtimeOptions)
  let chainedGrid = grid as GridInstance<TRow, {}>

  for (const plugin of configuredFeatures) {
    chainedGrid = chainedGrid.use(plugin)
  }

  const runtime = chainedGrid.runtime
  const api = chainedGrid.api
  const installedFeatures = chainedGrid.features as AffinoGridInstalledFeatures<TPlugins>

  return {
    runtime,
    api,
    features: installedFeatures,
  }
}
