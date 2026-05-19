<template>
  <AffinoChartFrame
    class="affino-area-chart"
    :width="width"
    :height="height"
    :title="title"
    :description="description"
    :empty="isEmpty"
    :aria-label="title ?? description ?? 'Area chart'"
  >
    <g v-if="showGrid" class="affino-area-chart__grid" aria-hidden="true">
      <line
        v-for="tick in yTicks"
        :key="`grid-${tick.value}`"
        class="affino-area-chart__grid-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="tick.y"
        :y2="tick.y"
      />
    </g>

    <g v-if="showAxes" class="affino-area-chart__axes" aria-hidden="true">
      <line
        class="affino-area-chart__axis-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x"
        :y1="geometry.plotArea.y"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
      <line
        class="affino-area-chart__axis-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="geometry.plotArea.y + geometry.plotArea.height"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
      <text
        v-for="tick in yTicks"
        :key="`y-${tick.value}`"
        class="affino-area-chart__y-label"
        :x="geometry.plotArea.x - 8"
        :y="tick.y"
        text-anchor="end"
        dominant-baseline="middle"
      >
        {{ formatTick(tick.value) }}
      </text>
      <text
        v-for="tick in visibleXTicks"
        :key="`x-${tick.key}`"
        class="affino-area-chart__x-label"
        :x="tick.x"
        :y="geometry.plotArea.y + geometry.plotArea.height + 18"
        text-anchor="middle"
      >
        {{ formatTick(tick.value) }}
      </text>
    </g>

    <path
      v-if="geometry.areaPath"
      class="affino-area-chart__area"
      :d="geometry.areaPath"
      aria-hidden="true"
    />

    <path
      v-if="geometry.linePath"
      class="affino-area-chart__line"
      :d="geometry.linePath"
      fill="none"
      aria-hidden="true"
    />

    <g v-if="showPoints" class="affino-area-chart__points">
      <circle
        v-for="point in geometry.points"
        :key="point.key"
        class="affino-area-chart__point"
        :data-point-index="point.index"
        :data-point-x-value="point.xValue"
        :data-point-y-value="point.yValue"
        :cx="point.x"
        :cy="point.y"
        r="4"
        tabindex="0"
        role="button"
        :aria-label="`Point ${point.index + 1}: ${point.yValue}`"
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
import { createAreaChartGeometry, createChartLinearScale } from "@affino/charts-core"
import type {
  AreaChartPointGeometry,
  AreaChartXScaleType,
  ChartDatum,
  ChartMargin,
} from "@affino/charts-core"
import AffinoChartFrame from "./AffinoChartFrame.vue"
import { createChartInteractionAnchor } from "./interaction"
import type { AffinoAreaChartPointEvent } from "./types"

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 360
const MAX_X_AXIS_LABELS = 12
const Y_TICK_COUNT = 5

const props = withDefaults(defineProps<{
  rows: ChartDatum[]
  yField: string
  xField?: string
  xScaleType?: AreaChartXScaleType
  width?: number
  height?: number
  margin?: Partial<ChartMargin>
  title?: string
  description?: string
  includeZeroY?: boolean
  baselineValue?: number
  showAxes?: boolean
  showGrid?: boolean
  showPoints?: boolean
  emptyText?: string
}>(), {
  xScaleType: "index",
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  includeZeroY: true,
  showAxes: true,
  showGrid: true,
  showPoints: true,
  emptyText: "No data",
})

const emit = defineEmits<{
  (event: "point-click" | "point-hover" | "point-leave", payload: AffinoAreaChartPointEvent): void
}>()

const geometry = computed(() => createAreaChartGeometry({
  rows: props.rows,
  yField: props.yField,
  xField: props.xField,
  xScaleType: props.xScaleType,
  size: {
    width: props.width,
    height: props.height,
  },
  margin: props.margin,
  includeZeroY: props.includeZeroY,
  baselineValue: props.baselineValue,
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
const yTicks = computed(() => {
  const { min, max } = geometry.value.yDomain
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
const visibleXTicks = computed(() => {
  const points = geometry.value.points
  if (points.length <= MAX_X_AXIS_LABELS) {
    return points.map(pointToTick)
  }

  const stride = Math.ceil(points.length / MAX_X_AXIS_LABELS)
  return points.filter((point) => point.index % stride === 0).map(pointToTick)
})

function pointToTick(point: AreaChartPointGeometry): { key: string; value: number; x: number } {
  return {
    key: point.key,
    value: point.xValue,
    x: xScale.value.scale(point.xValue),
  }
}

function formatTick(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }
  return Number.parseFloat(value.toFixed(2)).toString()
}

function emitPointEvent(
  eventName: "point-click" | "point-hover" | "point-leave",
  point: AreaChartPointGeometry,
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
    ...anchor,
  })
}
</script>

<style scoped>
.affino-area-chart {
  --affino-chart-area-fill: color-mix(in srgb, var(--affino-chart-series-1, #2563eb) 18%, transparent);
  --affino-chart-area-stroke: var(--affino-chart-series-1, #2563eb);
  --affino-chart-area-point-fill: var(--affino-chart-background, #ffffff);
  --affino-chart-area-point-stroke: var(--affino-chart-series-1, #2563eb);
  --affino-chart-area-point-hover-fill: var(--affino-chart-series-1, #2563eb);
  --affino-chart-area-focus-stroke: var(--affino-chart-text, #172033);
}

.affino-area-chart__area {
  fill: var(--affino-chart-area-fill);
}

.affino-area-chart__line {
  stroke: var(--affino-chart-area-stroke);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.affino-area-chart__point {
  fill: var(--affino-chart-area-point-fill);
  stroke: var(--affino-chart-area-point-stroke);
  stroke-width: 2;
  outline: none;
  transition: fill 120ms ease, stroke 120ms ease;
}

.affino-area-chart__point:hover,
.affino-area-chart__point:focus-visible {
  fill: var(--affino-chart-area-point-hover-fill);
}

.affino-area-chart__point:focus-visible {
  stroke: var(--affino-chart-area-focus-stroke);
  stroke-width: 2;
}

.affino-area-chart__axis-line {
  stroke: var(--affino-chart-axis);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-area-chart__grid-line {
  stroke: var(--affino-chart-grid);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-area-chart__x-label,
.affino-area-chart__y-label {
  fill: var(--affino-chart-muted-text);
  font-size: 11px;
}
</style>
