import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface ColumnVisibilityFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function columnVisibilityFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: ColumnVisibilityFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "columnVisibility", TFeature> {
  return {
    name: "columnVisibility",
    setup(ctx) {
      const feature = options.install(ctx)
      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)
      return feature
    },
  }
}
