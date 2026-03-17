<template>
  <div
    class="grid-body-pane"
    :class="pane.side === 'left' ? 'grid-body-pane--left' : 'grid-body-pane--right'"
    :style="pane.style"
    @wheel="renderApi.handleLinkedViewportWheel"
  >
    <slot name="chrome" />
    <div :ref="pane.contentRef ?? undefined" class="grid-pane-content" :style="pane.contentStyle">
      <div v-if="(pane.topSpacerHeight ?? viewport.topSpacerHeight) > 0" class="grid-spacer" :style="{ height: `${pane.topSpacerHeight ?? viewport.topSpacerHeight}px` }" />
      <div
        v-for="(row, rowOffset) in pane.displayRows"
        :key="`${String(row.rowId)}-${pane.side}-row`"
        class="grid-row"
        :class="[rows.rowClass(row), renderApi.rowStateClasses(row, rowOffset), { 'grid-row--autosize-probe': rows.isRowAutosizeProbe(row, renderApi.viewportRowOffset(row, rowOffset)) }]"
        :style="renderApi.paneRowStyle(row, rowOffset, pane.width)"
        @click="renderApi.handleRowContainerClick(row)"
        @mouseenter="renderApi.setHoveredRow(row, rowOffset)"
      >
        <div
          v-if="pane.showIndexColumn"
          class="grid-cell grid-cell--index grid-cell--index-number"
          :class="{ 'grid-cell--index-selected': renderApi.isFullRowSelectionSafe(renderApi.viewportRowOffset(row, rowOffset)) }"
          :style="renderApi.rowIndexColumnStyle"
          @click.stop="renderApi.handleRowIndexClickSafe(row, renderApi.viewportRowOffset(row, rowOffset), $event)"
        >
          {{ rows.rowIndexLabel(row, renderApi.viewportRowOffset(row, rowOffset)) }}
          <button
            v-if="mode === 'base'"
            type="button"
            class="row-resize-handle"
            aria-label="Resize rows"
            @mousedown.stop.prevent="rows.startRowResize($event, row, renderApi.viewportRowOffset(row, rowOffset))"
            @dblclick.stop.prevent="rows.autosizeRow($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          />
        </div>
        <div
          v-for="column in pane.columns"
          :key="`${String(row.rowId)}-${pane.side}-${column.key}`"
          class="grid-cell"
          :class="[
            pane.side === 'left' ? 'grid-cell--pinned-left' : 'grid-cell--pinned-right',
            renderApi.builtInCellClasses(row, column),
            renderApi.cellStateClasses(row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key)),
            renderApi.resolveCellCustomClass(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key)),
          ]"
          :style="[
            renderApi.columnStyle(column.key),
            renderApi.bodyCellPresentationStyle(column),
            renderApi.bodyCellSelectionStyle(column, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key)),
            renderApi.resolveCellCustomStyle(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key)),
          ]"
          :data-row-index="renderApi.absoluteRowIndex(row, rowOffset)"
          :data-column-index="renderApi.columnIndexByKey(column.key)"
          :tabindex="renderApi.cellTabIndex(renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          :role="renderApi.checkboxCellRole(row, column)"
          :aria-checked="renderApi.checkboxCellAriaChecked(row, column)"
          @mousedown.prevent.stop="renderApi.handleCellMouseDown($event, row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @click.stop="renderApi.handleBodyCellClick(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          @mousemove="renderApi.handleCellMouseMove($event, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @mouseleave="renderApi.clearRangeMoveHandleHover()"
          @keydown.stop="renderApi.handleCellKeydown($event, row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @dblclick.stop="renderApi.startInlineEditIfAllowed(row, column, renderApi.viewportRowOffset(row, rowOffset))"
        >
          <button
            v-if="mode === 'base' && renderApi.isCellEditableSafe(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key)) && renderApi.isFillHandleCellSafe(renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key)) && !renderApi.isEditingCellSafe(row, column.key)"
            type="button"
            class="cell-fill-handle"
            aria-label="Fill handle"
            tabindex="-1"
            @mousedown.stop.prevent="renderApi.handleFillHandleMouseDown($event)"
            @dblclick.stop.prevent="renderApi.handleFillHandleDoubleClick($event)"
          />
          <DataGridCellComboboxEditor
            v-if="renderApi.isSelectEditorCell(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            :value="renderApi.resolveSelectEditorValue(row, column)"
            :options="renderApi.resolveSelectEditorOptions(row, column)"
            :load-options="renderApi.resolveSelectEditorOptionsLoader(row, column)"
            :initial-filter="editing.editingCellInitialFilter"
            :open-on-mount="editing.editingCellOpenOnMount"
            @commit="renderApi.handleSelectEditorCommit"
            @cancel="renderApi.handleSelectEditorCancel"
            @options-resolved="renderApi.handleSelectEditorOptionsResolved(row, column, $event)"
          />
          <input
            v-else-if="renderApi.isTextEditorCell(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            class="cell-editor-control cell-editor-input"
            :value="editing.editingCellValue"
            @mousedown.stop
            @click.stop
            @input="renderApi.updateEditingCellValue(($event.target as HTMLInputElement).value)"
            @keydown.stop="renderApi.handleEditorKeydown"
            @blur="renderApi.handleTextEditorBlur"
          />
          <template v-else-if="renderApi.shouldRenderCheckboxCell(row, column)">
            <span class="grid-checkbox-indicator" :class="renderApi.checkboxIndicatorClass(row, column)" aria-hidden="true">
              <span class="grid-checkbox-indicator__mark" :class="renderApi.checkboxIndicatorMarkClass(row, column)" />
            </span>
          </template>
          <template v-else>{{ renderApi.readResolvedDisplayCell(row, column) }}</template>
        </div>
      </div>
      <div v-if="(pane.bottomSpacerHeight ?? viewport.bottomSpacerHeight) > 0" class="grid-spacer" :style="{ height: `${pane.bottomSpacerHeight ?? viewport.bottomSpacerHeight}px` }" />
      <DataGridTableStageOverlayLayer
        :selection-segments="pane.selectionOverlaySegments"
        :fill-preview-segments="pane.fillPreviewOverlaySegments"
        :move-preview-segments="pane.movePreviewOverlaySegments"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue"
import DataGridCellComboboxEditor from "../overlays/DataGridCellComboboxEditor.vue"
import DataGridTableStageOverlayLayer from "./DataGridTableStageOverlayLayer.vue"
import {
  useDataGridTableStageEditingSection,
  useDataGridTableStageMode,
  useDataGridTableStageRowsSection,
  useDataGridTableStageViewportSection,
} from "./dataGridTableStageContext"
import type {
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
})

const mode = useDataGridTableStageMode<Record<string, unknown>>()
const viewport = useDataGridTableStageViewportSection<Record<string, unknown>>()
const rows = useDataGridTableStageRowsSection<Record<string, unknown>>()
const editing = useDataGridTableStageEditingSection<Record<string, unknown>>()
</script>
