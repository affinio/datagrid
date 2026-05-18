<template>
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

    <g class="affino-bar-chart__bars">
      <rect
        v-for="bar in geometry.bars"
        :key="bar.key"
        class="affino-bar-chart__bar"
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
        @mouseenter="emitBarEvent('bar-hover', bar, $event)"
        @mouseleave="emitBarEvent('bar-leave', bar, $event)"
        @keydown.enter.prevent="emitBarEvent('bar-click', bar, $event)"
        @keydown.space.prevent="emitBarEvent('bar-click', bar, $event)"
      />
    </g>

    <template #empty>
      {{ emptyText }}
    </template>
  </AffinoChartFrame>
</template>

<script setup lang="ts">
import { computed } from "vue"
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
}>(), {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  showAxes: true,
  showGrid: true,
  emptyText: "No data",
})

const emit = defineEmits<{
  (event: "bar-click" | "bar-hover" | "bar-leave", payload: AffinoBarChartBarEvent): void
}>()

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

function formatTick(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }
  return Number.parseFloat(value.toFixed(2)).toString()
}

function emitBarEvent(
  eventName: "bar-click" | "bar-hover" | "bar-leave",
  bar: BarChartBarGeometry,
  event: MouseEvent | KeyboardEvent,
): void {
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
</script>

<style scoped>
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

.affino-bar-chart__axis-line {
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
</style>
