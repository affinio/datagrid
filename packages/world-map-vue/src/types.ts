export type WorldMapMarkerVariant = "default" | "success" | "warning" | "danger" | "muted"

export type WorldMapMarkerScaleMode = "screen" | "map"

export type WorldMapMarkerClassValue =
  | string
  | string[]
  | Record<string, boolean | undefined>
  | null
  | undefined

export type WorldMapMarkerStyleValue =
  | string
  | Record<string, string | number | undefined>
  | null
  | undefined

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
  class?: WorldMapMarkerClassValue
  style?: WorldMapMarkerStyleValue
  properties?: Record<string, unknown>
}

export interface WorldMapMarkerRenderContext {
  marker: WorldMapMarker
  x: number
  y: number
  radius: number
  selected: boolean
  hovered: boolean
  variant: WorldMapMarkerVariant
  markerClass: WorldMapMarkerClassValue
  markerStyle: WorldMapMarkerStyleValue
}

export interface WorldMapMarkerInteraction {
  marker: WorldMapMarker
  svgPoint: WorldMapPoint
  clientPoint: WorldMapPoint
  anchorRect: WorldMapAnchorRect
}
