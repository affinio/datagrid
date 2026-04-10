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
    <div :ref="pane.contentRef ?? undefined" class="grid-pane-content" :style="pane.contentStyle" @contextmenu="handleContextMenu">
      <div v-if="(pane.topSpacerHeight ?? viewport.topSpacerHeight) > 0" class="grid-spacer" :style="{ height: `${pane.topSpacerHeight ?? viewport.topSpacerHeight}px` }" />
      <div
        v-for="(row, rowOffset) in pane.displayRows"
        :key="`${String(row.rowId)}-${pane.side}-row`"
        class="grid-row"
        :class="[rows.rowClass(row), renderApi.rowStateClasses(row, rowOffset), { 'grid-row--autosize-probe': rows.isRowAutosizeProbe(row, renderApi.viewportRowOffset(row, rowOffset)) }]"
        :style="renderApi.paneRowStyle(row, rowOffset, pane.width)"
        :data-row-index="renderApi.absoluteRowIndex(row, rowOffset)"
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
          :tabindex="renderApi.rowIndexTabIndex(row)"
          :draggable="renderApi.isRowIndexDraggable(row)"
          @click.stop="renderApi.handleRowIndexClickSafe(row, renderApi.viewportRowOffset(row, rowOffset), $event)"
          @keydown.stop="renderApi.handleRowIndexKeydown($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          @dragstart.stop="renderApi.handleRowIndexDragStart($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          @dragover.stop.prevent="renderApi.handleRowIndexDragOver($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          @drop.stop.prevent="renderApi.handleRowIndexDrop($event, row, renderApi.viewportRowOffset(row, rowOffset))"
          @dragend.stop="renderApi.handleRowIndexDragEnd()"
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
          v-for="(column, columnOffset) in pane.columns"
          :key="`${String(row.rowId)}-${pane.side}-${column.key}`"
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
          :data-row-id="String(row.rowId)"
          :data-column-key="column.key"
          :data-row-index="renderApi.absoluteRowIndex(row, rowOffset)"
          :data-column-index="renderApi.columnIndexByKey(column.key)"
          :tabindex="renderApi.cellTabIndex(renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          :role="renderApi.cellAriaRole(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          :aria-checked="renderApi.cellAriaChecked(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          :aria-pressed="renderApi.cellAriaPressed(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          :aria-label="renderApi.cellAriaLabel(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          :aria-disabled="renderApi.cellAriaDisabled(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          @mousedown.prevent.stop="renderApi.handleCellMouseDown($event, row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @click.stop="renderApi.handleBodyCellClick($event, row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          @mousemove="renderApi.handleCellMouseMove($event, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @mouseleave="renderApi.clearRangeMoveHandleHover()"
          @keydown.stop="renderApi.handleCellKeydown($event, row, renderApi.viewportRowOffset(row, rowOffset), renderApi.columnIndexByKey(column.key))"
          @dblclick.stop.prevent="renderApi.startInlineEditIfAllowed(row, column, renderApi.viewportRowOffset(row, rowOffset))"
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
            v-else-if="renderApi.isDateEditorCell(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
            class="cell-editor-control cell-editor-input cell-editor-input--date"
            :name="`datagrid-cell-editor-${column.key}`"
            :type="renderApi.resolveDateEditorInputType(row, column)"
            :value="editing.editingCellValue"
            autofocus
            @mousedown.stop
            @click.stop
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
            autofocus
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
          <DataGridCellContentRenderer
            v-else
            :content="renderApi.renderResolvedCellContent(row, renderApi.viewportRowOffset(row, rowOffset), column, renderApi.columnIndexByKey(column.key))"
          />
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
})

const mode = useDataGridTableStageMode<Record<string, unknown>>()
const layoutMode = useDataGridTableStageLayoutMode<Record<string, unknown>>()
const viewport = useDataGridTableStageViewportSection<Record<string, unknown>>()
const rows = useDataGridTableStageRowsSection<Record<string, unknown>>()
const editing = useDataGridTableStageEditingSection<Record<string, unknown>>()
const handleContextMenu = props.handleContextMenu
</script>
