<template>
  <div class="grid-header-shell" :style="paneLayoutStyle">
    <slot name="center-chrome" />

    <div class="grid-header-pane grid-header-pane--left" :style="leftPaneStyle" @wheel="onLinkedViewportWheel">
      <slot name="left-chrome" />
      <div class="grid-header-row grid-pane-track" :style="leftTrackStyle">
        <div class="grid-cell grid-cell--header grid-cell--index grid-cell--index-header" :style="rowIndexColumnStyle">
          <div class="col-head col-head--index">
            <span>#</span>
          </div>
          <div v-if="!hasColumnMenu()" class="col-filter col-filter--index-spacer" aria-hidden="true" />
        </div>
        <template v-if="hasColumnMenu()">
          <template v-for="column in pinnedLeftColumns" :key="`header-left-${column.key}`">
            <div
              v-if="isRowSelectionColumn(column)"
              class="grid-cell grid-cell--header grid-cell--pinned-left grid-cell--checkbox grid-cell--row-selection"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
            >
              <div class="col-head col-head--index">
                <button
                  class="grid-checkbox-trigger"
                  :class="headerCheckboxIndicatorClass()"
                  type="button"
                  role="checkbox"
                  aria-label="Select all filtered rows"
                  :aria-checked="resolveHeaderRowSelectionAriaChecked()"
                  @mousedown.stop
                  @click.stop
                  @click="handleToggleAllVisibleRowsSafe"
                >
                  <span class="grid-checkbox-indicator" :class="headerCheckboxIndicatorClass()" aria-hidden="true">
                    <span class="grid-checkbox-indicator__mark" :class="headerCheckboxMarkClass()" />
                  </span>
                </button>
              </div>
            </div>
            <DataGridColumnMenu
              v-else
              :rows="sourceRows"
              :column-key="column.key"
              :column-label="column.column.label ?? column.key"
              :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
              :sort-enabled="isColumnSortable(column)"
              :pin="column.pin"
              :filter-enabled="isColumnFilterable(column)"
              :filter-active="isColumnFilterActiveSafe(column.key)"
              :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
              :max-filter-values="columnMenuMaxFilterValues"
              @sort="applyColumnMenuSortSafe(column.key, $event)"
              @pin="applyColumnMenuPinSafe(column.key, $event)"
              @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
              @clear-filter="clearColumnMenuFilterSafe(column.key)"
              v-slot="{ open }"
            >
              <div
                class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-left"
                :class="{
                  'grid-cell--header-menu-enabled': true,
                  'grid-cell--header-menu-open': open,
                }"
                :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
                :data-column-key="column.key"
                data-datagrid-column-menu-trigger="true"
              >
                <div class="col-head">
                  <span>{{ column.column.label ?? column.key }}</span>
                  <span v-if="isColumnFilterActiveSafe(column.key)" class="col-filter-badge" aria-hidden="true">F</span>
                  <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                  <button
                    type="button"
                    class="col-resize"
                    aria-label="Resize column"
                    @mousedown.stop.prevent="startResize($event, column.key)"
                    @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                    @click.stop
                  />
                </div>
              </div>
            </DataGridColumnMenu>
          </template>
        </template>
        <template v-else>
          <template v-for="column in pinnedLeftColumns" :key="`header-left-${column.key}`">
            <div
              v-if="isRowSelectionColumn(column)"
              class="grid-cell grid-cell--header grid-cell--pinned-left grid-cell--checkbox grid-cell--row-selection"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
            >
              <div class="col-head col-head--index">
                <button
                  class="grid-checkbox-trigger"
                  :class="headerCheckboxIndicatorClass()"
                  type="button"
                  role="checkbox"
                  aria-label="Select all filtered rows"
                  :aria-checked="resolveHeaderRowSelectionAriaChecked()"
                  @mousedown.stop
                  @click.stop
                  @click="handleToggleAllVisibleRowsSafe"
                >
                  <span class="grid-checkbox-indicator" :class="headerCheckboxIndicatorClass()" aria-hidden="true">
                    <span class="grid-checkbox-indicator__mark" :class="headerCheckboxMarkClass()" />
                  </span>
                </button>
              </div>
            </div>
            <div
              v-else
              class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-left"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
              @click="handleHeaderColumnClick(column, $event.shiftKey)"
            >
              <div class="col-head">
                <span>{{ column.column.label ?? column.key }}</span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                <button
                  type="button"
                  class="col-resize"
                  aria-label="Resize column"
                  @mousedown.stop.prevent="startResize($event, column.key)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
              <div class="col-filter" @click.stop>
                <input
                  class="col-filter-input"
                  :value="columnFilterTextByKey[column.key] ?? ''"
                  :disabled="!isColumnFilterable(column)"
                  placeholder="Filter..."
                  @mousedown.stop
                  @keydown.stop
                  @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>

    <div
      :ref="headerViewportRef"
      class="grid-header-viewport"
      @scroll="handleHeaderScroll"
      @wheel="onLinkedViewportWheel"
    >
      <div class="grid-header-row grid-center-track" :style="mainTrackStyle">
        <div
          v-if="leftColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="spacerStyle(leftColumnSpacerWidth)"
        />
        <template v-if="hasColumnMenu()">
          <DataGridColumnMenu
            v-for="column in renderedColumns"
            :key="`header-${column.key}`"
            :rows="sourceRows"
            :column-key="column.key"
            :column-label="column.column.label ?? column.key"
            :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
            :sort-enabled="isColumnSortable(column)"
            :pin="column.pin"
            :filter-enabled="isColumnFilterable(column)"
            :filter-active="isColumnFilterActiveSafe(column.key)"
            :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
            :max-filter-values="columnMenuMaxFilterValues"
            @sort="applyColumnMenuSortSafe(column.key, $event)"
            @pin="applyColumnMenuPinSafe(column.key, $event)"
            @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
            @clear-filter="clearColumnMenuFilterSafe(column.key)"
            v-slot="{ open }"
          >
            <div
              class="grid-cell grid-cell--header grid-cell--header-sortable"
              :class="{
                'grid-cell--header-menu-enabled': true,
                'grid-cell--header-menu-open': open,
              }"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
              data-datagrid-column-menu-trigger="true"
            >
              <div class="col-head">
                <span>{{ column.column.label ?? column.key }}</span>
                <span v-if="isColumnFilterActiveSafe(column.key)" class="col-filter-badge" aria-hidden="true">F</span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                <button
                  type="button"
                  class="col-resize"
                  aria-label="Resize column"
                  @mousedown.stop.prevent="startResize($event, column.key)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
            </div>
          </DataGridColumnMenu>
        </template>
        <template v-else>
          <div
            v-for="column in renderedColumns"
            :key="`header-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable"
            :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
            :data-column-key="column.key"
            @click="handleHeaderColumnClick(column, $event.shiftKey)"
          >
            <div class="col-head">
              <span>{{ column.column.label ?? column.key }}</span>
              <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
              <button
                type="button"
                class="col-resize"
                aria-label="Resize column"
                @mousedown.stop.prevent="startResize($event, column.key)"
                @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                @click.stop
              />
            </div>
            <div class="col-filter" @click.stop>
              <input
                class="col-filter-input"
                :value="columnFilterTextByKey[column.key] ?? ''"
                :disabled="!isColumnFilterable(column)"
                placeholder="Filter..."
                @mousedown.stop
                @keydown.stop
                @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </template>
        <div
          v-if="rightColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="spacerStyle(rightColumnSpacerWidth)"
        />
      </div>
    </div>

    <div class="grid-header-pane grid-header-pane--right" :style="rightPaneStyle" @wheel="onLinkedViewportWheel">
      <slot name="right-chrome" />
      <div class="grid-header-row grid-pane-track" :style="rightTrackStyle">
        <template v-if="hasColumnMenu()">
          <DataGridColumnMenu
            v-for="column in pinnedRightColumns"
            :key="`header-right-${column.key}`"
            :rows="sourceRows"
            :column-key="column.key"
            :column-label="column.column.label ?? column.key"
            :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
            :sort-enabled="isColumnSortable(column)"
            :pin="column.pin"
            :filter-enabled="isColumnFilterable(column)"
            :filter-active="isColumnFilterActiveSafe(column.key)"
            :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
            :max-filter-values="columnMenuMaxFilterValues"
            @sort="applyColumnMenuSortSafe(column.key, $event)"
            @pin="applyColumnMenuPinSafe(column.key, $event)"
            @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
            @clear-filter="clearColumnMenuFilterSafe(column.key)"
            v-slot="{ open }"
          >
            <div
              class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
              :class="{
                'grid-cell--header-menu-enabled': true,
                'grid-cell--header-menu-open': open,
              }"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
              data-datagrid-column-menu-trigger="true"
            >
              <div class="col-head">
                <span>{{ column.column.label ?? column.key }}</span>
                <span v-if="isColumnFilterActiveSafe(column.key)" class="col-filter-badge" aria-hidden="true">F</span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                <button
                  type="button"
                  class="col-resize"
                  aria-label="Resize column"
                  @mousedown.stop.prevent="startResize($event, column.key)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
            </div>
          </DataGridColumnMenu>
        </template>
        <template v-else>
          <div
            v-for="column in pinnedRightColumns"
            :key="`header-right-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
            :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
            :data-column-key="column.key"
            @click="handleHeaderColumnClick(column, $event.shiftKey)"
          >
            <div class="col-head">
              <span>{{ column.column.label ?? column.key }}</span>
              <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
              <button
                type="button"
                class="col-resize"
                aria-label="Resize column"
                @mousedown.stop.prevent="startResize($event, column.key)"
                @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                @click.stop
              />
            </div>
            <div class="col-filter" @click.stop>
              <input
                class="col-filter-input"
                :value="columnFilterTextByKey[column.key] ?? ''"
                :disabled="!isColumnFilterable(column)"
                placeholder="Filter..."
                @mousedown.stop
                @keydown.stop
                @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties, type PropType } from "vue"
import type { DataGridColumnPin } from "@affino/datagrid-vue"
import DataGridColumnMenu from "../overlays/DataGridColumnMenu.vue"
import type { DataGridTableStageBodyColumn as TableColumn } from "./dataGridTableStageBody.types"
import {
  useDataGridTableStageColumnsSection,
  useDataGridTableStageLayoutSection,
  useDataGridTableStageRowsSection,
  useDataGridTableStageViewportSection,
} from "./dataGridTableStageContext"

const props = defineProps({
  paneLayoutStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  leftPaneStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  rightPaneStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  leftTrackStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  rightTrackStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  rowIndexColumnStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  onLinkedViewportWheel: {
    type: Function as PropType<(event: WheelEvent) => void>,
    required: true,
  },
})

const layout = useDataGridTableStageLayoutSection<Record<string, unknown>>()
const viewport = useDataGridTableStageViewportSection<Record<string, unknown>>()
const columns = useDataGridTableStageColumnsSection<Record<string, unknown>>()
const rows = useDataGridTableStageRowsSection<Record<string, unknown>>()

const sourceRows = computed(() => rows.value.sourceRows ?? [])
const visibleColumns = computed(() => columns.value.visibleColumns)
const renderedColumns = computed(() => columns.value.renderedColumns)
const pinnedLeftColumns = computed(() => visibleColumns.value.filter(column => column.pin === "left"))
const pinnedRightColumns = computed(() => visibleColumns.value.filter(column => column.pin === "right"))
const mainTrackStyle = computed(() => layout.value.mainTrackStyle)
const leftColumnSpacerWidth = computed(() => viewport.value.leftColumnSpacerWidth)
const rightColumnSpacerWidth = computed(() => viewport.value.rightColumnSpacerWidth)
const columnFilterTextByKey = computed(() => columns.value.columnFilterTextByKey)
const columnMenuMaxFilterValues = computed(() => (
  typeof columns.value.columnMenuMaxFilterValues === "number"
    ? columns.value.columnMenuMaxFilterValues
    : 250
))

function hasColumnMenu(): boolean {
  if (columns.value.columnMenuEnabled === true) {
    return true
  }
  return typeof columns.value.applyColumnMenuSort === "function"
    || typeof columns.value.applyColumnMenuPin === "function"
    || typeof columns.value.applyColumnMenuFilter === "function"
    || typeof columns.value.clearColumnMenuFilter === "function"
}

function resolveTextAlign(value: unknown): CSSProperties["textAlign"] | undefined {
  return value === "left" || value === "center" || value === "right"
    ? value
    : undefined
}

function columnStyle(key: string): CSSProperties {
  return layout.value.columnStyle(key)
}

function sortIndicator(columnKey: string): string {
  return columns.value.sortIndicator(columnKey)
}

function startResize(event: MouseEvent, columnKey: string): void {
  columns.value.startResize(event, columnKey)
}

function handleResizeDoubleClick(event: MouseEvent, columnKey: string): void {
  columns.value.handleResizeDoubleClick(event, columnKey)
}

function setColumnFilterText(columnKey: string, value: string): void {
  columns.value.setColumnFilterText(columnKey, value)
}

function headerViewportRef(value: Element | { $el?: unknown } | null): void {
  viewport.value.headerViewportRef(value as never)
}

function handleHeaderScroll(event: Event): void {
  viewport.value.handleHeaderScroll(event)
}

function isRowSelectionColumn(column: TableColumn): boolean {
  return column.column.meta?.rowSelection === true
}

function isColumnSortable(column: TableColumn): boolean {
  return column.column.capabilities?.sortable !== false
}

function isColumnFilterable(column: TableColumn): boolean {
  return column.column.capabilities?.filterable !== false
}

function headerCellPresentationStyle(column: TableColumn): CSSProperties {
  const textAlign = resolveTextAlign(
    column.column.presentation?.headerAlign ?? column.column.presentation?.align,
  )
  return textAlign ? { textAlign } : {}
}

function handleHeaderColumnClick(column: TableColumn, additive: boolean): void {
  if (!isColumnSortable(column)) {
    return
  }
  columns.value.toggleSortForColumn(column.key, additive)
}

function isColumnFilterActiveSafe(columnKey: string): boolean {
  const evaluate = columns.value.isColumnFilterActive
  return typeof evaluate === "function" ? evaluate(columnKey) : false
}

function resolveColumnMenuSortDirectionSafe(columnKey: string): "asc" | "desc" | null {
  const resolve = columns.value.resolveColumnMenuSortDirection
  return typeof resolve === "function" ? resolve(columnKey) : null
}

function resolveColumnMenuSelectedTokensSafe(columnKey: string): readonly string[] {
  const resolve = columns.value.resolveColumnMenuSelectedTokens
  return typeof resolve === "function" ? resolve(columnKey) : []
}

function applyColumnMenuSortSafe(columnKey: string, direction: "asc" | "desc" | null): void {
  columns.value.applyColumnMenuSort?.(columnKey, direction)
}

function applyColumnMenuPinSafe(columnKey: string, pin: DataGridColumnPin): void {
  columns.value.applyColumnMenuPin?.(columnKey, pin)
}

function applyColumnMenuFilterSafe(columnKey: string, tokens: readonly string[]): void {
  columns.value.applyColumnMenuFilter?.(columnKey, tokens)
}

function clearColumnMenuFilterSafe(columnKey: string): void {
  columns.value.clearColumnMenuFilter?.(columnKey)
}

function isAllVisibleRowsSelectedSafe(): boolean {
  return rows.value.allVisibleRowsSelected === true
}

function isSomeVisibleRowsSelectedSafe(): boolean {
  return rows.value.someVisibleRowsSelected === true
}

function resolveHeaderRowSelectionAriaChecked(): "true" | "false" | "mixed" {
  if (isAllVisibleRowsSelectedSafe()) {
    return "true"
  }
  if (isSomeVisibleRowsSelectedSafe()) {
    return "mixed"
  }
  return "false"
}

function headerCheckboxIndicatorClass(): Record<string, boolean> {
  return {
    "grid-checkbox-indicator--checked": isAllVisibleRowsSelectedSafe(),
    "grid-checkbox-indicator--mixed": isSomeVisibleRowsSelectedSafe() && !isAllVisibleRowsSelectedSafe(),
  }
}

function headerCheckboxMarkClass(): Record<string, boolean> {
  return {
    "grid-checkbox-indicator__mark--checked": isAllVisibleRowsSelectedSafe(),
    "grid-checkbox-indicator__mark--mixed": isSomeVisibleRowsSelectedSafe() && !isAllVisibleRowsSelectedSafe(),
  }
}

function handleToggleAllVisibleRowsSafe(): void {
  rows.value.handleToggleAllVisibleRows?.()
}

function spacerStyle(width: number): CSSProperties {
  const px = `${width}px`
  return {
    width: px,
    minWidth: px,
    maxWidth: px,
  }
}
</script>
