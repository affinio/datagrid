import type {
  AreaChartPointGeometry,
  BarChartBarGeometry,
  ChartDatum,
  HistogramBinGeometry,
  LineChartPointGeometry,
  PieChartSliceGeometry,
  ScatterChartPointGeometry,
  TimeSeries,
  TimeSeriesTooltip,
} from "@affino/charts-core"

export type ChartThemeVariant = "default" | "muted" | "success" | "warning" | "danger"

export interface ChartInteractionPoint {
  x: number
  y: number
}

export type ChartTooltipPlacement = "right-bottom" | "left-bottom" | "right-top" | "left-top"

export interface TimeSeriesTooltipPointer {
  clientX: number | null
  clientY: number | null
  chart: ChartInteractionPoint
  plot: ChartInteractionPoint
}

export interface ChartAnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ChartLegendItem {
  id: string
  label: string
  color?: string
  value?: string | number
  disabled?: boolean
  hidden?: boolean
}

export type ChartLegendOrientation = "horizontal" | "vertical"

export interface AffinoChartInteractionPayload<TItem> {
  item: TItem
  row?: ChartDatum
  index: number
  clientPoint: ChartInteractionPoint
  anchorRect: ChartAnchorRect
}

export interface AffinoBarChartBarEvent extends AffinoChartInteractionPayload<BarChartBarGeometry> {
  bar: BarChartBarGeometry
  row: ChartDatum
  category: string
  value: number
}

export interface AffinoLineChartPointEvent extends AffinoChartInteractionPayload<LineChartPointGeometry> {
  point: LineChartPointGeometry
  row: ChartDatum
  xValue: number
  yValue: number
}

export interface AffinoPieChartSliceEvent extends AffinoChartInteractionPayload<PieChartSliceGeometry> {
  slice: PieChartSliceGeometry
  row: ChartDatum
  category: string
  value: number
  percentage: number
}

export interface AffinoScatterChartPointEvent extends AffinoChartInteractionPayload<ScatterChartPointGeometry> {
  point: ScatterChartPointGeometry
  row: ChartDatum
  xValue: number
  yValue: number
  radiusValue: number | null
}

export interface AffinoAreaChartPointEvent extends AffinoChartInteractionPayload<AreaChartPointGeometry> {
  point: AreaChartPointGeometry
  row: ChartDatum
  xValue: number
  yValue: number
}

export interface AffinoHistogramBinEvent extends AffinoChartInteractionPayload<HistogramBinGeometry> {
  bin: HistogramBinGeometry
  min: number
  max: number
  count: number
  values: number[]
}

export type ChartThemeMode = "light" | "dark"

export interface ChartTheme {
  mode?: ChartThemeMode
  background?: string
  surface?: string
  border?: string
  grid?: string
  axis?: string
  text?: string
  mutedText?: string
  tooltipBackground?: string
  tooltipText?: string
  tooltipSecondaryText?: string
  tooltipBorder?: string
  tooltipShadow?: string
  seriesColors?: readonly string[]
  positive?: string
  negative?: string
  focus?: string
  crosshair?: string
  crosshairWidth?: number
  crosshairDash?: string
  crosshairOpacity?: number
}

export interface TimeSeriesTooltipOptions {
  enabled?: boolean
  followPointer?: boolean
  constrainToChart?: boolean
  offsetX?: number
  offsetY?: number
  formatTime?: (timestamp: number) => string
  formatValue?: (value: number, series: TimeSeries) => string
}

export interface TimeSeriesCrosshairOptions {
  enabled?: boolean
  snap?: "nearest"
}

export interface TimeSeriesInteractionOptions {
  enabled?: boolean
  snap?: "nearest"
  tooltip?: TimeSeriesTooltipOptions
  crosshair?: TimeSeriesCrosshairOptions
}

export interface AffinoTimeSeriesTooltipEntry {
  seriesId: string
  seriesLabel: string
  value: number
  formattedValue: string
  color?: string
}

export interface AffinoTimeSeriesTooltip extends Omit<TimeSeriesTooltip, "entries"> {
  formattedTimestamp: string
  domainValue: number
  x: number
  anchor: ChartInteractionPoint
  pointer: TimeSeriesTooltipPointer
  placement: ChartTooltipPlacement
  entries: AffinoTimeSeriesTooltipEntry[]
}

export interface AffinoTimeSeriesVisibilityEvent {
  seriesId: string
  visible: boolean
}
