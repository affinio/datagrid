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
        <button
          type="button"
          class="data-grid-header-resize"
          aria-label="Resize column"
          @mousedown="startResize(column.key, $event)"
          @dblclick="resetResize(column.key, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from "vue"
import { useDataGridContext } from "../composables/useDataGridContext"
import { useFeature } from "../composables/useDataGridFeature"
import type { DataGridColumnMenuFeatureApi, DataGridSortingFeatureApi } from "../composables/useDataGridFeatureRegistry"
import { useDataGridViewContext } from "../composables/useDataGridViewContext"

const { visibleColumns, viewModel } = useDataGridViewContext()
const { engine } = useDataGridContext()
const sortingApi = useFeature<DataGridSortingFeatureApi>("sorting")
const columnMenuApi = useFeature<DataGridColumnMenuFeatureApi>("columnMenu")

let activeResize: {
  columnKey: string
  startX: number
  startWidth: number
} | null = null

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

const resolveColumnWidth = (columnKey: string): number => {
  const column = engine.grid.runtime.columnSnapshot.value.columns.find(entry => entry.key === columnKey)
  const width = typeof column?.width === "number"
    ? column.width
    : typeof column?.column.width === "number"
      ? column.column.width
      : 160
  return Math.max(56, Math.trunc(width))
}

const handleResizeMove = (event: MouseEvent): void => {
  if (!activeResize) {
    return
  }
  const delta = event.clientX - activeResize.startX
  engine.grid.api.columns.setWidth(activeResize.columnKey, Math.max(56, activeResize.startWidth + delta))
}

const stopResize = (): void => {
  activeResize = null
  if (typeof window !== "undefined") {
    window.removeEventListener("mousemove", handleResizeMove)
    window.removeEventListener("mouseup", stopResize)
  }
}

const startResize = (columnKey: string, event: MouseEvent): void => {
  if (event.button !== 0) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  activeResize = {
    columnKey,
    startX: event.clientX,
    startWidth: resolveColumnWidth(columnKey),
  }
  if (typeof window !== "undefined") {
    window.addEventListener("mousemove", handleResizeMove)
    window.addEventListener("mouseup", stopResize)
  }
}

const resetResize = (columnKey: string, event: MouseEvent): void => {
  event.preventDefault()
  event.stopPropagation()
  engine.grid.api.columns.setWidth(columnKey, null)
}

onBeforeUnmount(() => {
  stopResize()
})
</script>

<style scoped>
.data-grid-header {
  width: max-content;
  min-width: 100%;
  overflow: hidden;
}

.data-grid-header-row {
  display: grid;
  width: max-content;
  min-width: 100%;
  grid-template-columns: var(--dg-grid-template);
  transform: translateX(calc(var(--dg-scroll-left, 0px) * -1));
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
  position: relative;
  padding-right: 14px;
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

.data-grid-header-resize {
  position: absolute;
  top: -1px;
  right: -3px;
  width: 8px;
  height: calc(100% + 2px);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
}

.data-grid-header-resize::before {
  content: "";
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 3px;
  width: 2px;
  border-radius: 999px;
  background: rgba(107, 119, 140, 0.35);
}

.data-grid-header-cell:hover .data-grid-header-resize::before {
  background: rgba(59, 130, 246, 0.75);
}
</style>
