import { isFiniteChartNumber } from "./data.js"
import { resolveChartPlotArea } from "./layout.js"
import { computeChartNumericDomain, createChartLinearScale } from "./scale.js"
import type {
  ChartNumericDomain,
  TimeAxisOptions,
  TimeAxisTick,
  TimeSeries,
  TimeSeriesChartGeometry,
  TimeSeriesChartOptions,
  TimeSeriesGeometry,
  TimeSeriesGeometryPoint,
  TimeSeriesTooltip,
} from "./types.js"

const FALLBACK_DOMAIN: ChartNumericDomain = { min: 0, max: 1 }
const DEFAULT_MIN_TICK_SPACING = 84
const DEFAULT_LINE_WIDTH = 2
const DEFAULT_AREA_OPACITY = 0.18
const MAX_GENERATED_TICKS = 1_000

interface TimeInterval {
  approximateMs: number
  floor(timestamp: number): number
  offset(timestamp: number): number
}

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const TIME_INTERVALS: readonly TimeInterval[] = [
  fixedInterval(SECOND),
  fixedInterval(5 * SECOND),
  fixedInterval(15 * SECOND),
  fixedInterval(30 * SECOND),
  fixedInterval(MINUTE),
  fixedInterval(5 * MINUTE),
  fixedInterval(15 * MINUTE),
  fixedInterval(30 * MINUTE),
  fixedInterval(HOUR),
  fixedInterval(3 * HOUR),
  fixedInterval(6 * HOUR),
  fixedInterval(12 * HOUR),
  fixedInterval(DAY),
  fixedInterval(2 * DAY),
  fixedInterval(7 * DAY),
  calendarMonthInterval(1),
  calendarMonthInterval(3),
  calendarMonthInterval(6),
  calendarYearInterval(1),
  calendarYearInterval(2),
  calendarYearInterval(5),
  calendarYearInterval(10),
]

export function validateTimeSeries(series: readonly TimeSeries[]): void {
  const ids = new Set<string>()

  for (const item of series) {
    if (item.id.trim() === "") {
      throw new TypeError("Time-series ids must be non-empty strings.")
    }
    if (item.label.trim() === "") {
      throw new TypeError(`Time series "${item.id}" must have a non-empty label.`)
    }
    if (ids.has(item.id)) {
      throw new TypeError(`Duplicate time-series id "${item.id}".`)
    }
    ids.add(item.id)

    let previousTime = -Infinity
    for (let index = 0; index < item.data.length; index += 1) {
      const point = item.data[index]
      if (point === undefined || !isFiniteChartNumber(point.time) || !isFiniteChartNumber(point.value)) {
        throw new TypeError(`Time series "${item.id}" contains a non-finite point at index ${index}.`)
      }
      if (point.time <= previousTime) {
        const reason = point.time === previousTime ? "duplicate" : "unsorted"
        throw new RangeError(`Time series "${item.id}" contains ${reason} timestamps at index ${index}.`)
      }
      previousTime = point.time
    }
  }
}

export function createTimeSeriesChartGeometry(options: TimeSeriesChartOptions): TimeSeriesChartGeometry {
  validateTimeSeries(options.series)

  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const visibleSeries = options.series.filter((series) => series.visible !== false)
  const timestamps = visibleSeries.flatMap((series) => series.data.map((point) => point.time))
  const values = visibleSeries.flatMap((series) => series.data.map((point) => point.value))
  const hasArea = visibleSeries.some((series) => series.presentation?.type === "area")
  const timeDomain = computeChartNumericDomain(timestamps, { fallback: FALLBACK_DOMAIN })
  const valueDomain = computeChartNumericDomain(values, {
    fallback: FALLBACK_DOMAIN,
    includeZero: options.yAxis?.includeZero ?? hasArea,
  })
  const xScale = createChartLinearScale(timeDomain, {
    min: plotArea.x,
    max: plotArea.x + plotArea.width,
  })
  const yScale = createChartLinearScale(valueDomain, {
    min: plotArea.y + plotArea.height,
    max: plotArea.y,
  })
  const zeroY = valueDomain.min <= 0 && valueDomain.max >= 0 ? yScale.scale(0) : null
  const geometries = visibleSeries.map<TimeSeriesGeometry>((series) => {
    const points = series.data.map<TimeSeriesGeometryPoint>((point, index) => ({
      ...point,
      index,
      x: xScale.scale(point.time),
      y: yScale.scale(point.value),
    }))
    const type = series.presentation?.type ?? "line"

    return {
      id: series.id,
      label: series.label,
      presentation: {
        type,
        color: series.presentation?.color,
        lineWidth: series.presentation?.lineWidth ?? DEFAULT_LINE_WIDTH,
        areaOpacity: series.presentation?.areaOpacity ?? DEFAULT_AREA_OPACITY,
      },
      points,
      linePath: createLinePath(points),
      areaPath: type === "area" ? createAreaPath(points, zeroY ?? plotArea.y + plotArea.height) : "",
    }
  })

  return {
    series: geometries,
    plotArea,
    timeDomain,
    valueDomain,
    timeTicks: createTimeAxisTicks(timeDomain, {
      min: plotArea.x,
      max: plotArea.x + plotArea.width,
    }, options.timeAxis),
    zeroY,
  }
}

export function createTimeAxisTicks(
  domain: ChartNumericDomain,
  range: { min: number; max: number },
  options: TimeAxisOptions = {},
): TimeAxisTick[] {
  const width = Math.max(0, range.max - range.min)
  const span = Math.max(1, domain.max - domain.min)
  const responsiveTarget = Math.max(2, Math.floor(width / (options.minTickSpacing ?? DEFAULT_MIN_TICK_SPACING)) + 1)
  const targetTickCount = Math.max(2, Math.floor(options.targetTickCount ?? responsiveTarget))
  const desiredInterval = span / Math.max(1, targetTickCount - 1)
  const interval = TIME_INTERVALS.find((candidate) => candidate.approximateMs >= desiredInterval)
    ?? TIME_INTERVALS[TIME_INTERVALS.length - 1]
  if (interval === undefined) {
    return []
  }

  const scale = createChartLinearScale(domain, range)
  const ticks: TimeAxisTick[] = []
  let value = interval.floor(domain.min)
  if (value < domain.min) {
    value = interval.offset(value)
  }

  while (value <= domain.max && ticks.length < MAX_GENERATED_TICKS) {
    ticks.push({
      value,
      x: scale.scale(value),
      label: formatTimeAxisTick(value, options, span),
    })
    const nextValue = interval.offset(value)
    if (nextValue <= value) {
      break
    }
    value = nextValue
  }

  if (ticks.length === 0) {
    const value = domain.min + span / 2
    return [{ value, x: scale.scale(value), label: formatTimeAxisTick(value, options, span) }]
  }
  return ticks
}

export function formatTimeAxisTick(timestamp: number, options: TimeAxisOptions = {}, span = DAY): string {
  if (!isFiniteChartNumber(timestamp)) {
    throw new TypeError("Time-axis timestamps must be finite UTC Unix milliseconds.")
  }
  if (options.format !== undefined) {
    return options.format(timestamp)
  }

  const formatOptions = options.formatOptions ?? defaultTimeFormatOptions(span)
  return new Intl.DateTimeFormat(options.locale, {
    ...formatOptions,
    timeZone: "UTC",
  }).format(new Date(timestamp))
}

export function resolveTimeSeriesTooltip(
  series: readonly TimeSeries[],
  targetTimestamp: number,
): TimeSeriesTooltip | null {
  validateTimeSeries(series)
  if (!isFiniteChartNumber(targetTimestamp)) {
    throw new TypeError("Tooltip target timestamp must be finite UTC Unix milliseconds.")
  }

  const visibleSeries = series.filter((item) => item.visible !== false && item.data.length > 0)
  const timestamps = [...new Set(visibleSeries.flatMap((item) => item.data.map((point) => point.time)))]
    .sort((left, right) => left - right)
  const timestamp = findNearestValue(timestamps, targetTimestamp)
  if (timestamp === null) {
    return null
  }

  return {
    timestamp,
    entries: visibleSeries.flatMap((item) => {
      const point = findPointAtTimestamp(item, timestamp)
      return point === null ? [] : [{
        seriesId: item.id,
        seriesLabel: item.label,
        value: point.value,
        color: item.presentation?.color,
      }]
    }),
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

function fixedInterval(milliseconds: number): TimeInterval {
  return {
    approximateMs: milliseconds,
    floor: (timestamp) => Math.floor(timestamp / milliseconds) * milliseconds,
    offset: (timestamp) => timestamp + milliseconds,
  }
}

function calendarMonthInterval(step: number): TimeInterval {
  return {
    approximateMs: step * 30.4375 * DAY,
    floor(timestamp) {
      const date = new Date(timestamp)
      const month = Math.floor(date.getUTCMonth() / step) * step
      return Date.UTC(date.getUTCFullYear(), month, 1)
    },
    offset(timestamp) {
      const date = new Date(timestamp)
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + step, 1)
    },
  }
}

function calendarYearInterval(step: number): TimeInterval {
  return {
    approximateMs: step * 365.2425 * DAY,
    floor(timestamp) {
      const year = Math.floor(new Date(timestamp).getUTCFullYear() / step) * step
      return Date.UTC(year, 0, 1)
    },
    offset(timestamp) {
      return Date.UTC(new Date(timestamp).getUTCFullYear() + step, 0, 1)
    },
  }
}

function defaultTimeFormatOptions(span: number): Intl.DateTimeFormatOptions {
  if (span < DAY) {
    return { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
  }
  if (span < 370 * DAY) {
    return { month: "short", day: "2-digit" }
  }
  return { year: "numeric", month: "short" }
}

function findNearestValue(values: readonly number[], target: number): number | null {
  if (values.length === 0) {
    return null
  }
  let low = 0
  let high = values.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const value = values[middle]
    if (value === undefined) {
      return null
    }
    if (value < target) {
      low = middle + 1
    } else if (value > target) {
      high = middle - 1
    } else {
      return value
    }
  }
  const before = values[Math.max(0, high)]
  const after = values[Math.min(values.length - 1, low)]
  if (before === undefined) return after ?? null
  if (after === undefined) return before
  return target - before <= after - target ? before : after
}

function findPointAtTimestamp(series: TimeSeries, timestamp: number): TimeSeries["data"][number] | null {
  let low = 0
  let high = series.data.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const point = series.data[middle]
    if (point === undefined) return null
    if (point.time < timestamp) low = middle + 1
    else if (point.time > timestamp) high = middle - 1
    else return point
  }
  return null
}
