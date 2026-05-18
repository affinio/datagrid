<template>
  <div class="affino-pie-chart">
    <AffinoChartFrame
      class="affino-pie-chart__frame"
      :width="width"
      :height="height"
      :title="title"
      :description="description"
      :empty="isEmpty"
      :aria-label="title ?? description ?? 'Pie chart'"
    >
      <g class="affino-pie-chart__slices">
        <path
          v-for="slice in geometry.slices"
          :key="slice.key"
          class="affino-pie-chart__slice"
          :data-slice-index="slice.index"
          :data-slice-category="slice.category"
          :data-slice-value="slice.value"
          :d="slice.path"
          :style="{ fill: getSeriesColor(slice.index) }"
          tabindex="0"
          role="button"
          :aria-label="`${slice.category}: ${slice.value} (${formatPercentage(slice.percentage)})`"
          @click="emitSliceEvent('slice-click', slice, $event)"
          @mouseenter="emitSliceEvent('slice-hover', slice, $event)"
          @mouseleave="emitSliceEvent('slice-leave', slice, $event)"
          @keydown.enter.prevent="emitSliceEvent('slice-click', slice, $event)"
          @keydown.space.prevent="emitSliceEvent('slice-click', slice, $event)"
        />
      </g>

      <template #empty>
        {{ emptyText }}
      </template>
    </AffinoChartFrame>

    <AffinoChartLegend
      v-if="showLegend && legendItems.length > 0"
      class="affino-pie-chart__legend"
      :items="legendItems"
      orientation="vertical"
      aria-label="Pie chart legend"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { createPieChartGeometry } from "@affino/charts-core"
import type { ChartDatum, ChartMargin, PieChartSliceGeometry } from "@affino/charts-core"
import AffinoChartFrame from "./AffinoChartFrame.vue"
import AffinoChartLegend from "./AffinoChartLegend.vue"
import { createChartInteractionAnchor } from "./interaction"
import type { AffinoPieChartSliceEvent, ChartLegendItem } from "./types"

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 360
const SERIES_COLOR_COUNT = 5

const props = withDefaults(defineProps<{
  rows: ChartDatum[]
  categoryField: string
  valueField: string
  width?: number
  height?: number
  margin?: Partial<ChartMargin>
  title?: string
  description?: string
  innerRadiusRatio?: number
  startAngle?: number
  endAngle?: number
  showLegend?: boolean
  emptyText?: string
}>(), {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  innerRadiusRatio: 0,
  showLegend: true,
  emptyText: "No data",
})

const emit = defineEmits<{
  (event: "slice-click" | "slice-hover" | "slice-leave", payload: AffinoPieChartSliceEvent): void
}>()

const geometry = computed(() => createPieChartGeometry({
  rows: props.rows,
  categoryField: props.categoryField,
  valueField: props.valueField,
  size: {
    width: props.width,
    height: props.height,
  },
  margin: props.margin,
  innerRadiusRatio: props.innerRadiusRatio,
  startAngle: props.startAngle,
  endAngle: props.endAngle,
}))

const isEmpty = computed(() => geometry.value.slices.length === 0)
const legendItems = computed<ChartLegendItem[]>(() => geometry.value.slices.map((slice) => ({
  id: slice.key,
  label: slice.category,
  color: getSeriesColor(slice.index),
  value: formatPercentage(slice.percentage),
})))

function getSeriesColor(index: number): string {
  return `var(--affino-chart-series-${index % SERIES_COLOR_COUNT + 1})`
}

function formatPercentage(value: number): string {
  return `${Number.parseFloat((value * 100).toFixed(1))}%`
}

function emitSliceEvent(
  eventName: "slice-click" | "slice-hover" | "slice-leave",
  slice: PieChartSliceGeometry,
  event: MouseEvent | KeyboardEvent,
): void {
  const anchor = createChartInteractionAnchor(event.currentTarget instanceof Element ? event.currentTarget : null)

  emit(eventName, {
    item: slice,
    slice,
    row: slice.row,
    index: slice.index,
    category: slice.category,
    value: slice.value,
    percentage: slice.percentage,
    ...anchor,
  })
}
</script>

<style scoped>
.affino-pie-chart {
  --affino-chart-series-5: #8b5cf6;
  --affino-chart-pie-slice-stroke: var(--affino-chart-background, #ffffff);
  --affino-chart-pie-slice-hover-opacity: 0.82;

  display: grid;
  gap: 12px;
  color: var(--affino-chart-text, #172033);
  font-family: inherit;
}

.affino-pie-chart__slice {
  stroke: var(--affino-chart-pie-slice-stroke);
  stroke-width: 1;
  outline: none;
  transition: opacity 120ms ease, stroke 120ms ease;
}

.affino-pie-chart__slice:hover,
.affino-pie-chart__slice:focus-visible {
  opacity: var(--affino-chart-pie-slice-hover-opacity);
}

.affino-pie-chart__slice:focus-visible {
  stroke: var(--affino-chart-text, #172033);
  stroke-width: 2;
}
</style>
