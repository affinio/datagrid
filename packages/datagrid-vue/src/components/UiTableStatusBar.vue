<template>
  <div class="ui-table__status-bar">
    <div class="ui-table__status-bar-left">
      <span class="ui-table__status-label">Rows:</span>
      <span class="ui-table__status-value">{{ rowCountDisplay }}</span>
      <template v-if="showSelectedSection">
        <span class="ui-table__status-divider">|</span>
        <span class="ui-table__status-label">Selected:</span>
        <span class="ui-table__status-value">{{ selectedRowCountDisplay }}</span>
      </template>
    </div>
    <div class="ui-table__status-bar-right">
      <div v-if="hasSelectionMetrics" class="ui-table__status-metrics">
        <span
          v-for="metric in metrics"
          :key="metric.id"
          class="ui-table__status-metric"
          :title="metric.label"
        >
          <span class="ui-table__status-metric-label">{{ metric.label }}:</span>
          <span class="ui-table__status-metric-value">{{ metric.displayValue }}</span>
        </span>
      </div>
      <UiTableZoomControl
        v-if="showZoomControl"
        v-model="zoomProxy"
        :min="minZoom"
        :max="maxZoom"
        :step="zoomStep"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import UiTableZoomControl from "./UiTableZoomControl.vue"
import type { UiTableSelectionMetricResult } from "@affino/datagrid-core/types"

const props = withDefaults(defineProps<{
  rowCountDisplay: string
  selectedRowCount: number
  selectedRowCountDisplay: string
  metrics: UiTableSelectionMetricResult[]
  showZoomControl: boolean
  zoom: number
  minZoom: number
  maxZoom: number
  zoomStep: number
}>(), {
  metrics: () => [],
  showZoomControl: false,
})

const emit = defineEmits<{ (e: "update:zoom", value: number): void }>()

const hasSelectionMetrics = computed(() => props.metrics.length > 0)
const showSelectedSection = computed(() => props.selectedRowCount > 0)

const zoomProxy = computed({
  get: () => props.zoom,
  set: value => emit("update:zoom", value),
})
</script>
