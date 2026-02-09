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
