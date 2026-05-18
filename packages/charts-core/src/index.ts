export type {
  ChartDatum,
  ChartLinearScale,
  ChartMargin,
  ChartNumericDomain,
  ChartPoint,
  ChartRect,
  ChartSize,
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

export function createChartsCore(): { version: string } {
  return { version: "0.1.0" }
}
