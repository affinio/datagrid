import type {
  BarChartBarGeometry,
  ChartDatum,
  LineChartPointGeometry,
  PieChartSliceGeometry,
  ScatterChartPointGeometry,
} from "@affino/charts-core"

export type ChartThemeVariant = "default" | "muted" | "success" | "warning" | "danger"

export interface ChartInteractionPoint {
  x: number
  y: number
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
