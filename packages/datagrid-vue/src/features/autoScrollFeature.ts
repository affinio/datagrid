import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface AutoScrollFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function autoScrollFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: AutoScrollFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "autoScroll", TFeature> {
  return {
    name: "autoScroll",
    setup(ctx) {
      const feature = options.install(ctx)

      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)

      return feature
    },
  }
}
