import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import topojsonClient from "topojson-client"

const { feature: topoJsonFeature } = topojsonClient

const scriptDir = dirname(fileURLToPath(import.meta.url))
const sandboxRoot = resolve(scriptDir, "..")
const inputPath = resolve(sandboxRoot, "public/maps/countries-110m.json")
const outputPath = resolve(sandboxRoot, "public/maps/world-countries-110m.normalized.json")

const topology = JSON.parse(await readFile(inputPath, "utf8"))
const countriesObject = topology.objects?.countries

if (countriesObject === undefined) {
  throw new Error("[world-map] TopoJSON is missing objects.countries")
}

const geoJson = topoJsonFeature(topology, countriesObject)
const countries = geoJsonFeaturesToWorldMapCountryFeatures(geoJson)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(countries)}\n`, "utf8")

console.log(`[world-map] Features written: ${countries.length}`)
console.log(`[world-map] Output: ${outputPath}`)

function geoJsonFeaturesToWorldMapCountryFeatures(geoJson) {
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

function geoJsonFeatureToWorldMapCountryFeature(feature, index) {
  const geometry = geoJsonGeometryToWorldMapGeometry(feature.geometry)
  if (geometry === null) {
    return null
  }

  const properties = feature.properties ?? {}
  const id = String(feature.id ?? properties.iso_a3 ?? properties.ISO_A3 ?? properties.name ?? index)
  const name = String(properties.name ?? properties.NAME ?? id)
  const countryFeature = {
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

function geoJsonGeometryToWorldMapGeometry(geometry) {
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

function convertPolygonCoordinates(coordinates) {
  return coordinates
    .map(convertLinearRing)
    .filter((ring) => ring.length > 0)
}

function convertLinearRing(ring) {
  return ring.flatMap(([lon, lat]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return []
    }

    return [{ lon, lat }]
  })
}

function isGeoJsonFeatureCollection(value) {
  return isRecord(value) && Array.isArray(value.features)
}

function isGeoJsonFeature(value) {
  return isRecord(value) && value.geometry !== undefined
}

function stringProperty(value) {
  return value === undefined || value === null ? undefined : String(value)
}

function isRecord(value) {
  return typeof value === "object" && value !== null
}
