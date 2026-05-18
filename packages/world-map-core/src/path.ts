import { projectWorldMapPosition } from "./projection"
import type {
  CreateWorldMapPathOptions,
  WorldMapCountryFeature,
  WorldMapPathFeature,
  WorldMapPosition,
} from "./types"

export function createWorldMapPath(
  feature: WorldMapCountryFeature,
  options: CreateWorldMapPathOptions,
): WorldMapPathFeature {
  const path = createGeometryPath(feature.geometry, options)
  const pathFeature: WorldMapPathFeature = {
    id: feature.id,
    name: feature.name,
    path,
  }

  if (feature.iso2 !== undefined) {
    pathFeature.iso2 = feature.iso2
  }
  if (feature.iso3 !== undefined) {
    pathFeature.iso3 = feature.iso3
  }
  if (feature.properties !== undefined) {
    pathFeature.properties = feature.properties
  }

  return pathFeature
}

export function createWorldMapPaths(
  features: WorldMapCountryFeature[],
  options: CreateWorldMapPathOptions,
): WorldMapPathFeature[] {
  return features.map((feature) => createWorldMapPath(feature, options))
}

function createGeometryPath(
  geometry: WorldMapCountryFeature["geometry"],
  options: CreateWorldMapPathOptions,
): string {
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates

  return polygons
    .flatMap((polygon) => polygon.map((ring) => createRingPath(ring, options)))
    .filter((path) => path.length > 0)
    .join(" ")
}

function createRingPath(
  ring: WorldMapPosition[],
  options: CreateWorldMapPathOptions,
): string {
  if (ring.length === 0) {
    return ""
  }

  const firstPosition = ring[0]!
  const firstPoint = projectWorldMapPosition(firstPosition, options)
  const commands = [`M ${formatCoordinate(firstPoint.x, options.precision)} ${formatCoordinate(firstPoint.y, options.precision)}`]
  let previousPoint = firstPoint

  for (const position of ring.slice(1)) {
    const point = projectWorldMapPosition(position, options)
    const command = shouldBreakPath(previousPoint.x, point.x, options) ? "M" : "L"
    commands.push(`${command} ${formatCoordinate(point.x, options.precision)} ${formatCoordinate(point.y, options.precision)}`)
    previousPoint = point
  }

  commands.push("Z")
  return commands.join(" ")
}

function shouldBreakPath(
  previousX: number,
  nextX: number,
  options: CreateWorldMapPathOptions,
): boolean {
  return (options.breakOnAntimeridian ?? true) &&
    Math.abs(nextX - previousX) > options.viewport.width / 2
}

function formatCoordinate(value: number, precision: number | undefined): string {
  if (precision === undefined) {
    return String(value)
  }

  return String(Number(value.toFixed(precision)))
}
