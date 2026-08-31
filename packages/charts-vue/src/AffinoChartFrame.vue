<template>
  <div class="affino-chart-frame">
    <div v-if="$slots.header || title || description" class="affino-chart-frame__header">
      <slot name="header">
        <h2 v-if="title" class="affino-chart-frame__title">{{ title }}</h2>
        <p v-if="description" class="affino-chart-frame__description">{{ description }}</p>
      </slot>
    </div>

    <div class="affino-chart-frame__stage">
      <svg
        class="affino-chart-frame__svg"
        :width="width"
        :height="height"
        :viewBox="viewBox"
        role="img"
        :aria-label="ariaLabel || undefined"
        :aria-labelledby="svgLabelledBy"
      >
        <title v-if="!ariaLabel" :id="titleId">{{ svgTitle }}</title>
        <desc v-if="description" :id="descriptionId">{{ description }}</desc>
        <slot />
      </svg>

      <div
        v-if="state"
        class="affino-chart-frame__state"
        :class="`affino-chart-frame__state--${state}`"
        :data-state="state"
        :role="stateRole"
        :aria-live="stateLive"
      >
        <slot v-if="state === 'error'" name="error" :error="errorMessage">
          {{ errorMessage }}
        </slot>
        <slot v-else-if="state === 'loading'" name="loading">
          Loading chart
        </slot>
        <slot v-else name="empty">
          No chart data
        </slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 360

let nextChartFrameId = 0
</script>

<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(defineProps<{
  width?: number
  height?: number
  title?: string
  description?: string
  empty?: boolean
  loading?: boolean
  error?: string | null
  ariaLabel?: string
}>(), {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  empty: false,
  loading: false,
  error: null,
})

defineSlots<{
  default?: () => unknown
  header?: () => unknown
  empty?: () => unknown
  loading?: () => unknown
  error?: (props: { error: string }) => unknown
}>()

const frameId = ++nextChartFrameId
const titleId = `affino-chart-frame-title-${frameId}`
const descriptionId = `affino-chart-frame-description-${frameId}`

const viewBox = computed(() => `0 0 ${props.width} ${props.height}`)
const svgTitle = computed(() => props.ariaLabel ?? props.title ?? "Chart")
const svgLabelledBy = computed(() => (
  props.ariaLabel ? undefined : props.description ? `${titleId} ${descriptionId}` : titleId
))
const errorMessage = computed(() => props.error ?? "Chart could not be rendered.")
const state = computed<"error" | "loading" | "empty" | null>(() => {
  if (props.error) {
    return "error"
  }
  if (props.loading) {
    return "loading"
  }
  if (props.empty) {
    return "empty"
  }
  return null
})
const stateRole = computed(() => state.value === "error" ? "alert" : "status")
const stateLive = computed(() => state.value === "error" ? "assertive" : "polite")
</script>

<style scoped>
.affino-chart-frame {
  color: var(--affino-chart-text, #172033);
  background: var(--affino-chart-background, #ffffff);
  border: 1px solid var(--affino-chart-border, #d8dee8);
  border-radius: 8px;
  font-family: inherit;
  min-width: 0;
  overflow: hidden;
}

.affino-chart-frame__header {
  display: grid;
  gap: 4px;
  padding: 14px 16px 0;
}

.affino-chart-frame__title {
  margin: 0;
  color: var(--affino-chart-text);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
}

.affino-chart-frame__description {
  margin: 0;
  color: var(--affino-chart-muted-text);
  font-size: 13px;
  line-height: 1.45;
}

.affino-chart-frame__stage {
  position: relative;
  background: var(--affino-chart-surface, #f8fafc);
  min-width: 0;
}

.affino-chart-frame__svg {
  display: block;
  width: 100%;
  height: auto;
}

.affino-chart-frame__state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--affino-chart-muted-text);
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
  background: color-mix(in srgb, var(--affino-chart-surface) 92%, transparent);
  backdrop-filter: blur(1px);
}

.affino-chart-frame__state--error {
  color: var(--affino-chart-danger);
}
</style>
