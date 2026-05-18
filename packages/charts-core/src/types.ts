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
