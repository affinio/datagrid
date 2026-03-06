import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface SortingFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function sortingFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: SortingFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "sorting", TFeature> {
  return {
    name: "sorting",
    setup(ctx) {
      const feature = options.install(ctx)
      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)
      return feature
    },
  }
}
