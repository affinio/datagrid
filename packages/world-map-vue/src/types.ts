export type WorldMapMarkerVariant = "default" | "success" | "warning" | "danger" | "muted"

export type WorldMapMarkerScaleMode = "screen" | "map"

export interface WorldMapPoint {
  x: number
  y: number
}

export interface WorldMapAnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface WorldMapMarker {
  id: string
  lon: number
  lat: number
  label?: string
  value?: number
  variant?: WorldMapMarkerVariant
  properties?: Record<string, unknown>
}

export interface WorldMapMarkerInteraction {
  marker: WorldMapMarker
  svgPoint: WorldMapPoint
  clientPoint: WorldMapPoint
  anchorRect: WorldMapAnchorRect
}
