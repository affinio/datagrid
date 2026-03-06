<template>
  <div
    class="data-grid-cell"
    role="gridcell"
    :data-row-key="String(rowKey)"
    :data-column-key="columnKey"
    :aria-colindex="columnIndex + 1"
    :aria-rowindex="rowIndex + 1"
    :aria-selected="isSelected ? 'true' : 'false'"
    @click.stop="handleClick"
  >
    {{ displayValue }}
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  rowKey: string | number
  rowIndex: number
  columnKey: string
  columnIndex: number
  isSelected: boolean
  value: unknown
}>()

const emit = defineEmits<{
  (
    event: "cell-click",
    payload: {
      rowKey: string | number
      columnKey: string
      additive: boolean
      toggle: boolean
    },
  ): void
}>()

const displayValue = computed<string>(() => {
  const value = props.value
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number") {
    return String(value)
  }
  if (value == null) {
    return ""
  }
  if (typeof value === "object") {
    return "[object]"
  }
  return String(value)
})

const handleClick = (event: MouseEvent): void => {
  const additive = event.metaKey || event.ctrlKey
  emit("cell-click", {
    rowKey: props.rowKey,
    columnKey: props.columnKey,
    additive,
    toggle: additive,
  })
}
</script>

<style scoped>
.data-grid-cell {
  border: 1px solid var(--dg-border-color, #d7dde5);
  padding: 6px 8px;
  text-align: left;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
