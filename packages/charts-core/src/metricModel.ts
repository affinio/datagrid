import { isFiniteChartNumber } from "./data.js"
import type {
  MetricDeltaDirection,
  MetricDeltaModel,
  MetricFormat,
  MetricModel,
  MetricModelOptions,
} from "./types.js"

const DEFAULT_METRIC_LOCALE = "en-GB"
const DEFAULT_METRIC_CURRENCY = "GBP"

export function createMetricModel(options: MetricModelOptions): MetricModel {
  const format = options.format ?? "number"
  const model: MetricModel = {
    label: options.label,
    value: options.value,
    displayValue: formatMetricValue(options.value, {
      format,
      currency: options.currency,
      locale: options.locale,
      precision: options.precision,
    }),
    format,
    delta: createMetricDelta(options.value, options.previousValue),
    trend: (options.trend ?? []).filter(isFiniteChartNumber),
  }

  if (options.unit !== undefined) {
    model.unit = options.unit
  }

  return model
}

function formatMetricValue(
  value: number | string | null,
  options: {
    format: MetricFormat
    currency?: string
    locale?: string
    precision?: number
  },
): string {
  if (value === null || !isDisplayableMetricValue(value)) {
    return "—"
  }

  if (typeof value === "string" || options.format === "raw") {
    return String(value)
  }

  return createMetricFormatter(options).format(value)
}

function createMetricFormatter(options: {
  format: MetricFormat
  currency?: string
  locale?: string
  precision?: number
}): Intl.NumberFormat {
  return new Intl.NumberFormat(options.locale ?? DEFAULT_METRIC_LOCALE, {
    ...getFormatOptions(options.format, options.currency),
    ...getPrecisionOptions(options.precision),
  })
}

function getFormatOptions(format: MetricFormat, currency: string | undefined): Intl.NumberFormatOptions {
  switch (format) {
    case "percent":
      return { style: "percent" }
    case "currency":
      return {
        style: "currency",
        currency: currency ?? DEFAULT_METRIC_CURRENCY,
      }
    case "compact":
      return {
        notation: "compact",
        compactDisplay: "short",
      }
    case "number":
    case "raw":
      return {}
  }
}

function getPrecisionOptions(precision: number | undefined): Intl.NumberFormatOptions {
  if (precision === undefined || !Number.isInteger(precision) || precision < 0) {
    return {}
  }

  return {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }
}

function createMetricDelta(
  value: number | string | null,
  previousValue: number | null | undefined,
): MetricDeltaModel | null {
  if (!isFiniteChartNumber(value) || !isFiniteChartNumber(previousValue)) {
    return null
  }

  const deltaValue = value - previousValue
  return {
    value: deltaValue,
    percentage: previousValue === 0 ? null : (deltaValue / Math.abs(previousValue)) * 100,
    direction: getDeltaDirection(deltaValue),
  }
}

function getDeltaDirection(value: number): MetricDeltaDirection {
  if (value > 0) {
    return "up"
  }
  if (value < 0) {
    return "down"
  }
  return "flat"
}

function isDisplayableMetricValue(value: number | string): boolean {
  return typeof value === "string" || isFiniteChartNumber(value)
}
