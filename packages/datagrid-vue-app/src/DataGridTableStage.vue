<template>
  <section class="grid-stage" :class="{ 'grid-stage--auto-row-height': mode === 'base' && rowHeightMode === 'auto' }">
    <div
      :ref="headerViewportRef"
      class="grid-header-viewport"
      @scroll="handleHeaderScroll"
      @wheel="handleHeaderWheel"
    >
      <div class="grid-header-row" :style="gridContentStyle">
        <div class="grid-cell grid-cell--header grid-cell--index" :style="indexColumnStyle">#</div>
        <div class="grid-main-track" :style="mainTrackStyle">
          <div
            v-for="column in pinnedLeftColumns"
            :key="`header-left-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable"
            :class="pinnedColumnClass(column.key)"
            :style="pinnedColumnStyle(column.key)"
            @click="toggleSortForColumn(column.key, $event.shiftKey)"
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
                placeholder="Filter..."
                @mousedown.stop
                @keydown.stop
                @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
          <div
            v-if="centerLeftSpacerWidth > 0"
            class="grid-column-spacer"
            :style="{ width: `${centerLeftSpacerWidth}px`, minWidth: `${centerLeftSpacerWidth}px`, maxWidth: `${centerLeftSpacerWidth}px` }"
          />
          <div
            v-for="column in renderedColumns"
            :key="`header-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable"
            :style="columnStyle(column.key)"
            @click="toggleSortForColumn(column.key, $event.shiftKey)"
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
                placeholder="Filter..."
                @mousedown.stop
                @keydown.stop
                @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
          <div
            v-if="centerRightSpacerWidth > 0"
            class="grid-column-spacer"
            :style="{ width: `${centerRightSpacerWidth}px`, minWidth: `${centerRightSpacerWidth}px`, maxWidth: `${centerRightSpacerWidth}px` }"
          />
          <div
            v-for="column in pinnedRightColumns"
            :key="`header-right-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable"
            :class="pinnedColumnClass(column.key)"
            :style="pinnedColumnStyle(column.key)"
            @click="toggleSortForColumn(column.key, $event.shiftKey)"
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
                placeholder="Filter..."
                @mousedown.stop
                @keydown.stop
                @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div :ref="bodyViewportRef" class="grid-body-viewport table-wrap" @scroll="handleViewportScroll">
      <div class="grid-body-content" :style="gridContentStyle">
        <div v-if="topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }" />
        <div
          v-for="(row, rowOffset) in displayRows"
          :key="String(row.rowId)"
          class="grid-row"
          :class="[rowClass(row), { 'grid-row--autosize-probe': isRowAutosizeProbe(row, rowOffset) }]"
          :style="rowStyle(row, rowOffset)"
          @click="toggleGroupRow(row)"
        >
          <div class="grid-cell grid-cell--index" :style="indexColumnStyle">
            {{ rowIndexLabel(row, rowOffset) }}
            <button
              v-if="mode === 'base'"
              type="button"
              class="row-resize-handle"
              aria-label="Resize rows"
              @mousedown.stop.prevent="startRowResize($event, row, rowOffset)"
              @dblclick.stop.prevent="autosizeRow($event, row, rowOffset)"
            />
          </div>
          <div class="grid-main-track" :style="mainTrackStyle">
            <div
              v-for="column in pinnedLeftColumns"
              :key="`${String(row.rowId)}-left-${column.key}`"
              class="grid-cell"
              :class="[
                pinnedColumnClass(column.key),
                {
                  'grid-cell--selected': isCellSelected(rowOffset, columnIndexByKey(column.key)),
                  'grid-cell--fill-preview': isCellInFillPreview(rowOffset, columnIndexByKey(column.key)),
                  'grid-cell--clipboard-pending': isCellInPendingClipboardRange(rowOffset, columnIndexByKey(column.key)),
                  'grid-cell--clipboard-pending-top': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'top'),
                  'grid-cell--clipboard-pending-right': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'right'),
                  'grid-cell--clipboard-pending-bottom': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'bottom'),
                  'grid-cell--clipboard-pending-left': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'left'),
                  'grid-cell--editing': isEditingCell(row, column.key),
                },
              ]"
              :style="pinnedColumnStyle(column.key)"
              :data-row-index="viewportRowStart + rowOffset"
              :data-column-index="columnIndexByKey(column.key)"
              tabindex="0"
              @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
              @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
              @dblclick.stop="startInlineEdit(row, column.key)"
            >
              <button
                v-if="mode === 'base' && isFillHandleCell(rowOffset, columnIndexByKey(column.key)) && !isEditingCell(row, column.key)"
                type="button"
                class="cell-fill-handle"
                aria-label="Fill handle"
                tabindex="-1"
                @mousedown.stop.prevent="startFillHandleDrag($event)"
              />
              <input
                v-if="isEditingCell(row, column.key)"
                class="cell-editor-input"
                :value="editingCellValue"
                @mousedown.stop
                @click.stop
                @input="updateEditingCellValue(($event.target as HTMLInputElement).value)"
                @keydown.stop="handleEditorKeydown"
                @blur="commitInlineEdit"
              />
              <template v-else>{{ readCell(row, column.key) }}</template>
            </div>
            <div
              v-if="centerLeftSpacerWidth > 0"
              class="grid-column-spacer"
              :style="{ width: `${centerLeftSpacerWidth}px`, minWidth: `${centerLeftSpacerWidth}px`, maxWidth: `${centerLeftSpacerWidth}px` }"
            />
            <div
              v-for="(column, columnOffset) in renderedColumns"
              :key="`${String(row.rowId)}-${column.key}`"
              class="grid-cell"
              :class="{
                'grid-cell--selected': isCellSelected(rowOffset, columnIndexByKey(column.key)),
                'grid-cell--fill-preview': isCellInFillPreview(rowOffset, columnIndexByKey(column.key)),
                'grid-cell--clipboard-pending': isCellInPendingClipboardRange(rowOffset, columnIndexByKey(column.key)),
                'grid-cell--clipboard-pending-top': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'top'),
                'grid-cell--clipboard-pending-right': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'right'),
                'grid-cell--clipboard-pending-bottom': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'bottom'),
                'grid-cell--clipboard-pending-left': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'left'),
                'grid-cell--editing': isEditingCell(row, column.key),
              }"
              :style="columnStyle(column.key)"
              :data-row-index="viewportRowStart + rowOffset"
              :data-column-index="columnIndexByKey(column.key)"
              tabindex="0"
              @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
              @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
              @dblclick.stop="startInlineEdit(row, column.key)"
            >
              <button
                v-if="mode === 'base' && isFillHandleCell(rowOffset, columnIndexByKey(column.key)) && !isEditingCell(row, column.key)"
                type="button"
                class="cell-fill-handle"
                aria-label="Fill handle"
                tabindex="-1"
                @mousedown.stop.prevent="startFillHandleDrag($event)"
              />
              <input
                v-if="isEditingCell(row, column.key)"
                class="cell-editor-input"
                :value="editingCellValue"
                @mousedown.stop
                @click.stop
                @input="updateEditingCellValue(($event.target as HTMLInputElement).value)"
                @keydown.stop="handleEditorKeydown"
                @blur="commitInlineEdit"
              />
              <template v-else>{{ readCell(row, column.key) }}</template>
            </div>
            <div
              v-if="centerRightSpacerWidth > 0"
              class="grid-column-spacer"
              :style="{ width: `${centerRightSpacerWidth}px`, minWidth: `${centerRightSpacerWidth}px`, maxWidth: `${centerRightSpacerWidth}px` }"
            />
            <div
              v-for="column in pinnedRightColumns"
              :key="`${String(row.rowId)}-right-${column.key}`"
              class="grid-cell"
              :class="[
                pinnedColumnClass(column.key),
                {
                  'grid-cell--selected': isCellSelected(rowOffset, columnIndexByKey(column.key)),
                  'grid-cell--fill-preview': isCellInFillPreview(rowOffset, columnIndexByKey(column.key)),
                  'grid-cell--clipboard-pending': isCellInPendingClipboardRange(rowOffset, columnIndexByKey(column.key)),
                  'grid-cell--clipboard-pending-top': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'top'),
                  'grid-cell--clipboard-pending-right': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'right'),
                  'grid-cell--clipboard-pending-bottom': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'bottom'),
                  'grid-cell--clipboard-pending-left': isCellOnPendingClipboardEdge(rowOffset, columnIndexByKey(column.key), 'left'),
                  'grid-cell--editing': isEditingCell(row, column.key),
                },
              ]"
              :style="pinnedColumnStyle(column.key)"
              :data-row-index="viewportRowStart + rowOffset"
              :data-column-index="columnIndexByKey(column.key)"
              tabindex="0"
              @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
              @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
              @dblclick.stop="startInlineEdit(row, column.key)"
            >
              <button
                v-if="mode === 'base' && isFillHandleCell(rowOffset, columnIndexByKey(column.key)) && !isEditingCell(row, column.key)"
                type="button"
                class="cell-fill-handle"
                aria-label="Fill handle"
                tabindex="-1"
                @mousedown.stop.prevent="startFillHandleDrag($event)"
              />
              <input
                v-if="isEditingCell(row, column.key)"
                class="cell-editor-input"
                :value="editingCellValue"
                @mousedown.stop
                @click.stop
                @input="updateEditingCellValue(($event.target as HTMLInputElement).value)"
                @keydown.stop="handleEditorKeydown"
                @blur="commitInlineEdit"
              />
              <template v-else>{{ readCell(row, column.key) }}</template>
            </div>
          </div>
        </div>
        <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue"
import type { DataGridTableStageProps } from "./dataGridTableStage.types"
import { ensureDataGridAppStyles } from "./ensureDataGridAppStyles"

ensureDataGridAppStyles()

const props = defineProps<DataGridTableStageProps<Record<string, unknown>>>()

const visibleColumnIndexByKey = computed<Map<string, number>>(() => {
  const indexByKey = new Map<string, number>()
  props.visibleColumns.forEach((column, index) => {
    indexByKey.set(column.key, index)
  })
  return indexByKey
})

const pinnedLeftColumns = computed(() => props.visibleColumns.filter(column => column.pin === "left"))
const pinnedRightColumns = computed(() => props.visibleColumns.filter(column => column.pin === "right"))
const centerVisibleColumns = computed(() => props.visibleColumns.filter(column => column.pin !== "left" && column.pin !== "right"))
const renderedColumns = computed(() => props.renderedColumns.filter(column => column.pin !== "left" && column.pin !== "right"))

const indexColumnWidthPx = computed(() => {
  const rawWidth = props.indexColumnStyle.width ?? props.indexColumnStyle.minWidth ?? "72px"
  const parsed = Number.parseFloat(String(rawWidth))
  return Number.isFinite(parsed) ? parsed : 72
})

const leftPinnedOffsets = computed<Map<string, number>>(() => {
  const offsets = new Map<string, number>()
  let currentOffset = indexColumnWidthPx.value
  for (const column of pinnedLeftColumns.value) {
    offsets.set(column.key, currentOffset)
    currentOffset += column.width ?? 140
  }
  return offsets
})

const rightPinnedOffsets = computed<Map<string, number>>(() => {
  const offsets = new Map<string, number>()
  let currentOffset = 0
  for (let index = pinnedRightColumns.value.length - 1; index >= 0; index -= 1) {
    const column = pinnedRightColumns.value[index]
    if (!column) {
      continue
    }
    offsets.set(column.key, currentOffset)
    currentOffset += column.width ?? 140
  }
  return offsets
})

const centerLeftSpacerWidth = computed(() => {
  const firstRenderedKey = renderedColumns.value[0]?.key
  if (!firstRenderedKey) {
    return 0
  }
  let width = 0
  for (const column of centerVisibleColumns.value) {
    if (column.key === firstRenderedKey) {
      break
    }
    width += column.width ?? 140
  }
  return width
})

const centerRightSpacerWidth = computed(() => {
  const lastRenderedKey = renderedColumns.value[renderedColumns.value.length - 1]?.key
  if (!lastRenderedKey) {
    return 0
  }
  let width = 0
  let seenLastRendered = false
  for (const column of centerVisibleColumns.value) {
    if (seenLastRendered) {
      width += column.width ?? 140
    }
    if (column.key === lastRenderedKey) {
      seenLastRendered = true
    }
  }
  return width
})

function columnIndexByKey(columnKey: string): number {
  return visibleColumnIndexByKey.value.get(columnKey) ?? 0
}

function pinnedColumnClass(columnKey: string): string {
  const column = props.visibleColumns.find(entry => entry.key === columnKey)
  if (column?.pin === "left") {
    return "grid-cell--pinned-left"
  }
  if (column?.pin === "right") {
    return "grid-cell--pinned-right"
  }
  return ""
}

function pinnedColumnStyle(columnKey: string): CSSProperties {
  const base = props.columnStyle(columnKey)
  const column = props.visibleColumns.find(entry => entry.key === columnKey)
  if (column?.pin === "left") {
    return {
      ...base,
      position: "sticky",
      left: `${leftPinnedOffsets.value.get(columnKey) ?? indexColumnWidthPx.value}px`,
    }
  }
  if (column?.pin === "right") {
    return {
      ...base,
      position: "sticky",
      right: `${rightPinnedOffsets.value.get(columnKey) ?? 0}px`,
    }
  }
  return base
}
</script>
