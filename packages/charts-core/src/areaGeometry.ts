import { getChartNumberValue, isFiniteChartNumber } from "./data.js"
import { resolveChartPlotArea } from "./layout.js"
import {
  computeChartNumericDomain,
  createChartLinearScale,
} from "./scale.js"
import type {
  AreaChartGeometry,
  AreaChartGeometryOptions,
  AreaChartPointGeometry,
  ChartDatum,
  ChartNumericDomain,
} from "./types.js"

interface ValidAreaDatum {
  key: string
  index: number
  row: ChartDatum
  xValue: number
  yValue: number
}

const FALLBACK_NUMERIC_DOMAIN: ChartNumericDomain = { min: 0, max: 1 }

export function createAreaChartGeometry(options: AreaChartGeometryOptions): AreaChartGeometry {
  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const baselineValue = resolveBaselineValue(options.baselineValue)
  const validPoints = collectValidAreaData(options)
  const xDomain = computeChartNumericDomain(validPoints.map((point) => point.xValue), {
    fallback: FALLBACK_NUMERIC_DOMAIN,
  })
  const yValues = validPoints.map((point) => point.yValue)
  if (options.baselineValue !== undefined) {
    yValues.push(baselineValue)
  }
  const yDomain = computeChartNumericDomain(yValues, {
    includeZero: options.includeZeroY ?? true,
    fallback: FALLBACK_NUMERIC_DOMAIN,
  })
  const xScale = createChartLinearScale(xDomain, {
    min: plotArea.x,
    max: plotArea.x + plotArea.width,
  })
  const yScale = createChartLinearScale(yDomain, {
    min: plotArea.y + plotArea.height,
    max: plotArea.y,
  })
  const baselineY = yScale.scale(baselineValue)

  if (validPoints.length === 0) {
    return {
      points: [],
      linePath: "",
      areaPath: "",
      baselineValue,
      baselineY,
      plotArea,
      xDomain,
      yDomain,
    }
  }

  const points = validPoints.map<AreaChartPointGeometry>((point) => ({
    ...point,
    x: xScale.scale(point.xValue),
    y: yScale.scale(point.yValue),
  }))

  return {
    points,
    linePath: createLinePath(points),
    areaPath: createAreaPath(points, baselineY),
    baselineValue,
    baselineY,
    plotArea,
    xDomain,
    yDomain,
  }
}

function collectValidAreaData(options: AreaChartGeometryOptions): ValidAreaDatum[] {
  const scaleType = options.xScaleType ?? "index"
  const validPoints: ValidAreaDatum[] = []

  for (const row of options.rows) {
    const yValue = getChartNumberValue(row, options.yField)
    if (yValue == null) {
      continue
    }

    const index = validPoints.length
    const xValue = scaleType === "number"
      ? getNumberXValue(row, options.xField)
      : index
    if (xValue == null) {
      continue
    }

    validPoints.push({
      key: `${index}`,
      index,
      row,
      xValue,
      yValue,
    })
  }

  return validPoints
}

function getNumberXValue(row: ChartDatum, field: string | undefined): number | null {
  if (field === undefined) {
    return null
  }
  return getChartNumberValue(row, field)
}

function resolveBaselineValue(value: number | undefined): number {
  if (value === undefined || !isFiniteChartNumber(value)) {
    return 0
  }
  return value
}

function createLinePath(points: readonly AreaChartPointGeometry[]): string {
  return points.map((point, index) => {
    const command = index === 0 ? "M" : "L"
    return `${command} ${point.x} ${point.y}`
  }).join(" ")
}

function createAreaPath(points: readonly AreaChartPointGeometry[], baselineY: number): string {
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  if (firstPoint === undefined || lastPoint === undefined || points.length < 2) {
    return ""
  }

  return [
    `M ${firstPoint.x} ${baselineY}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${lastPoint.x} ${baselineY}`,
    "Z",
  ].join(" ")
}
