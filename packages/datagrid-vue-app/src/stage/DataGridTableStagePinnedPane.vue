<template>
  <div
    class="grid-body-pane"
    :class="[
      pane.side === 'left' ? 'grid-body-pane--left' : 'grid-body-pane--right',
      layoutMode === 'auto-height' ? 'grid-body-pane--layout-auto-height' : 'grid-body-pane--layout-fill',
    ]"
    :style="pane.style"
    @wheel="renderApi.handleLinkedViewportWheel"
  >
    <slot name="chrome" />
    <DataGridTableStageOverlayLayer
      layer-class="grid-selection-overlay--pane-seam"
      :selection-segments="pane.selectionSeamOverlaySegments"
      :fill-preview-segments="pane.fillPreviewSeamOverlaySegments"
      :move-preview-segments="pane.movePreviewSeamOverlaySegments"
      :lanes="pane.seamOverlayLanes"
    />
    <div :ref="pane.contentRef ?? undefined" class="grid-pane-content" :style="pane.contentStyle" @contextmenu="handleContextMenu">
      <div v-if="(pane.topSpacerHeight ?? viewport.topSpacerHeight) > 0" class="grid-spacer" :style="{ height: `${pane.topSpacerHeight ?? viewport.topSpacerHeight}px` }" />
      <div
        v-for="(row, rowOffset) in pane.displayRows"
        :key="resolvePaneRowKey(row, rowOffset)"
        class="grid-row"
        role="row"
        :class="[rows.rowClass(row), renderApi.rowStateClasses(row, rowOffset), { 'grid-row--autosize-probe': rows.isRowAutosizeProbe(row, renderApi.viewportRowOffset(row, rowOffset)) }]"
        :style="renderApi.paneRowStyle(row, rowOffset, pane.width)"
        :data-row-index="renderApi.absoluteRowIndex(row, rowOffset)"
        :aria-rowindex="renderApi.absoluteRowIndex(row, rowOffset) + 1"
        :aria-expanded="renderApi.rowAriaExpanded(row)"
        :aria-label="renderApi.rowAriaLabel(row, rowOffset)"
        :aria-disabled="renderApi.rowAriaDisabled(row, rowOffset)"
        @click="renderApi.handleRowContainerClick(row)"
        @mouseenter="renderApi.setHoveredRow(row, rowOffset)"
      >
        <div
          v-if="pane.showIndexColumn"
          class="grid-cell grid-cell--index grid-cell--index-number datagrid-stage__row-index-cell"
          :class="[
            renderApi.rowIndexCellClasses(row, renderApi.viewportRowOffset(row, rowOffset)),
            {
              'grid-cell--pinned-divider-right': pane.side === 'left' && pane.columns.length > 0,
            },
          ]"
          :style="renderApi.rowIndexCellStyle(row, renderApi.viewportRowOffset(row, rowOffset))"
          :data-row-id="String(row.rowId)"
          :data-row-index="renderApi.absoluteRowIndex(row, rowOffset)"
          :aria-rowindex="renderApi.absoluteRowIndex(row, rowOffset) + 1"
          aria-colindex="1"
          role="rowheader"
          :tabindex="renderApi.rowIndexTabIndex(row)"
          :draggable="renderApi.isRowIndexDraggable(row)"
          @click.stop="renderApi.handleRowIndexClickSafe(row, renderApi.viewportRowOffset(row, rowOffset), $event)"
          @keydown.stop="renderApi.handleRowIndexKeydown($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          @dragstart.stop="renderApi.handleRowIndexDragStart($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          @dragover.stop="renderApi.handleRowIndexDragOver($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          @drop.stop="renderApi.handleRowIndexDrop($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          @dragend.stop="renderApi.handleRowIndexDragEnd()"
        >
          {{ rows.rowIndexLabel(row, renderApi.viewportRowOffset(row, rowOffset)) }}
          <button
            v-if="mode === 'base'"
            type="button"
            class="row-resize-handle"
            aria-label="Resize rows"
            @mousedown.stop="rows.startRowResize($event, row, renderApi.viewportRowOffset(row, rowOffset))"
            @touchstart.stop.passive="startRowTouchResize($event, row, renderApi.viewportRowOffset(row, rowOffset))"
            @touchmove.stop.passive="handleRowTouchResizeMove($event)"
            @touchend.stop.passive="handleRowTouchResizeEnd($event)"
            @touchcancel.stop.passive="handleRowTouchResizeEnd($event)"
            @click.stop
            @dblclick.stop="rows.autosizeRow($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          />
        </div>
        <div
          v-for="(column, columnOffset) in pane.columns"
          :key="resolvePaneCellKey(row, column)"
          class="grid-cell"
          :class="[
            'datagrid-stage__cell',
            pane.side === 'left' ? 'grid-cell--pinned-left' : 'grid-cell--pinned-right',
            pane.side === 'left' && columnOffset < pane.columns.length - 1 ? 'grid-cell--pinned-divider-right' : null,
            pane.side === 'right' && columnOffset > 0 ? 'grid-cell--pinned-divider-left' : null,
            renderApi.builtInCellClasses(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key)),
            renderApi.cellStateClasses(row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key)),
            renderApi.resolveCellCustomClass(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key)),
          ]"
          :style="[
            renderApi.columnStyle(column.key),
            renderApi.bodyCellPresentationStyle(column),
            renderApi.bodyCellSelectionStyle(row, column, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key)),
            renderApi.resolveCellCustomStyle(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key)),
          ]"
          :id="renderApi.cellDomId(row, column)"
          :data-row-id="String(row.rowId)"
          :data-column-key="column.key"
          :data-row-index="renderApi.absoluteRowIndex(row, rowOffset)"
          :data-column-index="renderApi.columnIndexByKey(column.key)"
          :aria-rowindex="renderApi.absoluteRowIndex(row, rowOffset) + 1"
          :aria-colindex="renderApi.columnIndexByKey(column.key) + 1"
          :tabindex="renderApi.cellTabIndex(renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          :aria-selected="renderApi.cellAriaSelected(renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          :role="renderApi.cellAriaRole(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key)) ?? 'gridcell'"
          :aria-checked="renderApi.cellAriaChecked(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          :aria-pressed="renderApi.cellAriaPressed(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          :aria-label="renderApi.cellAriaLabel(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          :aria-disabled="renderApi.cellAriaDisabled(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          @mousedown.stop="renderApi.handleCellMouseDown($event, row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @click.stop="renderApi.handleBodyCellClick($event, row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          @mousemove="renderApi.handleCellMouseMove($event, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @mouseleave="renderApi.clearRangeMoveHandleHover()"
          @keydown.stop="renderApi.handleCellKeydown($event, row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @dblclick.stop="renderApi.startInlineEditIfAllowed(row, column, renderApi.viewportRowOffset(row, rowOffset), $event)"
        >
          <button
            v-if="mode === 'base' && renderApi.isCellEditableSafe(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key)) && renderApi.isFillHandleCellSafe(renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key)) && !renderApi.isEditingCellSafe(row, column.key)"
            type="button"
            class="cell-fill-handle"
            aria-label="Fill handle"
            tabindex="-1"
            @mousedown.stop="renderApi.handleFillHandleMouseDown($event)"
            @dblclick.stop="renderApi.handleFillHandleDoubleClick($event)"
            @touchstart.stop.passive="renderApi.handleFillHandleTouchStart($event)"
            @touchmove.stop.passive="renderApi.handleFillHandleTouchMove($event)"
            @touchend.stop.passive="renderApi.handleFillHandleTouchEnd($event)"
            @touchcancel.stop.passive="renderApi.handleFillHandleTouchEnd($event)"
          />
          <button
            v-if="renderApi.isTouchSelectionAnchorHandleCell(row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
            type="button"
            class="grid-touch-selection-handle"
            aria-label="Selection handle"
            tabindex="-1"
            @mousedown.stop.prevent="renderApi.handleTouchSelectionHandleMouseDown($event)"
            @touchstart.stop.passive="renderApi.handleTouchSelectionHandleTouchStart($event, row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
            @touchmove.stop.passive="renderApi.handleTouchSelectionHandleTouchMove($event)"
            @touchend.stop.passive="renderApi.handleTouchSelectionHandleTouchEnd($event)"
            @touchcancel.stop.passive="renderApi.handleTouchSelectionHandleTouchEnd($event)"
            @click.stop.prevent
            @contextmenu.stop.prevent
          />
          <button
            v-if="renderApi.isTouchRangeMoveHandleCell(row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
            type="button"
            class="grid-touch-range-move-handle"
            aria-label="Move selection"
            tabindex="-1"
            @mousedown.stop.prevent="renderApi.handleTouchRangeMoveHandleMouseDown($event)"
            @touchstart.stop.passive="renderApi.handleTouchRangeMoveHandleTouchStart($event, row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
            @touchmove.stop.passive="renderApi.handleTouchRangeMoveHandleTouchMove($event)"
            @touchend.stop.passive="renderApi.handleTouchRangeMoveHandleTouchEnd($event)"
            @touchcancel.stop.passive="renderApi.handleTouchRangeMoveHandleTouchEnd($event)"
            @click.stop.prevent
            @contextmenu.stop.prevent
          />
          <DataGridCellComboboxEditor
            v-if="renderApi.isSelectEditorCell(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            :value="renderApi.resolveSelectEditorValue(row, column)"
            :options="renderApi.resolveSelectEditorOptions(row, column)"
            :load-options="renderApi.resolveSelectEditorOptionsLoader(row, column)"
            :initial-filter="editing.editingCellInitialFilter"
            :open-on-mount="editing.editingCellOpenOnMount"
            :disabled="editing.editingCellPending"
            :aria-label="renderApi.cellEditorAriaLabel(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            :aria-invalid="editing.editingCellValidationMessage || editing.editingCellRejectedReason ? 'true' : undefined"
            @commit="renderApi.handleSelectEditorCommit"
            @cancel="renderApi.handleSelectEditorCancel"
            @options-resolved="renderApi.handleSelectEditorOptionsResolved(row, column, $event)"
          />
          <input
            v-else-if="renderApi.isDateEditorCell(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            class="cell-editor-control cell-editor-input cell-editor-input--date"
            :name="`datagrid-cell-editor-${column.key}`"
            :type="renderApi.resolveDateEditorInputType(row, column)"
            :value="editing.editingCellValue"
            :disabled="editing.editingCellPending"
            :aria-label="renderApi.cellEditorAriaLabel(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            :aria-invalid="editing.editingCellValidationMessage || editing.editingCellRejectedReason ? 'true' : undefined"
            :aria-busy="editing.editingCellPending ? 'true' : undefined"
            autofocus
            @mousedown.stop
            @click.stop
            @contextmenu.stop
            @input="renderApi.updateEditingCellValue(($event.target as HTMLInputElement).value)"
            @change="renderApi.handleDateEditorChange(($event.target as HTMLInputElement).value)"
            @keydown.stop="renderApi.handleEditorKeydown"
            @blur="renderApi.handleTextEditorBlur"
          />
          <input
            v-else-if="renderApi.isTextEditorCell(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            class="cell-editor-control cell-editor-input"
            :name="`datagrid-cell-editor-${column.key}`"
            :value="editing.editingCellValue"
            :disabled="editing.editingCellPending"
            :aria-label="renderApi.cellEditorAriaLabel(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            :aria-invalid="editing.editingCellValidationMessage || editing.editingCellRejectedReason ? 'true' : undefined"
            :aria-busy="editing.editingCellPending ? 'true' : undefined"
            autofocus
            @mousedown.stop
            @click.stop
            @contextmenu.stop
            @input="renderApi.updateEditingCellValue(($event.target as HTMLInputElement).value)"
            @keydown.stop="renderApi.handleEditorKeydown"
            @blur="renderApi.handleTextEditorBlur"
          />
          <template v-else-if="renderApi.shouldRenderCheckboxCell(row, column)">
            <span class="grid-checkbox-indicator" :class="renderApi.checkboxIndicatorClass(row, column)" aria-hidden="true">
              <span class="grid-checkbox-indicator__mark" :class="renderApi.checkboxIndicatorMarkClass(row, column)" />
            </span>
          </template>
          <DataGridCellContentRenderer
            v-else
            :content-key="resolvePaneCellContentKey(row, column)"
            :content="renderApi.renderResolvedCellContent(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          />
        </div>
      </div>
      <div v-if="(pane.bottomSpacerHeight ?? viewport.bottomSpacerHeight) > 0" class="grid-spacer" :style="{ height: `${pane.bottomSpacerHeight ?? viewport.bottomSpacerHeight}px` }" />
      <DataGridTableStageOverlayLayer
        :selection-segments="pane.selectionOverlaySegments"
        :fill-preview-segments="pane.fillPreviewOverlaySegments"
        :move-preview-segments="pane.movePreviewOverlaySegments"
        :lanes="pane.overlayLanes"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, type PropType } from "vue"
import DataGridCellComboboxEditor from "../overlays/DataGridCellComboboxEditor.vue"
import {
  recordDataGridPerfSample,
  resolveDataGridPerfNow,
} from "../perf/dataGridPerfTrace"
import DataGridCellContentRenderer from "./DataGridCellContentRenderer"
import DataGridTableStageOverlayLayer from "./DataGridTableStageOverlayLayer.vue"
import {
  useDataGridTableStageEditingSection,
  useDataGridTableStageLayoutMode,
  useDataGridTableStageMode,
  useDataGridTableStageRowsSection,
  useDataGridTableStageViewportSection,
} from "./dataGridTableStageContext"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageBodyRow,
  DataGridTableStagePinnedPaneProps,
  DataGridTableStagePinnedPaneRenderApi,
} from "./dataGridTableStageBody.types"

const props = defineProps({
  pane: {
    type: Object as PropType<DataGridTableStagePinnedPaneProps>,
    required: true,
  },
  renderApi: {
    type: Object as PropType<DataGridTableStagePinnedPaneRenderApi>,
    required: true,
  },
  handleContextMenu: {
    type: Function as PropType<(event: MouseEvent) => void>,
    default: undefined,
  },
  perfTraceEnabled: {
    type: Boolean,
    default: false,
  },
})

const mode = useDataGridTableStageMode<Record<string, unknown>>()
const layoutMode = useDataGridTableStageLayoutMode<Record<string, unknown>>()
const viewport = useDataGridTableStageViewportSection<Record<string, unknown>>()
const rows = useDataGridTableStageRowsSection<Record<string, unknown>>()
const editing = useDataGridTableStageEditingSection<Record<string, unknown>>()
const handleContextMenu = props.handleContextMenu

function resolveRecycledPaneRowSlotIndex(row: DataGridTableStageBodyRow, rowOffset: number, rowCount: number): number {
  const poolSize = Math.max(1, rowCount)
  const absoluteIndex = props.renderApi.absoluteRowIndex(row, rowOffset)
  const normalizedIndex = Number.isFinite(absoluteIndex)
    ? Math.trunc(absoluteIndex)
    : rowOffset
  return ((normalizedIndex % poolSize) + poolSize) % poolSize
}

function resolvePaneRowKey(row: DataGridTableStageBodyRow, rowOffset: number): string {
  if (props.pane.rowKeyMode !== "recycled") {
    return `${String(row.rowId)}-${props.pane.side}-row`
  }
  return `${props.pane.side}-recycled-row-${resolveRecycledPaneRowSlotIndex(row, rowOffset, props.pane.displayRows.length)}`
}

function resolvePaneCellKey(row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): string {
  if (props.pane.rowKeyMode !== "recycled") {
    return `${String(row.rowId)}-${props.pane.side}-${column.key}`
  }
  return String(column.key)
}

function hasAuthoredCellContentRenderer(row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): boolean {
  return typeof column.column.cellRenderer === "function"
    || (row.kind === "group" && typeof column.column.groupCellRenderer === "function")
}

function resolvePaneCellContentKey(row: DataGridTableStageBodyRow, column: DataGridTableStageBodyColumn): string | undefined {
  if (props.pane.rowKeyMode !== "recycled" || !hasAuthoredCellContentRenderer(row, column)) {
    return undefined
  }
  return `${String(row.rowId)}-${props.pane.side}-${column.key}`
}

function resolveRowWindowSignature(rows: readonly DataGridTableStageBodyRow[]): string {
  const rowCount = rows.length
  const firstRow = rows[0]
  const lastRow = rowCount > 0 ? rows[rowCount - 1] : null
  return `${rowCount}:${String(firstRow?.rowId ?? "none")}:${String(lastRow?.rowId ?? "none")}`
}

function resolveColumnWindowSignature(columns: DataGridTableStagePinnedPaneProps["columns"]): string {
  const columnCount = columns.length
  const firstColumn = columns[0]
  const lastColumn = columnCount > 0 ? columns[columnCount - 1] : null
  return `${columnCount}:${String(firstColumn?.key ?? "none")}:${String(lastColumn?.key ?? "none")}`
}

let activeTouchRowResizeId: number | null = null

function readTouchAt(touches: TouchList, identifier: number): Touch | null {
  const indexedTouches = touches as TouchList & { [index: number]: Touch | undefined }
  for (let index = 0; index < touches.length; index += 1) {
    const touch = typeof touches.item === "function" ? touches.item(index) : indexedTouches[index]
    if (touch?.identifier === identifier) {
      return touch
    }
  }
  return null
}

function readFirstTouch(touches: TouchList): Touch | null {
  const indexedTouches = touches as TouchList & { [index: number]: Touch | undefined }
  return (typeof touches.item === "function" ? touches.item(0) : indexedTouches[0]) ?? null
}

function createTouchRowResizeMouseEvent(type: "mousedown" | "mousemove" | "mouseup", touch: Touch): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: touch.clientX,
    clientY: touch.clientY,
  })
}

function startRowTouchResize(event: TouchEvent, row: DataGridTableStageBodyRow, rowOffset: number): void {
  const touch = event.touches.length === 1 ? readFirstTouch(event.touches) : null
  if (!touch) {
    activeTouchRowResizeId = null
    return
  }
  activeTouchRowResizeId = touch.identifier
  rows.value.startRowResize(createTouchRowResizeMouseEvent("mousedown", touch), row, rowOffset)
}

function handleRowTouchResizeMove(event: TouchEvent): void {
  if (activeTouchRowResizeId == null || typeof window === "undefined") {
    return
  }
  const touch = readTouchAt(event.touches, activeTouchRowResizeId)
  if (!touch) {
    return
  }
  window.dispatchEvent(createTouchRowResizeMouseEvent("mousemove", touch))
}

function handleRowTouchResizeEnd(event: TouchEvent): void {
  if (activeTouchRowResizeId == null || typeof window === "undefined") {
    activeTouchRowResizeId = null
    return
  }
  const touch = readTouchAt(event.changedTouches, activeTouchRowResizeId)
  activeTouchRowResizeId = null
  if (!touch) {
    return
  }
  window.dispatchEvent(createTouchRowResizeMouseEvent("mouseup", touch))
}

function emitRenderWindowTelemetry(): void {
  if (!props.perfTraceEnabled) {
    return
  }
  const rowCount = props.pane.displayRows.length
  const pinnedColumnCount = props.pane.columns.length
  const indexColumnCount = props.pane.showIndexColumn ? 1 : 0
  recordDataGridPerfSample({
    scope: "stageRenderWindow",
    ts: resolveDataGridPerfNow(),
    totalMs: 0,
    surface: props.pane.side === "left" ? "pinned-left" : "pinned-right",
    rowCount,
    centerColumnCount: 0,
    pinnedColumnCount,
    cellSurfaceCount: rowCount * (pinnedColumnCount + indexColumnCount),
    rowNodeCount: rowCount,
    cellNodeCount: rowCount * (pinnedColumnCount + indexColumnCount),
    placeholderRowCount: props.pane.displayRows.filter(row => (row as { __placeholder?: boolean }).__placeholder === true).length,
    topSpacerHeight: props.pane.topSpacerHeight ?? viewport.value.topSpacerHeight,
    bottomSpacerHeight: props.pane.bottomSpacerHeight ?? viewport.value.bottomSpacerHeight,
    selectionSegmentCount: props.pane.selectionOverlaySegments.length + props.pane.selectionSeamOverlaySegments.length,
    fillPreviewSegmentCount: props.pane.fillPreviewOverlaySegments.length + props.pane.fillPreviewSeamOverlaySegments.length,
    movePreviewSegmentCount: props.pane.movePreviewOverlaySegments.length + props.pane.movePreviewSeamOverlaySegments.length,
    overlayLaneCount: (props.pane.overlayLanes?.length ?? 0) + (props.pane.seamOverlayLanes?.length ?? 0),
  })
}

watch(
  () => {
    if (!props.perfTraceEnabled) {
      return null
    }
    return [
      props.pane.side,
      props.pane.displayRows.length,
      resolveRowWindowSignature(props.pane.displayRows),
      resolveColumnWindowSignature(props.pane.columns),
      String(props.pane.showIndexColumn),
      String(props.pane.topSpacerHeight ?? viewport.value.topSpacerHeight),
      String(props.pane.bottomSpacerHeight ?? viewport.value.bottomSpacerHeight),
      String(props.pane.selectionOverlaySegments.length),
      String(props.pane.selectionSeamOverlaySegments.length),
      String(props.pane.fillPreviewOverlaySegments.length),
      String(props.pane.fillPreviewSeamOverlaySegments.length),
      String(props.pane.movePreviewOverlaySegments.length),
      String(props.pane.movePreviewSeamOverlaySegments.length),
      String(props.pane.overlayLanes?.length ?? 0),
      String(props.pane.seamOverlayLanes?.length ?? 0),
    ].join("|")
  },
  (signature) => {
    if (signature != null) {
      emitRenderWindowTelemetry()
    }
  },
  { immediate: true },
)
</script>
