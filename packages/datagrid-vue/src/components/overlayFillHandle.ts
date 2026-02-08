import type { FillHandleStylePayload } from "@affino/datagrid-core/selection/fillHandleStylePool"
import type { UiTableOverlayTransformInput } from "../types/overlay"

export interface OverlayFillHandlePosition {
  x: number
  y: number
}

function normalizeFinite(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0
  }
  return value as number
}

export function resolveOverlayFillHandlePosition(
  style: FillHandleStylePayload | null | undefined,
  transform: UiTableOverlayTransformInput | null,
): OverlayFillHandlePosition | null {
  if (!style) {
    return null
  }

  const baseX = normalizeFinite(style.x)
  const baseY = normalizeFinite(style.y)
  const scrollLeft = normalizeFinite(transform?.scrollLeft)
  const scrollTop = normalizeFinite(transform?.scrollTop)

  return {
    x: baseX + scrollLeft,
    y: baseY + scrollTop,
  }
}
