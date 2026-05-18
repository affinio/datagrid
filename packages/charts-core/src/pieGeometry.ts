import { getChartNumberValue, getChartStringValue } from "./data"
import { resolveChartPlotArea } from "./layout"
import type {
  ChartDatum,
  ChartPoint,
  PieChartGeometry,
  PieChartGeometryOptions,
  PieChartSliceGeometry,
} from "./types"

interface ValidPieDatum {
  key: string
  index: number
  row: ChartDatum
  category: string
  value: number
}

const DEFAULT_START_ANGLE = -Math.PI / 2
const FULL_CIRCLE_EPSILON = 1e-10

export function createPieChartGeometry(options: PieChartGeometryOptions): PieChartGeometry {
  const plotArea = resolveChartPlotArea(options.size, options.margin)
  const center = {
    x: plotArea.x + plotArea.width / 2,
    y: plotArea.y + plotArea.height / 2,
  }
  const radius = Math.max(0, Math.min(plotArea.width, plotArea.height) / 2)
  const innerRadius = radius * clampInnerRadiusRatio(options.innerRadiusRatio ?? 0)
  const validSlices = collectValidPieData(options)
  const total = validSlices.reduce((sum, slice) => sum + slice.value, 0)
  const startAngle = options.startAngle ?? DEFAULT_START_ANGLE
  const endAngle = options.endAngle ?? startAngle + Math.PI * 2
  const angleSpan = endAngle - startAngle
  let currentAngle = startAngle

  const slices = validSlices.map<PieChartSliceGeometry>((slice) => {
    const percentage = slice.value / total
    const sliceStartAngle = currentAngle
    const sliceEndAngle = currentAngle + angleSpan * percentage
    currentAngle = sliceEndAngle

    return {
      ...slice,
      percentage,
      startAngle: sliceStartAngle,
      endAngle: sliceEndAngle,
      padAngle: 0,
      path: createSlicePath(center, radius, innerRadius, sliceStartAngle, sliceEndAngle),
      centroid: createSliceCentroid(center, radius, innerRadius, sliceStartAngle, sliceEndAngle),
    }
  })

  return {
    slices,
    plotArea,
    center,
    radius,
    innerRadius,
    total,
  }
}

function collectValidPieData(options: PieChartGeometryOptions): ValidPieDatum[] {
  const validSlices: ValidPieDatum[] = []

  for (const row of options.rows) {
    const value = getChartNumberValue(row, options.valueField)
    if (value == null || value <= 0) {
      continue
    }

    const category = getChartStringValue(row, options.categoryField)
    const index = validSlices.length
    validSlices.push({
      key: `${category}::${index}`,
      index,
      row,
      category,
      value,
    })
  }

  return validSlices
}

function createSlicePath(
  center: ChartPoint,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  if (radius <= 0) {
    return `M ${center.x} ${center.y} Z`
  }

  const angleSpan = endAngle - startAngle
  const isFullCircle = Math.abs(Math.abs(angleSpan) - Math.PI * 2) <= FULL_CIRCLE_EPSILON
  if (innerRadius <= 0) {
    return isFullCircle
      ? createFullPiePath(center, radius, startAngle, angleSpan)
      : createPieSlicePath(center, radius, startAngle, endAngle, angleSpan)
  }

  return isFullCircle
    ? createFullDonutPath(center, radius, innerRadius, startAngle, angleSpan)
    : createDonutSlicePath(center, radius, innerRadius, startAngle, endAngle, angleSpan)
}

function createPieSlicePath(
  center: ChartPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
  angleSpan: number,
): string {
  const start = polarToPoint(center, radius, startAngle)
  const end = polarToPoint(center, radius, endAngle)
  const largeArcFlag = getLargeArcFlag(angleSpan)
  const sweepFlag = getSweepFlag(angleSpan)

  return [
    `M ${center.x} ${center.y}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`,
    "Z",
  ].join(" ")
}

function createDonutSlicePath(
  center: ChartPoint,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
  angleSpan: number,
): string {
  const outerStart = polarToPoint(center, radius, startAngle)
  const outerEnd = polarToPoint(center, radius, endAngle)
  const innerEnd = polarToPoint(center, innerRadius, endAngle)
  const innerStart = polarToPoint(center, innerRadius, startAngle)
  const largeArcFlag = getLargeArcFlag(angleSpan)
  const sweepFlag = getSweepFlag(angleSpan)
  const reverseSweepFlag = sweepFlag === 1 ? 0 : 1

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} ${reverseSweepFlag} ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ")
}

function createFullPiePath(
  center: ChartPoint,
  radius: number,
  startAngle: number,
  angleSpan: number,
): string {
  const start = polarToPoint(center, radius, startAngle)
  const mid = polarToPoint(center, radius, startAngle + angleSpan / 2)
  const sweepFlag = getSweepFlag(angleSpan)

  return [
    `M ${center.x} ${center.y}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 1 ${sweepFlag} ${mid.x} ${mid.y}`,
    `A ${radius} ${radius} 0 1 ${sweepFlag} ${start.x} ${start.y}`,
    "Z",
  ].join(" ")
}

function createFullDonutPath(
  center: ChartPoint,
  radius: number,
  innerRadius: number,
  startAngle: number,
  angleSpan: number,
): string {
  const outerStart = polarToPoint(center, radius, startAngle)
  const outerMid = polarToPoint(center, radius, startAngle + angleSpan / 2)
  const innerStart = polarToPoint(center, innerRadius, startAngle)
  const innerMid = polarToPoint(center, innerRadius, startAngle + angleSpan / 2)
  const sweepFlag = getSweepFlag(angleSpan)
  const reverseSweepFlag = sweepFlag === 1 ? 0 : 1

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${radius} ${radius} 0 1 ${sweepFlag} ${outerMid.x} ${outerMid.y}`,
    `A ${radius} ${radius} 0 1 ${sweepFlag} ${outerStart.x} ${outerStart.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 1 ${reverseSweepFlag} ${innerMid.x} ${innerMid.y}`,
    `A ${innerRadius} ${innerRadius} 0 1 ${reverseSweepFlag} ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ")
}

function createSliceCentroid(
  center: ChartPoint,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): ChartPoint {
  return polarToPoint(center, (radius + innerRadius) / 2, (startAngle + endAngle) / 2)
}

function polarToPoint(center: ChartPoint, radius: number, angle: number): ChartPoint {
  return {
    x: sanitizeNumber(center.x + Math.cos(angle) * radius),
    y: sanitizeNumber(center.y + Math.sin(angle) * radius),
  }
}

function getLargeArcFlag(angleSpan: number): 0 | 1 {
  return Math.abs(angleSpan) > Math.PI ? 1 : 0
}

function getSweepFlag(angleSpan: number): 0 | 1 {
  return angleSpan >= 0 ? 1 : 0
}

function clampInnerRadiusRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  if (value >= 0.95) {
    return 0.95
  }
  return value
}

function sanitizeNumber(value: number): number {
  if (Math.abs(value) < 1e-12) {
    return 0
  }
  return value
}
