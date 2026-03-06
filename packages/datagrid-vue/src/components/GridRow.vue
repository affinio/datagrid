<template>
  <div
    class="data-grid-row"
    role="row"
    :data-row-key="String(row.rowId)"
    :aria-rowindex="row.displayIndex + 1"
    :aria-selected="row.state.selected ? 'true' : 'false'"
  >
    <GridCell
      v-for="(column, columnIndex) in visibleColumns"
      :key="`${String(row.rowId)}:${column.key}`"
      :row-key="row.rowId"
      :row-index="row.displayIndex"
      :column-key="column.key"
      :column-index="columnIndex"
      :is-selected="row.state.selected"
      :value="viewModel.readCell(row, column.key)"
      @cell-click="handleCellClick(column.key, columnIndex)"
    />
  </div>
</template>

<script setup lang="ts">
import type { DataGridRowNode } from "@affino/datagrid-core"
import { useDataGridViewContext } from "../composables/useDataGridViewContext"
import GridCell from "./GridCell.vue"
import type { DataGridCellClickPayload, DataGridRowSelectPayload } from "./gridUiTypes"

const props = defineProps<{
  row: DataGridRowNode<unknown>
}>()

const emit = defineEmits<{
  (event: "row-select", payload: DataGridRowSelectPayload): void
  (event: "cell-click", payload: DataGridCellClickPayload): void
}>()

const { visibleColumns, viewModel } = useDataGridViewContext()

const handleCellClick = (columnKey: string, columnIndex: number) => {
  return () => {
    if (!props.row.state.selected) {
      emit("row-select", {
        row: props.row,
        rowIndex: props.row.displayIndex,
      })
    }
    emit("cell-click", {
      row: props.row,
      rowIndex: props.row.displayIndex,
      columnKey,
      columnIndex,
    })
  }
}
</script>

<style scoped>
.data-grid-row {
  display: grid;
  width: 100%;
  grid-template-columns: var(--dg-grid-template);
}
</style>
