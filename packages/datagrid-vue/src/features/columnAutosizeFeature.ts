import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface ColumnAutosizeFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function columnAutosizeFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: ColumnAutosizeFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "columnAutosize", TFeature> {
  return {
    name: "columnAutosize",
    setup(ctx) {
      const feature = options.install(ctx)
      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)
      return feature
    },
  }
}
