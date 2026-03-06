import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface ServerSideRowModelFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function serverSideRowModelFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: ServerSideRowModelFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "serverSideRowModel", TFeature> {
  return {
    name: "serverSideRowModel",
    setup(ctx) {
      const feature = options.install(ctx)
      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)
      return feature
    },
  }
}
