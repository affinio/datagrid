<template>
  <AffinoChartFrame
    class="affino-hloc-chart"
    :width="width"
    :height="height"
    :title="title"
    :description="description"
    :empty="isEmpty"
    :aria-label="title ?? description ?? 'HLOC chart'"
  >
    <g v-if="showGrid" class="affino-hloc-chart__grid" aria-hidden="true">
      <line
        v-for="tick in yTicks"
        :key="`grid-${tick.value}`"
        class="affino-hloc-chart__grid-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="tick.y"
        :y2="tick.y"
      />
    </g>

    <g v-if="showAxes" class="affino-hloc-chart__axes" aria-hidden="true">
      <line class="affino-hloc-chart__axis-line" :x1="geometry.plotArea.x" :x2="geometry.plotArea.x" :y1="geometry.plotArea.y" :y2="geometry.plotArea.y + geometry.plotArea.height" />
      <line class="affino-hloc-chart__axis-line" :x1="geometry.plotArea.x" :x2="geometry.plotArea.x + geometry.plotArea.width" :y1="geometry.plotArea.y + geometry.plotArea.height" :y2="geometry.plotArea.y + geometry.plotArea.height" />
      <text v-for="tick in yTicks" :key="`y-${tick.value}`" class="affino-hloc-chart__y-label" :x="geometry.plotArea.x - 8" :y="tick.y" text-anchor="end" dominant-baseline="middle">{{ formatValue(tick.value) }}</text>
      <text v-for="tick in geometry.timeTicks" :key="`x-${tick.value}`" class="affino-hloc-chart__x-label" :x="tick.x" :y="geometry.plotArea.y + geometry.plotArea.height + 18" text-anchor="middle">{{ tick.label }}</text>
    </g>

    <g class="affino-hloc-chart__points">
      <g
        v-for="point in geometry.points"
        :key="`${point.time}-${point.index}`"
        class="affino-hloc-chart__point"
        :class="`affino-hloc-chart__point--${point.direction}`"
        :data-point-index="point.index"
        :data-point-time="point.time"
        :aria-label="pointLabel(point)"
        role="img"
      >
        <line class="affino-hloc-chart__range" :x1="point.x" :x2="point.x" :y1="point.highY" :y2="point.lowY" />
        <line class="affino-hloc-chart__open" :x1="point.openX" :x2="point.x" :y1="point.openY" :y2="point.openY" />
        <line class="affino-hloc-chart__close" :x1="point.x" :x2="point.closeX" :y1="point.closeY" :y2="point.closeY" />
      </g>
    </g>

    <g class="affino-hloc-chart__overlays">
      <g
        v-for="series in geometry.overlays"
        :key="`overlay-${series.id}`"
        class="affino-hloc-chart__overlay"
        :data-series-id="series.id"
        role="img"
        :aria-label="`${series.label} overlay`"
      >
        <path
          v-if="series.areaPath"
          class="affino-hloc-chart__overlay-area"
          :d="series.areaPath"
          :style="overlayStyle(series)"
          aria-hidden="true"
        />
        <path
          class="affino-hloc-chart__overlay-line"
          :d="series.linePath"
          :style="overlayStyle(series)"
          aria-hidden="true"
        />
      </g>
    </g>

    <g class="affino-hloc-chart__markers">
      <circle
        v-for="marker in geometry.markers"
        :key="`marker-${marker.id}`"
        class="affino-hloc-chart__marker"
        :cx="marker.x"
        :cy="marker.y"
        :r="marker.radius ?? 4"
        :style="{ '--affino-hloc-marker-color': marker.color ?? 'var(--affino-chart-series-2, #9333ea)' }"
        :data-marker-id="marker.id"
        role="img"
        :aria-label="markerLabel(marker)"
      />
    </g>

    <template #empty>{{ emptyText }}</template>
  </AffinoChartFrame>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { createHlocChartGeometry } from "@affino/charts-core"
import type { ChartMargin, HlocMarker, HlocMarkerGeometry, HlocPoint, HlocPointGeometry, TimeAxisOptions, TimeSeries, TimeSeriesGeometry, TimeSeriesYAxisOptions } from "@affino/charts-core"
import AffinoChartFrame from "./AffinoChartFrame.vue"

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 360
const Y_TICK_COUNT = 5

const props = withDefaults(defineProps<{
  data: readonly HlocPoint[]
  overlays?: readonly TimeSeries[]
  markers?: readonly HlocMarker[]
  width?: number
  height?: number
  margin?: Partial<ChartMargin>
  title?: string
  description?: string
  timeAxis?: TimeAxisOptions
  yAxis?: TimeSeriesYAxisOptions
  tickWidth?: number
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

const geometry = computed(() => createHlocChartGeometry({
  data: props.data,
  overlays: props.overlays,
  markers: props.markers,
  size: { width: props.width, height: props.height },
  margin: props.margin,
  timeAxis: props.timeAxis,
  yAxis: props.yAxis,
  tickWidth: props.tickWidth,
}))
const isEmpty = computed(() => geometry.value.points.length === 0)
const yScale = computed(() => {
  const domain = geometry.value.valueDomain
  const area = geometry.value.plotArea
  return (value: number) => area.y + area.height - ((value - domain.min) / (domain.max - domain.min)) * area.height
})
const yTicks = computed(() => {
  const { min, max } = geometry.value.valueDomain
  return Array.from({ length: Y_TICK_COUNT }, (_, index) => {
    const value = min + (max - min) * index / (Y_TICK_COUNT - 1)
    return { value, y: yScale.value(value) }
  })
})

function formatValue(value: number): string {
  return props.yAxis?.format?.(value) ?? (Number.isInteger(value) ? String(value) : Number.parseFloat(value.toFixed(2)).toString())
}

function pointLabel(point: HlocPointGeometry): string {
  return `${new Date(point.time).toISOString()}: open ${point.open}, high ${point.high}, low ${point.low}, close ${point.close}`
}

function markerLabel(marker: HlocMarkerGeometry): string {
  return `${marker.label}: ${new Date(marker.time).toISOString()}, value ${marker.value}`
}

function overlayStyle(series: TimeSeriesGeometry): Record<string, string> {
  return {
    "--affino-hloc-overlay-color": series.presentation.color ?? "var(--affino-chart-series-2, #9333ea)",
    "--affino-hloc-overlay-width": String(series.presentation.lineWidth),
    "--affino-hloc-overlay-opacity": String(series.presentation.areaOpacity),
  }
}
</script>

<style scoped>
.affino-hloc-chart__axis-line,
.affino-hloc-chart__range,
.affino-hloc-chart__open,
.affino-hloc-chart__close {
  fill: none;
  stroke: var(--affino-chart-series-1, #2563eb);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.affino-hloc-chart__overlay-line,
.affino-hloc-chart__overlay-area {
  fill: none;
  stroke: var(--affino-hloc-overlay-color);
  stroke-width: var(--affino-hloc-overlay-width);
  vector-effect: non-scaling-stroke;
}

.affino-hloc-chart__overlay-area {
  fill: var(--affino-hloc-overlay-color);
  fill-opacity: var(--affino-hloc-overlay-opacity);
  stroke: none;
}

.affino-hloc-chart__marker {
  fill: var(--affino-hloc-marker-color);
  stroke: var(--affino-chart-surface, #f8fafc);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.affino-hloc-chart__point--up .affino-hloc-chart__range,
.affino-hloc-chart__point--up .affino-hloc-chart__open,
.affino-hloc-chart__point--up .affino-hloc-chart__close {
  stroke: var(--affino-chart-positive, #16a34a);
}

.affino-hloc-chart__point--down .affino-hloc-chart__range,
.affino-hloc-chart__point--down .affino-hloc-chart__open,
.affino-hloc-chart__point--down .affino-hloc-chart__close {
  stroke: var(--affino-chart-negative, #dc2626);
}

.affino-hloc-chart__axis-line { stroke: var(--affino-chart-axis); stroke-width: 1; }
.affino-hloc-chart__grid-line { stroke: var(--affino-chart-grid); stroke-width: 1; vector-effect: non-scaling-stroke; }
.affino-hloc-chart__x-label,
.affino-hloc-chart__y-label { fill: var(--affino-chart-muted-text); font-size: 11px; }
</style>
