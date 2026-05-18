export type {
  BarChartBarGeometry,
  BarChartGeometry,
  BarChartGeometryOptions,
  ChartBandScale,
  ChartBandScaleOptions,
  ChartDatum,
  ChartLinearScale,
  ChartMargin,
  ChartNumericDomain,
  ChartPoint,
  ChartRect,
  ChartSize,
  LineChartGeometry,
  LineChartGeometryOptions,
  LineChartPointGeometry,
  LineChartXScaleType,
} from "./types"
export {
  getChartNumberValue,
  getChartStringValue,
  isFiniteChartNumber,
} from "./data"
export {
  DEFAULT_CHART_MARGIN,
  resolveChartMargin,
  resolveChartPlotArea,
} from "./layout"
export {
  computeChartNumericDomain,
  createChartLinearScale,
  normalizeChartValue,
} from "./scale"
export { createChartBandScale } from "./bandScale"
export { createBarChartGeometry } from "./barGeometry"
export { createLineChartGeometry } from "./lineGeometry"

export function createChartsCore(): { version: string } {
  return { version: "0.1.0" }
}
