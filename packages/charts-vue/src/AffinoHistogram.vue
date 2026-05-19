<template>
  <AffinoChartFrame
    class="affino-histogram"
    :width="width"
    :height="height"
    :title="title"
    :description="description"
    :empty="isEmpty"
    :aria-label="title ?? description ?? 'Histogram'"
  >
    <g v-if="showGrid" class="affino-histogram__grid" aria-hidden="true">
      <line
        v-for="tick in yTicks"
        :key="`grid-${tick.value}`"
        class="affino-histogram__grid-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="tick.y"
        :y2="tick.y"
      />
    </g>

    <g v-if="showAxes" class="affino-histogram__axes" aria-hidden="true">
      <line
        class="affino-histogram__axis-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x"
        :y1="geometry.plotArea.y"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
      <line
        class="affino-histogram__axis-line"
        :x1="geometry.plotArea.x"
        :x2="geometry.plotArea.x + geometry.plotArea.width"
        :y1="geometry.plotArea.y + geometry.plotArea.height"
        :y2="geometry.plotArea.y + geometry.plotArea.height"
      />
      <text
        v-for="tick in yTicks"
        :key="`y-${tick.value}`"
        class="affino-histogram__y-label"
        :x="geometry.plotArea.x - 8"
        :y="tick.y"
        text-anchor="end"
        dominant-baseline="middle"
      >
        {{ formatTick(tick.value) }}
      </text>
      <text
        v-for="bin in visibleAxisBins"
        :key="`x-${bin.key}`"
        class="affino-histogram__x-label"
        :x="bin.x"
        :y="geometry.plotArea.y + geometry.plotArea.height + 18"
        text-anchor="middle"
      >
        {{ formatTick(bin.min) }}
      </text>
    </g>

    <g v-if="!isEmpty" class="affino-histogram__bins">
      <rect
        v-for="bin in geometry.bins"
        :key="bin.key"
        class="affino-histogram__bin"
        :data-bin-index="bin.index"
        :data-bin-min="bin.min"
        :data-bin-max="bin.max"
        :data-bin-count="bin.count"
        :x="bin.x"
        :y="bin.y"
        :width="bin.width"
        :height="bin.height"
        tabindex="0"
        role="button"
        :aria-label="`Bin ${formatTick(bin.min)} to ${formatTick(bin.max)}: ${bin.count}`"
        @click="emitBinEvent('bin-click', bin, $event)"
        @mouseenter="emitBinEvent('bin-hover', bin, $event)"
        @mouseleave="emitBinEvent('bin-leave', bin, $event)"
        @keydown.enter.prevent="emitBinEvent('bin-click', bin, $event)"
        @keydown.space.prevent="emitBinEvent('bin-click', bin, $event)"
      />
    </g>

    <template #empty>
      {{ emptyText }}
    </template>
  </AffinoChartFrame>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { createChartLinearScale, createHistogramGeometry } from "@affino/charts-core"
import type { ChartDatum, ChartMargin, HistogramBinGeometry } from "@affino/charts-core"
import AffinoChartFrame from "./AffinoChartFrame.vue"
import { createChartInteractionAnchor } from "./interaction"
import type { AffinoHistogramBinEvent } from "./types"

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 360
const MAX_X_AXIS_LABELS = 10
const Y_TICK_COUNT = 5

const props = withDefaults(defineProps<{
  rows: ChartDatum[]
  valueField: string
  width?: number
  height?: number
  margin?: Partial<ChartMargin>
  title?: string
  description?: string
  binCount?: number
  valueMin?: number
  valueMax?: number
  includeOutOfRange?: boolean
  showAxes?: boolean
  showGrid?: boolean
  emptyText?: string
}>(), {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  includeOutOfRange: false,
  showAxes: true,
  showGrid: true,
  emptyText: "No data",
})

const emit = defineEmits<{
  (event: "bin-click" | "bin-hover" | "bin-leave", payload: AffinoHistogramBinEvent): void
}>()

const geometry = computed(() => createHistogramGeometry({
  rows: props.rows,
  valueField: props.valueField,
  size: {
    width: props.width,
    height: props.height,
  },
  margin: props.margin,
  binCount: props.binCount,
  valueMin: props.valueMin,
  valueMax: props.valueMax,
  includeOutOfRange: props.includeOutOfRange,
}))

const isEmpty = computed(() => geometry.value.totalCount === 0)
const yScale = computed(() => createChartLinearScale(geometry.value.countDomain, {
  min: geometry.value.plotArea.y + geometry.value.plotArea.height,
  max: geometry.value.plotArea.y,
}))
const yTicks = computed(() => {
  const { min, max } = geometry.value.countDomain
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
const visibleAxisBins = computed(() => {
  const bins = geometry.value.bins
  if (bins.length <= MAX_X_AXIS_LABELS) {
    return bins
  }

  const stride = Math.ceil(bins.length / MAX_X_AXIS_LABELS)
  return bins.filter((bin) => bin.index % stride === 0)
})

function formatTick(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }
  return Number.parseFloat(value.toFixed(2)).toString()
}

function emitBinEvent(
  eventName: "bin-click" | "bin-hover" | "bin-leave",
  bin: HistogramBinGeometry,
  event: MouseEvent | KeyboardEvent,
): void {
  const anchor = createChartInteractionAnchor(event.currentTarget instanceof Element ? event.currentTarget : null)

  emit(eventName, {
    item: bin,
    bin,
    index: bin.index,
    min: bin.min,
    max: bin.max,
    count: bin.count,
    values: bin.values,
    ...anchor,
  })
}
</script>

<style scoped>
.affino-histogram {
  --affino-chart-histogram-bin-fill: var(--affino-chart-series-1, #2563eb);
  --affino-chart-histogram-bin-hover-fill: #1d4ed8;
  --affino-chart-histogram-bin-stroke: var(--affino-chart-background, #ffffff);
  --affino-chart-histogram-bin-focus-stroke: var(--affino-chart-text, #172033);
}

.affino-histogram__bin {
  fill: var(--affino-chart-histogram-bin-fill);
  stroke: var(--affino-chart-histogram-bin-stroke);
  stroke-width: 1;
  outline: none;
  transition: fill 120ms ease, stroke 120ms ease;
}

.affino-histogram__bin:hover,
.affino-histogram__bin:focus-visible {
  fill: var(--affino-chart-histogram-bin-hover-fill);
}

.affino-histogram__bin:focus-visible {
  stroke: var(--affino-chart-histogram-bin-focus-stroke);
  stroke-width: 2;
}

.affino-histogram__axis-line {
  stroke: var(--affino-chart-axis);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-histogram__grid-line {
  stroke: var(--affino-chart-grid);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.affino-histogram__x-label,
.affino-histogram__y-label {
  fill: var(--affino-chart-muted-text);
  font-size: 11px;
}
</style>
