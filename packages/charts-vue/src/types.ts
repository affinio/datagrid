import type {
  BarChartBarGeometry,
  ChartDatum,
  LineChartPointGeometry,
  PieChartSliceGeometry,
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

export interface AffinoBarChartBarEvent {
  bar: BarChartBarGeometry
  row: ChartDatum
  index: number
  category: string
  value: number
  clientPoint?: ChartInteractionPoint
}

export interface AffinoLineChartPointEvent {
  point: LineChartPointGeometry
  row: ChartDatum
  index: number
  xValue: number
  yValue: number
}

export interface AffinoPieChartSliceEvent {
  slice: PieChartSliceGeometry
  row: ChartDatum
  index: number
  category: string
  value: number
  percentage: number
}
