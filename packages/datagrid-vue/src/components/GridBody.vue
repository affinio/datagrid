<template>
  <div class="data-grid-body" role="rowgroup">
    <div class="data-grid-body-spacer" aria-hidden="true" :style="leadingSpacerStyle" />
    <GridRow
      v-for="row in visibleRows"
      :key="String(row.rowId)"
      :row="row"
      @row-select="emit('row-select', $event)"
      @cell-click="emit('cell-click', $event)"
    />
    <div class="data-grid-body-spacer" aria-hidden="true" :style="trailingSpacerStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useDataGridViewContext } from "../composables/useDataGridViewContext"
import GridRow from "./GridRow.vue"
import type { DataGridCellClickPayload, DataGridRowSelectPayload } from "./gridUiTypes"

const { visibleRows, viewModel } = useDataGridViewContext()

const rowHeight = 31

const leadingSpacerStyle = computed(() => ({
  height: `${Math.max(0, viewModel.rowSnapshot.value.viewportRange.start) * rowHeight}px`,
}))

const trailingSpacerStyle = computed(() => {
  const snapshot = viewModel.rowSnapshot.value
  const hiddenRows = Math.max(0, snapshot.rowCount - snapshot.viewportRange.end - 1)
  return {
    height: `${hiddenRows * rowHeight}px`,
  }
})

const emit = defineEmits<{
  (event: "row-select", payload: DataGridRowSelectPayload): void
  (event: "cell-click", payload: DataGridCellClickPayload): void
}>()
</script>

<style scoped>
.data-grid-body {
  width: max-content;
  min-width: 100%;
}

.data-grid-body-spacer {
  width: 1px;
}
</style>
