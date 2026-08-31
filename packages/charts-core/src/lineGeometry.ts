import { getChartNumberValue } from "./data.js"
import { resolveChartPlotArea } from "./layout.js"
import {
  computeChartNumericDomain,
  createChartLinearScale,
} from "./scale.js"
import type {
  ChartDatum,
  ChartNumericDomain,
  LineChartGeometry,
  LineChartGeometryOptions,
  LineChartPointGeometry,
} from "./types.js"

interface ValidLineDatum {
  key: string
  index: number
  row: ChartDatum
  xValue: number
  yValue: number
}

const FALLBACK_NUMERIC_DOMAIN: ChartNumericDomain = { min: 0, max: 1 }

export function createLineChartGeometry(options: LineChartGeometryOptions): LineChartGeometry {
  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const validPoints = collectValidLineData(options)
  const xDomain = computeChartNumericDomain(validPoints.map((point) => point.xValue), {
    fallback: FALLBACK_NUMERIC_DOMAIN,
  })
  const yDomain = computeChartNumericDomain(validPoints.map((point) => point.yValue), {
    includeZero: options.includeZeroY ?? false,
    fallback: FALLBACK_NUMERIC_DOMAIN,
  })

  if (validPoints.length === 0) {
    return {
      points: [],
      path: "",
      plotArea,
      xDomain,
      yDomain,
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
  const points = validPoints.map<LineChartPointGeometry>((point) => ({
    ...point,
    x: xScale.scale(point.xValue),
    y: yScale.scale(point.yValue),
  }))

  return {
    points,
    path: createLinePath(points),
    plotArea,
    xDomain,
    yDomain,
  }
}

function collectValidLineData(options: LineChartGeometryOptions): ValidLineDatum[] {
  const scaleType = options.xScaleType ?? "index"
  const validPoints: ValidLineDatum[] = []

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

function createLinePath(points: readonly LineChartPointGeometry[]): string {
  return points.map((point, index) => {
    const command = index === 0 ? "M" : "L"
    return `${command} ${point.x} ${point.y}`
  }).join(" ")
}
