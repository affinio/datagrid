<template>
  <div class="grid-header-shell" :style="paneLayoutStyle">
    <slot name="center-chrome" />

    <div class="grid-header-pane grid-header-pane--left" :style="leftPaneStyle" @wheel="onLinkedViewportWheel">
      <slot name="left-chrome" />
      <div class="grid-header-row grid-pane-track" :style="leftTrackStyle">
        <div v-if="showIndexColumn" class="grid-cell grid-cell--header grid-cell--index grid-cell--index-header" :style="rowIndexColumnStyle">
          <div class="col-head col-head--index">
            <span>#</span>
          </div>
          <div v-if="!hasColumnMenu()" class="col-filter col-filter--index-spacer" aria-hidden="true" />
        </div>
        <template v-if="shouldUseColumnMenus()">
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
              :key="resolveColumnMenuInstanceKey(column.key)"
              :rows="sourceRows"
              :items="resolveColumnMenuItemsSafe(column.key)"
              :disabled-items="resolveColumnMenuDisabledItemsSafe(column.key)"
              :disabled-reasons="resolveColumnMenuDisabledReasonsSafe(column.key)"
              :labels="resolveColumnMenuLabelsSafe(column.key)"
              :action-options="resolveColumnMenuActionOptionsSafe(column.key)"
              :column-key="column.key"
              :column-label="column.column.label ?? column.key"
              :column-data-type="column.column.dataType"
              :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
              :sort-enabled="isColumnSortable(column)"
              :pin="column.pin"
              :grouped="isColumnGroupedSafe(column.key)"
              :group-order="resolveColumnGroupOrderSafe(column.key)"
              :group-enabled="isColumnGroupable(column)"
              :filter-enabled="isColumnMenuValueFilterEnabled(column)"
              :value-filter-row-limit="columnMenuValueFilterRowLimit"
              :text-filter-enabled="isColumnFilterable(column)"
              :text-filter-value="columnFilterTextByKey[column.key] ?? ''"
              :filter-active="isColumnFilterActiveSafe(column.key)"
              :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
              :max-filter-values="columnMenuMaxFilterValues"
              @sort="applyColumnMenuSortSafe(column.key, $event)"
              @pin="applyColumnMenuPinSafe(column.key, $event)"
              @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
              @group="applyColumnMenuGroupBySafe(column.key, $event)"
              @update-text-filter="setColumnFilterText(column.key, $event)"
              @clear-filter="clearColumnMenuFilterSafe(column.key)"
              v-slot="{ open, toggleMenuFromElement }"
            >
              <div
                class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-left"
                :class="{
                  'grid-cell--header-menu-enabled': true,
                  'grid-cell--header-menu-open': open,
                }"
                :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
                :data-column-key="column.key"
              >
                <div class="col-head">
                  <span class="col-head__label">{{ column.column.label ?? column.key }}</span>
                  <button
                    type="button"
                    class="col-menu-trigger"
                    :class="resolveColumnMenuTriggerClass(column.key, open)"
                    :aria-label="resolveColumnMenuButtonLabel(column)"
                    :title="resolveColumnMenuButtonLabel(column)"
                    :data-column-key="column.key"
                    data-datagrid-column-menu-trigger="true"
                    data-datagrid-column-menu-button="true"
                    @mousedown.stop
                    @click.stop="handleColumnMenuButtonClick(toggleMenuFromElement, $event)"
                  >
                    <svg class="col-menu-trigger__icon" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        v-if="shouldShowColumnMenuFilterIcon(column.key)"
                        d="M2.5 3.5h11L9.25 8.5v3.25l-2.5 1.25V8.5z"
                      />
                      <path
                        v-if="shouldShowColumnMenuSortAscIcon(column.key)"
                        d="M9 11V6.75M9 6.75 7.25 8.5M9 6.75 10.75 8.5"
                      />
                      <path
                        v-else-if="shouldShowColumnMenuSortDescIcon(column.key)"
                        d="M9 5v4.25M9 9.25 7.25 7.5M9 9.25 10.75 7.5"
                      />
                      <path
                        v-else
                        d="M5.5 6.5 8 9l2.5-2.5"
                      />
                    </svg>
                  </button>
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
                <span
                  v-if="resolveColumnGroupBadgeLabel(column.key)"
                  class="col-head__group-badge"
                  :title="resolveColumnGroupBadgeTitle(column.key)"
                >
                  {{ resolveColumnGroupBadgeLabel(column.key) }}
                </span>
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
        <template v-if="shouldUseColumnMenus()">
          <DataGridColumnMenu
            v-for="column in renderedColumns"
            :key="resolveColumnMenuInstanceKey(column.key)"
            :rows="sourceRows"
            :items="resolveColumnMenuItemsSafe(column.key)"
            :disabled-items="resolveColumnMenuDisabledItemsSafe(column.key)"
            :disabled-reasons="resolveColumnMenuDisabledReasonsSafe(column.key)"
            :labels="resolveColumnMenuLabelsSafe(column.key)"
            :action-options="resolveColumnMenuActionOptionsSafe(column.key)"
            :column-key="column.key"
            :column-label="column.column.label ?? column.key"
            :column-data-type="column.column.dataType"
            :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
            :sort-enabled="isColumnSortable(column)"
            :pin="column.pin"
            :grouped="isColumnGroupedSafe(column.key)"
            :group-order="resolveColumnGroupOrderSafe(column.key)"
            :group-enabled="isColumnGroupable(column)"
            :filter-enabled="isColumnMenuValueFilterEnabled(column)"
            :value-filter-row-limit="columnMenuValueFilterRowLimit"
            :text-filter-enabled="isColumnFilterable(column)"
            :text-filter-value="columnFilterTextByKey[column.key] ?? ''"
            :filter-active="isColumnFilterActiveSafe(column.key)"
            :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
            :max-filter-values="columnMenuMaxFilterValues"
            @sort="applyColumnMenuSortSafe(column.key, $event)"
            @pin="applyColumnMenuPinSafe(column.key, $event)"
            @group="applyColumnMenuGroupBySafe(column.key, $event)"
            @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
            @update-text-filter="setColumnFilterText(column.key, $event)"
            @clear-filter="clearColumnMenuFilterSafe(column.key)"
            v-slot="{ open, toggleMenuFromElement }"
          >
            <div
              class="grid-cell grid-cell--header grid-cell--header-sortable"
              :class="{
                'grid-cell--header-menu-enabled': true,
                'grid-cell--header-menu-open': open,
              }"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
            >
              <div class="col-head">
                <span class="col-head__label">{{ column.column.label ?? column.key }}</span>
                <span
                  v-if="resolveColumnGroupBadgeLabel(column.key)"
                  class="col-head__group-badge"
                  :title="resolveColumnGroupBadgeTitle(column.key)"
                >
                  {{ resolveColumnGroupBadgeLabel(column.key) }}
                </span>
                <button
                  type="button"
                  class="col-menu-trigger"
                  :class="resolveColumnMenuTriggerClass(column.key, open)"
                  :aria-label="resolveColumnMenuButtonLabel(column)"
                  :title="resolveColumnMenuButtonLabel(column)"
                  :data-column-key="column.key"
                  data-datagrid-column-menu-trigger="true"
                  data-datagrid-column-menu-button="true"
                  @mousedown.stop
                  @click.stop="handleColumnMenuButtonClick(toggleMenuFromElement, $event)"
                >
                  <svg class="col-menu-trigger__icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      v-if="shouldShowColumnMenuFilterIcon(column.key)"
                      d="M2.5 3.5h11L9.25 8.5v3.25l-2.5 1.25V8.5z"
                    />
                    <path
                      v-if="shouldShowColumnMenuSortAscIcon(column.key)"
                      d="M9 11V6.75M9 6.75 7.25 8.5M9 6.75 10.75 8.5"
                    />
                    <path
                      v-else-if="shouldShowColumnMenuSortDescIcon(column.key)"
                      d="M9 5v4.25M9 9.25 7.25 7.5M9 9.25 10.75 7.5"
                    />
                    <path
                      v-else
                      d="M5.5 6.5 8 9l2.5-2.5"
                    />
                  </svg>
                </button>
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
              <span
                v-if="resolveColumnGroupBadgeLabel(column.key)"
                class="col-head__group-badge"
                :title="resolveColumnGroupBadgeTitle(column.key)"
              >
                {{ resolveColumnGroupBadgeLabel(column.key) }}
              </span>
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
        <template v-if="shouldUseColumnMenus()">
          <DataGridColumnMenu
            v-for="column in pinnedRightColumns"
            :key="resolveColumnMenuInstanceKey(column.key)"
            :rows="sourceRows"
            :items="resolveColumnMenuItemsSafe(column.key)"
            :disabled-items="resolveColumnMenuDisabledItemsSafe(column.key)"
            :disabled-reasons="resolveColumnMenuDisabledReasonsSafe(column.key)"
            :labels="resolveColumnMenuLabelsSafe(column.key)"
            :action-options="resolveColumnMenuActionOptionsSafe(column.key)"
            :column-key="column.key"
            :column-label="column.column.label ?? column.key"
            :column-data-type="column.column.dataType"
            :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
            :sort-enabled="isColumnSortable(column)"
            :pin="column.pin"
            :grouped="isColumnGroupedSafe(column.key)"
            :group-order="resolveColumnGroupOrderSafe(column.key)"
            :group-enabled="isColumnGroupable(column)"
            :filter-enabled="isColumnMenuValueFilterEnabled(column)"
            :value-filter-row-limit="columnMenuValueFilterRowLimit"
            :text-filter-enabled="isColumnFilterable(column)"
            :text-filter-value="columnFilterTextByKey[column.key] ?? ''"
            :filter-active="isColumnFilterActiveSafe(column.key)"
            :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
            :max-filter-values="columnMenuMaxFilterValues"
            @sort="applyColumnMenuSortSafe(column.key, $event)"
            @pin="applyColumnMenuPinSafe(column.key, $event)"
            @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
            @group="applyColumnMenuGroupBySafe(column.key, $event)"
            @update-text-filter="setColumnFilterText(column.key, $event)"
            @clear-filter="clearColumnMenuFilterSafe(column.key)"
            v-slot="{ open, toggleMenuFromElement }"
          >
            <div
              class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
              :class="{
                'grid-cell--header-menu-enabled': true,
                'grid-cell--header-menu-open': open,
              }"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
            >
              <div class="col-head">
                <span class="col-head__label">{{ column.column.label ?? column.key }}</span>
                <span
                  v-if="resolveColumnGroupBadgeLabel(column.key)"
                  class="col-head__group-badge"
                  :title="resolveColumnGroupBadgeTitle(column.key)"
                >
                  {{ resolveColumnGroupBadgeLabel(column.key) }}
                </span>
                <button
                  type="button"
                  class="col-menu-trigger"
                  :class="resolveColumnMenuTriggerClass(column.key, open)"
                  :aria-label="resolveColumnMenuButtonLabel(column)"
                  :title="resolveColumnMenuButtonLabel(column)"
                  :data-column-key="column.key"
                  data-datagrid-column-menu-trigger="true"
                  data-datagrid-column-menu-button="true"
                  @mousedown.stop
                  @click.stop="handleColumnMenuButtonClick(toggleMenuFromElement, $event)"
                >
                  <svg class="col-menu-trigger__icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      v-if="shouldShowColumnMenuFilterIcon(column.key)"
                      d="M2.5 3.5h11L9.25 8.5v3.25l-2.5 1.25V8.5z"
                    />
                    <path
                      v-if="shouldShowColumnMenuSortAscIcon(column.key)"
                      d="M9 11V6.75M9 6.75 7.25 8.5M9 6.75 10.75 8.5"
                    />
                    <path
                      v-else-if="shouldShowColumnMenuSortDescIcon(column.key)"
                      d="M9 5v4.25M9 9.25 7.25 7.5M9 9.25 10.75 7.5"
                    />
                    <path
                      v-else
                      d="M5.5 6.5 8 9l2.5-2.5"
                    />
                  </svg>
                </button>
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
import type {
  DataGridColumnMenuActionOptions,
  DataGridColumnMenuDisabledReasons,
  DataGridColumnMenuItemLabels,
} from "../overlays/dataGridColumnMenu"
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
  showIndexColumn: {
    type: Boolean,
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
const columnMenuValueFilterRowLimit = computed(() => (
  typeof columns.value.columnMenuValueFilterRowLimit === "number"
    ? columns.value.columnMenuValueFilterRowLimit
    : Number.MAX_SAFE_INTEGER
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

function shouldUseColumnMenus(): boolean {
  return hasColumnMenu() && columns.value.columnMenuValueFilterEnabled !== false
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

function isColumnGroupable(column: TableColumn): boolean {
  return column.column.capabilities?.groupable !== false
}

function isColumnMenuValueFilterEnabled(column: TableColumn): boolean {
  return isColumnFilterable(column) && columns.value.columnMenuValueFilterEnabled !== false
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

function isColumnMenuSortActive(columnKey: string): boolean {
  return resolveColumnMenuSortDirectionSafe(columnKey) !== null
}

function isColumnMenuFilterActive(columnKey: string): boolean {
  return isColumnFilterActiveSafe(columnKey)
}

function isColumnGroupedSafe(columnKey: string): boolean {
  const evaluate = columns.value.isColumnGrouped
  return typeof evaluate === "function" ? evaluate(columnKey) : false
}

function resolveColumnGroupOrderSafe(columnKey: string): number | null {
  const resolve = columns.value.resolveColumnGroupOrder
  return typeof resolve === "function" ? resolve(columnKey) : null
}

function resolveColumnGroupBadgeLabel(columnKey: string): string | null {
  const order = resolveColumnGroupOrderSafe(columnKey)
  if (!Number.isFinite(order)) {
    return null
  }
  return `G${Number(order) + 1}`
}

function resolveColumnGroupBadgeTitle(columnKey: string): string {
  const order = resolveColumnGroupOrderSafe(columnKey)
  if (!Number.isFinite(order)) {
    return "Grouped column"
  }
  return `Grouped column, level ${Number(order) + 1}`
}

function shouldShowColumnMenuFilterIcon(columnKey: string): boolean {
  return isColumnMenuFilterActive(columnKey)
}

function shouldShowColumnMenuSortAscIcon(columnKey: string): boolean {
  return resolveColumnMenuSortDirectionSafe(columnKey) === "asc"
}

function shouldShowColumnMenuSortDescIcon(columnKey: string): boolean {
  return resolveColumnMenuSortDirectionSafe(columnKey) === "desc"
}

function resolveColumnMenuTriggerClass(columnKey: string, open: boolean): Record<string, boolean> {
  return {
    "col-menu-trigger--open": open,
    "col-menu-trigger--active": open || isColumnMenuSortActive(columnKey) || isColumnMenuFilterActive(columnKey) || isColumnGroupedSafe(columnKey),
    "col-menu-trigger--filtered": isColumnMenuFilterActive(columnKey),
    "col-menu-trigger--grouped": isColumnGroupedSafe(columnKey),
    "col-menu-trigger--sorted": isColumnMenuSortActive(columnKey),
  }
}

function resolveColumnMenuButtonLabel(column: TableColumn): string {
  const states: string[] = []
  if (isColumnMenuFilterActive(column.key)) {
    states.push("filtered")
  }
  if (isColumnGroupedSafe(column.key)) {
    const order = resolveColumnGroupOrderSafe(column.key)
    states.push(Number.isFinite(order) ? `grouped level ${Number(order) + 1}` : "grouped")
  }
  if (shouldShowColumnMenuSortAscIcon(column.key)) {
    states.push("sorted ascending")
  } else if (shouldShowColumnMenuSortDescIcon(column.key)) {
    states.push("sorted descending")
  }
  const suffix = states.length > 0 ? `, ${states.join(" and ")}` : ""
  return `Open column menu for ${column.column.label ?? column.key}${suffix}`
}

function handleColumnMenuButtonClick(
  toggleMenuFromElement: (element: HTMLElement | null) => void,
  event: MouseEvent,
): void {
  toggleMenuFromElement(event.currentTarget instanceof HTMLElement ? event.currentTarget : null)
}

function resolveColumnMenuSelectedTokensSafe(columnKey: string): readonly string[] {
  const resolve = columns.value.resolveColumnMenuSelectedTokens
  return typeof resolve === "function" ? resolve(columnKey) : []
}

function resolveColumnMenuItemsSafe(columnKey: string) {
  const resolve = columns.value.resolveColumnMenuItems
  return typeof resolve === "function" ? resolve(columnKey) : ["sort", "group", "pin", "filter"]
}

function resolveColumnMenuDisabledItemsSafe(columnKey: string): readonly string[] {
  const resolve = columns.value.resolveColumnMenuDisabledItems
  return typeof resolve === "function" ? resolve(columnKey) : []
}

function resolveColumnMenuDisabledReasonsSafe(columnKey: string): DataGridColumnMenuDisabledReasons {
  const resolve = columns.value.resolveColumnMenuDisabledReasons
  return typeof resolve === "function" ? resolve(columnKey) : {}
}

function resolveColumnMenuLabelsSafe(columnKey: string): DataGridColumnMenuItemLabels {
  const resolve = columns.value.resolveColumnMenuLabels
  return typeof resolve === "function" ? resolve(columnKey) : {}
}

function resolveColumnMenuActionOptionsSafe(columnKey: string): DataGridColumnMenuActionOptions {
  const resolve = columns.value.resolveColumnMenuActionOptions
  return typeof resolve === "function" ? resolve(columnKey) : {}
}

function resolveColumnMenuInstanceKey(columnKey: string): string {
  return [
    columnKey,
    columns.value.columnMenuValueFilterEnabled === false ? "text-only" : "value-filter",
    columnMenuValueFilterRowLimit.value,
    sourceRows.value.length,
  ].join(":")
}

function applyColumnMenuSortSafe(columnKey: string, direction: "asc" | "desc" | null): void {
  columns.value.applyColumnMenuSort?.(columnKey, direction)
}

function applyColumnMenuPinSafe(columnKey: string, pin: DataGridColumnPin): void {
  columns.value.applyColumnMenuPin?.(columnKey, pin)
}

function applyColumnMenuGroupBySafe(columnKey: string, grouped: boolean): void {
  columns.value.applyColumnMenuGroupBy?.(columnKey, grouped)
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
