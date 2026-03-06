<template>
  <div class="data-grid-body" role="rowgroup">
    <GridRow
      v-for="row in visibleRows"
      :key="String(row.rowId)"
      :row="row"
      @row-select="emit('row-select', $event)"
      @cell-click="emit('cell-click', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useDataGridViewContext } from "../composables/useDataGridViewContext"
import GridRow from "./GridRow.vue"
import type { DataGridCellClickPayload, DataGridRowSelectPayload } from "./gridUiTypes"

const { visibleRows } = useDataGridViewContext()

const emit = defineEmits<{
  (event: "row-select", payload: DataGridRowSelectPayload): void
  (event: "cell-click", payload: DataGridCellClickPayload): void
}>()
</script>

<style scoped>
.data-grid-body {
  width: 100%;
}
</style>
