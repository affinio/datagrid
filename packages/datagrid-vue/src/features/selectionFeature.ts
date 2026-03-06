import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface SelectionFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function selectionFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: SelectionFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "selection", TFeature> {
  return {
    name: "selection",
    setup(ctx) {
      const feature = options.install(ctx)

      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)

      return feature
    },
  }
}
