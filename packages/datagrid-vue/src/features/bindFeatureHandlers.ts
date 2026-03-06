import type { GridContext, GridEventMap, GridFeatureEventHandlers } from "../grid/types"

export function bindFeatureHandlers<
  TFeature,
  TRow = unknown,
  TEvents extends GridEventMap = GridEventMap,
>(
  ctx: GridContext<TRow>,
  feature: TFeature,
  handlers?: GridFeatureEventHandlers<TFeature, TRow, TEvents>,
): void {
  if (!handlers) {
    return
  }

  for (
    const [eventName, handler] of Object.entries(handlers) as Array<
      [
        Extract<keyof TEvents, string>,
        GridFeatureEventHandlers<TFeature, TRow, TEvents>[Extract<keyof TEvents, string>],
      ]
    >
  ) {
    if (!handler) {
      continue
    }
    ctx.on(eventName, (payload: unknown) => {
      handler.call(feature, payload as TEvents[typeof eventName], ctx)
    })
  }
}
