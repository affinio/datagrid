import { getChartNumberValue, isFiniteChartNumber } from "./data.js"
import { resolveChartPlotArea } from "./layout.js"
import {
  computeChartNumericDomain,
  createChartLinearScale,
} from "./scale.js"
import type {
  ChartNumericDomain,
  HistogramBinGeometry,
  HistogramGeometry,
  HistogramGeometryOptions,
} from "./types.js"

interface HistogramBinData {
  min: number
  max: number
  values: number[]
}

const DEFAULT_BIN_COUNT = 10
const MIN_BIN_COUNT = 1
const MAX_BIN_COUNT = 100
const FALLBACK_VALUE_DOMAIN: ChartNumericDomain = { min: 0, max: 1 }

export function createHistogramGeometry(options: HistogramGeometryOptions): HistogramGeometry {
  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const values = options.rows.flatMap((row) => {
    const value = getChartNumberValue(row, options.valueField)
    return value == null ? [] : [value]
  })
  const binCount = resolveBinCount(options.binCount)
  const valueDomain = resolveHistogramValueDomain(values, options)
  const bins = createHistogramBins(valueDomain, binCount)
  assignHistogramValues(bins, values, valueDomain, options.includeOutOfRange ?? false)

  const counts = bins.map((bin) => bin.values.length)
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0
  const countDomain = maxCount > 0
    ? { min: 0, max: maxCount }
    : { min: 0, max: 1 }
  const xScale = createChartLinearScale(valueDomain, {
    min: plotArea.x,
    max: plotArea.x + plotArea.width,
  })
  const yScale = createChartLinearScale(countDomain, {
    min: plotArea.y + plotArea.height,
    max: plotArea.y,
  })
  const baselineY = yScale.scale(0)
  const geometryBins = bins.map<HistogramBinGeometry>((bin, index) => {
    const x = xScale.scale(bin.min)
    const binMaxX = xScale.scale(bin.max)
    const y = yScale.scale(bin.values.length)

    return {
      key: `${index}`,
      index,
      min: bin.min,
      max: bin.max,
      count: bin.values.length,
      values: bin.values,
      x,
      y: Math.min(y, baselineY),
      width: Math.max(0, binMaxX - x),
      height: Math.max(0, Math.abs(baselineY - y)),
    }
  })

  return {
    bins: geometryBins,
    plotArea,
    valueDomain,
    countDomain,
    totalCount: geometryBins.reduce((sum, bin) => sum + bin.count, 0),
  }
}

function resolveHistogramValueDomain(
  values: readonly number[],
  options: HistogramGeometryOptions,
): ChartNumericDomain {
  const valueMin = options.valueMin
  const valueMax = options.valueMax
  const hasMin = isFiniteChartNumber(valueMin)
  const hasMax = isFiniteChartNumber(valueMax)

  if (hasMin && hasMax) {
    return stabilizeDomain({
      min: Math.min(valueMin, valueMax),
      max: Math.max(valueMin, valueMax),
    })
  }

  if (hasMin || hasMax) {
    const computed = computeChartNumericDomain(values, { fallback: FALLBACK_VALUE_DOMAIN })
    return stabilizeDomain({
      min: hasMin ? valueMin : computed.min,
      max: hasMax ? valueMax : computed.max,
    })
  }

  return computeChartNumericDomain(values, { fallback: FALLBACK_VALUE_DOMAIN })
}

function createHistogramBins(domain: ChartNumericDomain, binCount: number): HistogramBinData[] {
  const span = domain.max - domain.min
  const binWidth = span / binCount

  return Array.from({ length: binCount }, (_, index) => ({
    min: domain.min + binWidth * index,
    max: index === binCount - 1 ? domain.max : domain.min + binWidth * (index + 1),
    values: [],
  }))
}

function assignHistogramValues(
  bins: HistogramBinData[],
  values: readonly number[],
  domain: ChartNumericDomain,
  includeOutOfRange: boolean,
): void {
  const binWidth = (domain.max - domain.min) / bins.length

  for (const value of values) {
    if (!includeOutOfRange && (value < domain.min || value > domain.max)) {
      continue
    }

    const index = getHistogramBinIndex(value, domain, binWidth, bins.length)
    bins[index]?.values.push(value)
  }
}

function getHistogramBinIndex(
  value: number,
  domain: ChartNumericDomain,
  binWidth: number,
  binCount: number,
): number {
  if (value <= domain.min) {
    return 0
  }
  if (value >= domain.max) {
    return binCount - 1
  }

  return Math.min(binCount - 1, Math.max(0, Math.floor((value - domain.min) / binWidth)))
}

function resolveBinCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_BIN_COUNT
  }

  return Math.min(MAX_BIN_COUNT, Math.max(MIN_BIN_COUNT, Math.floor(value)))
}

function stabilizeDomain(domain: ChartNumericDomain): ChartNumericDomain {
  if (domain.min !== domain.max) {
    return domain
  }

  return {
    min: domain.min - 1,
    max: domain.max + 1,
  }
}
