<template>
  <div v-if="selectionSegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
    <div
      v-for="segment in selectionSegments"
      :key="segment.key"
      class="grid-selection-overlay__segment"
      :style="segment.style"
    />
  </div>
  <div v-if="fillPreviewSegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
    <div
      v-for="segment in fillPreviewSegments"
      :key="segment.key"
      class="grid-selection-overlay__segment grid-selection-overlay__segment--fill-preview"
      :style="segment.style"
    />
  </div>
  <div v-if="movePreviewSegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
    <div
      v-for="segment in movePreviewSegments"
      :key="segment.key"
      class="grid-selection-overlay__segment grid-selection-overlay__segment--move-preview"
      :style="segment.style"
    />
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties, PropType } from "vue"

interface OverlaySegment {
  key: string
  style: CSSProperties
}

defineProps({
  selectionSegments: {
    type: Array as PropType<readonly OverlaySegment[]>,
    required: true,
  },
  fillPreviewSegments: {
    type: Array as PropType<readonly OverlaySegment[]>,
    required: true,
  },
  movePreviewSegments: {
    type: Array as PropType<readonly OverlaySegment[]>,
    required: true,
  },
})
</script>
