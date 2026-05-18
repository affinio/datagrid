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
