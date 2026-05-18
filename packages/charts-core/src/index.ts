export type {
  AreaChartGeometry,
  AreaChartGeometryOptions,
  AreaChartPointGeometry,
  AreaChartXScaleType,
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
  HistogramBinGeometry,
  HistogramGeometry,
  HistogramGeometryOptions,
  LineChartGeometry,
  LineChartGeometryOptions,
  LineChartPointGeometry,
  LineChartXScaleType,
  MetricDeltaDirection,
  MetricDeltaModel,
  MetricFormat,
  MetricModel,
  MetricModelOptions,
  PieChartGeometry,
  PieChartGeometryOptions,
  PieChartSliceGeometry,
  ScatterChartGeometry,
  ScatterChartGeometryOptions,
  ScatterChartPointGeometry,
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
export { createPieChartGeometry } from "./pieGeometry"
export { createScatterChartGeometry } from "./scatterGeometry"
export { createAreaChartGeometry } from "./areaGeometry"
export { createMetricModel } from "./metricModel"
export { createHistogramGeometry } from "./histogramGeometry"

export function createChartsCore(): { version: string } {
  return { version: "0.1.0" }
}
