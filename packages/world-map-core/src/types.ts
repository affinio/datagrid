export type WorldMapCountryId = string

export interface WorldMapPosition {
  lon: number
  lat: number
}

export interface WorldMapViewport {
  width: number
  height: number
}

export interface WorldMapScreenPoint {
  x: number
  y: number
}

export type WorldMapProjectionType = "equirectangular"

export interface ProjectWorldMapPositionOptions {
  viewport: WorldMapViewport
  projection?: WorldMapProjectionType
}

export interface CreateWorldMapPathOptions {
  viewport: WorldMapViewport
  projection?: WorldMapProjectionType
  precision?: number
  breakOnAntimeridian?: boolean
}

export interface WorldMapPolygonGeometry {
  type: "Polygon"
  coordinates: WorldMapPosition[][]
}

export interface WorldMapMultiPolygonGeometry {
  type: "MultiPolygon"
  coordinates: WorldMapPosition[][][]
}

export type WorldMapGeometry =
  | WorldMapPolygonGeometry
  | WorldMapMultiPolygonGeometry

export interface WorldMapCountryFeature {
  id: WorldMapCountryId
  name: string
  iso2?: string
  iso3?: string
  geometry: WorldMapGeometry
  properties?: Record<string, unknown>
}

export interface WorldMapPathFeature {
  id: WorldMapCountryId
  name: string
  iso2?: string
  iso3?: string
  path: string
  properties?: Record<string, unknown>
}
