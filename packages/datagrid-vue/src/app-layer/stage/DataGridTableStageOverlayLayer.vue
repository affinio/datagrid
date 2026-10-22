<template>
  <div v-if="selectionSegments.length > 0" class="grid-selection-overlay" :class="layerClass" aria-hidden="true">
    <div
      v-for="segment in selectionSegments"
      :key="segment.key"
      class="grid-selection-overlay__segment"
      :style="segment.style"
    />
  </div>
  <div v-if="fillPreviewSegments.length > 0" class="grid-selection-overlay" :class="layerClass" aria-hidden="true">
    <div
      v-for="segment in fillPreviewSegments"
      :key="segment.key"
      class="grid-selection-overlay__segment grid-selection-overlay__segment--fill-preview"
      :style="segment.style"
    />
  </div>
  <div v-if="movePreviewSegments.length > 0" class="grid-selection-overlay" :class="layerClass" aria-hidden="true">
    <div
      v-for="segment in movePreviewSegments"
      :key="segment.key"
      class="grid-selection-overlay__segment grid-selection-overlay__segment--move-preview"
      :style="segment.style"
    />
  </div>
  <div
    v-for="lane in visibleLanes"
    :key="lane.key"
    class="grid-selection-overlay"
    :class="[layerClass, lane.className]"
    :data-datagrid-overlay-lane="lane.key"
    aria-hidden="true"
  >
    <div
      v-for="segment in lane.segments"
      :key="segment.key"
      class="grid-selection-overlay__segment"
      :class="lane.segmentClassName"
      :style="segment.style"
      data-datagrid-overlay-segment="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue"
import type { DataGridTableStageOverlayLane } from "./dataGridTableStageBody.types"

interface OverlaySegment {
  key: string
  style: CSSProperties
}

const props = withDefaults(defineProps<{
  selectionSegments: readonly OverlaySegment[]
  fillPreviewSegments: readonly OverlaySegment[]
  movePreviewSegments: readonly OverlaySegment[]
  layerClass?: string
  lanes?: readonly DataGridTableStageOverlayLane[]
}>(), {
  layerClass: "",
  lanes: () => [],
})

const visibleLanes = computed(() => (props.lanes ?? []).filter(lane => lane.segments.length > 0))
</script>
