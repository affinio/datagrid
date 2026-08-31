<template>
  <div
    ref="containerElement"
    class="affino-time-series-chart affino-chart-theme"
    :class="`affino-chart-theme--${themeMode}`"
    :style="themeStyle"
  >
    <AffinoChartFrame
      :width="renderWidth"
      :height="height"
      :title="title"
      :description="description"
      :empty="isEmpty"
      :aria-label="title ?? description ?? 'Time-series chart'"
    >
      <g v-if="showGrid" class="affino-time-series-chart__grid" aria-hidden="true">
        <line
          v-for="tick in yTicks"
          :key="`grid-${tick.value}`"
          class="affino-time-series-chart__grid-line"
          :x1="geometry.plotArea.x"
          :x2="geometry.plotArea.x + geometry.plotArea.width"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>

      <g v-if="showAxes" class="affino-time-series-chart__axes" aria-hidden="true">
        <line
          class="affino-time-series-chart__axis-line"
          :x1="geometry.plotArea.x"
          :x2="geometry.plotArea.x"
          :y1="geometry.plotArea.y"
          :y2="geometry.plotArea.y + geometry.plotArea.height"
        />
        <line
          class="affino-time-series-chart__axis-line"
          :x1="geometry.plotArea.x"
          :x2="geometry.plotArea.x + geometry.plotArea.width"
          :y1="geometry.plotArea.y + geometry.plotArea.height"
          :y2="geometry.plotArea.y + geometry.plotArea.height"
        />
        <text
          v-for="tick in yTicks"
          :key="`y-${tick.value}`"
          class="affino-time-series-chart__axis-label"
          :x="geometry.plotArea.x - 8"
          :y="tick.y"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ formatValue(tick.value) }}
        </text>
        <text
          v-for="tick in geometry.timeTicks"
          :key="`x-${tick.value}`"
          class="affino-time-series-chart__axis-label"
          :x="tick.x"
          :y="geometry.plotArea.y + geometry.plotArea.height + 20"
          text-anchor="middle"
        >
          {{ tick.label }}
        </text>
      </g>

      <line
        v-if="geometry.zeroY !== null"
        class="affino-time-series-chart__zero-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="geometry.zeroY"
        :y2="geometry.zeroY"
        aria-hidden="true"
      />

      <g class="affino-time-series-chart__series" aria-hidden="true">
        <path
          v-for="(item, index) in areaSeries"
          :key="`area-${item.id}`"
          class="affino-time-series-chart__area"
          :d="item.areaPath"
          :fill="seriesColor(item.id, index)"
          :fill-opacity="item.presentation.areaOpacity"
        />
        <path
          v-for="(item, index) in geometry.series"
          :key="item.id"
          class="affino-time-series-chart__line"
          :data-series-id="item.id"
          :d="item.linePath"
          :stroke="seriesColor(item.id, index)"
          :stroke-width="item.presentation.lineWidth"
        />
      </g>

      <g v-if="tooltipPayload !== null" class="affino-time-series-chart__focus" aria-hidden="true">
        <line
          v-if="showCrosshair"
          class="affino-time-series-chart__crosshair"
          :x1="tooltipPayload.x"
          :x2="tooltipPayload.x"
          :y1="geometry.plotArea.y"
          :y2="geometry.plotArea.y + geometry.plotArea.height"
        />
        <circle
          v-for="point in activePoints"
          :key="`active-${point.seriesId}`"
          class="affino-time-series-chart__focus-point"
          :cx="point.x"
          :cy="point.y"
          r="4"
          :fill="point.color"
        />
      </g>

      <rect
        v-if="!isEmpty"
        class="affino-time-series-chart__interaction"
        :x="geometry.plotArea.x"
        :y="geometry.plotArea.y"
        :width="geometry.plotArea.width"
        :height="geometry.plotArea.height"
        fill="transparent"
        tabindex="0"
        role="slider"
        aria-label="Inspect chart values"
        :aria-valuemin="geometry.timeDomain.min"
        :aria-valuemax="geometry.timeDomain.max"
        :aria-valuenow="activeTimestamp ?? undefined"
        @mousemove="handlePointerMove"
        @mouseleave="clearTooltip"
        @focus="handleFocus"
        @blur="clearTooltip"
        @keydown.left.prevent="moveTooltip(-1)"
        @keydown.right.prevent="moveTooltip(1)"
        @keydown.home.prevent="moveTooltipToEdge('start')"
        @keydown.end.prevent="moveTooltipToEdge('end')"
        @keydown.esc="clearTooltip"
      />

      <template #empty>{{ emptyText }}</template>
    </AffinoChartFrame>

    <div
      v-if="tooltipEnabled && tooltipPayload !== null"
      class="affino-time-series-chart__tooltip"
      :style="tooltipPositionStyle"
      role="status"
    >
      <slot name="tooltip" :tooltip="tooltipPayload">
        <div class="affino-time-series-chart__tooltip-time">{{ tooltipPayload.formattedTimestamp }}</div>
        <div v-for="entry in tooltipPayload.entries" :key="entry.seriesId" class="affino-time-series-chart__tooltip-entry">
          <span class="affino-time-series-chart__tooltip-swatch" :style="{ backgroundColor: entry.color }" />
          <span>{{ entry.seriesLabel }}</span>
          <strong>{{ entry.formattedValue }}</strong>
        </div>
      </slot>
    </div>

    <AffinoChartLegend
      v-if="showLegend"
      class="affino-time-series-chart__legend"
      :items="legendItems"
      :interactive="legendToggle"
      @item-click="toggleSeriesVisibility($event.item.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import {
  createChartLinearScale,
  createTimeSeriesChartGeometry,
  formatTimeAxisTick,
  resolveTimeSeriesTooltip,
} from "@affino/charts-core"
import type {
  ChartMargin,
  TimeAxisOptions,
  TimeSeries,
  TimeSeriesGeometryPoint,
  TimeSeriesYAxisOptions,
} from "@affino/charts-core"
import AffinoChartFrame from "./AffinoChartFrame.vue"
import AffinoChartLegend from "./AffinoChartLegend.vue"
import type {
  AffinoTimeSeriesTooltip,
  AffinoTimeSeriesVisibilityEvent,
  ChartLegendItem,
  ChartTheme,
  TimeSeriesTooltipOptions,
} from "./types"

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 360
const Y_TICK_COUNT = 5

const props = withDefaults(defineProps<{
  series: readonly TimeSeries[]
  width?: number
  height?: number
  responsive?: boolean
  margin?: Partial<ChartMargin>
  title?: string
  description?: string
  emptyText?: string
  timeAxis?: TimeAxisOptions
  yAxis?: TimeSeriesYAxisOptions
  tooltip?: TimeSeriesTooltipOptions
  showAxes?: boolean
  showGrid?: boolean
  showLegend?: boolean
  legendToggle?: boolean
  showCrosshair?: boolean
  theme?: ChartTheme | "light" | "dark"
}>(), {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  responsive: true,
  emptyText: "No data",
  showAxes: true,
  showGrid: true,
  showLegend: true,
  legendToggle: true,
  showCrosshair: true,
  theme: "light",
})

const emit = defineEmits<{
  (event: "tooltip-change", payload: AffinoTimeSeriesTooltip | null): void
  (event: "series-visibility-change", payload: AffinoTimeSeriesVisibilityEvent): void
}>()

defineSlots<{
  tooltip?: (props: { tooltip: AffinoTimeSeriesTooltip }) => unknown
}>()

const containerElement = ref<HTMLElement | null>(null)
const observedWidth = ref<number | null>(null)
const hiddenSeriesIds = ref(new Set<string>())
const activeTimestamp = ref<number | null>(null)
let resizeObserver: ResizeObserver | null = null

const renderWidth = computed(() => props.responsive ? observedWidth.value ?? props.width : props.width)
const renderedSeries = computed<TimeSeries[]>(() => props.series.map((series) => ({
  ...series,
  visible: series.visible !== false && !hiddenSeriesIds.value.has(series.id),
})))
const geometry = computed(() => createTimeSeriesChartGeometry({
  series: renderedSeries.value,
  size: { width: renderWidth.value, height: props.height },
  margin: props.margin,
  timeAxis: props.timeAxis,
  yAxis: props.yAxis,
}))
const isEmpty = computed(() => geometry.value.series.every((series) => series.points.length === 0))
const areaSeries = computed(() => geometry.value.series.filter((series) => series.presentation.type === "area"))
const tooltipEnabled = computed(() => props.tooltip?.enabled !== false)
const themeMode = computed(() => typeof props.theme === "string" ? props.theme : props.theme.mode ?? "light")
const themeStyle = computed<Record<string, string>>(() => {
  if (typeof props.theme === "string") return {}
  const theme = props.theme
  const styles: Record<string, string> = {}
  const tokens: Array<[keyof ChartTheme, string]> = [
    ["background", "--affino-chart-background"],
    ["surface", "--affino-chart-surface"],
    ["border", "--affino-chart-border"],
    ["grid", "--affino-chart-grid"],
    ["axis", "--affino-chart-axis"],
    ["text", "--affino-chart-text"],
    ["mutedText", "--affino-chart-muted-text"],
    ["tooltipBackground", "--affino-chart-tooltip-background"],
    ["tooltipText", "--affino-chart-tooltip-text"],
    ["positive", "--affino-chart-positive"],
    ["negative", "--affino-chart-negative"],
    ["focus", "--affino-chart-focus"],
    ["crosshair", "--affino-chart-crosshair"],
  ]
  for (const [key, token] of tokens) {
    const value = theme[key]
    if (typeof value === "string") styles[token] = value
  }
  theme.seriesColors?.forEach((color, index) => {
    styles[`--affino-chart-series-${index + 1}`] = color
  })
  return styles
})
const yScale = computed(() => createChartLinearScale(geometry.value.valueDomain, {
  min: geometry.value.plotArea.y + geometry.value.plotArea.height,
  max: geometry.value.plotArea.y,
}))
const yTicks = computed(() => {
  const { min, max } = geometry.value.valueDomain
  const step = (max - min) / (Y_TICK_COUNT - 1)
  return Array.from({ length: Y_TICK_COUNT }, (_, index) => {
    const value = min + step * index
    return { value, y: yScale.value.scale(value) }
  })
})
const domainTimestamps = computed(() => [...new Set(renderedSeries.value
  .filter((series) => series.visible !== false)
  .flatMap((series) => series.data.map((point) => point.time)))]
  .sort((left, right) => left - right))
const tooltipPayload = computed<AffinoTimeSeriesTooltip | null>(() => {
  if (activeTimestamp.value === null) return null
  const raw = resolveTimeSeriesTooltip(renderedSeries.value, activeTimestamp.value)
  if (raw === null) return null
  const xScale = createChartLinearScale(geometry.value.timeDomain, {
    min: geometry.value.plotArea.x,
    max: geometry.value.plotArea.x + geometry.value.plotArea.width,
  })
  return {
    timestamp: raw.timestamp,
    formattedTimestamp: props.tooltip?.formatTime?.(raw.timestamp)
      ?? formatTimeAxisTick(raw.timestamp, props.timeAxis, geometry.value.timeDomain.max - geometry.value.timeDomain.min),
    x: xScale.scale(raw.timestamp),
    entries: raw.entries.map((entry) => {
      const sourceSeries = props.series.find((series) => series.id === entry.seriesId)
      return {
        ...entry,
        color: sourceSeries === undefined ? entry.color : seriesColor(sourceSeries.id, props.series.indexOf(sourceSeries)),
        formattedValue: sourceSeries === undefined
          ? formatValue(entry.value)
          : props.tooltip?.formatValue?.(entry.value, sourceSeries) ?? formatValue(entry.value),
      }
    }),
  }
})
const activePoints = computed(() => {
  const tooltip = tooltipPayload.value
  if (tooltip === null) return []
  return geometry.value.series.flatMap((series, index) => {
    const point = findGeometryPoint(series.points, tooltip.timestamp)
    return point === null ? [] : [{
      seriesId: series.id,
      x: point.x,
      y: point.y,
      color: seriesColor(series.id, index),
    }]
  })
})
const tooltipLeftPercent = computed(() => Math.min(92, Math.max(8, tooltipPayload.value === null
  ? 50
  : tooltipPayload.value.x / renderWidth.value * 100)))
const tooltipPositionStyle = computed(() => ({ left: `${tooltipLeftPercent.value}%` }))
const legendItems = computed<ChartLegendItem[]>(() => props.series.map((series, index) => ({
  id: series.id,
  label: series.label,
  color: seriesColor(series.id, index),
  hidden: series.visible === false || hiddenSeriesIds.value.has(series.id),
})))

watch(() => props.series.map((series) => series.id), (ids) => {
  const retained = new Set([...hiddenSeriesIds.value].filter((id) => ids.includes(id)))
  hiddenSeriesIds.value = retained
  if (activeTimestamp.value !== null && domainTimestamps.value.length === 0) clearTooltip()
})

onMounted(() => {
  if (!props.responsive || typeof ResizeObserver === "undefined" || containerElement.value === null) return
  resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width
    if (width !== undefined && width > 0) observedWidth.value = width
  })
  resizeObserver.observe(containerElement.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

function formatValue(value: number): string {
  return props.yAxis?.format?.(value) ?? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

function seriesColor(seriesId: string, index: number): string {
  const configured = props.series.find((series) => series.id === seriesId)?.presentation?.color
  return configured ?? `var(--affino-chart-series-${index % 5 + 1})`
}

function handlePointerMove(event: MouseEvent): void {
  const element = event.currentTarget
  if (!(element instanceof SVGElement)) return
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const { min, max } = geometry.value.timeDomain
  setActiveTimestamp(min + (max - min) * ratio)
}

function handleFocus(): void {
  if (activeTimestamp.value !== null) return
  const timestamps = domainTimestamps.value
  const timestamp = timestamps[Math.floor((timestamps.length - 1) / 2)]
  if (timestamp !== undefined) setActiveTimestamp(timestamp)
}

function moveTooltip(direction: -1 | 1): void {
  const timestamps = domainTimestamps.value
  if (timestamps.length === 0) return
  const current = tooltipPayload.value?.timestamp
  const currentIndex = current === undefined ? -1 : timestamps.indexOf(current)
  const nextIndex = Math.min(timestamps.length - 1, Math.max(0, currentIndex + direction))
  const timestamp = timestamps[nextIndex]
  if (timestamp !== undefined) setActiveTimestamp(timestamp)
}

function moveTooltipToEdge(edge: "start" | "end"): void {
  const timestamps = domainTimestamps.value
  const timestamp = edge === "start" ? timestamps[0] : timestamps[timestamps.length - 1]
  if (timestamp !== undefined) setActiveTimestamp(timestamp)
}

function setActiveTimestamp(timestamp: number): void {
  const resolved = resolveTimeSeriesTooltip(renderedSeries.value, timestamp)
  activeTimestamp.value = resolved?.timestamp ?? null
  emit("tooltip-change", tooltipPayload.value)
}

function clearTooltip(): void {
  if (activeTimestamp.value === null) return
  activeTimestamp.value = null
  emit("tooltip-change", null)
}

function toggleSeriesVisibility(seriesId: string): void {
  const next = new Set(hiddenSeriesIds.value)
  if (next.has(seriesId)) next.delete(seriesId)
  else next.add(seriesId)
  hiddenSeriesIds.value = next
  emit("series-visibility-change", {
    seriesId,
    visible: !next.has(seriesId),
  })
}

function findGeometryPoint(points: readonly TimeSeriesGeometryPoint[], timestamp: number): TimeSeriesGeometryPoint | null {
  let low = 0
  let high = points.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const point = points[middle]
    if (point === undefined) return null
    if (point.time < timestamp) low = middle + 1
    else if (point.time > timestamp) high = middle - 1
    else return point
  }
  return null
}
</script>

<style scoped>
.affino-time-series-chart {
  position: relative;
  width: 100%;
  min-width: 0;
}

.affino-time-series-chart__grid-line {
  stroke: var(--affino-chart-grid, #e4e7ec);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-time-series-chart__axis-line,
.affino-time-series-chart__zero-line {
  stroke: var(--affino-chart-axis, #475467);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-time-series-chart__zero-line {
  stroke-width: 1.5;
}

.affino-time-series-chart__axis-label {
  fill: var(--affino-chart-muted-text, #667085);
  font-size: 11px;
}

.affino-time-series-chart__area,
.affino-time-series-chart__line {
  pointer-events: none;
}

.affino-time-series-chart__line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.affino-time-series-chart__interaction {
  cursor: crosshair;
  outline: none;
  pointer-events: all;
}

.affino-time-series-chart__interaction:focus-visible {
  stroke: var(--affino-chart-focus, #2563eb);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.affino-time-series-chart__crosshair {
  stroke: var(--affino-chart-crosshair, #667085);
  stroke-dasharray: 4 3;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-time-series-chart__focus-point {
  stroke: var(--affino-chart-background, #ffffff);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.affino-time-series-chart__tooltip {
  position: absolute;
  z-index: 2;
  top: 12px;
  min-width: 160px;
  max-width: min(280px, 80%);
  padding: 10px 12px;
  color: var(--affino-chart-tooltip-text, #ffffff);
  background: var(--affino-chart-tooltip-background, #101828);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgb(16 24 40 / 18%);
  font-size: 12px;
  pointer-events: none;
  transform: translateX(-50%);
}

.affino-time-series-chart__tooltip-time {
  margin-bottom: 6px;
  font-weight: 600;
}

.affino-time-series-chart__tooltip-entry {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
  margin-top: 4px;
}

.affino-time-series-chart__tooltip-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.affino-time-series-chart__legend {
  padding: 10px 4px 0;
}
</style>
