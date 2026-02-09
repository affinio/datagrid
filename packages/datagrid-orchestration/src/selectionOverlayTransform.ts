export interface DataGridOverlayTransformInput {
  viewportWidth: number
  viewportHeight: number
  scrollLeft: number
  scrollTop: number
  pinnedOffsetLeft?: number
  pinnedOffsetRight?: number
}

export interface DataGridOverlayTransform {
  transform: string
  clipPath: string
  willChange: "transform"
}

function normalizeDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, value)
}

export function buildDataGridOverlayTransform(
  input: DataGridOverlayTransformInput,
): DataGridOverlayTransform {
  const viewportWidth = normalizeDimension(input.viewportWidth)
  const pinnedOffsetLeft = normalizeDimension(input.pinnedOffsetLeft ?? 0)
  const pinnedOffsetRight = normalizeDimension(input.pinnedOffsetRight ?? 0)
  const maxRightInset = Math.max(0, viewportWidth - pinnedOffsetLeft)
  const rightInset = Math.min(pinnedOffsetRight, maxRightInset)

  return {
    transform: `translate3d(${-input.scrollLeft}px, ${-input.scrollTop}px, 0)`,
    clipPath: `inset(0px ${rightInset}px 0px ${pinnedOffsetLeft}px)`,
    willChange: "transform",
  }
}

export function buildDataGridOverlayTransformFromSnapshot(
  snapshot: DataGridOverlayTransformInput,
): DataGridOverlayTransform {
  return buildDataGridOverlayTransform(snapshot)
}
