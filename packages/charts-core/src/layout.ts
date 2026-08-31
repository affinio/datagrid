import type { ChartMargin, ChartRect, ChartSize } from "./types.js"

export const DEFAULT_CHART_MARGIN: ChartMargin = {
  top: 16,
  right: 16,
  bottom: 32,
  left: 40,
}

export function resolveChartMargin(margin: Partial<ChartMargin> = {}): ChartMargin {
  return {
    top: margin.top ?? DEFAULT_CHART_MARGIN.top,
    right: margin.right ?? DEFAULT_CHART_MARGIN.right,
    bottom: margin.bottom ?? DEFAULT_CHART_MARGIN.bottom,
    left: margin.left ?? DEFAULT_CHART_MARGIN.left,
  }
}

export function resolveChartPlotArea(size: ChartSize, margin?: Partial<ChartMargin>): ChartRect {
  const resolvedMargin = resolveChartMargin(margin)
  return {
    x: resolvedMargin.left,
    y: resolvedMargin.top,
    width: Math.max(0, size.width - resolvedMargin.left - resolvedMargin.right),
    height: Math.max(0, size.height - resolvedMargin.top - resolvedMargin.bottom),
  }
}
