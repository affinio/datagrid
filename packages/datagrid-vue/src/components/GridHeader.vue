<template>
  <div class="data-grid-header" role="rowgroup">
    <div
      class="data-grid-header-row"
      role="row"
    >
      <div
        v-for="column in visibleColumns"
        :key="column.key"
        class="data-grid-header-cell"
        role="columnheader"
        :aria-sort="resolveAriaSort(column.key)"
        @click="handleHeaderClick(column.key)"
        @contextmenu.prevent="openColumnMenu($event, column.key)"
      >
        <span class="data-grid-header-label">{{ column.label }}</span>
        <span class="data-grid-header-sort">
          {{ resolveSortLabel(column.key) }}
        </span>
        <button
          v-if="columnMenuApi"
          type="button"
          class="data-grid-header-menu"
          aria-label="Open column menu"
          @click.stop="openColumnMenu($event, column.key)"
        >
          ...
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFeature } from "../composables/useDataGridFeature"
import type { DataGridColumnMenuFeatureApi, DataGridSortingFeatureApi } from "../composables/useDataGridFeatureRegistry"
import { useDataGridViewContext } from "../composables/useDataGridViewContext"

const { visibleColumns, viewModel } = useDataGridViewContext()
const sortingApi = useFeature<DataGridSortingFeatureApi>("sorting")
const columnMenuApi = useFeature<DataGridColumnMenuFeatureApi>("columnMenu")

const resolveSortDirection = (columnKey: string): "asc" | "desc" | null => {
  const entry = viewModel.rowSnapshot.value.sortModel.find(sort => sort.key === columnKey)
  return entry?.direction ?? null
}

const resolveSortLabel = (columnKey: string): string => {
  const direction = resolveSortDirection(columnKey)
  if (direction === "asc") {
    return "ASC"
  }
  if (direction === "desc") {
    return "DESC"
  }
  return ""
}

const resolveAriaSort = (columnKey: string): "ascending" | "descending" | "none" => {
  const direction = resolveSortDirection(columnKey)
  if (direction === "asc") {
    return "ascending"
  }
  if (direction === "desc") {
    return "descending"
  }
  return "none"
}

const handleHeaderClick = (columnKey: string): void => {
  sortingApi.value?.toggleColumnSort(columnKey)
}

const openColumnMenu = (event: MouseEvent, columnKey: string): void => {
  columnMenuApi.value?.open(columnKey, {
    x: event.clientX,
    y: event.clientY,
  })
}
</script>

<style scoped>
.data-grid-header {
  width: 100%;
}

.data-grid-header-row {
  display: grid;
  width: 100%;
  grid-template-columns: var(--dg-grid-template);
}

.data-grid-header-cell {
  border: 1px solid var(--dg-border-color, #d7dde5);
  padding: 6px 8px;
  text-align: left;
  font-weight: 600;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.data-grid-header-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-grid-header-sort {
  font-size: 11px;
  line-height: 1;
  min-width: 8px;
  text-align: center;
}

.data-grid-header-menu {
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  border-radius: 4px;
  padding: 2px 4px;
  cursor: pointer;
}

.data-grid-header-menu:hover {
  border-color: var(--dg-border-color, #d7dde5);
}
</style>
