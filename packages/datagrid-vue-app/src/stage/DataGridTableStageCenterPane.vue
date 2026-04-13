<template>
  <div
    :ref="viewportRef ?? undefined"
    :class="resolvedViewportClass"
    tabindex="0"
    @scroll="handleScroll"
    @wheel="handleWheel"
    @contextmenu="handleContextMenu"
    @keydown.stop="handleKeydown"
  >
    <div class="grid-body-content" :style="layout.gridContentStyle">
      <div v-if="topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }" />
      <div
        v-for="(row, rowOffset) in displayRows"
        :key="String(row.rowId)"
        class="grid-row"
        :class="[rows.rowClass(row), renderApi.rowStateClasses(row, rowOffset), { 'grid-row--autosize-probe': rows.isRowAutosizeProbe(row, renderApi.viewportRowOffset(row, rowOffset)) }]"
        :style="[rows.rowStyle(row, renderApi.viewportRowOffset(row, rowOffset)), layout.mainTrackStyle]"
        :data-row-index="renderApi.absoluteRowIndex(row, rowOffset)"
        @click="renderApi.handleRowContainerClick(row)"
        @mouseenter="renderApi.setHoveredRow(row, rowOffset)"
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
            'datagrid-stage__cell',
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
          @mouseleave="renderApi.clearRangeMoveHandleHover"
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
        <div
          v-if="viewport.rightColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="renderApi.spacerStyle(viewport.rightColumnSpacerWidth)"
        />
      </div>
      <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
      <DataGridTableStageOverlayLayer
        :selection-segments="selectionOverlaySegments"
        :fill-preview-segments="fillPreviewOverlaySegments"
        :move-preview-segments="movePreviewOverlaySegments"
        :lanes="overlayLanes"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs, type PropType } from "vue"
import DataGridCellComboboxEditor from "../overlays/DataGridCellComboboxEditor.vue"
import DataGridCellContentRenderer from "./DataGridCellContentRenderer"
import DataGridTableStageOverlayLayer from "./DataGridTableStageOverlayLayer.vue"
import {
  useDataGridTableStageColumnsSection,
  useDataGridTableStageEditingSection,
  useDataGridTableStageLayoutSection,
  useDataGridTableStageLayoutMode,
  useDataGridTableStageMode,
  useDataGridTableStageRowsSection,
  useDataGridTableStageViewportSection,
} from "./dataGridTableStageContext"
import type {
  DataGridTableStageBodyRow,
  DataGridTableStageCenterPaneRenderApi,
  DataGridTableStageOverlayLane,
  DataGridTableStageOverlaySegment,
} from "./dataGridTableStageBody.types"
import type { DataGridElementRefHandler } from "./dataGridTableStage.types"

const props = defineProps({
  viewportRef: {
    type: Function as PropType<DataGridElementRefHandler>,
    default: undefined,
  },
  displayRows: {
    type: Array as PropType<readonly DataGridTableStageBodyRow[]>,
    required: true,
  },
  topSpacerHeight: {
    type: Number,
    default: undefined,
  },
  bottomSpacerHeight: {
    type: Number,
    default: undefined,
  },
  viewportClass: {
    type: String,
    default: "grid-body-viewport table-wrap",
  },
  handleScroll: {
    type: Function as PropType<(event: Event) => void>,
    default: undefined,
  },
  handleWheel: {
    type: Function as PropType<(event: WheelEvent) => void>,
    default: undefined,
  },
  handleKeydown: {
    type: Function as PropType<(event: KeyboardEvent) => void>,
    default: undefined,
  },
  handleContextMenu: {
    type: Function as PropType<(event: MouseEvent) => void>,
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
  overlayLanes: {
    type: Array as PropType<readonly DataGridTableStageOverlayLane[]>,
    default: () => [],
  },
  renderApi: {
    type: Object as PropType<DataGridTableStageCenterPaneRenderApi>,
    required: true,
  },
})

const mode = useDataGridTableStageMode<Record<string, unknown>>()
const layoutMode = useDataGridTableStageLayoutMode<Record<string, unknown>>()
const layout = useDataGridTableStageLayoutSection<Record<string, unknown>>()
const viewport = useDataGridTableStageViewportSection<Record<string, unknown>>()
const columns = useDataGridTableStageColumnsSection<Record<string, unknown>>()
const rows = useDataGridTableStageRowsSection<Record<string, unknown>>()
const editing = useDataGridTableStageEditingSection<Record<string, unknown>>()
const {
  displayRows,
  viewportClass,
  viewportRef,
  selectionOverlaySegments,
  fillPreviewOverlaySegments,
  movePreviewOverlaySegments,
  overlayLanes,
  renderApi,
} = toRefs(props)

const topSpacerHeight = computed(() => props.topSpacerHeight ?? viewport.value.topSpacerHeight)
const bottomSpacerHeight = computed(() => props.bottomSpacerHeight ?? viewport.value.bottomSpacerHeight)
const handleScroll = computed(() => props.handleScroll ?? renderApi.value.handleCenterViewportScroll)
const handleWheel = computed(() => props.handleWheel ?? renderApi.value.handleBodyViewportWheel)
const handleKeydown = computed(() => props.handleKeydown ?? renderApi.value.handleViewportKeydown)
const handleContextMenu = computed(() => props.handleContextMenu)
const resolvedViewportClass = computed(() => [
  viewportClass.value,
  layoutMode.value === "auto-height"
    ? "grid-body-viewport--layout-auto-height"
    : "grid-body-viewport--layout-fill",
])
</script>
