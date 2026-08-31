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
  TimeAxisOptions,
  TimeAxisTick,
  TimeSeries,
  TimeSeriesChartGeometry,
  TimeSeriesChartOptions,
  TimeSeriesGeometry,
  TimeSeriesGeometryPoint,
  TimeSeriesPoint,
  TimeSeriesPresentation,
  TimeSeriesInteractionSnap,
  TimeSeriesTooltip,
  TimeSeriesTooltipEntry,
  TimeSeriesTooltipResolver,
  TimeSeriesType,
  TimeSeriesYAxisOptions,
} from "./types.js"
export {
  getChartNumberValue,
  getChartStringValue,
  isFiniteChartNumber,
} from "./data.js"
export {
  DEFAULT_CHART_MARGIN,
  resolveChartMargin,
  resolveChartPlotArea,
} from "./layout.js"
export {
  computeChartNumericDomain,
  createChartLinearScale,
  normalizeChartValue,
} from "./scale.js"
export { createChartBandScale } from "./bandScale.js"
export { createBarChartGeometry } from "./barGeometry.js"
export { createLineChartGeometry } from "./lineGeometry.js"
export { createPieChartGeometry } from "./pieGeometry.js"
export { createScatterChartGeometry } from "./scatterGeometry.js"
export { createAreaChartGeometry } from "./areaGeometry.js"
export { createMetricModel } from "./metricModel.js"
export { createHistogramGeometry } from "./histogramGeometry.js"
export {
  createTimeAxisTicks,
  createTimeSeriesTooltipResolver,
  createTimeSeriesChartGeometry,
  formatTimeAxisTick,
  resolveNearestTimeSeriesTimestamp,
  resolveTimeSeriesTooltip,
  validateTimeSeries,
} from "./timeSeries.js"

export function createChartsCore(): { version: string } {
  return { version: "0.1.0" }
}
