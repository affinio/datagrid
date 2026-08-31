<template>
  <ul
    class="affino-chart-legend"
    :class="`affino-chart-legend--${orientation}`"
    :aria-label="ariaLabel"
  >
    <li
      v-for="(item, index) in items"
      :key="item.id"
      class="affino-chart-legend__item"
      :class="{
        'affino-chart-legend__item--interactive': interactive && !item.disabled,
        'affino-chart-legend__item--disabled': item.disabled,
        'affino-chart-legend__item--hidden': item.hidden,
      }"
      :tabindex="interactive && !item.disabled ? 0 : undefined"
      :role="interactive && !item.disabled ? 'button' : undefined"
      :aria-disabled="item.disabled ? 'true' : undefined"
      :aria-pressed="interactive && !item.disabled ? !item.hidden : undefined"
      @click="handleItemClick(item, index, $event)"
      @mouseenter="emitItemEvent('item-hover', item, index, $event.currentTarget)"
      @mouseleave="emitItemEvent('item-leave', item, index, $event.currentTarget)"
      @keydown.enter.prevent="handleItemClick(item, index, $event)"
      @keydown.space.prevent="handleItemClick(item, index, $event)"
    >
      <span
        class="affino-chart-legend__swatch"
        :style="{ backgroundColor: item.color ?? getSeriesColor(index) }"
        aria-hidden="true"
      />
      <span class="affino-chart-legend__label">{{ item.label }}</span>
      <span v-if="item.value !== undefined" class="affino-chart-legend__value">{{ item.value }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { createChartInteractionAnchor } from "./interaction"
import type { AffinoChartInteractionPayload, ChartLegendItem, ChartLegendOrientation } from "./types"

const SERIES_COLOR_COUNT = 5

withDefaults(defineProps<{
  items: ChartLegendItem[]
  orientation?: ChartLegendOrientation
  interactive?: boolean
  ariaLabel?: string
}>(), {
  orientation: "horizontal",
  interactive: false,
  ariaLabel: "Chart legend",
})

const emit = defineEmits<{
  (event: "item-click" | "item-hover" | "item-leave", payload: AffinoChartInteractionPayload<ChartLegendItem>): void
}>()

function getSeriesColor(index: number): string {
  return `var(--affino-chart-series-${index % SERIES_COLOR_COUNT + 1})`
}

function handleItemClick(item: ChartLegendItem, index: number, event: MouseEvent | KeyboardEvent): void {
  if (!isInteractiveEventTarget(item, event.currentTarget)) {
    return
  }

  emitItemEvent("item-click", item, index, event.currentTarget)
}

function emitItemEvent(
  eventName: "item-click" | "item-hover" | "item-leave",
  item: ChartLegendItem,
  index: number,
  element: EventTarget | null,
): void {
  if (item.disabled || !(element instanceof Element)) {
    return
  }

  emit(eventName, {
    item,
    index,
    ...createChartInteractionAnchor(element),
  })
}

function isInteractiveEventTarget(item: ChartLegendItem, element: EventTarget | null): boolean {
  return !item.disabled && element instanceof Element && element.getAttribute("role") === "button"
}
</script>

<style scoped>
.affino-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin: 0;
  padding: 0;
  color: var(--affino-chart-text, #172033);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.35;
  list-style: none;
}

.affino-chart-legend--vertical {
  display: grid;
  gap: 8px;
}

.affino-chart-legend__item {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  max-width: 100%;
  min-width: 0;
  outline: none;
}

.affino-chart-legend__item--interactive {
  cursor: pointer;
}

.affino-chart-legend__item--disabled {
  color: var(--affino-chart-muted-text, #667085);
  opacity: 0.54;
}

.affino-chart-legend__item--hidden {
  opacity: 0.54;
}

.affino-chart-legend__item:focus-visible {
  border-radius: 4px;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--affino-chart-text, #172033) 28%, transparent);
}

.affino-chart-legend__swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.affino-chart-legend__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.affino-chart-legend__value {
  color: var(--affino-chart-muted-text, #667085);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
