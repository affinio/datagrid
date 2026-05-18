import { projectWorldMapPosition } from "./projection"
import type {
  CreateWorldMapPathOptions,
  WorldMapCountryFeature,
  WorldMapPathFeature,
  WorldMapPosition,
} from "./types"

interface ProjectedPathPoint {
  x: number
  y: number
}

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

  const points = ring.map((position) => projectWorldMapPosition(position, options))
  if (shouldUnwrapRing(points, options)) {
    return createUnwrappedRingPath(points, options)
  }

  return createClosedRingPath(points, options, 0)
}

function createUnwrappedRingPath(
  points: ProjectedPathPoint[],
  options: CreateWorldMapPathOptions,
): string {
  const viewportWidth = options.viewport.width
  const unwrappedPoints = unwrapProjectedRing(points, viewportWidth)
  const minX = Math.min(...unwrappedPoints.map((point) => point.x))
  const maxX = Math.max(...unwrappedPoints.map((point) => point.x))
  const minShift = Math.floor((0 - maxX) / viewportWidth)
  const maxShift = Math.ceil((viewportWidth - minX) / viewportWidth)

  return Array.from({ length: maxShift - minShift + 1 }, (_, index) => minShift + index)
    .filter((shift) => maxX + shift * viewportWidth >= 0 && minX + shift * viewportWidth <= viewportWidth)
    .map((shift) => createClosedRingPath(unwrappedPoints, options, shift * viewportWidth))
    .join(" ")
}

function createClosedRingPath(
  points: ProjectedPathPoint[],
  options: CreateWorldMapPathOptions,
  offsetX: number,
): string {
  const [firstPoint, ...remainingPoints] = points
  if (firstPoint === undefined) {
    return ""
  }

  const commands = [`M ${formatCoordinate(firstPoint.x + offsetX, options.precision)} ${formatCoordinate(firstPoint.y, options.precision)}`]
  commands.push(...remainingPoints.map((point) => (
    `L ${formatCoordinate(point.x + offsetX, options.precision)} ${formatCoordinate(point.y, options.precision)}`
  )))
  commands.push("Z")
  return commands.join(" ")
}

function unwrapProjectedRing(
  points: ProjectedPathPoint[],
  viewportWidth: number,
): ProjectedPathPoint[] {
  const [firstPoint, ...remainingPoints] = points
  if (firstPoint === undefined) {
    return []
  }

  const unwrappedPoints = [{ ...firstPoint }]
  for (const point of remainingPoints) {
    const previousPoint = unwrappedPoints[unwrappedPoints.length - 1]!
    let x = point.x
    while (x - previousPoint.x > viewportWidth / 2) {
      x -= viewportWidth
    }
    while (previousPoint.x - x > viewportWidth / 2) {
      x += viewportWidth
    }
    unwrappedPoints.push({ x, y: point.y })
  }

  return unwrappedPoints
}

function shouldUnwrapRing(
  points: ProjectedPathPoint[],
  options: CreateWorldMapPathOptions,
): boolean {
  return points.some((point, index) => {
    const previousPoint = points[index - 1]
    return previousPoint !== undefined && shouldBreakPath(previousPoint.x, point.x, options)
  })
}

function shouldBreakPath(
  previousX: number,
  nextX: number,
  options: CreateWorldMapPathOptions,
): boolean {
  const strategy = options.antimeridianStrategy ?? (options.breakOnAntimeridian === false ? "none" : "break-lines")
  return strategy === "break-lines" &&
    options.viewport.width > 0 &&
    Math.abs(nextX - previousX) > options.viewport.width / 2
}

function formatCoordinate(value: number, precision: number | undefined): string {
  if (precision === undefined) {
    return String(value)
  }

  return String(Number(value.toFixed(precision)))
}
