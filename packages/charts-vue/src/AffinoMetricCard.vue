<template>
  <article
    class="affino-metric-card"
    :class="[
      `affino-metric-card--${variant}`,
      { 'affino-metric-card--clickable': true },
    ]"
    role="button"
    tabindex="0"
    @click="emitMetricClick"
    @keydown.enter.prevent="emitMetricClick"
    @keydown.space.prevent="emitMetricClick"
  >
    <header class="affino-metric-card__header">
      <p class="affino-metric-card__label">{{ model.label }}</p>
      <p v-if="title || description" class="affino-metric-card__meta">
        <span v-if="title">{{ title }}</span>
        <span v-if="description">{{ description }}</span>
      </p>
    </header>

    <div class="affino-metric-card__value-row">
      <strong class="affino-metric-card__value">{{ model.displayValue }}</strong>
      <span v-if="model.unit" class="affino-metric-card__unit">{{ model.unit }}</span>
    </div>

    <p
      v-if="showDelta && model.delta"
      class="affino-metric-card__delta"
      :class="`affino-metric-card__delta--${model.delta.direction}`"
    >
      <span aria-hidden="true">{{ deltaSymbol }}</span>
      <span>{{ deltaLabel }}</span>
    </p>

    <svg
      v-if="showTrend && sparklinePoints !== null"
      class="affino-metric-card__sparkline"
      viewBox="0 0 120 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline :points="sparklinePoints" />
    </svg>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { createMetricModel } from "@affino/charts-core"
import type { MetricFormat, MetricModel } from "@affino/charts-core"
import type { ChartThemeVariant } from "./types"

const SPARKLINE_WIDTH = 120
const SPARKLINE_HEIGHT = 32
const SPARKLINE_PADDING = 3

const props = withDefaults(defineProps<{
  label: string
  value: number | string | null
  previousValue?: number | null
  format?: MetricFormat
  currency?: string
  locale?: string
  unit?: string
  precision?: number
  trend?: number[]
  title?: string
  description?: string
  variant?: ChartThemeVariant
  showDelta?: boolean
  showTrend?: boolean
}>(), {
  format: "number",
  variant: "default",
  showDelta: true,
  showTrend: true,
})

const emit = defineEmits<{
  "metric-click": [payload: { model: MetricModel }]
}>()

const model = computed(() => createMetricModel({
  label: props.label,
  value: props.value,
  previousValue: props.previousValue,
  format: props.format,
  currency: props.currency,
  locale: props.locale,
  unit: props.unit,
  precision: props.precision,
  trend: props.trend,
}))

const deltaSymbol = computed(() => {
  switch (model.value.delta?.direction) {
    case "up":
      return "+"
    case "down":
      return "-"
    case "flat":
    case undefined:
      return ""
  }
})
const deltaLabel = computed(() => {
  const delta = model.value.delta
  if (delta === null) {
    return ""
  }

  const value = Math.abs(delta.value)
  const percentage = delta.percentage === null ? null : `${formatDeltaNumber(Math.abs(delta.percentage))}%`
  return percentage === null
    ? `${formatDeltaNumber(value)}`
    : `${formatDeltaNumber(value)} (${percentage})`
})
const sparklinePoints = computed(() => createSparklinePoints(model.value.trend))

function emitMetricClick(): void {
  emit("metric-click", {
    model: model.value,
  })
}

function createSparklinePoints(values: readonly number[]): string | null {
  if (values.length < 2) {
    return null
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const xStep = (SPARKLINE_WIDTH - SPARKLINE_PADDING * 2) / (values.length - 1)
  const yMid = SPARKLINE_HEIGHT / 2

  return values.map((value, index) => {
    const x = SPARKLINE_PADDING + xStep * index
    const y = range === 0
      ? yMid
      : SPARKLINE_HEIGHT - SPARKLINE_PADDING - ((value - min) / range) * (SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2)
    return `${roundPoint(x)},${roundPoint(y)}`
  }).join(" ")
}

function formatDeltaNumber(value: number): string {
  if (value > 0 && value < 1) {
    return Number.parseFloat(value.toFixed(3)).toString()
  }
  return Number.parseFloat(value.toFixed(1)).toString()
}

function roundPoint(value: number): number {
  return Number.parseFloat(value.toFixed(2))
}
</script>

<style scoped>
.affino-metric-card {
  --affino-chart-metric-background: var(--affino-chart-background, #ffffff);
  --affino-chart-metric-border: var(--affino-chart-border, #d8dee8);
  --affino-chart-metric-label: var(--affino-chart-muted-text, #667085);
  --affino-chart-metric-value: var(--affino-chart-text, #172033);
  --affino-chart-metric-unit: var(--affino-chart-muted-text, #667085);
  --affino-chart-metric-delta-up: var(--affino-chart-success, #16a34a);
  --affino-chart-metric-delta-down: var(--affino-chart-danger, #dc2626);
  --affino-chart-metric-delta-flat: var(--affino-chart-muted-text, #667085);
  --affino-chart-metric-sparkline: var(--affino-chart-series-1, #2563eb);

  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  color: var(--affino-chart-metric-value);
  background: var(--affino-chart-metric-background);
  border: 1px solid var(--affino-chart-metric-border);
  border-radius: 8px;
  font-family: inherit;
  outline: none;
}

.affino-metric-card--clickable {
  cursor: pointer;
}

.affino-metric-card:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--affino-chart-metric-value) 28%, transparent);
}

.affino-metric-card--success {
  --affino-chart-metric-border: color-mix(in srgb, var(--affino-chart-success, #16a34a) 34%, #ffffff);
  --affino-chart-metric-sparkline: var(--affino-chart-success, #16a34a);
}

.affino-metric-card--warning {
  --affino-chart-metric-border: color-mix(in srgb, var(--affino-chart-warning, #d97706) 34%, #ffffff);
  --affino-chart-metric-sparkline: var(--affino-chart-warning, #d97706);
}

.affino-metric-card--danger {
  --affino-chart-metric-border: color-mix(in srgb, var(--affino-chart-danger, #dc2626) 34%, #ffffff);
  --affino-chart-metric-sparkline: var(--affino-chart-danger, #dc2626);
}

.affino-metric-card--muted {
  --affino-chart-metric-background: var(--affino-chart-surface, #f8fafc);
}

.affino-metric-card__header {
  display: grid;
  gap: 3px;
}

.affino-metric-card__label,
.affino-metric-card__meta,
.affino-metric-card__delta {
  margin: 0;
}

.affino-metric-card__label {
  color: var(--affino-chart-metric-label);
  font-size: 13px;
  line-height: 1.35;
}

.affino-metric-card__meta {
  display: grid;
  gap: 2px;
  color: var(--affino-chart-muted-text, #667085);
  font-size: 12px;
  line-height: 1.35;
}

.affino-metric-card__value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.affino-metric-card__value {
  min-width: 0;
  color: var(--affino-chart-metric-value);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.affino-metric-card__unit {
  color: var(--affino-chart-metric-unit);
  font-size: 13px;
  line-height: 1.2;
}

.affino-metric-card__delta {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}

.affino-metric-card__delta--up {
  color: var(--affino-chart-metric-delta-up);
}

.affino-metric-card__delta--down {
  color: var(--affino-chart-metric-delta-down);
}

.affino-metric-card__delta--flat {
  color: var(--affino-chart-metric-delta-flat);
}

.affino-metric-card__sparkline {
  display: block;
  width: 100%;
  height: 32px;
}

.affino-metric-card__sparkline polyline {
  fill: none;
  stroke: var(--affino-chart-metric-sparkline);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}
</style>
