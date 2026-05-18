import { getChartNumberValue } from "./data"
import { resolveChartPlotArea } from "./layout"
import {
  computeChartNumericDomain,
  createChartLinearScale,
} from "./scale"
import type {
  ChartDatum,
  ChartLinearScale,
  ChartNumericDomain,
  ScatterChartGeometry,
  ScatterChartGeometryOptions,
  ScatterChartPointGeometry,
} from "./types"

interface ValidScatterDatum {
  key: string
  index: number
  row: ChartDatum
  xValue: number
  yValue: number
  radiusValue: number | null
}

const FALLBACK_NUMERIC_DOMAIN: ChartNumericDomain = { min: 0, max: 1 }
const DEFAULT_SCATTER_RADIUS = 4
const DEFAULT_BUBBLE_MIN_RADIUS = 3
const DEFAULT_BUBBLE_MAX_RADIUS = 12

export function createScatterChartGeometry(options: ScatterChartGeometryOptions): ScatterChartGeometry {
  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const validPoints = collectValidScatterData(options)
  const xDomain = computeChartNumericDomain(validPoints.map((point) => point.xValue), {
    includeZero: options.includeZeroX ?? false,
    fallback: FALLBACK_NUMERIC_DOMAIN,
  })
  const yDomain = computeChartNumericDomain(validPoints.map((point) => point.yValue), {
    includeZero: options.includeZeroY ?? false,
    fallback: FALLBACK_NUMERIC_DOMAIN,
  })
  const validRadiusValues = validPoints.flatMap((point) => (
    point.radiusValue == null ? [] : [point.radiusValue]
  ))
  const radiusDomain = options.radiusField !== undefined && validRadiusValues.length > 0
    ? computeChartNumericDomain(validRadiusValues, { fallback: FALLBACK_NUMERIC_DOMAIN })
    : null

  if (validPoints.length === 0) {
    return {
      points: [],
      plotArea,
      xDomain,
      yDomain,
      radiusDomain: null,
    }
  }

  const xScale = createChartLinearScale(xDomain, {
    min: plotArea.x,
    max: plotArea.x + plotArea.width,
  })
  const yScale = createChartLinearScale(yDomain, {
    min: plotArea.y + plotArea.height,
    max: plotArea.y,
  })
  const radiusScale = createRadiusScale(options, radiusDomain)
  const fallbackRadius = resolveFallbackRadius(options)
  const points = validPoints.map<ScatterChartPointGeometry>((point) => ({
    ...point,
    x: xScale.scale(point.xValue),
    y: yScale.scale(point.yValue),
    radius: point.radiusValue == null || radiusScale === null
      ? fallbackRadius
      : radiusScale.scale(point.radiusValue),
  }))

  return {
    points,
    plotArea,
    xDomain,
    yDomain,
    radiusDomain,
  }
}

function collectValidScatterData(options: ScatterChartGeometryOptions): ValidScatterDatum[] {
  const validPoints: ValidScatterDatum[] = []

  for (const row of options.rows) {
    const xValue = getChartNumberValue(row, options.xField)
    const yValue = getChartNumberValue(row, options.yField)
    if (xValue == null || yValue == null) {
      continue
    }

    const index = validPoints.length
    validPoints.push({
      key: `${index}`,
      index,
      row,
      xValue,
      yValue,
      radiusValue: options.radiusField === undefined
        ? null
        : getChartNumberValue(row, options.radiusField),
    })
  }

  return validPoints
}

function createRadiusScale(
  options: ScatterChartGeometryOptions,
  radiusDomain: ChartNumericDomain | null,
): ChartLinearScale | null {
  if (radiusDomain === null) {
    return null
  }

  const radiusRange = resolveBubbleRadiusRange(options)
  return createChartLinearScale(radiusDomain, radiusRange)
}

function resolveFallbackRadius(options: ScatterChartGeometryOptions): number {
  if (options.radiusField === undefined) {
    return sanitizeRadius(options.minRadius ?? DEFAULT_SCATTER_RADIUS)
  }

  return resolveBubbleRadiusRange(options).min
}

function resolveBubbleRadiusRange(options: ScatterChartGeometryOptions): { min: number; max: number } {
  const min = sanitizeRadius(options.minRadius ?? DEFAULT_BUBBLE_MIN_RADIUS)
  const max = Math.max(min, sanitizeRadius(options.maxRadius ?? DEFAULT_BUBBLE_MAX_RADIUS))
  return { min, max }
}

function sanitizeRadius(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  return value
}
