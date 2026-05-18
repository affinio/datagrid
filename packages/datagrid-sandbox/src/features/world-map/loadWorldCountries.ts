import type {
  WorldMapCountryFeature,
  WorldMapGeometry,
  WorldMapPosition,
} from "@affino/world-map-core"

type GeoJsonPositionTuple = readonly [number, number, ...number[]]
type GeoJsonLinearRing = readonly GeoJsonPositionTuple[]
type GeoJsonPolygonCoordinates = readonly GeoJsonLinearRing[]
type GeoJsonMultiPolygonCoordinates = readonly GeoJsonPolygonCoordinates[]

interface GeoJsonPolygonGeometry {
  type: "Polygon"
  coordinates: GeoJsonPolygonCoordinates
}

interface GeoJsonMultiPolygonGeometry {
  type: "MultiPolygon"
  coordinates: GeoJsonMultiPolygonCoordinates
}

type GeoJsonGeometry = GeoJsonPolygonGeometry | GeoJsonMultiPolygonGeometry

interface GeoJsonFeature {
  type?: "Feature"
  id?: unknown
  properties?: Record<string, unknown> | null
  geometry?: GeoJsonGeometry | null
}

export interface GeoJsonFeatureCollection {
  type?: "FeatureCollection"
  features?: readonly GeoJsonFeature[]
}

export async function loadNormalizedWorldCountries110m(): Promise<WorldMapCountryFeature[]> {
  const response = await fetch("/maps/world-countries-110m.normalized.json")
  if (!response.ok) {
    throw new Error(`[world-map] Failed to load normalized countries-110m.json: ${response.status}`)
  }

  const countries = await response.json() as unknown
  return Array.isArray(countries) ? countries as WorldMapCountryFeature[] : []
}

export function geoJsonFeaturesToWorldMapCountryFeatures(
  geoJson: unknown,
): WorldMapCountryFeature[] {
  if (isGeoJsonFeatureCollection(geoJson)) {
    return geoJson.features.flatMap((feature, index) => {
      const country = geoJsonFeatureToWorldMapCountryFeature(feature, index)
      return country === null ? [] : [country]
    })
  }

  if (isGeoJsonFeature(geoJson)) {
    const country = geoJsonFeatureToWorldMapCountryFeature(geoJson, 0)
    return country === null ? [] : [country]
  }

  return []
}

export function geoJsonFeatureToWorldMapCountryFeature(
  feature: GeoJsonFeature,
  index: number,
): WorldMapCountryFeature | null {
  const geometry = geoJsonGeometryToWorldMapGeometry(feature.geometry)
  if (geometry === null) {
    return null
  }

  const properties = feature.properties ?? {}
  const id = String(feature.id ?? properties.iso_a3 ?? properties.ISO_A3 ?? properties.name ?? index)
  const name = String(properties.name ?? properties.NAME ?? id)
  const countryFeature: WorldMapCountryFeature = {
    id,
    name,
    geometry,
  }
  const iso2 = stringProperty(properties.iso_a2 ?? properties.ISO_A2)
  const iso3 = stringProperty(properties.iso_a3 ?? properties.ISO_A3 ?? properties.adm0_a3 ?? properties.ADM0_A3)

  if (iso2 !== undefined) {
    countryFeature.iso2 = iso2
  }
  if (iso3 !== undefined) {
    countryFeature.iso3 = iso3
  }
  if (feature.properties !== undefined && feature.properties !== null) {
    countryFeature.properties = feature.properties
  }

  return countryFeature
}

export function geoJsonGeometryToWorldMapGeometry(
  geometry: GeoJsonGeometry | null | undefined,
): WorldMapGeometry | null {
  if (geometry?.type === "Polygon") {
    const coordinates = convertPolygonCoordinates(geometry.coordinates)
    return coordinates.length === 0 ? null : { type: "Polygon", coordinates }
  }

  if (geometry?.type === "MultiPolygon") {
    const coordinates = geometry.coordinates
      .map(convertPolygonCoordinates)
      .filter((polygon) => polygon.length > 0)

    return coordinates.length === 0 ? null : { type: "MultiPolygon", coordinates }
  }

  return null
}

function convertPolygonCoordinates(coordinates: GeoJsonPolygonCoordinates): WorldMapPosition[][] {
  return coordinates
    .map(convertLinearRing)
    .filter((ring) => ring.length > 0)
}

function convertLinearRing(ring: GeoJsonLinearRing): WorldMapPosition[] {
  return ring.flatMap(([lon, lat]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return []
    }

    return [{ lon, lat }]
  })
}

function isGeoJsonFeatureCollection(value: unknown): value is GeoJsonFeatureCollection & {
  features: readonly GeoJsonFeature[]
} {
  return isRecord(value) && Array.isArray(value.features)
}

function isGeoJsonFeature(value: unknown): value is GeoJsonFeature {
  return isRecord(value) && value.geometry !== undefined
}

function stringProperty(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
