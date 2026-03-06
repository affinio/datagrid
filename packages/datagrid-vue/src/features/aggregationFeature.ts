import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface AggregationFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function aggregationFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: AggregationFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "aggregation", TFeature> {
  return {
    name: "aggregation",
    setup(ctx) {
      const feature = options.install(ctx)

      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)

      return feature
    },
  }
}
