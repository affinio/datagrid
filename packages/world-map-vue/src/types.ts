export type WorldMapMarkerVariant = "default" | "success" | "warning" | "danger" | "muted"

export type WorldMapMarkerScaleMode = "screen" | "map"

export interface WorldMapMarker {
  id: string
  lon: number
  lat: number
  label?: string
  value?: number
  variant?: WorldMapMarkerVariant
  properties?: Record<string, unknown>
}
