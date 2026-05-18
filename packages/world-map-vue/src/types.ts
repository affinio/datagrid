export interface WorldMapMarker {
  id: string
  lon: number
  lat: number
  label?: string
  value?: number
  properties?: Record<string, unknown>
}
