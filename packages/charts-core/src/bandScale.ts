import type { ChartBandScale, ChartBandScaleOptions } from "./types"

const DEFAULT_BAND_PADDING_INNER = 0.1
const DEFAULT_BAND_PADDING_OUTER = 0.05

export function createChartBandScale(options: ChartBandScaleOptions): ChartBandScale {
  const categories = dedupeCategories(options.categories)
  const range = options.range

  if (categories.length === 0) {
    return {
      categories,
      range,
      bandwidth: 0,
      step: 0,
      scale: () => null,
    }
  }

  const paddingInner = clampPadding(
    options.paddingInner ?? DEFAULT_BAND_PADDING_INNER,
    0,
    0.95,
  )
  const paddingOuter = clampPadding(
    options.paddingOuter ?? DEFAULT_BAND_PADDING_OUTER,
    0,
    1,
  )
  const span = Math.abs(range.max - range.min)
  const direction = range.max >= range.min ? 1 : -1
  const denominator = Math.max(1, categories.length - paddingInner + paddingOuter * 2)
  const step = Math.max(0, span / denominator)
  const bandwidth = Math.max(0, step * (1 - paddingInner))
  const positions = new Map<string, number>()

  categories.forEach((category, index) => {
    positions.set(category, range.min + direction * step * (paddingOuter + index))
  })

  return {
    categories,
    range,
    bandwidth,
    step,
    scale(category: string): number | null {
      return positions.get(category) ?? null
    },
  }
}

function dedupeCategories(categories: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  const uniqueCategories: string[] = []

  for (const category of categories) {
    if (seen.has(category)) {
      continue
    }

    seen.add(category)
    uniqueCategories.push(category)
  }

  return uniqueCategories
}

function clampPadding(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}
