import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface RowHeightFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function rowHeightFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: RowHeightFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "rowHeight", TFeature> {
  return {
    name: "rowHeight",
    setup(ctx) {
      const feature = options.install(ctx)
      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)
      return feature
    },
  }
}
