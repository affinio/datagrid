export type ChartDatum = Record<string, unknown>

export interface ChartSize {
  width: number
  height: number
}

export interface ChartMargin {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ChartRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ChartPoint {
  x: number
  y: number
}

export interface ChartNumericDomain {
  min: number
  max: number
}

export interface ChartLinearScale {
  domain: ChartNumericDomain
  range: { min: number; max: number }
  scale(value: number): number
}

export interface ChartBandScaleOptions {
  categories: readonly string[]
  range: { min: number; max: number }
  paddingInner?: number
  paddingOuter?: number
}

export interface ChartBandScale {
  categories: readonly string[]
  range: { min: number; max: number }
  bandwidth: number
  step: number
  scale(category: string): number | null
}

export interface BarChartGeometryOptions {
  rows: readonly ChartDatum[]
  categoryField: string
  valueField: string
  size: ChartSize
  margin?: Partial<ChartMargin>
  maxBars?: number
  includeZero?: boolean
  paddingInner?: number
  paddingOuter?: number
}

export interface BarChartBarGeometry {
  key: string
  index: number
  row: ChartDatum
  category: string
  value: number
  x: number
  y: number
  width: number
  height: number
}

export interface BarChartGeometry {
  bars: BarChartBarGeometry[]
  plotArea: ChartRect
  valueDomain: ChartNumericDomain
  categories: string[]
}

export type LineChartXScaleType = "index" | "number"

export interface LineChartGeometryOptions {
  rows: readonly ChartDatum[]
  xField?: string
  yField: string
  size: ChartSize
  margin?: Partial<ChartMargin>
  xScaleType?: LineChartXScaleType
  includeZeroY?: boolean
}

export interface LineChartPointGeometry {
  key: string
  index: number
  row: ChartDatum
  xValue: number
  yValue: number
  x: number
  y: number
}

export interface LineChartGeometry {
  points: LineChartPointGeometry[]
  path: string
  plotArea: ChartRect
  xDomain: ChartNumericDomain
  yDomain: ChartNumericDomain
}
