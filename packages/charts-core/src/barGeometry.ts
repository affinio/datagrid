import { createChartBandScale } from "./bandScale"
import { getChartNumberValue, getChartStringValue } from "./data"
import { resolveChartPlotArea } from "./layout"
import {
  computeChartNumericDomain,
  createChartLinearScale,
} from "./scale"
import type {
  BarChartBarGeometry,
  BarChartGeometry,
  BarChartGeometryOptions,
  ChartDatum,
  ChartNumericDomain,
} from "./types"

interface ValidBarDatum {
  key: string
  index: number
  row: ChartDatum
  category: string
  value: number
}

export function createBarChartGeometry(options: BarChartGeometryOptions): BarChartGeometry {
  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const validBars = collectValidBarData(options)
  const values = validBars.map((bar) => bar.value)
  const valueDomain = computeChartNumericDomain(values, {
    includeZero: options.includeZero ?? true,
    fallback: { min: 0, max: 1 },
  })
  const categories = validBars.map((bar) => bar.key)

  if (validBars.length === 0) {
    return {
      bars: [],
      plotArea,
      valueDomain,
      categories,
    }
  }

  const xScale = createChartBandScale({
    categories,
    range: { min: plotArea.x, max: plotArea.x + plotArea.width },
    paddingInner: options.paddingInner,
    paddingOuter: options.paddingOuter,
  })
  const yScale = createChartLinearScale(valueDomain, {
    min: plotArea.y + plotArea.height,
    max: plotArea.y,
  })
  const baselineY = yScale.scale(resolveBarBaseline(valueDomain))
  const bars = validBars.map<BarChartBarGeometry>((bar) => {
    const valueY = yScale.scale(bar.value)
    const x = xScale.scale(bar.key) ?? plotArea.x

    return {
      ...bar,
      x,
      y: Math.min(valueY, baselineY),
      width: xScale.bandwidth,
      height: Math.max(0, Math.abs(baselineY - valueY)),
    }
  })

  return {
    bars,
    plotArea,
    valueDomain,
    categories,
  }
}

function collectValidBarData(options: BarChartGeometryOptions): ValidBarDatum[] {
  const validBars: ValidBarDatum[] = []
  const maxBars = options.maxBars ?? Infinity

  for (const row of options.rows) {
    if (validBars.length >= maxBars) {
      break
    }

    const value = getChartNumberValue(row, options.valueField)
    if (value == null) {
      continue
    }

    const category = getChartStringValue(row, options.categoryField)
    const index = validBars.length
    validBars.push({
      key: `${category}::${index}`,
      index,
      row,
      category,
      value,
    })
  }

  return validBars
}

function resolveBarBaseline(domain: ChartNumericDomain): number {
  if (domain.min <= 0 && domain.max >= 0) {
    return 0
  }
  if (domain.min > 0) {
    return domain.min
  }
  return domain.max
}
