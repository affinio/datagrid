import type {
  DataGridFeature,
  GridContext,
  GridEventMap,
  GridFeatureEventHandlers,
} from "../grid/types"
import { bindFeatureHandlers } from "./bindFeatureHandlers"

export interface PointerPreviewFeatureOptions<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap> {
  install: (ctx: GridContext<TRow>) => TFeature
  on?: GridFeatureEventHandlers<TFeature, TRow, TEvents>
}

export function pointerPreviewFeature<TFeature = unknown, TRow = unknown, TEvents extends GridEventMap = GridEventMap>(
  options: PointerPreviewFeatureOptions<TFeature, TRow, TEvents>,
): DataGridFeature<TRow, "pointerPreview", TFeature> {
  return {
    name: "pointerPreview",
    setup(ctx) {
      const feature = options.install(ctx)

      bindFeatureHandlers<TFeature, TRow, TEvents>(ctx, feature, options.on)

      return feature
    },
  }
}
