<template>
  <section class="grid-stage" :class="{ 'grid-stage--auto-row-height': mode === 'base' && rowHeightMode === 'auto' }">
    <div class="grid-header-shell" :style="paneLayoutStyle">
      <div class="grid-header-pane grid-header-pane--left" :style="leftPaneStyle" @wheel="handleLinkedViewportWheel">
        <div class="grid-header-row grid-pane-track" :style="leftTrackStyle">
          <div class="grid-cell grid-cell--header grid-cell--index grid-cell--index-header" :style="resolvedIndexColumnStyle">
            <div class="col-head">
              <span>#</span>
            </div>
            <div class="col-filter col-filter--index-spacer" aria-hidden="true" />
          </div>
          <div
            v-for="column in pinnedLeftColumns"
            :key="`header-left-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-left"
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
        </div>
      </div>

      <div
        :ref="headerViewportRef"
        class="grid-header-viewport"
        @scroll="handleHeaderScroll"
        @wheel="handleLinkedViewportWheel"
      >
        <div class="grid-header-row grid-center-track" :style="mainTrackStyle">
          <div
            v-if="leftColumnSpacerWidth > 0"
            class="grid-column-spacer"
            :style="spacerStyle(leftColumnSpacerWidth)"
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
            v-if="rightColumnSpacerWidth > 0"
            class="grid-column-spacer"
            :style="spacerStyle(rightColumnSpacerWidth)"
          />
        </div>
      </div>

      <div class="grid-header-pane grid-header-pane--right" :style="rightPaneStyle" @wheel="handleLinkedViewportWheel">
        <div class="grid-header-row grid-pane-track" :style="rightTrackStyle">
          <div
            v-for="column in pinnedRightColumns"
            :key="`header-right-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
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
        </div>
      </div>
    </div>

    <div class="grid-body-shell" :style="paneLayoutStyle">
      <div
        class="grid-body-pane grid-body-pane--left"
        :style="leftPaneStyle"
        @wheel="handleLinkedViewportWheel"
      >
        <div ref="leftPaneContentRef" class="grid-pane-content" :style="pinnedContentStyle">
          <div v-if="topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }" />
          <div
            v-for="(row, rowOffset) in displayRows"
            :key="`${String(row.rowId)}-left-row`"
            class="grid-row"
            :class="[rowClass(row), { 'grid-row--autosize-probe': isRowAutosizeProbe(row, rowOffset) }]"
            :style="paneRowStyle(row, rowOffset, leftPaneWidth)"
            @click="toggleGroupRow(row)"
          >
            <div class="grid-cell grid-cell--index" :style="resolvedIndexColumnStyle">
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
            <div
              v-for="column in pinnedLeftColumns"
              :key="`${String(row.rowId)}-left-${column.key}`"
              class="grid-cell grid-cell--pinned-left"
              :class="cellStateClasses(row, rowOffset, columnIndexByKey(column.key))"
              :style="columnStyle(column.key)"
              :data-row-index="viewportRowStart + rowOffset"
              :data-column-index="columnIndexByKey(column.key)"
              tabindex="-1"
              @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
              @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
              @dblclick.stop="startInlineEdit(row, column.key)"
            >
              <button
                v-if="mode === 'base' && isFillHandleCellSafe(rowOffset, columnIndexByKey(column.key)) && !isEditingCellSafe(row, column.key)"
                type="button"
                class="cell-fill-handle"
                aria-label="Fill handle"
                tabindex="-1"
                @mousedown.stop.prevent="startFillHandleDrag($event)"
              />
              <input
                v-if="isEditingCellSafe(row, column.key)"
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
          <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
          <div v-if="leftSelectionOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in leftSelectionOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment"
              :style="segment.style"
            />
          </div>
        </div>
      </div>

      <div
        :ref="captureBodyViewportRef"
        class="grid-body-viewport table-wrap"
        tabindex="0"
        @scroll="handleCenterViewportScroll"
        @wheel="handleBodyViewportWheel"
        @keydown.stop="handleViewportKeydown"
      >
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
            <div class="grid-center-track" :style="mainTrackStyle">
              <div
                v-if="leftColumnSpacerWidth > 0"
                class="grid-column-spacer"
                :style="spacerStyle(leftColumnSpacerWidth)"
              />
              <div
                v-for="column in renderedColumns"
                :key="`${String(row.rowId)}-${column.key}`"
                class="grid-cell"
                :class="cellStateClasses(row, rowOffset, columnIndexByKey(column.key))"
                :style="columnStyle(column.key)"
                :data-row-index="viewportRowStart + rowOffset"
                :data-column-index="columnIndexByKey(column.key)"
                tabindex="-1"
                @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
                @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
                @dblclick.stop="startInlineEdit(row, column.key)"
              >
                <button
                  v-if="mode === 'base' && isFillHandleCellSafe(rowOffset, columnIndexByKey(column.key)) && !isEditingCellSafe(row, column.key)"
                  type="button"
                  class="cell-fill-handle"
                  aria-label="Fill handle"
                  tabindex="-1"
                  @mousedown.stop.prevent="startFillHandleDrag($event)"
                />
                <input
                  v-if="isEditingCellSafe(row, column.key)"
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
                v-if="rightColumnSpacerWidth > 0"
                class="grid-column-spacer"
                :style="spacerStyle(rightColumnSpacerWidth)"
              />
            </div>
          </div>
          <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
          <div v-if="centerSelectionOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in centerSelectionOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment"
              :style="segment.style"
            />
          </div>
        </div>
      </div>

      <div
        class="grid-body-pane grid-body-pane--right"
        :style="rightPaneStyle"
        @wheel="handleLinkedViewportWheel"
      >
        <div ref="rightPaneContentRef" class="grid-pane-content" :style="pinnedContentStyle">
          <div v-if="topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }" />
          <div
            v-for="(row, rowOffset) in displayRows"
            :key="`${String(row.rowId)}-right-row`"
            class="grid-row"
            :class="[rowClass(row), { 'grid-row--autosize-probe': isRowAutosizeProbe(row, rowOffset) }]"
            :style="paneRowStyle(row, rowOffset, rightPaneWidth)"
            @click="toggleGroupRow(row)"
          >
            <div
              v-for="column in pinnedRightColumns"
              :key="`${String(row.rowId)}-right-${column.key}`"
              class="grid-cell grid-cell--pinned-right"
              :class="cellStateClasses(row, rowOffset, columnIndexByKey(column.key))"
              :style="columnStyle(column.key)"
              :data-row-index="viewportRowStart + rowOffset"
              :data-column-index="columnIndexByKey(column.key)"
              tabindex="-1"
              @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
              @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
              @dblclick.stop="startInlineEdit(row, column.key)"
            >
              <button
                v-if="mode === 'base' && isFillHandleCellSafe(rowOffset, columnIndexByKey(column.key)) && !isEditingCellSafe(row, column.key)"
                type="button"
                class="cell-fill-handle"
                aria-label="Fill handle"
                tabindex="-1"
                @mousedown.stop.prevent="startFillHandleDrag($event)"
              />
              <input
                v-if="isEditingCellSafe(row, column.key)"
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
          <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
          <div v-if="rightSelectionOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in rightSelectionOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment"
              :style="segment.style"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type ComponentPublicInstance, type CSSProperties } from "vue"
import type {
  DataGridColumnSnapshot,
} from "@affino/datagrid-vue"
import {
  useDataGridLinkedPaneScrollSync,
  useDataGridManagedWheelScroll,
} from "@affino/datagrid-vue/advanced"
import type { DataGridTableRow, DataGridTableStageProps } from "./dataGridTableStage.types"
import { ensureDataGridAppStyles } from "./ensureDataGridAppStyles"

ensureDataGridAppStyles()

const props = defineProps<DataGridTableStageProps<Record<string, unknown>>>()

type TableRow = DataGridTableRow<Record<string, unknown>>

type OverlaySegment = {
  key: string
  style: CSSProperties
}

function resolveElementRef(value: Element | ComponentPublicInstance | null): HTMLElement | null {
  if (value instanceof HTMLElement) {
    return value
  }
  if (value && "$el" in value) {
    const element = value.$el
    return element instanceof HTMLElement ? element : null
  }
  return null
}

function createSyntheticScrollEvent(target: HTMLElement): Event {
  return { target } as unknown as Event
}

function parsePixelValue(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveColumnWidth(column: DataGridColumnSnapshot): number {
  const style = props.columnStyle(column.key)
  return parsePixelValue(style.width ?? style.minWidth ?? column.width, column.width ?? 140)
}

function isCellSelectedSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isCellSelected
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isSelectionAnchorCellSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isSelectionAnchorCell
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellInFillPreviewSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isCellInFillPreview
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellInPendingClipboardRangeSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isCellInPendingClipboardRange
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellOnPendingClipboardEdgeSafe(
  rowOffset: number,
  columnIndex: number,
  edge: "top" | "right" | "bottom" | "left",
): boolean {
  const evaluate = props.isCellOnPendingClipboardEdge
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex, edge)
    : false
}

function isEditingCellSafe(row: TableRow, columnKey: string): boolean {
  const evaluate = props.isEditingCell
  return typeof evaluate === "function"
    ? evaluate(row, columnKey)
    : false
}

function isFillHandleCellSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isFillHandleCell
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

const DEFAULT_INDEX_COLUMN_WIDTH = 72

const indexColumnWidthPx = computed(() => {
  const width = parsePixelValue(
    props.indexColumnStyle.width ?? props.indexColumnStyle.minWidth,
    DEFAULT_INDEX_COLUMN_WIDTH,
  )
  return width > 0 ? width : DEFAULT_INDEX_COLUMN_WIDTH
})

const resolvedIndexColumnStyle = computed<CSSProperties>(() => {
  const width = `${indexColumnWidthPx.value}px`
  return {
    ...props.indexColumnStyle,
    width,
    minWidth: width,
    maxWidth: width,
    left: "0px",
  }
})

const pinnedLeftColumns = computed(() => props.visibleColumns.filter(column => column.pin === "left"))
const pinnedRightColumns = computed(() => props.visibleColumns.filter(column => column.pin === "right"))

const leftPaneWidth = computed(() => {
  return indexColumnWidthPx.value + pinnedLeftColumns.value.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
})

const rightPaneWidth = computed(() => {
  return pinnedRightColumns.value.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
})

const paneLayoutStyle = computed<CSSProperties>(() => ({
  gridTemplateColumns: `${leftPaneWidth.value}px minmax(0, 1fr) ${rightPaneWidth.value}px`,
}))

const leftPaneStyle = computed<CSSProperties>(() => ({
  width: `${leftPaneWidth.value}px`,
  minWidth: `${leftPaneWidth.value}px`,
  maxWidth: `${leftPaneWidth.value}px`,
}))

const rightPaneStyle = computed<CSSProperties>(() => ({
  width: `${rightPaneWidth.value}px`,
  minWidth: `${rightPaneWidth.value}px`,
  maxWidth: `${rightPaneWidth.value}px`,
}))

const bodyViewportEl = ref<HTMLElement | null>(null)
const leftPaneContentRef = ref<HTMLElement | null>(null)
const rightPaneContentRef = ref<HTMLElement | null>(null)

function captureBodyViewportRef(value: Element | ComponentPublicInstance | null): void {
  bodyViewportEl.value = resolveElementRef(value)
  props.bodyViewportRef(value)
}

const linkedPaneScrollSync = useDataGridLinkedPaneScrollSync({
  resolveSourceScrollTop: () => bodyViewportEl.value?.scrollTop ?? 0,
  mode: "direct-transform",
  resolvePaneElements: () => [leftPaneContentRef.value, rightPaneContentRef.value],
})

const managedWheelScroll = useDataGridManagedWheelScroll({
  resolveBodyViewport: () => bodyViewportEl.value,
  resolveMainViewport: () => bodyViewportEl.value,
  setHandledScrollTop: value => {
    if (bodyViewportEl.value) {
      bodyViewportEl.value.scrollTop = value
    }
  },
  setHandledScrollLeft: value => {
    if (bodyViewportEl.value) {
      bodyViewportEl.value.scrollLeft = value
    }
  },
  syncLinkedScroll: scrollTop => {
    linkedPaneScrollSync.syncNow(scrollTop)
  },
  scheduleLinkedScrollSyncLoop: linkedPaneScrollSync.scheduleSyncLoop,
  isLinkedScrollSyncLoopScheduled: linkedPaneScrollSync.isSyncLoopScheduled,
  onWheelConsumed: () => {
    const bodyViewport = bodyViewportEl.value
    if (!bodyViewport) {
      return
    }
    props.handleViewportScroll(createSyntheticScrollEvent(bodyViewport))
  },
})

function handleCenterViewportScroll(event: Event): void {
  props.handleViewportScroll(event)
  const element = event.target as HTMLElement | null
  if (!element) {
    return
  }
  linkedPaneScrollSync.onSourceScroll(element.scrollTop)
}

function handleLinkedViewportWheel(event: WheelEvent): void {
  managedWheelScroll.onLinkedViewportWheel(event)
}

function handleBodyViewportWheel(event: WheelEvent): void {
  managedWheelScroll.onBodyViewportWheel(event)
}

onBeforeUnmount(() => {
  linkedPaneScrollSync.reset()
  managedWheelScroll.reset()
})

const leftTrackStyle = computed<CSSProperties>(() => ({
  width: `${leftPaneWidth.value}px`,
  minWidth: `${leftPaneWidth.value}px`,
  maxWidth: `${leftPaneWidth.value}px`,
}))

const rightTrackStyle = computed<CSSProperties>(() => ({
  width: `${rightPaneWidth.value}px`,
  minWidth: `${rightPaneWidth.value}px`,
  maxWidth: `${rightPaneWidth.value}px`,
}))

const rowMetrics = computed(() => {
  const metrics: Array<{ top: number; height: number }> = []
  let currentTop = props.topSpacerHeight
  props.displayRows.forEach((row, rowOffset) => {
    const style = props.rowStyle(row, rowOffset)
    const height = parsePixelValue(style.height ?? style.minHeight, 31)
    metrics.push({
      top: currentTop,
      height,
    })
    currentTop += height
  })
  return metrics
})

const visibleColumnIndexByKey = computed(() => {
  const indexByKey = new Map<string, number>()
  props.visibleColumns.forEach((column, index) => {
    indexByKey.set(column.key, index)
  })
  return indexByKey
})

const visibleSelectionBounds = computed(() => {
  let startRowOffset: number | null = null
  let endRowOffset: number | null = null
  let startColumnIndex: number | null = null
  let endColumnIndex: number | null = null

  for (let rowOffset = 0; rowOffset < props.displayRows.length; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < props.visibleColumns.length; columnIndex += 1) {
      if (!isCellSelectedSafe(rowOffset, columnIndex)) {
        continue
      }
      startRowOffset ??= rowOffset
      endRowOffset = rowOffset
      startColumnIndex = startColumnIndex == null ? columnIndex : Math.min(startColumnIndex, columnIndex)
      endColumnIndex = endColumnIndex == null ? columnIndex : Math.max(endColumnIndex, columnIndex)
    }
  }

  if (
    startRowOffset == null
    || endRowOffset == null
    || startColumnIndex == null
    || endColumnIndex == null
  ) {
    return null
  }

  return {
    startRowOffset,
    endRowOffset,
    startColumnIndex,
    endColumnIndex,
  }
})

const isSingleVisibleSelectedCell = computed(() => {
  const bounds = visibleSelectionBounds.value
  if (!bounds) {
    return false
  }
  return bounds.startRowOffset === bounds.endRowOffset
    && bounds.startColumnIndex === bounds.endColumnIndex
})

function columnIndexByKey(columnKey: string): number {
  return visibleColumnIndexByKey.value.get(columnKey) ?? 0
}

function isSelectionAnchorCell(rowOffset: number, columnIndex: number): boolean {
  return isSelectionAnchorCellSafe(rowOffset, columnIndex)
}

function shouldHighlightSelectedCell(rowOffset: number, columnIndex: number): boolean {
  const isSelected = isCellSelectedSafe(rowOffset, columnIndex)
  if (!isSelected) {
    return false
  }
  if (isSelectionAnchorCell(rowOffset, columnIndex)) {
    return false
  }
  return !isSingleVisibleSelectedCell.value
}

function paneRowStyle(row: TableRow, rowOffset: number, paneWidth: number): CSSProperties {
  return {
    ...props.rowStyle(row, rowOffset),
    width: `${paneWidth}px`,
    minWidth: `${paneWidth}px`,
    maxWidth: `${paneWidth}px`,
  }
}

function spacerStyle(width: number): CSSProperties {
  const px = `${width}px`
  return {
    width: px,
    minWidth: px,
    maxWidth: px,
  }
}

const pinnedContentStyle = computed<CSSProperties>(() => ({}))

function resolveSelectionOverlayMetrics() {
  const bounds = visibleSelectionBounds.value
  if (!bounds) {
    return null
  }

  const startMetric = rowMetrics.value[bounds.startRowOffset]
  const endMetric = rowMetrics.value[bounds.endRowOffset]
  if (!startMetric || !endMetric) {
    return null
  }

  return {
    bounds,
    top: startMetric.top,
    height: Math.max(1, (endMetric.top + endMetric.height) - startMetric.top),
  }
}

function buildOverlaySegment(
  key: string,
  top: number,
  left: number,
  width: number,
  height: number,
  options?: {
    omitLeftBorder?: boolean
    omitRightBorder?: boolean
  },
): OverlaySegment {
  return {
    key,
    style: {
      position: "absolute",
      top: `${top}px`,
      left: `${left}px`,
      width: `${Math.max(1, width)}px`,
      height: `${Math.max(1, height)}px`,
      border: "2px solid var(--datagrid-selection-copied-border)",
      borderLeftWidth: options?.omitLeftBorder ? "0px" : "2px",
      borderRightWidth: options?.omitRightBorder ? "0px" : "2px",
      boxSizing: "border-box",
      borderTopLeftRadius: options?.omitLeftBorder ? "0px" : "1px",
      borderBottomLeftRadius: options?.omitLeftBorder ? "0px" : "1px",
      borderTopRightRadius: options?.omitRightBorder ? "0px" : "1px",
      borderBottomRightRadius: options?.omitRightBorder ? "0px" : "1px",
      pointerEvents: "none",
      zIndex: 6,
    },
  }
}

const leftSelectionOverlaySegments = computed<OverlaySegment[]>(() => {
  const metrics = resolveSelectionOverlayMetrics()
  if (!metrics) {
    return []
  }

  const selectedColumns = pinnedLeftColumns.value.filter(column => {
    const index = columnIndexByKey(column.key)
    return index >= metrics.bounds.startColumnIndex && index <= metrics.bounds.endColumnIndex
  })
  if (selectedColumns.length === 0) {
    return []
  }

  let left = indexColumnWidthPx.value
  for (const column of pinnedLeftColumns.value) {
    if (column.key === selectedColumns[0]?.key) {
      break
    }
    left += resolveColumnWidth(column)
  }

  const width = selectedColumns.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
  const lastSelectedIndex = columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
  return [
    buildOverlaySegment(
      `selection-left-${metrics.bounds.startRowOffset}-${metrics.bounds.endRowOffset}`,
      metrics.top,
      left,
      width,
      metrics.height,
      {
        omitRightBorder: metrics.bounds.endColumnIndex > lastSelectedIndex,
      },
    ),
  ]
})

const centerSelectionOverlaySegments = computed<OverlaySegment[]>(() => {
  const metrics = resolveSelectionOverlayMetrics()
  if (!metrics) {
    return []
  }

  const selectedColumns = props.renderedColumns.filter(column => {
    const index = columnIndexByKey(column.key)
    return index >= metrics.bounds.startColumnIndex && index <= metrics.bounds.endColumnIndex
  })
  if (selectedColumns.length === 0) {
    return []
  }

  let left = props.leftColumnSpacerWidth
  for (const column of props.renderedColumns) {
    if (column.key === selectedColumns[0]?.key) {
      break
    }
    left += resolveColumnWidth(column)
  }

  const width = selectedColumns.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
  const firstSelectedIndex = columnIndexByKey(selectedColumns[0]?.key ?? "")
  const lastSelectedIndex = columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
  return [
    buildOverlaySegment(
      `selection-center-${metrics.bounds.startRowOffset}-${metrics.bounds.endRowOffset}`,
      metrics.top,
      left,
      width,
      metrics.height,
      {
        omitLeftBorder: metrics.bounds.startColumnIndex < firstSelectedIndex,
        omitRightBorder: metrics.bounds.endColumnIndex > lastSelectedIndex,
      },
    ),
  ]
})

const rightSelectionOverlaySegments = computed<OverlaySegment[]>(() => {
  const metrics = resolveSelectionOverlayMetrics()
  if (!metrics) {
    return []
  }

  const selectedColumns = pinnedRightColumns.value.filter(column => {
    const index = columnIndexByKey(column.key)
    return index >= metrics.bounds.startColumnIndex && index <= metrics.bounds.endColumnIndex
  })
  if (selectedColumns.length === 0) {
    return []
  }

  let left = 0
  for (const column of pinnedRightColumns.value) {
    if (column.key === selectedColumns[0]?.key) {
      break
    }
    left += resolveColumnWidth(column)
  }

  const width = selectedColumns.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
  const firstSelectedIndex = columnIndexByKey(selectedColumns[0]?.key ?? "")
  return [
    buildOverlaySegment(
      `selection-right-${metrics.bounds.startRowOffset}-${metrics.bounds.endRowOffset}`,
      metrics.top,
      left,
      width,
      metrics.height,
      {
        omitLeftBorder: metrics.bounds.startColumnIndex < firstSelectedIndex,
      },
    ),
  ]
})

function cellStateClasses(row: TableRow, rowOffset: number, columnIndex: number): Record<string, boolean> {
  const columnKey = props.visibleColumns[columnIndex]?.key ?? ""
  return {
    "grid-cell--selected": shouldHighlightSelectedCell(rowOffset, columnIndex),
    "grid-cell--selection-anchor": isSelectionAnchorCell(rowOffset, columnIndex),
    "grid-cell--fill-preview": isCellInFillPreviewSafe(rowOffset, columnIndex),
    "grid-cell--clipboard-pending": isCellInPendingClipboardRangeSafe(rowOffset, columnIndex),
    "grid-cell--clipboard-pending-top": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "top"),
    "grid-cell--clipboard-pending-right": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "right"),
    "grid-cell--clipboard-pending-bottom": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "bottom"),
    "grid-cell--clipboard-pending-left": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "left"),
    "grid-cell--editing": isEditingCellSafe(row, columnKey),
  }
}
</script>
