import { isFiniteChartNumber } from "./data.js"
import { resolveChartPlotArea } from "./layout.js"
import { computeChartNumericDomain, createChartLinearScale } from "./scale.js"
import { createTimeAxisTicks, validateTimeSeries } from "./timeSeries.js"
import type {
  HlocChartGeometry,
  HlocChartOptions,
  HlocMarker,
  HlocMarkerGeometry,
  HlocPoint,
  TimeSeriesGeometry,
  TimeSeriesGeometryPoint,
} from "./types.js"

const FALLBACK_DOMAIN = { min: 0, max: 1 }
const DEFAULT_TICK_WIDTH = 6

export function validateHlocData(data: readonly HlocPoint[]): void {
  let previousTime = -Infinity
  for (let index = 0; index < data.length; index += 1) {
    const point = data[index]
    if (point === undefined || !isFiniteChartNumber(point.time)
      || !isFiniteChartNumber(point.high) || !isFiniteChartNumber(point.low)
      || !isFiniteChartNumber(point.open) || !isFiniteChartNumber(point.close)) {
      throw new TypeError(`HLOC data contains a non-finite point at index ${index}.`)
    }
    if (point.time <= previousTime) {
      throw new RangeError(`HLOC data contains ${point.time === previousTime ? "duplicate" : "unsorted"} timestamps at index ${index}.`)
    }
    if (point.high < Math.max(point.open, point.close) || point.low > Math.min(point.open, point.close)) {
      throw new RangeError(`HLOC point at index ${index} has inconsistent high/low bounds.`)
    }
    previousTime = point.time
  }
}

export function createHlocChartGeometry(options: HlocChartOptions): HlocChartGeometry {
  validateHlocData(options.data)
  validateTimeSeries(options.overlays ?? [])
  validateHlocMarkers(options.markers ?? [])
  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const candleTimes = options.data.map((point) => point.time)
  const timeDomain = computeChartNumericDomain(candleTimes, { fallback: FALLBACK_DOMAIN })
  const firstCandleTime = candleTimes[0]
  const lastCandleTime = candleTimes[candleTimes.length - 1]
  const isInCandleRange = (time: number): boolean => (
    firstCandleTime !== undefined && lastCandleTime !== undefined
    && time >= firstCandleTime && time <= lastCandleTime
  )
  const visibleOverlays = (options.overlays ?? []).filter((series) => series.visible !== false)
  const overlayValues = visibleOverlays.flatMap((series) => (
    series.data.filter((point) => isInCandleRange(point.time)).map((point) => point.value)
  ))
  const markerValues = (options.markers ?? [])
    .filter((marker) => isInCandleRange(marker.time))
    .map((marker) => marker.value)
  const valueDomain = computeChartNumericDomain(
    [
      ...options.data.flatMap((point) => [point.high, point.low, point.open, point.close]),
      ...overlayValues,
      ...markerValues,
    ],
    { fallback: FALLBACK_DOMAIN, includeZero: options.yAxis?.includeZero ?? false },
  )
  const xScale = createChartLinearScale(timeDomain, { min: plotArea.x, max: plotArea.x + plotArea.width })
  const yScale = createChartLinearScale(valueDomain, { min: plotArea.y + plotArea.height, max: plotArea.y })
  const tickWidth = Math.max(1, options.tickWidth ?? DEFAULT_TICK_WIDTH)
  const overlays = visibleOverlays.map<TimeSeriesGeometry>((series) => {
    const points = series.data
      .filter((point) => isInCandleRange(point.time))
      .map<TimeSeriesGeometryPoint>((point, index) => ({
        ...point,
        index,
        x: xScale.scale(point.time),
        y: yScale.scale(point.value),
      }))
    const type = series.presentation?.type ?? "line"
    const zeroY = valueDomain.min <= 0 && valueDomain.max >= 0
      ? yScale.scale(0)
      : plotArea.y + plotArea.height

    return {
      id: series.id,
      label: series.label,
      presentation: {
        type,
        color: series.presentation?.color,
        lineWidth: series.presentation?.lineWidth ?? 2,
        areaOpacity: series.presentation?.areaOpacity ?? 0.18,
      },
      points,
      linePath: createLinePath(points),
      areaPath: type === "area" ? createAreaPath(points, zeroY) : "",
    }
  })
  const markers = (options.markers ?? [])
    .filter((marker) => isInCandleRange(marker.time))
    .map<HlocMarkerGeometry>((marker) => ({
      ...marker,
      x: xScale.scale(marker.time),
      y: yScale.scale(marker.value),
    }))

  return {
    points: options.data.map((point, index) => ({
      ...point,
      index,
      x: xScale.scale(point.time),
      highY: yScale.scale(point.high),
      lowY: yScale.scale(point.low),
      openY: yScale.scale(point.open),
      closeY: yScale.scale(point.close),
      openX: xScale.scale(point.time) - tickWidth,
      closeX: xScale.scale(point.time) + tickWidth,
      direction: point.close > point.open ? "up" : point.close < point.open ? "down" : "flat",
    })),
    overlays,
    markers,
    plotArea,
    timeDomain,
    valueDomain,
    timeTicks: createTimeAxisTicks(timeDomain, {
      min: plotArea.x,
      max: plotArea.x + plotArea.width,
    }, options.timeAxis),
  }
}

export function validateHlocMarkers(markers: readonly HlocMarker[]): void {
  const ids = new Set<string>()
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]
    if (marker === undefined || marker.id.trim() === "" || marker.label.trim() === "") {
      throw new TypeError(`HLOC marker at index ${index} must have a non-empty id and label.`)
    }
    if (ids.has(marker.id)) {
      throw new TypeError(`Duplicate HLOC marker id "${marker.id}".`)
    }
    if (!isFiniteChartNumber(marker.time) || !isFiniteChartNumber(marker.value)) {
      throw new TypeError(`HLOC marker "${marker.id}" contains a non-finite coordinate.`)
    }
    if (marker.color !== undefined && marker.color.trim() === "") {
      throw new TypeError(`HLOC marker "${marker.id}" has an empty color.`)
    }
    if (marker.radius !== undefined && (!isFiniteChartNumber(marker.radius) || marker.radius <= 0)) {
      throw new RangeError(`HLOC marker "${marker.id}" radius must be a positive finite number.`)
    }
    ids.add(marker.id)
  }
}

function createLinePath(points: readonly TimeSeriesGeometryPoint[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
}

function createAreaPath(points: readonly TimeSeriesGeometryPoint[], baselineY: number): string {
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined || points.length < 2) {
    return ""
  }
  return [`M ${first.x} ${baselineY}`, ...points.map((point) => `L ${point.x} ${point.y}`), `L ${last.x} ${baselineY}`, "Z"].join(" ")
}
