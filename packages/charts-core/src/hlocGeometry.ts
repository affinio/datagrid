import { isFiniteChartNumber } from "./data.js"
import { resolveChartPlotArea } from "./layout.js"
import { computeChartNumericDomain, createChartLinearScale } from "./scale.js"
import { createTimeAxisTicks } from "./timeSeries.js"
import type { HlocChartGeometry, HlocChartOptions, HlocPoint } from "./types.js"

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
  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const timeDomain = computeChartNumericDomain(options.data.map((point) => point.time), { fallback: FALLBACK_DOMAIN })
  const valueDomain = computeChartNumericDomain(
    options.data.flatMap((point) => [point.high, point.low, point.open, point.close]),
    { fallback: FALLBACK_DOMAIN, includeZero: options.yAxis?.includeZero ?? false },
  )
  const xScale = createChartLinearScale(timeDomain, { min: plotArea.x, max: plotArea.x + plotArea.width })
  const yScale = createChartLinearScale(valueDomain, { min: plotArea.y + plotArea.height, max: plotArea.y })
  const tickWidth = Math.max(1, options.tickWidth ?? DEFAULT_TICK_WIDTH)

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
    plotArea,
    timeDomain,
    valueDomain,
    timeTicks: createTimeAxisTicks(timeDomain, {
      min: plotArea.x,
      max: plotArea.x + plotArea.width,
    }, options.timeAxis),
  }
}
