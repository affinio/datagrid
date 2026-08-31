<template>
  <div class="affino-bar-chart-container">
  <AffinoChartFrame
    class="affino-bar-chart"
    :width="width"
    :height="height"
    :title="title"
    :description="description"
    :empty="isEmpty"
    :aria-label="title ?? description ?? 'Bar chart'"
  >
    <g v-if="showGrid" class="affino-bar-chart__grid" aria-hidden="true">
      <line
        v-for="tick in yTicks"
        :key="`grid-${tick.value}`"
        class="affino-bar-chart__grid-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="tick.y"
        :y2="tick.y"
      />
    </g>

    <g v-if="showAxes" class="affino-bar-chart__axes" aria-hidden="true">
      <line
        class="affino-bar-chart__axis-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x"
        :y1="geometry.plotArea.y"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
      <line
        class="affino-bar-chart__axis-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="geometry.plotArea.y + geometry.plotArea.height"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
      <text
        v-for="tick in yTicks"
        :key="`y-${tick.value}`"
        class="affino-bar-chart__y-label"
        :x="geometry.plotArea.x - 8"
        :y="tick.y"
        text-anchor="end"
        dominant-baseline="middle"
      >
        {{ formatTick(tick.value) }}
      </text>
      <text
        v-for="bar in visibleAxisBars"
        :key="`x-${bar.key}`"
        class="affino-bar-chart__x-label"
        :x="bar.x + bar.width / 2"
        :y="geometry.plotArea.y + geometry.plotArea.height + 18"
        text-anchor="middle"
      >
        {{ bar.category }}
      </text>
    </g>

    <line
      v-if="showAxes"
      class="affino-bar-chart__zero-line"
      :x1="geometry.plotArea.x"
      :x2="geometry.plotArea.x + geometry.plotArea.width"
      :y1="zeroY"
      :y2="zeroY"
      aria-hidden="true"
    />

    <g class="affino-bar-chart__bars">
      <rect
        v-for="bar in geometry.bars"
        :key="bar.key"
        class="affino-bar-chart__bar"
        :class="bar.value < 0 ? 'affino-bar-chart__bar--negative' : 'affino-bar-chart__bar--positive'"
        :data-bar-index="bar.index"
        :data-bar-category="bar.category"
        :x="bar.x"
        :y="bar.y"
        :width="bar.width"
        :height="bar.height"
        tabindex="0"
        role="button"
        :aria-label="`${bar.category}: ${bar.value}`"
        @click="emitBarEvent('bar-click', bar, $event)"
        @mouseenter="showBarTooltip(bar); emitBarEvent('bar-hover', bar, $event)"
        @mouseleave="clearBarTooltip(); emitBarEvent('bar-leave', bar, $event)"
        @focus="showBarTooltip(bar)"
        @blur="clearBarTooltip"
        @keydown.enter.prevent="emitBarEvent('bar-click', bar, $event)"
        @keydown.space.prevent="emitBarEvent('bar-click', bar, $event)"
      />
    </g>

    <template #empty>
      {{ emptyText }}
    </template>
  </AffinoChartFrame>
  <div v-if="tooltip && activeBar !== null" class="affino-bar-chart__tooltip" :style="tooltipStyle" role="status">
    <span>{{ formatCategory(activeBar.category) }}</span>
    <strong>{{ formatTick(activeBar.value) }}</strong>
  </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { createBarChartGeometry, createChartLinearScale } from "@affino/charts-core"
import type { BarChartBarGeometry, ChartDatum, ChartMargin } from "@affino/charts-core"
import AffinoChartFrame from "./AffinoChartFrame.vue"
import { createChartInteractionAnchor } from "./interaction"
import type { AffinoBarChartBarEvent } from "./types"

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 360
const MAX_X_AXIS_LABELS = 12
const Y_TICK_COUNT = 5

const props = withDefaults(defineProps<{
  rows: ChartDatum[]
  categoryField: string
  valueField: string
  width?: number
  height?: number
  margin?: Partial<ChartMargin>
  title?: string
  description?: string
  maxBars?: number
  showAxes?: boolean
  showGrid?: boolean
  emptyText?: string
  tooltip?: boolean
  valueFormatter?: (value: number) => string
  categoryFormatter?: (category: string) => string
}>(), {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  showAxes: true,
  showGrid: true,
  emptyText: "No data",
  tooltip: true,
})

const emit = defineEmits<{
  (event: "bar-click" | "bar-hover" | "bar-leave", payload: AffinoBarChartBarEvent): void
}>()

const activeBar = ref<BarChartBarGeometry | null>(null)

const geometry = computed(() => createBarChartGeometry({
  rows: props.rows,
  categoryField: props.categoryField,
  valueField: props.valueField,
  size: {
    width: props.width,
    height: props.height,
  },
  margin: props.margin,
  maxBars: props.maxBars,
}))

const isEmpty = computed(() => geometry.value.bars.length === 0)
const yScale = computed(() => createChartLinearScale(geometry.value.valueDomain, {
  min: geometry.value.plotArea.y + geometry.value.plotArea.height,
  max: geometry.value.plotArea.y,
}))
const zeroY = computed(() => yScale.value.scale(0))
const yTicks = computed(() => {
  const { min, max } = geometry.value.valueDomain
  if (Y_TICK_COUNT <= 1 || min === max) {
    return [{ value: min, y: yScale.value.scale(min) }]
  }

  const step = (max - min) / (Y_TICK_COUNT - 1)
  return Array.from({ length: Y_TICK_COUNT }, (_, index) => {
    const value = min + step * index
    return {
      value,
      y: yScale.value.scale(value),
    }
  })
})
const visibleAxisBars = computed(() => {
  const bars = geometry.value.bars
  if (bars.length <= MAX_X_AXIS_LABELS) {
    return bars
  }

  const stride = Math.ceil(bars.length / MAX_X_AXIS_LABELS)
  return bars.filter((bar) => bar.index % stride === 0)
})
const tooltipStyle = computed(() => ({
  left: `${activeBar.value === null ? 50 : Math.min(92, Math.max(8, (activeBar.value.x + activeBar.value.width / 2) / props.width * 100))}%`,
}))

function formatTick(value: number): string {
  if (props.valueFormatter !== undefined) return props.valueFormatter(value)
  if (Number.isInteger(value)) {
    return String(value)
  }
  return Number.parseFloat(value.toFixed(2)).toString()
}

function formatCategory(category: string): string {
  return props.categoryFormatter?.(category) ?? category
}

function emitBarEvent(
  eventName: "bar-click" | "bar-hover" | "bar-leave",
  bar: BarChartBarGeometry,
  event: MouseEvent | KeyboardEvent,
): void {
  if (eventName === "bar-hover") activeBar.value = bar
  if (eventName === "bar-leave") activeBar.value = null
  const anchor = createChartInteractionAnchor(event.currentTarget instanceof Element ? event.currentTarget : null)

  emit(eventName, {
    item: bar,
    bar,
    row: bar.row,
    index: bar.index,
    category: bar.category,
    value: bar.value,
    ...anchor,
  })
}

function showBarTooltip(bar: BarChartBarGeometry): void {
  activeBar.value = bar
}

function clearBarTooltip(): void {
  activeBar.value = null
}
</script>

<style scoped>
.affino-bar-chart-container {
  position: relative;
  width: 100%;
}

.affino-bar-chart {
  --affino-chart-bar-fill: var(--affino-chart-series-1, #2563eb);
  --affino-chart-bar-hover-fill: #1d4ed8;
}

.affino-bar-chart__bar {
  fill: var(--affino-chart-bar-fill);
  outline: none;
  transition: fill 120ms ease;
}

.affino-bar-chart__bar:hover,
.affino-bar-chart__bar:focus-visible {
  fill: var(--affino-chart-bar-hover-fill);
}

.affino-bar-chart__bar:focus-visible {
  stroke: var(--affino-chart-text);
  stroke-width: 2;
}

.affino-bar-chart__axis-line,
.affino-bar-chart__zero-line {
  stroke: var(--affino-chart-axis);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-bar-chart__grid-line {
  stroke: var(--affino-chart-grid);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-bar-chart__x-label,
.affino-bar-chart__y-label {
  fill: var(--affino-chart-muted-text);
  font-size: 11px;
}

.affino-bar-chart__bar--positive {
  fill: var(--affino-chart-positive, #16a34a);
}

.affino-bar-chart__bar--negative {
  fill: var(--affino-chart-negative, #dc2626);
}

.affino-bar-chart__tooltip {
  position: absolute;
  z-index: 2;
  top: 12px;
  display: grid;
  gap: 4px;
  min-width: 120px;
  padding: 8px 10px;
  color: var(--affino-chart-tooltip-text, #ffffff);
  background: var(--affino-chart-tooltip-background, #101828);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgb(16 24 40 / 18%);
  font-size: 12px;
  pointer-events: none;
  transform: translateX(-50%);
}

.affino-bar-chart__tooltip strong {
  font-variant-numeric: tabular-nums;
}
</style>
