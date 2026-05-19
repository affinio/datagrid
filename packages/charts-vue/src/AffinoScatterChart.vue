<template>
  <AffinoChartFrame
    class="affino-scatter-chart"
    :width="width"
    :height="height"
    :title="title"
    :description="description"
    :empty="isEmpty"
    :aria-label="title ?? description ?? 'Scatter chart'"
  >
    <g v-if="showGrid" class="affino-scatter-chart__grid" aria-hidden="true">
      <line
        v-for="tick in yTicks"
        :key="`grid-y-${tick.value}`"
        class="affino-scatter-chart__grid-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="tick.y"
        :y2="tick.y"
      />
      <line
        v-for="tick in xTicks"
        :key="`grid-x-${tick.value}`"
        class="affino-scatter-chart__grid-line"
        :x1="tick.x"
        :x2="tick.x"
        :y1="geometry.plotArea.y"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
    </g>

    <g v-if="showAxes" class="affino-scatter-chart__axes" aria-hidden="true">
      <line
        class="affino-scatter-chart__axis-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x"
        :y1="geometry.plotArea.y"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
      <line
        class="affino-scatter-chart__axis-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="geometry.plotArea.y + geometry.plotArea.height"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
      <text
        v-for="tick in yTicks"
        :key="`y-${tick.value}`"
        class="affino-scatter-chart__y-label"
        :x="geometry.plotArea.x - 8"
        :y="tick.y"
        text-anchor="end"
        dominant-baseline="middle"
      >
        {{ formatTick(tick.value) }}
      </text>
      <text
        v-for="tick in xTicks"
        :key="`x-${tick.value}`"
        class="affino-scatter-chart__x-label"
        :x="tick.x"
        :y="geometry.plotArea.y + geometry.plotArea.height + 18"
        text-anchor="middle"
      >
        {{ formatTick(tick.value) }}
      </text>
    </g>

    <g class="affino-scatter-chart__points">
      <circle
        v-for="point in geometry.points"
        :key="point.key"
        class="affino-scatter-chart__point"
        :data-point-index="point.index"
        :data-point-x-value="point.xValue"
        :data-point-y-value="point.yValue"
        :data-point-radius-value="point.radiusValue"
        :cx="point.x"
        :cy="point.y"
        :r="point.radius"
        tabindex="0"
        role="button"
        :aria-label="`Point ${point.index + 1}: ${point.xValue}, ${point.yValue}`"
        @click="emitPointEvent('point-click', point, $event)"
        @mouseenter="emitPointEvent('point-hover', point, $event)"
        @mouseleave="emitPointEvent('point-leave', point, $event)"
        @keydown.enter.prevent="emitPointEvent('point-click', point, $event)"
        @keydown.space.prevent="emitPointEvent('point-click', point, $event)"
      />
    </g>

    <template #empty>
      {{ emptyText }}
    </template>
  </AffinoChartFrame>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { createChartLinearScale, createScatterChartGeometry } from "@affino/charts-core"
import type { ChartDatum, ChartMargin, ScatterChartPointGeometry } from "@affino/charts-core"
import AffinoChartFrame from "./AffinoChartFrame.vue"
import { createChartInteractionAnchor } from "./interaction"
import type { AffinoScatterChartPointEvent } from "./types"

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 360
const TICK_COUNT = 5

const props = withDefaults(defineProps<{
  rows: ChartDatum[]
  xField: string
  yField: string
  radiusField?: string
  width?: number
  height?: number
  margin?: Partial<ChartMargin>
  title?: string
  description?: string
  minRadius?: number
  maxRadius?: number
  includeZeroX?: boolean
  includeZeroY?: boolean
  showAxes?: boolean
  showGrid?: boolean
  emptyText?: string
}>(), {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  includeZeroX: false,
  includeZeroY: false,
  showAxes: true,
  showGrid: true,
  emptyText: "No data",
})

const emit = defineEmits<{
  (event: "point-click" | "point-hover" | "point-leave", payload: AffinoScatterChartPointEvent): void
}>()

const geometry = computed(() => createScatterChartGeometry({
  rows: props.rows,
  xField: props.xField,
  yField: props.yField,
  radiusField: props.radiusField,
  size: {
    width: props.width,
    height: props.height,
  },
  margin: props.margin,
  minRadius: props.minRadius,
  maxRadius: props.maxRadius,
  includeZeroX: props.includeZeroX,
  includeZeroY: props.includeZeroY,
}))

const isEmpty = computed(() => geometry.value.points.length === 0)
const xScale = computed(() => createChartLinearScale(geometry.value.xDomain, {
  min: geometry.value.plotArea.x,
  max: geometry.value.plotArea.x + geometry.value.plotArea.width,
}))
const yScale = computed(() => createChartLinearScale(geometry.value.yDomain, {
  min: geometry.value.plotArea.y + geometry.value.plotArea.height,
  max: geometry.value.plotArea.y,
}))
const xTicks = computed(() => createTicks(geometry.value.xDomain.min, geometry.value.xDomain.max).map((value) => ({
  value,
  x: xScale.value.scale(value),
})))
const yTicks = computed(() => createTicks(geometry.value.yDomain.min, geometry.value.yDomain.max).map((value) => ({
  value,
  y: yScale.value.scale(value),
})))

function createTicks(min: number, max: number): number[] {
  if (TICK_COUNT <= 1 || min === max) {
    return [min]
  }

  const step = (max - min) / (TICK_COUNT - 1)
  return Array.from({ length: TICK_COUNT }, (_, index) => min + step * index)
}

function formatTick(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }
  return Number.parseFloat(value.toFixed(2)).toString()
}

function emitPointEvent(
  eventName: "point-click" | "point-hover" | "point-leave",
  point: ScatterChartPointGeometry,
  event: MouseEvent | KeyboardEvent,
): void {
  const anchor = createChartInteractionAnchor(event.currentTarget instanceof Element ? event.currentTarget : null)

  emit(eventName, {
    item: point,
    point,
    row: point.row,
    index: point.index,
    xValue: point.xValue,
    yValue: point.yValue,
    radiusValue: point.radiusValue,
    ...anchor,
  })
}
</script>

<style scoped>
.affino-scatter-chart {
  --affino-chart-scatter-fill: color-mix(in srgb, var(--affino-chart-series-1, #2563eb) 70%, transparent);
  --affino-chart-scatter-stroke: var(--affino-chart-series-1, #2563eb);
  --affino-chart-scatter-hover-fill: var(--affino-chart-series-1, #2563eb);
  --affino-chart-scatter-focus-stroke: var(--affino-chart-text, #172033);
}

.affino-scatter-chart__point {
  fill: var(--affino-chart-scatter-fill);
  stroke: var(--affino-chart-scatter-stroke);
  stroke-width: 1.5;
  outline: none;
  transition: fill 120ms ease, stroke 120ms ease;
}

.affino-scatter-chart__point:hover,
.affino-scatter-chart__point:focus-visible {
  fill: var(--affino-chart-scatter-hover-fill);
}

.affino-scatter-chart__point:focus-visible {
  stroke: var(--affino-chart-scatter-focus-stroke);
  stroke-width: 2;
}

.affino-scatter-chart__axis-line {
  stroke: var(--affino-chart-axis);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-scatter-chart__grid-line {
  stroke: var(--affino-chart-grid);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-scatter-chart__x-label,
.affino-scatter-chart__y-label {
  fill: var(--affino-chart-muted-text);
  font-size: 11px;
}
</style>
