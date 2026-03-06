import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface RangeMoveFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function rangeMoveFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: RangeMoveFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "rangeMove", TFeature> {
  return {
    name: "rangeMove",
    setup(ctx) {
      const feature = options.install(ctx)

      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)

      return feature
    },
  }
}
