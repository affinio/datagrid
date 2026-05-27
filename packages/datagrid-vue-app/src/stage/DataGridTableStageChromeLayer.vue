<template>
  <div class="grid-chrome-layer" :style="layerStyle" aria-hidden="true">
    <div
      v-for="(band, index) in model.bands"
      :key="`band-${index}-${band.kind}-${band.top}`"
      class="grid-chrome-layer__band"
      :class="resolveBandClass(band.kind)"
      :style="resolveBandStyle(band)"
    />
    <div
      v-for="(line, index) in visibleHorizontalLines"
      :key="`horizontal-${index}-${line.position}`"
      class="grid-chrome-layer__line grid-chrome-layer__line--horizontal"
      :style="resolveHorizontalLineStyle(line)"
    />
    <div
      v-for="(line, index) in visibleVerticalLines"
      :key="`vertical-${index}-${line.position}`"
      class="grid-chrome-layer__line grid-chrome-layer__line--vertical"
      :style="resolveVerticalLineStyle(line)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue"
import type {
  DataGridChromeBand,
  DataGridChromeLine,
  DataGridChromePaneModel,
} from "@affino/datagrid-chrome"

const props = defineProps<{
  model: DataGridChromePaneModel
}>()

const bandClassByKind: Record<string, string> = {
  base: "grid-chrome-layer__band--base",
  hover: "grid-chrome-layer__band--hover",
  striped: "grid-chrome-layer__band--striped",
  group: "grid-chrome-layer__band--group",
  tree: "grid-chrome-layer__band--tree",
  pivot: "grid-chrome-layer__band--pivot",
  "pivot-group": "grid-chrome-layer__band--pivot-group",
}

const layerStyle = computed<CSSProperties>(() => ({
  width: px(props.model.width),
  height: px(props.model.height),
}))

const visibleHorizontalLines = computed(() => props.model.horizontalLines.filter(line => (
  line.position > 0.5 && line.position < props.model.height + 0.5
)))

const visibleVerticalLines = computed(() => props.model.verticalLines.filter(line => (
  line.position > 0.5 && line.position < props.model.width - 0.5
)))

function px(value: number): string {
  return `${Math.max(0, Number.isFinite(value) ? value : 0)}px`
}

function resolveBandClass(kind: string): string {
  return bandClassByKind[kind] ?? ""
}

function resolveBandStyle(band: DataGridChromeBand): CSSProperties {
  return {
    top: px(band.top),
    height: px(band.height),
  }
}

function resolveHorizontalLineStyle(line: DataGridChromeLine): CSSProperties {
  return {
    top: `calc(${px(line.position)} - var(--datagrid-row-divider-size))`,
  }
}

function resolveVerticalLineStyle(line: DataGridChromeLine): CSSProperties {
  return {
    left: px(line.position),
    height: px(props.model.height),
  }
}
</script>
