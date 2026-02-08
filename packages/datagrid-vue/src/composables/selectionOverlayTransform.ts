import type { UiTableOverlayTransformInput } from "../types/overlay"
import type { TableOverlayScrollSnapshot } from "./useTableOverlayScrollState"

export interface SelectionOverlayViewportState {
  width: number
  height: number
  scrollLeft: number
  scrollTop: number
}

function normalizeFinite(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0
  }
  return value as number
}

export function buildSelectionOverlayTransform(
  viewportState: SelectionOverlayViewportState,
  pinnedLeftOffset: number,
  pinnedRightOffset: number,
): UiTableOverlayTransformInput {
  const scrollLeft = normalizeFinite(viewportState.scrollLeft)
  const scrollTop = normalizeFinite(viewportState.scrollTop)
  const viewportWidth = Math.max(0, normalizeFinite(viewportState.width))
  const viewportHeight = Math.max(0, normalizeFinite(viewportState.height))
  const safePinnedLeft = Math.max(0, normalizeFinite(pinnedLeftOffset))
  const safePinnedRight = Math.max(0, normalizeFinite(pinnedRightOffset))

  return {
    viewportWidth,
    viewportHeight,
    scrollLeft,
    scrollTop,
    pinnedLeftTranslateX: scrollLeft + safePinnedLeft,
    pinnedRightTranslateX: scrollLeft - safePinnedRight,
  }
}

export function buildSelectionOverlayTransformFromSnapshot(
  snapshot: TableOverlayScrollSnapshot,
): UiTableOverlayTransformInput {
  return buildSelectionOverlayTransform(
    {
      width: snapshot.viewportWidth,
      height: snapshot.viewportHeight,
      scrollLeft: snapshot.scrollLeft,
      scrollTop: snapshot.scrollTop,
    },
    snapshot.pinnedOffsetLeft,
    snapshot.pinnedOffsetRight,
  )
}
