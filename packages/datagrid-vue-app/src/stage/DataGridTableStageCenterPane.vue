<template>
  <div
    :ref="viewportRef ?? undefined"
    class="grid-body-viewport table-wrap"
    tabindex="0"
    @scroll="renderApi.handleCenterViewportScroll"
    @wheel="renderApi.handleBodyViewportWheel"
    @keydown.stop="renderApi.handleViewportKeydown"
  >
    <div class="grid-body-content" :style="layout.gridContentStyle">
      <div v-if="viewport.topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${viewport.topSpacerHeight}px` }" />
      <div
        v-for="(row, rowOffset) in rows.displayRows"
        :key="String(row.rowId)"
        class="grid-row"
        :class="[rows.rowClass(row), renderApi.rowStateClasses(row, rowOffset), { 'grid-row--autosize-probe': rows.isRowAutosizeProbe(row, rowOffset) }]"
        :style="[rows.rowStyle(row, rowOffset), layout.mainTrackStyle]"
        @click="renderApi.handleRowContainerClick(row)"
        @mouseenter="renderApi.setHoveredRow(rowOffset)"
      >
        <div
          v-if="viewport.leftColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="renderApi.spacerStyle(viewport.leftColumnSpacerWidth)"
        />
        <div
          v-for="column in columns.renderedColumns"
          :key="`${String(row.rowId)}-${column.key}`"
          class="grid-cell"
          :class="[
            renderApi.builtInCellClasses(row, column),
            renderApi.cellStateClasses(row, rowOffset, renderApi.columnIndexByKey(column.key)),
            renderApi.resolveCellCustomClass(row, rowOffset, column, renderApi.columnIndexByKey(column.key)),
          ]"
          :style="[
            renderApi.columnStyle(column.key),
            renderApi.bodyCellPresentationStyle(column),
            renderApi.bodyCellSelectionStyle(column, rowOffset, renderApi.columnIndexByKey(column.key)),
            renderApi.resolveCellCustomStyle(row, rowOffset, column, renderApi.columnIndexByKey(column.key)),
          ]"
          :data-row-index="viewport.viewportRowStart + rowOffset"
          :data-column-index="renderApi.columnIndexByKey(column.key)"
          :tabindex="renderApi.cellTabIndex(rowOffset, renderApi.columnIndexByKey(column.key))"
          :role="renderApi.checkboxCellRole(row, column)"
          :aria-checked="renderApi.checkboxCellAriaChecked(row, column)"
          @mousedown.prevent.stop="renderApi.handleCellMouseDown($event, row, rowOffset, renderApi.columnIndexByKey(column.key))"
          @click.stop="renderApi.handleBodyCellClick(row, rowOffset, column, renderApi.columnIndexByKey(column.key))"
          @mousemove="renderApi.handleCellMouseMove($event, rowOffset, renderApi.columnIndexByKey(column.key))"
          @mouseleave="renderApi.clearRangeMoveHandleHover"
          @keydown.stop="renderApi.handleCellKeydown($event, row, rowOffset, renderApi.columnIndexByKey(column.key))"
          @dblclick.stop="renderApi.startInlineEditIfAllowed(row, column)"
        >
          <button
            v-if="mode === 'base' && renderApi.isCellEditableSafe(row, rowOffset, column, renderApi.columnIndexByKey(column.key)) && renderApi.isFillHandleCellSafe(rowOffset, renderApi.columnIndexByKey(column.key)) && !renderApi.isEditingCellSafe(row, column.key)"
            type="button"
            class="cell-fill-handle"
            aria-label="Fill handle"
            tabindex="-1"
            @mousedown.stop.prevent="renderApi.handleFillHandleMouseDown($event)"
            @dblclick.stop.prevent="renderApi.handleFillHandleDoubleClick($event)"
          />
          <DataGridCellComboboxEditor
            v-if="renderApi.isSelectEditorCell(row, rowOffset, column, renderApi.columnIndexByKey(column.key))"
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
            v-else-if="renderApi.isTextEditorCell(row, rowOffset, column, renderApi.columnIndexByKey(column.key))"
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
        <div
          v-if="viewport.rightColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="renderApi.spacerStyle(viewport.rightColumnSpacerWidth)"
        />
      </div>
      <div v-if="viewport.bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${viewport.bottomSpacerHeight}px` }" />
      <DataGridTableStageOverlayLayer
        :selection-segments="selectionOverlaySegments"
        :fill-preview-segments="fillPreviewOverlaySegments"
        :move-preview-segments="movePreviewOverlaySegments"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRefs, type PropType } from "vue"
import DataGridCellComboboxEditor from "../overlays/DataGridCellComboboxEditor.vue"
import DataGridTableStageOverlayLayer from "./DataGridTableStageOverlayLayer.vue"
import {
  useDataGridTableStageColumnsSection,
  useDataGridTableStageEditingSection,
  useDataGridTableStageLayoutSection,
  useDataGridTableStageMode,
  useDataGridTableStageRowsSection,
  useDataGridTableStageViewportSection,
} from "./dataGridTableStageContext"
import type {
  DataGridTableStageCenterPaneRenderApi,
  DataGridTableStageOverlaySegment,
} from "./dataGridTableStageBody.types"
import type { DataGridElementRefHandler } from "./dataGridTableStage.types"

const props = defineProps({
  viewportRef: {
    type: Function as PropType<DataGridElementRefHandler>,
    default: undefined,
  },
  selectionOverlaySegments: {
    type: Array as PropType<readonly DataGridTableStageOverlaySegment[]>,
    required: true,
  },
  fillPreviewOverlaySegments: {
    type: Array as PropType<readonly DataGridTableStageOverlaySegment[]>,
    required: true,
  },
  movePreviewOverlaySegments: {
    type: Array as PropType<readonly DataGridTableStageOverlaySegment[]>,
    required: true,
  },
  renderApi: {
    type: Object as PropType<DataGridTableStageCenterPaneRenderApi>,
    required: true,
  },
})

const mode = useDataGridTableStageMode<Record<string, unknown>>()
const layout = useDataGridTableStageLayoutSection<Record<string, unknown>>()
const viewport = useDataGridTableStageViewportSection<Record<string, unknown>>()
const columns = useDataGridTableStageColumnsSection<Record<string, unknown>>()
const rows = useDataGridTableStageRowsSection<Record<string, unknown>>()
const editing = useDataGridTableStageEditingSection<Record<string, unknown>>()
const {
  viewportRef,
  selectionOverlaySegments,
  fillPreviewOverlaySegments,
  movePreviewOverlaySegments,
  renderApi,
} = toRefs(props)
</script>