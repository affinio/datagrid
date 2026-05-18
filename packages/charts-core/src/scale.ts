import { isFiniteChartNumber } from "./data"
import type { ChartLinearScale, ChartNumericDomain } from "./types"

const DEFAULT_NUMERIC_DOMAIN: ChartNumericDomain = { min: 0, max: 1 }

export function computeChartNumericDomain(
  values: readonly unknown[],
  options: {
    includeZero?: boolean
    fallback?: ChartNumericDomain
    paddingRatio?: number
  } = {},
): ChartNumericDomain {
  let min = Infinity
  let max = -Infinity
  let hasValue = false

  for (const value of values) {
    if (!isFiniteChartNumber(value)) {
      continue
    }

    min = Math.min(min, value)
    max = Math.max(max, value)
    hasValue = true
  }

  const baseDomain = hasValue
    ? { min, max }
    : options.fallback ?? DEFAULT_NUMERIC_DOMAIN

  const zeroAdjustedDomain = hasValue && options.includeZero
    ? {
        min: Math.min(baseDomain.min, 0),
        max: Math.max(baseDomain.max, 0),
      }
    : baseDomain

  const stableDomain = expandStableDomain(zeroAdjustedDomain)
  return applyDomainPadding(stableDomain, options.paddingRatio ?? 0)
}

export function normalizeChartValue(value: number, domain: ChartNumericDomain): number {
  if (domain.min === domain.max) {
    return 0.5
  }

  const normalized = (value - domain.min) / (domain.max - domain.min)
  return clamp01(normalized)
}

export function createChartLinearScale(
  domain: ChartNumericDomain,
  range: { min: number; max: number },
): ChartLinearScale {
  return {
    domain,
    range,
    scale(value: number): number {
      const normalized = normalizeChartValue(value, domain)
      return range.min + (range.max - range.min) * normalized
    },
  }
}

function expandStableDomain(domain: ChartNumericDomain): ChartNumericDomain {
  if (domain.min !== domain.max) {
    return domain
  }

  return {
    min: domain.min - 1,
    max: domain.max + 1,
  }
}

function applyDomainPadding(domain: ChartNumericDomain, paddingRatio: number): ChartNumericDomain {
  if (paddingRatio <= 0) {
    return domain
  }

  const span = domain.max - domain.min
  const padding = span * paddingRatio
  return {
    min: domain.min - padding,
    max: domain.max + padding,
  }
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0
  }
  if (value >= 1) {
    return 1
  }
  return value
}
