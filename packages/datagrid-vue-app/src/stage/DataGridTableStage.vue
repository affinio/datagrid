<template>
  <section
    ref="stageRootEl"
    class="grid-stage"
    :class="{
      'grid-stage--canvas-chrome': true,
      'grid-stage--auto-row-height': mode === 'base' && rowHeightMode === 'auto',
      'grid-stage--layout-fill': layoutMode === 'fill',
      'grid-stage--layout-auto-height': layoutMode === 'auto-height',
      'grid-stage--fill-dragging': isFillDragging,
      'grid-stage--range-moving': isRangeMoving,
      'grid-stage--single-cell-selection': isSingleSelectedCell,
    }"
    :style="layout.stageStyle"
  >
    <DataGridTableStageHeader
      :pane-layout-style="paneLayoutStyle"
      :left-pane-style="leftPaneStyle"
      :right-pane-style="rightPaneStyle"
      :left-track-style="leftTrackStyle"
      :right-track-style="rightTrackStyle"
      :row-index-column-style="resolvedRowIndexColumnStyle"
      :show-index-column="showRowIndex"
      :on-linked-viewport-wheel="handleLinkedViewportWheel"
    >
      <template #center-chrome>
        <canvas
          ref="centerHeaderChromeCanvasEl"
          class="grid-chrome-canvas grid-chrome-canvas--header-center"
          :style="centerHeaderChromeCanvasStyle"
          aria-hidden="true"
        />
      </template>
      <template #left-chrome>
        <canvas ref="leftHeaderChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
      </template>
      <template #right-chrome>
        <canvas ref="rightHeaderChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
      </template>
    </DataGridTableStageHeader>

    <div ref="bodyShellRef" class="grid-body-shell" :style="[paneLayoutStyle, layout.bodyShellStyle]" @mouseleave="clearHoveredRow">
      <canvas
        ref="centerChromeCanvasEl"
        class="grid-chrome-canvas grid-chrome-canvas--center-shell"
        :style="centerChromeCanvasStyle"
        aria-hidden="true"
      />
      <DataGridTableStagePinnedPane
        :pane="leftPinnedPane"
        :render-api="pinnedPaneRenderApi"
        :handle-context-menu="onViewportContextMenu"
      >
        <template #chrome>
          <canvas ref="leftChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        </template>
      </DataGridTableStagePinnedPane>

      <DataGridTableStageCenterPane
        :display-rows="rows.displayRows"
        :runtime-revision="rows.runtimeRevision"
        :body-rows-revision="rows.displayRowsRevision"
        :top-spacer-height="viewport.topSpacerHeight"
        :bottom-spacer-height="viewport.bottomSpacerHeight"
        :viewport-ref="captureBodyViewportRef"
        :report-center-pane-diagnostics="props.reportCenterPaneDiagnostics"
        :report-fill-plumbing-state="props.reportFillPlumbingState"
        :report-fill-plumbing-detail="props.reportFillPlumbingDetail"
        :handle-context-menu="onViewportContextMenu"
        :selection-overlay-segments="centerSelectionOverlaySegments"
        :fill-preview-overlay-segments="centerFillPreviewOverlaySegments"
        :move-preview-overlay-segments="centerMovePreviewOverlaySegments"
        :overlay-lanes="centerCustomOverlayLanes"
        :render-api="centerPaneRenderApi"
      />

      <DataGridTableStagePinnedPane
        :pane="rightPinnedPane"
        :render-api="pinnedPaneRenderApi"
        :handle-context-menu="onViewportContextMenu"
      >
        <template #chrome>
          <canvas ref="rightChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        </template>
      </DataGridTableStagePinnedPane>

      <DataGridTableStageFillActionMenu
        :is-open="fillActionMenuOpen"
        :style="floatingFillActionStyle"
        @toggle="toggleFloatingFillActionMenu"
        @selected="handleFillActionSelection"
      />
    </div>

    <div
      v-if="rows.pinnedBottomRows.length > 0"
      class="grid-body-shell grid-body-shell--pinned-bottom"
      :style="paneLayoutStyle"
      @mouseleave="clearHoveredRow"
    >
      <canvas
        ref="centerBottomChromeCanvasEl"
        class="grid-chrome-canvas grid-chrome-canvas--center-shell"
        :style="centerBottomChromeCanvasStyle"
        aria-hidden="true"
      />
      <DataGridTableStagePinnedPane
        :pane="leftPinnedBottomPane"
        :render-api="pinnedPaneRenderApi"
        :handle-context-menu="onViewportContextMenu"
      >
        <template #chrome>
          <canvas ref="leftBottomChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        </template>
      </DataGridTableStagePinnedPane>

      <DataGridTableStageCenterPane
        :display-rows="rows.pinnedBottomRows"
        :runtime-revision="rows.runtimeRevision"
        :body-rows-revision="rows.displayRowsRevision"
        viewport-class="grid-body-viewport grid-body-viewport--pinned-bottom"
        :viewport-ref="capturePinnedBottomViewportRef"
        :report-center-pane-diagnostics="props.reportCenterPaneDiagnostics"
        :report-fill-plumbing-state="props.reportFillPlumbingState"
        :report-fill-plumbing-detail="props.reportFillPlumbingDetail"
        :handle-scroll="handlePinnedBottomViewportScroll"
        :handle-wheel="handleBodyViewportWheel"
        :handle-keydown="handlePinnedBottomViewportKeydown"
        :handle-context-menu="onViewportContextMenu"
        :selection-overlay-segments="centerPinnedBottomSelectionOverlaySegments"
        :fill-preview-overlay-segments="centerPinnedBottomFillPreviewOverlaySegments"
        :move-preview-overlay-segments="centerPinnedBottomMovePreviewOverlaySegments"
        :overlay-lanes="centerPinnedBottomCustomOverlayLanes"
        :render-api="centerPaneRenderApi"
      />

      <DataGridTableStagePinnedPane
        :pane="rightPinnedBottomPane"
        :render-api="pinnedPaneRenderApi"
        :handle-context-menu="onViewportContextMenu"
      >
        <template #chrome>
          <canvas ref="rightBottomChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        </template>
      </DataGridTableStagePinnedPane>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type CSSProperties, type PropType } from "vue"
import { restoreDataGridFocus } from "@affino/datagrid-vue/app"
import DataGridTableStageHeader from "./DataGridTableStageHeader.vue"
import DataGridTableStageCenterPane from "./DataGridTableStageCenterPane.vue"
import DataGridTableStageFillActionMenu from "./DataGridTableStageFillActionMenu.vue"
import DataGridTableStagePinnedPane from "./DataGridTableStagePinnedPane.vue"
import type {
  DataGridTableStageBodyColumn as TableColumn,
  DataGridTableStageBodyRow as TableRow,
  DataGridTableStageCenterPaneRenderApi,
  DataGridTableStagePinnedPaneRenderApi,
} from "./dataGridTableStageBody.types"
import type {
  DataGridTableStageCustomOverlay,
  DataGridTableStageProps,
} from "./dataGridTableStage.types"
import {
  createDataGridTableStageContextFromProps,
  type DataGridTableStageContext,
  provideDataGridTableStageContext,
} from "./dataGridTableStageContext"
import type { DataGridStageOverlayGeometryContext } from "./dataGridStageOverlayGeometry"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"
import { isDataGridPlaceholderSurfaceRow } from "./useDataGridTableStagePlaceholderRows"
import { useDataGridPerfTrace } from "./useDataGridPerfTrace"
import { useDataGridStageCellRendering } from "./useDataGridStageCellRendering"
import { useDataGridStageCellState } from "./useDataGridStageCellState"
import { useDataGridStageFillAction } from "./useDataGridStageFillAction"
import { useDataGridStagePointerInteractions } from "./useDataGridStagePointerInteractions"
import { useDataGridStageRowIndex } from "./useDataGridStageRowIndex"
import {
  useDataGridStageViewportRuntime,
  type UseDataGridStageViewportRuntimeSyncers,
} from "./useDataGridStageViewportRuntime"
import { useDataGridStagePanes } from "./useDataGridStagePanes"
import { useDataGridStageChromeModel } from "./useDataGridStageChromeModel"
import { useDataGridStageChromeCanvas } from "./useDataGridStageChromeCanvas"
import { useDataGridStageOverlays } from "./useDataGridStageOverlays"

ensureDataGridAppStyles()

const props = defineProps({
  mode: {
    type: String as PropType<DataGridTableStageProps<Record<string, unknown>>["mode"]>,
    required: true,
  },
  rowHeightMode: {
    type: String as PropType<DataGridTableStageProps<Record<string, unknown>>["rowHeightMode"]>,
    required: true,
  },
  layoutMode: {
    type: String as PropType<DataGridTableStageProps<Record<string, unknown>>["layoutMode"]>,
    required: true,
  },
  chromeSignature: {
    type: String as PropType<DataGridTableStageProps<Record<string, unknown>>["chromeSignature"]>,
    default: "",
  },
  reportFillPlumbingState: {
    type: Function as PropType<DataGridTableStageProps<Record<string, unknown>>["reportFillPlumbingState"]>,
    default: undefined,
  },
  reportFillPlumbingDetail: {
    type: Function as PropType<DataGridTableStageProps<Record<string, unknown>>["reportFillPlumbingDetail"]>,
    default: undefined,
  },
  layout: {
    type: Object as PropType<DataGridTableStageProps<Record<string, unknown>>["layout"]>,
    required: true,
  },
  viewport: {
    type: Object as PropType<DataGridTableStageProps<Record<string, unknown>>["viewport"]>,
    required: true,
  },
  columns: {
    type: Object as PropType<DataGridTableStageProps<Record<string, unknown>>["columns"]>,
    required: true,
  },
  rows: {
    type: Object as PropType<DataGridTableStageProps<Record<string, unknown>>["rows"]>,
    required: true,
  },
  selection: {
    type: Object as PropType<DataGridTableStageProps<Record<string, unknown>>["selection"]>,
    required: true,
  },
  editing: {
    type: Object as PropType<DataGridTableStageProps<Record<string, unknown>>["editing"]>,
    required: true,
  },
  cells: {
    type: Object as PropType<DataGridTableStageProps<Record<string, unknown>>["cells"]>,
    required: true,
  },
  interaction: {
    type: Object as PropType<DataGridTableStageProps<Record<string, unknown>>["interaction"]>,
    required: true,
  },
  customOverlays: {
    type: Array as PropType<readonly DataGridTableStageCustomOverlay[]>,
    default: () => [],
  },
  reportCenterPaneDiagnostics: {
    type: Function as PropType<DataGridTableStageProps<Record<string, unknown>>["reportCenterPaneDiagnostics"]>,
    default: undefined,
  },
  onViewportContextMenu: {
    type: Function as PropType<(event: MouseEvent) => void>,
    default: undefined,
  },
  stageContext: {
    type: Object as PropType<DataGridTableStageContext<Record<string, unknown>>>,
    default: undefined,
  },
})

const stageContext = props.stageContext ?? createDataGridTableStageContextFromProps(
  props as DataGridTableStageProps<Record<string, unknown>>,
)

provideDataGridTableStageContext(stageContext)

const mode = stageContext.mode
const rowHeightMode = stageContext.rowHeightMode
const layoutMode = stageContext.layoutMode
const layout = stageContext.layout
const viewport = stageContext.viewport
const columns = stageContext.columns
const rows = stageContext.rows
const selection = stageContext.selection
const editing = stageContext.editing
const cells = stageContext.cells
const interaction = stageContext.interaction

const visibleColumns = computed(() => columns.value?.visibleColumns ?? [])
const renderedColumns = computed(() => columns.value?.renderedColumns ?? [])
const displayRows = computed(() => rows.value?.displayRows ?? [])
const pinnedBottomRows = computed(() => rows.value?.pinnedBottomRows ?? [])
const selectionRange = computed(() => selection.value?.selectionRange ?? null)
const selectionRanges = computed<readonly OverlayRange[]>(() => {
  const ranges = selection.value?.selectionRanges
  if (Array.isArray(ranges) && ranges.length > 0) {
    return ranges
  }
  return selectionRange.value ? [selectionRange.value] : []
})
const isFillDragging = computed(() => selection.value?.isFillDragging === true)
const hasExplicitGroupCellRenderer = computed(() => (
  visibleColumns.value.some(column => hasGroupCellRenderer(column))
))
function columnStyle(key: string): CSSProperties {
  return layout.value.columnStyle(key)
}

function handleCellMouseDown(event: MouseEvent, row: TableRow, rowOffset: number, columnIndex: number): void {
  interaction.value.handleCellMouseDown(event, row, rowOffset, columnIndex)
}

function handleCellKeydown(event: KeyboardEvent, row: TableRow, rowOffset: number, columnIndex: number): void {
  if (
    row.kind === "group"
    && !hasExplicitGroupCellRenderer.value
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && !event.shiftKey
    && (event.key === " " || event.key === "Spacebar")
  ) {
    event.preventDefault()
    event.stopPropagation()
    rows.value.toggleGroupRow(row)
    return
  }
  interaction.value.handleCellKeydown(event, row, rowOffset, columnIndex)
}

type OverlayRange = NonNullable<DataGridTableStageProps<Record<string, unknown>>["selection"]["selectionRange"]>
interface DataGridPivotHeaderMeta {
  groupLabels?: readonly string[]
}

function parsePixelValue(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveColumnWidth(column: TableColumn): number {
  const style = layout.value.columnStyle(column.key)
  return parsePixelValue(style.width ?? style.minWidth ?? column.width, column.width ?? 140)
}

function readPivotHeaderMeta(column: TableColumn): DataGridPivotHeaderMeta | null {
  const rawMeta = column.column.meta?.affinoPivotHeader
  if (!isRecord(rawMeta)) {
    return null
  }
  const groupLabels = Array.isArray(rawMeta.groupLabels)
    ? rawMeta.groupLabels.filter((value): value is string => typeof value === "string" && value.length > 0)
    : []
  return groupLabels.length > 0 ? { groupLabels } : null
}

function resolveTextAlign(value: unknown): CSSProperties["textAlign"] | undefined {
  return value === "left" || value === "center" || value === "right"
    ? value
    : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function hasGroupCellRenderer(column: TableColumn): boolean {
  const authoredColumn = column.column as typeof column.column & {
    groupCellRenderer?: unknown
  }
  return typeof authoredColumn.groupCellRenderer === "function"
}

function isColumnEditable(column: TableColumn): boolean {
  return column.column.capabilities?.editable !== false
}

function bodyCellPresentationStyle(column: TableColumn): CSSProperties {
  const textAlign = resolveTextAlign(column.column.presentation?.align)
  return textAlign ? { textAlign } : {}
}

function resolveInlineRowStateFill(
  row: TableRow,
  rowOffset: number,
  options: { fullBleed?: boolean } = {},
): CSSProperties | null {
  let overlayColor: string | null = null
  if (isHoveredRow(row, rowOffset)) {
    overlayColor = "var(--datagrid-row-band-hover-bg)"
  } else if (isStripedRow(row, rowOffset)) {
    overlayColor = "var(--datagrid-row-band-striped-bg)"
  }
  if (!overlayColor) {
    return null
  }
  if (options.fullBleed === true) {
    return {
      backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor})`,
      backgroundSize: "100% calc(100% - var(--datagrid-row-divider-size))",
      backgroundPosition: "top left",
      backgroundRepeat: "no-repeat",
    }
  }
  return {
    backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor})`,
    backgroundSize: "calc(100% - var(--datagrid-column-divider-size)) calc(100% - var(--datagrid-row-divider-size))",
    backgroundPosition: "top left",
    backgroundRepeat: "no-repeat",
  }
}

function bodyCellSelectionStyle(row: TableRow, column: TableColumn, rowOffset: number, columnIndex: number): CSSProperties {
  if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
    if (column.pin === "left") {
      return { background: "var(--datagrid-pinned-left-bg)" }
    }
    if (column.pin === "right") {
      return { background: "var(--datagrid-pinned-right-bg)" }
    }
    return { background: "var(--datagrid-row-background-color)" }
  }
  if (shouldHighlightSelectedCellVisual(rowOffset, columnIndex)) {
    return { background: "var(--datagrid-selection-range-bg)" }
  }
  const rowStateFill = resolveInlineRowStateFill(row, rowOffset, {
    fullBleed: column.pin === "left" || column.pin === "right",
  })
  if (rowStateFill) {
    return rowStateFill
  }
  return {}
}

function resolveCellCustomClass(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
) {
  return cells.value.cellClass?.(row, rowOffset, column, columnIndex) ?? null
}

function resolveCellCustomStyle(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): CSSProperties {
  return cells.value.cellStyle?.(row, rowOffset, column, columnIndex) ?? {}
}

function isSelectCellTriggerClick(event: MouseEvent, row: TableRow, column: TableColumn): boolean {
  if (row.kind === "group" || resolveCellEditorMode(row, column) !== "select") {
    return false
  }
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  if (!target) {
    return false
  }
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0) {
    return false
  }
  const offsetX = event.clientX - rect.left
  const triggerWidth = Math.min(24, Math.max(16, Math.floor(rect.width * 0.22)))
  return offsetX >= rect.width - triggerWidth
}

function isDateCellTriggerClick(event: MouseEvent, row: TableRow, column: TableColumn): boolean {
  const editorMode = row.kind === "group" ? "none" : resolveCellEditorMode(row, column)
  if (editorMode !== "date" && editorMode !== "datetime") {
    return false
  }
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  if (!target) {
    return false
  }
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0) {
    return false
  }
  const offsetX = event.clientX - rect.left
  const triggerWidth = Math.min(24, Math.max(16, Math.floor(rect.width * 0.22)))
  return offsetX >= rect.width - triggerWidth
}

function cellTabIndex(rowOffset: number, columnIndex: number): number {
  return isVisualSelectionAnchorCell(rowOffset, columnIndex) ? 0 : -1
}

function resolveViewportRowStart(): number {
  return viewport.value?.viewportRowStart ?? 0
}

function resolveViewportRowEnd(): number {
  const explicitEnd = viewport.value?.viewportRowEnd
  if (Number.isFinite(explicitEnd)) {
    return Math.max(resolveViewportRowStart(), Math.trunc(explicitEnd as number))
  }
  const actualCount = displayRows.value.length
  return actualCount > 0
    ? resolveViewportRowStart() + actualCount - 1
    : resolveViewportRowStart() - 1
}

function resolveLeftColumnSpacerWidth(): number {
  return viewport.value?.leftColumnSpacerWidth ?? 0
}

function resolveRightColumnSpacerWidth(): number {
  return viewport.value?.rightColumnSpacerWidth ?? 0
}

function isCellSelectedSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = cells.value.isCellSelected
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function resolveVisualSelectionAnchorCell(): { rowIndex: number; columnIndex: number } | null {
  if (
    selectionRange.value
    && selectionRange.value.startRow === selectionRange.value.endRow
    && selectionRange.value.startColumn === selectionRange.value.endColumn
  ) {
    return {
      rowIndex: selectionRange.value.startRow,
      columnIndex: selectionRange.value.startColumn,
    }
  }
  return selection.value.selectionAnchorCell ?? null
}

function isVisualSelectionAnchorCell(rowOffset: number, columnIndex: number): boolean {
  const anchorCell = resolveVisualSelectionAnchorCell()
  return Boolean(
    anchorCell
    && viewport.value.viewportRowStart + rowOffset === anchorCell.rowIndex
    && columnIndex === anchorCell.columnIndex,
  )
}

function shouldHighlightSelectedCellVisual(rowOffset: number, columnIndex: number): boolean {
  if (!isCellSelectedSafe(rowOffset, columnIndex)) {
    return false
  }
  if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
    return false
  }
  return !isSingleSelectedCell.value
}

function isSelectionAnchorCellSafe(rowOffset: number, columnIndex: number): boolean {
  if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
    return true
  }
  const evaluate = cells.value.isSelectionAnchorCell
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellInFillPreviewSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = cells.value.isCellInFillPreview
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellInPendingClipboardRangeSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = cells.value.isCellInPendingClipboardRange
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellOnPendingClipboardEdgeSafe(
  rowOffset: number,
  columnIndex: number,
  edge: "top" | "right" | "bottom" | "left",
): boolean {
  const evaluate = cells.value.isCellOnPendingClipboardEdge
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex, edge)
    : false
}

function isEditingCellSafe(row: TableRow, columnKey: string): boolean {
  const evaluate = editing.value.isEditingCell
  return typeof evaluate === "function"
    ? evaluate(row, columnKey)
    : false
}

function isCellEditableSafe(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): boolean {
  const evaluate = cells.value.isCellEditable
  return typeof evaluate === "function"
    ? evaluate(row, rowOffset, column, columnIndex)
    : isColumnEditable(column)
}

function isCellOnSelectionEdgeSafe(
  rowOffset: number,
  columnIndex: number,
  edge: "top" | "right" | "bottom" | "left",
): boolean {
  const evaluate = cells.value.isCellOnSelectionEdge
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex, edge)
    : false
}

function isFillHandleCellSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = selection.value.isFillHandleCell
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isVisibleCellEditableByAbsoluteCoord(rowIndex: number, columnIndex: number): boolean {
  const rowOffset = rowIndex - viewport.value.viewportRowStart
  const row = displayRows.value[rowOffset]
  const column = visibleColumns.value[columnIndex]
  if (rowOffset < 0 || !row || !column) {
    return false
  }
  return isCellEditableSafe(row, rowOffset, column, columnIndex)
}

const isRangeMoving = computed(() => selection.value.isRangeMoving)

const pinnedLeftColumns = computed(() => visibleColumns.value.filter(column => column.pin === "left"))
const pinnedRightColumns = computed(() => visibleColumns.value.filter(column => column.pin === "right"))

const stageRootEl = ref<HTMLElement | null>(null)
const bodyShellRef = ref<HTMLElement | null>(null)
const leftPaneContentRef = ref<HTMLElement | null>(null)
const rightPaneContentRef = ref<HTMLElement | null>(null)
const leftBottomPaneContentRef = ref<HTMLElement | null>(null)
const rightBottomPaneContentRef = ref<HTMLElement | null>(null)
const leftHeaderChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const centerHeaderChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const rightHeaderChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const leftChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const centerChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const rightChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const leftBottomChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const centerBottomChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const rightBottomChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const hoveredRowIndex = ref<number | null>(null)
let resolveGridChromeSyncers: () => UseDataGridStageViewportRuntimeSyncers = () => ({
  syncBodyViewportMetrics: () => {},
  syncPinnedBottomViewportMetrics: () => {},
  syncPinnedBottomViewportScrollLeft: () => {},
  scheduleGridChromeRedraw: () => {},
  flushGridChromeRedraw: () => {},
  connectGridChromeResizeObserver: () => {},
  disconnectGridChromeResizeObserver: () => {},
})

function clearHoveredRow(): void {
  hoveredRowIndex.value = null
}

function resolveAbsoluteRowIndex(row: TableRow, rowOffset: number): number {
  return Number.isFinite(row.displayIndex)
    ? Math.max(0, Math.trunc(row.displayIndex))
    : viewport.value.viewportRowStart + rowOffset
}

function resolveViewportRowOffset(row: TableRow, rowOffset: number): number {
  return resolveAbsoluteRowIndex(row, rowOffset) - viewport.value.viewportRowStart
}

function setHoveredRow(row: TableRow, rowOffset: number): void {
  if (!rows.value.rowHover) {
    return
  }
  hoveredRowIndex.value = resolveAbsoluteRowIndex(row, rowOffset)
}

function isHoveredRow(row: TableRow, rowOffset: number): boolean {
  return rows.value.rowHover === true && hoveredRowIndex.value === resolveAbsoluteRowIndex(row, rowOffset)
}

function isStripedRow(row: TableRow, rowOffset: number): boolean {
  return rows.value.stripedRows === true && resolveAbsoluteRowIndex(row, rowOffset) % 2 === 1
}

function isRowFocusedSafe(row: TableRow): boolean {
  return typeof rows.value.isRowFocused === "function" ? rows.value.isRowFocused(row) : false
}

function isRowCheckboxSelectedSafe(row: TableRow): boolean {
  return typeof rows.value.isRowCheckboxSelected === "function" ? rows.value.isRowCheckboxSelected(row) : false
}

function handleRowContainerClick(row: TableRow): void {
  handleRowClickSafe(row)
}

function rowStateClasses(row: TableRow, rowOffset: number): Record<string, boolean> {
  return {
    "grid-row--hoverable": rows.value.rowHover === true,
    "grid-row--hovered": isHoveredRow(row, rowOffset),
    "grid-row--striped": isStripedRow(row, rowOffset),
    "grid-row--group-explicit-trigger": row.kind === "group" && hasExplicitGroupCellRenderer.value,
    "grid-row--clipboard-pending": rows.value.isRowInPendingClipboardCut?.(row) === true,
    "grid-row--focused": isRowFocusedSafe(row),
    "grid-row--checkbox-selected": isRowCheckboxSelectedSafe(row),
  }
}

function handleGroupCellClick(row: TableRow): void {
  if (row.kind !== "group") {
    return
  }
  if (hasExplicitGroupCellRenderer.value) {
    return
  }
  rows.value.toggleGroupRow(row)
}

function handleBodyCellClick(
  event: MouseEvent,
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): void {
  if (isRowSelectionColumn(column)) {
    if (row.kind === "group") {
      return
    }
    interaction.value.handleCellClick(row, rowOffset, column, columnIndex)
    return
  }
  handleGroupCellClick(row)
  if (row.kind === "group") {
    return
  }
  if (!isEditingCellSafe(row, column.key) && (isSelectCellTriggerClick(event, row, column) || isDateCellTriggerClick(event, row, column))) {
    startInlineEditIfAllowed(row, column, rowOffset)
    return
  }
  interaction.value.handleCellClick(row, rowOffset, column, columnIndex)
}

function resolveVisibleAnchorCellPosition(): { rowIndex: number; columnIndex: number } | null {
  for (let rowOffset = 0; rowOffset < displayRows.value.length; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < visibleColumns.value.length; columnIndex += 1) {
      if (!isSelectionAnchorCellSafe(rowOffset, columnIndex)) {
        continue
      }
      return {
        rowIndex: resolveAbsoluteRowIndex(displayRows.value[rowOffset] as TableRow, rowOffset),
        columnIndex,
      }
    }
  }
  return null
}

function resolveVisibleCellElement(rowIndex: number, columnIndex: number): HTMLElement | null {
  const selector = `.grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
  for (const root of [
    leftPaneContentRef.value,
    bodyViewportEl.value,
    rightPaneContentRef.value,
    leftBottomPaneContentRef.value,
    bottomViewportEl.value,
    rightBottomPaneContentRef.value,
  ]) {
    const match = root?.querySelector<HTMLElement>(selector)
    if (match) {
      return match
    }
  }
  return null
}

function resolveVisibleRowElement(rowIndex: number): HTMLElement | null {
  const selector = `.grid-cell[data-row-index="${rowIndex}"]`
  for (const root of [
    leftPaneContentRef.value,
    bodyViewportEl.value,
    rightPaneContentRef.value,
    leftBottomPaneContentRef.value,
    bottomViewportEl.value,
    rightBottomPaneContentRef.value,
  ]) {
    const match = root?.querySelector<HTMLElement>(selector)
    if (match) {
      return match
    }
  }
  return null
}

function resolveRelativeCellRect(cell: { rowIndex: number; columnIndex: number } | null): {
  left: number
  right: number
  top: number
  bottom: number
} | null {
  if (!cell) {
    return null
  }
  const cellElement = resolveVisibleCellElement(cell.rowIndex, cell.columnIndex)
  const shellRect = bodyShellRef.value?.getBoundingClientRect()
  if (!cellElement || !shellRect) {
    return null
  }
  const cellRect = cellElement.getBoundingClientRect()
  return {
    left: cellRect.left - shellRect.left,
    right: cellRect.right - shellRect.left,
    top: cellRect.top - shellRect.top,
    bottom: cellRect.bottom - shellRect.top,
  }
}

function focusVisibleAnchorCell(): void {
  const anchorCell = resolveVisibleAnchorCellPosition()
  if (!anchorCell) {
    bodyViewportEl.value?.focus({ preventScroll: true })
    return
  }
  const cellElement = resolveVisibleCellElement(anchorCell.rowIndex, anchorCell.columnIndex)
  if (cellElement) {
    cellElement.focus({ preventScroll: true })
    return
  }
  bodyViewportEl.value?.focus({ preventScroll: true })
}

function restoreAnchorCellFocus(): void {
  void restoreDataGridFocus(focusVisibleAnchorCell)
}

const rowIndexState = useDataGridStageRowIndex({
  rows,
  layout,
  viewportRowStart: computed(() => viewport.value.viewportRowStart),
  selectionRange,
  visibleColumns,
  isHoveredRow,
  isStripedRow,
  resolveAbsoluteRowIndex,
  resolveInlineRowStateFill,
  isDataGridPlaceholderSurfaceRow,
})

const leftPaneWidth = computed(() => {
  return rowIndexState.indexColumnWidthPx.value + (pinnedLeftColumns.value ?? []).reduce((sum, column) => sum + resolveColumnWidth(column), 0)
})

const rightPaneWidth = computed(() => {
  return (pinnedRightColumns.value ?? []).reduce((sum, column) => sum + resolveColumnWidth(column), 0)
})

const {
  bodyViewportEl,
  bottomViewportEl,
  bodyViewportScrollTop,
  bodyViewportScrollLeft,
  bodyViewportClientWidth,
  bodyViewportClientHeight,
  pinnedBottomViewportClientHeight,
  bodyViewportTopOffset,
  headerShellHeight,
  headerViewportClientWidth,
  captureBodyViewportRef,
  capturePinnedBottomViewportRef,
  handleCenterViewportScroll,
  handlePinnedBottomViewportScroll,
  handleLinkedViewportWheel,
  handleBodyViewportWheel,
} = useDataGridStageViewportRuntime({
  stageRootEl,
  viewport,
  leftPaneContentRef,
  rightPaneContentRef,
  resolveGridChromeSyncers: () => resolveGridChromeSyncers(),
})

useDataGridPerfTrace({
  viewport,
  displayRows,
  bodyViewportScrollTop,
})

const {
  chromeRenderModel,
  headerChromeRenderModel,
  pinnedBottomChromeRenderModel,
  hasPivotHeaderGroups,
  rowMetrics,
  pinnedBottomRowMetrics,
  chromeColumnsRevision,
  chromeRowsRevision,
  resolveVisibleRowMetricsFromDom,
} = useDataGridStageChromeModel({
  mode,
  rowHeightMode,
  layout,
  viewport,
  rows,
  visibleColumns,
  renderedColumns,
  displayRows,
  pinnedBottomRows,
  selectionTotalRowCount: computed(() => selection.value?.totalRowCount ?? null),
  leftPaneWidth,
  rightPaneWidth,
  bodyViewportScrollTop,
  bodyViewportScrollLeft,
  bodyViewportClientWidth,
  bodyViewportClientHeight,
  pinnedBottomViewportClientHeight,
  headerShellHeight,
  headerViewportClientWidth,
  bodyViewportEl,
  indexColumnWidthPx: rowIndexState.indexColumnWidthPx,
  pinnedLeftColumns,
  pinnedRightColumns,
  resolveColumnWidth,
  resolveLeftColumnSpacerWidth,
  resolveRightColumnSpacerWidth,
  resolveAbsoluteRowIndex,
  resolveViewportRowOffset,
  isHoveredRow,
  isStripedRow,
  readPivotHeaderMeta,
})

const {
  showRowIndex,
  indexColumnWidthPx,
  resolvedRowIndexColumnStyle,
  rowIndexCellClasses,
  rowIndexCellStyle,
  rowIndexTabIndex,
  isFullRowSelectionSafe,
  isRowIndexDraggable,
  handleRowClickSafe,
  handleRowIndexClickSafe,
  handleRowIndexKeydownSafe,
  handleRowIndexDragStart,
  handleRowIndexDragOver,
  handleRowIndexDrop,
  clearRowIndexDragState,
} = rowIndexState

const {
  startInlineEditIfAllowed,
  resolveCellEditorMode,
  resolveSelectEditorOptions,
  resolveSelectEditorOptionsLoader,
  handleSelectEditorOptionsResolved,
  readResolvedDisplayCell,
  renderResolvedCellContent,
  resolveSelectEditorValue,
  isSelectEditorCell,
  isDateEditorCell,
  resolveDateEditorInputType,
  isTextEditorCell,
  handleSelectEditorCommit,
  handleSelectEditorCancel,
  handleDateEditorChange,
  handleTextEditorBlur,
  updateEditingCellValue,
  handleEditorKeydown,
} = useDataGridStageCellRendering({
  mode,
  visibleColumns,
  rows,
  cells,
  editing,
  isCellEditableSafe,
  isEditingCellSafe,
  columnIndexByKey,
})

let isRangeMoveHandleHoverCellImpl = (_rowOffset: number, _columnIndex: number) => false

function isRangeMoveHandleHoverCellSafe(rowOffset: number, columnIndex: number): boolean {
  return isRangeMoveHandleHoverCellImpl(rowOffset, columnIndex)
}

const {
  builtInCellClasses,
  cellStateClasses,
  cellAriaRole,
  cellAriaChecked,
  cellAriaPressed,
  cellAriaLabel,
  cellAriaDisabled,
  isRowSelectionColumn,
  shouldRenderCheckboxCell,
  checkboxIndicatorClass,
  checkboxIndicatorMarkClass,
} = useDataGridStageCellState({
  visibleColumns,
  cells: computed(() => ({
    readCell: cells.value.readCell,
  })),
  isCellEditableSafe,
  isEditingCellSafe,
  resolveCellEditorMode,
  isVisualSelectionAnchorCell,
  shouldHighlightSelectedCellVisual,
  isRangeMoveHandleHoverCell: isRangeMoveHandleHoverCellSafe,
  isCellInFillPreviewSafe,
  isCellInPendingClipboardRangeSafe,
  isCellOnPendingClipboardEdgeSafe,
})

const {
  syncBodyViewportMetrics,
  syncPinnedBottomViewportMetrics,
  syncPinnedBottomViewportScrollLeft,
  scheduleGridChromeRedraw,
  flushGridChromeRedraw,
  connectGridChromeResizeObserver,
  disconnectGridChromeResizeObserver,
} = useDataGridStageChromeCanvas({
  stageRootEl,
  bodyShellRef,
  bodyViewportEl,
  bottomViewportEl,
  leftHeaderChromeCanvasEl,
  centerHeaderChromeCanvasEl,
  rightHeaderChromeCanvasEl,
  leftChromeCanvasEl,
  centerChromeCanvasEl,
  rightChromeCanvasEl,
  leftBottomChromeCanvasEl,
  centerBottomChromeCanvasEl,
  rightBottomChromeCanvasEl,
  bodyViewportScrollTop,
  bodyViewportScrollLeft,
  bodyViewportClientWidth,
  bodyViewportClientHeight,
  pinnedBottomViewportClientHeight,
  bodyViewportTopOffset,
  headerShellHeight,
  headerViewportClientWidth,
  chromeRenderModel,
  headerChromeRenderModel,
  pinnedBottomChromeRenderModel,
  hasPivotHeaderGroups,
})

resolveGridChromeSyncers = () => ({
  syncBodyViewportMetrics,
  syncPinnedBottomViewportMetrics,
  syncPinnedBottomViewportScrollLeft,
  scheduleGridChromeRedraw,
  flushGridChromeRedraw,
  connectGridChromeResizeObserver,
  disconnectGridChromeResizeObserver,
})

watch(
  chromeColumnsRevision,
  () => {
    syncBodyViewportMetrics()
    scheduleGridChromeRedraw()
  },
)

watch(
  () => props.chromeSignature,
  () => {
    void nextTick(() => {
      syncBodyViewportMetrics()
      scheduleGridChromeRedraw()
    })
  },
)

watch(
  chromeRowsRevision,
  () => {
    // Auto-height row metrics can shift during scroll; redraw chrome, but avoid
    // re-reading shell/header layout metrics that belong to resize/column sync.
    scheduleGridChromeRedraw()
  },
)

const effectiveBodyViewportWidth = computed(() => {
  return bodyViewportClientWidth.value > 0
    ? bodyViewportClientWidth.value
    : parsePixelValue(layout.value.gridContentStyle.width ?? layout.value.gridContentStyle.minWidth, 0)
})

const {
  fillActionMenuOpen,
  floatingFillActionStyle,
  toggleFloatingFillActionMenu,
  handleFillActionSelection,
} = useDataGridStageFillAction({
  selection,
  selectionRange,
  visibleColumns,
  renderedColumns,
  displayRows,
  bodyViewportEl,
  bodyShellRef,
  bodyViewportClientHeight,
  bodyViewportTopOffset,
  bodyViewportScrollLeft,
  leftPaneWidth,
  rightPaneWidth,
  effectiveBodyViewportWidth,
  indexColumnWidthPx,
  pinnedLeftColumns,
  pinnedRightColumns,
  resolveColumnWidth,
  resolveViewportRowStart,
  resolveVisibleCellElement,
  resolveVisibleRowElement,
  resolveRelativeCellRect,
  isVisibleCellEditableByAbsoluteCoord,
  restoreAnchorCellFocus,
})

const {
  clearRangeMoveHandleHover,
  isRangeMoveHandleHoverCell: isRangeMoveHandleHoverCellFromPointer,
  handleCellMouseMove,
  handleFillHandleMouseDown,
  handleFillHandleDoubleClick,
} = useDataGridStagePointerInteractions({
  mode,
  selection,
  selectionRange,
  visibleColumns,
  displayRows,
  viewportRowStart: computed(() => viewport.value.viewportRowStart),
  fillActionMenuOpen,
  isCellSelectedSafe,
  isCellEditableSafe,
  isCellOnSelectionEdgeSafe,
})

isRangeMoveHandleHoverCellImpl = isRangeMoveHandleHoverCellFromPointer

function handlePinnedBottomViewportKeydown(event: KeyboardEvent): void {
  viewport.value.handleViewportKeydown(event)
}

const overlayGeometryContext = computed<DataGridStageOverlayGeometryContext>(() => ({
  bodyViewportClientHeight: bodyViewportClientHeight.value,
  indexColumnWidthPx: indexColumnWidthPx.value,
  leftPaneWidth: leftPaneWidth.value,
  rightPaneWidth: rightPaneWidth.value,
  renderedColumns: renderedColumns.value,
  pinnedLeftColumns: pinnedLeftColumns.value,
  pinnedRightColumns: pinnedRightColumns.value,
  layoutGridContentWidth: parsePixelValue(layout.value.gridContentStyle.width ?? layout.value.gridContentStyle.minWidth, 0),
  columnIndexByKey,
  resolveColumnWidth,
  resolveLeftColumnSpacerWidth,
}))

const visibleColumnIndexByKey = computed(() => {
  const indexByKey = new Map<string, number>()
  visibleColumns.value.forEach((column, index) => {
    indexByKey.set(column.key, index)
  })
  return indexByKey
})

const isSingleSelectedCell = computed(() => {
  const ranges = selectionRanges.value
  if (ranges.length !== 1) {
    return false
  }
  const range = ranges[0]
  if (!range) {
    return false
  }
  return range.startRow === range.endRow
    && range.startColumn === range.endColumn
})

function columnIndexByKey(columnKey: string): number {
  return visibleColumnIndexByKey.value.get(columnKey) ?? 0
}

function paneRowStyle(row: TableRow, rowOffset: number, paneWidth: number): CSSProperties {
  return {
    ...rows.value.rowStyle(row, resolveViewportRowOffset(row, rowOffset)),
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

function resolveVisibleRangeBoundsForRows(
  range: OverlayRange | null,
  laneRows: readonly TableRow[],
) {
  if (!range || laneRows.length === 0 || visibleColumns.value.length === 0) {
    return null
  }

  const visibleColumnStart = 0
  const visibleColumnEnd = visibleColumns.value.length - 1
  const startColumnIndex = Math.max(range.startColumn, visibleColumnStart)
  const endColumnIndex = Math.min(range.endColumn, visibleColumnEnd)

  if (startColumnIndex > endColumnIndex) {
    return null
  }

  let startRowOffset: number | null = null
  let endRowOffset: number | null = null

  laneRows.forEach((row, rowOffset) => {
    const absoluteRowIndex = resolveAbsoluteRowIndex(row, rowOffset)
    if (absoluteRowIndex < range.startRow || absoluteRowIndex > range.endRow) {
      return
    }
    if (startRowOffset == null) {
      startRowOffset = rowOffset
    }
    endRowOffset = rowOffset
  })

  if (startRowOffset == null || endRowOffset == null) {
    return null
  }

  return {
    startRowOffset,
    endRowOffset,
    startColumnIndex,
    endColumnIndex,
  }
}

function resolveVisibleRangeBounds(range: OverlayRange | null) {
  if (!range || visibleColumns.value.length === 0) {
    return null
  }

  const visibleColumnStart = 0
  const visibleColumnEnd = visibleColumns.value.length - 1
  const startColumnIndex = Math.max(range.startColumn, visibleColumnStart)
  const endColumnIndex = Math.min(range.endColumn, visibleColumnEnd)

  if (startColumnIndex > endColumnIndex) {
    return null
  }

  const visibleRowStart = resolveViewportRowStart()
  const visibleRowEnd = resolveViewportRowEnd()
  const startRowIndex = Math.max(range.startRow, visibleRowStart)
  const endRowIndex = Math.min(range.endRow, visibleRowEnd)

  if (startRowIndex > endRowIndex) {
    return null
  }

  return {
    startRowOffset: startRowIndex - visibleRowStart,
    endRowOffset: endRowIndex - visibleRowStart,
    startColumnIndex,
    endColumnIndex,
  }
}

function resolvePinnedBottomVisibleRangeBounds(range: OverlayRange | null) {
  return resolveVisibleRangeBoundsForRows(range, pinnedBottomRows.value)
}

const customOverlays = computed(() => props.customOverlays ?? [])
const {
  leftSelectionOverlaySegments,
  leftSelectionSeamOverlaySegments,
  centerSelectionOverlaySegments,
  rightSelectionOverlaySegments,
  rightSelectionSeamOverlaySegments,
  leftPinnedBottomSelectionOverlaySegments,
  leftPinnedBottomSelectionSeamOverlaySegments,
  centerPinnedBottomSelectionOverlaySegments,
  rightPinnedBottomSelectionOverlaySegments,
  rightPinnedBottomSelectionSeamOverlaySegments,
  leftFillPreviewOverlaySegments,
  leftFillPreviewSeamOverlaySegments,
  centerFillPreviewOverlaySegments,
  rightFillPreviewOverlaySegments,
  rightFillPreviewSeamOverlaySegments,
  leftPinnedBottomFillPreviewOverlaySegments,
  leftPinnedBottomFillPreviewSeamOverlaySegments,
  centerPinnedBottomFillPreviewOverlaySegments,
  rightPinnedBottomFillPreviewOverlaySegments,
  rightPinnedBottomFillPreviewSeamOverlaySegments,
  leftMovePreviewOverlaySegments,
  leftMovePreviewSeamOverlaySegments,
  centerMovePreviewOverlaySegments,
  rightMovePreviewOverlaySegments,
  rightMovePreviewSeamOverlaySegments,
  leftPinnedBottomMovePreviewOverlaySegments,
  leftPinnedBottomMovePreviewSeamOverlaySegments,
  centerPinnedBottomMovePreviewOverlaySegments,
  rightPinnedBottomMovePreviewOverlaySegments,
  rightPinnedBottomMovePreviewSeamOverlaySegments,
  leftCustomOverlayLanes,
  centerCustomOverlayLanes,
  rightCustomOverlayLanes,
  leftCustomSeamOverlayLanes,
  rightCustomSeamOverlayLanes,
  leftPinnedBottomCustomOverlayLanes,
  centerPinnedBottomCustomOverlayLanes,
  rightPinnedBottomCustomOverlayLanes,
  leftPinnedBottomCustomSeamOverlayLanes,
  rightPinnedBottomCustomSeamOverlayLanes,
} = useDataGridStageOverlays({
  overlayGeometryContext,
  bodyViewportClientHeight,
  bottomViewportClientHeight: pinnedBottomViewportClientHeight,
  visibleColumns,
  displayRows,
  selectionRanges,
  selectionRange,
  fillPreviewRange: computed(() => selection.value?.fillPreviewRange ?? null),
  rangeMovePreviewRange: computed(() => selection.value?.rangeMovePreviewRange ?? null),
  rowMetrics,
  pinnedBottomRowMetrics,
  isCellSelectedSafe,
  isCellInFillPreviewSafe,
  isSingleSelectedCell,
  isFillDragging,
  isRangeMoving,
  resolveVisibleRangeBounds,
  resolvePinnedBottomVisibleRangeBounds,
  customOverlays,
})

const {
  paneLayoutStyle,
  leftPaneStyle,
  rightPaneStyle,
  leftTrackStyle,
  rightTrackStyle,
  centerHeaderChromeCanvasStyle,
  centerChromeCanvasStyle,
  centerBottomChromeCanvasStyle,
  leftPinnedPane,
  rightPinnedPane,
  leftPinnedBottomPane,
  rightPinnedBottomPane,
} = useDataGridStagePanes({
  leftPaneWidth,
  rightPaneWidth,
  leftPaneContentRef,
  rightPaneContentRef,
  leftBottomPaneContentRef,
  rightBottomPaneContentRef,
  displayRows,
  pinnedBottomRows,
  showRowIndex: rowIndexState.showRowIndex,
  pinnedLeftColumns,
  pinnedRightColumns,
  leftSelectionOverlaySegments,
  leftSelectionSeamOverlaySegments,
  centerSelectionOverlaySegments,
  rightSelectionOverlaySegments,
  rightSelectionSeamOverlaySegments,
  leftPinnedBottomSelectionOverlaySegments,
  leftPinnedBottomSelectionSeamOverlaySegments,
  centerPinnedBottomSelectionOverlaySegments,
  rightPinnedBottomSelectionOverlaySegments,
  rightPinnedBottomSelectionSeamOverlaySegments,
  leftFillPreviewOverlaySegments,
  leftFillPreviewSeamOverlaySegments,
  centerFillPreviewOverlaySegments,
  rightFillPreviewOverlaySegments,
  rightFillPreviewSeamOverlaySegments,
  leftPinnedBottomFillPreviewOverlaySegments,
  leftPinnedBottomFillPreviewSeamOverlaySegments,
  centerPinnedBottomFillPreviewOverlaySegments,
  rightPinnedBottomFillPreviewOverlaySegments,
  rightPinnedBottomFillPreviewSeamOverlaySegments,
  leftMovePreviewOverlaySegments,
  leftMovePreviewSeamOverlaySegments,
  centerMovePreviewOverlaySegments,
  rightMovePreviewOverlaySegments,
  rightMovePreviewSeamOverlaySegments,
  leftPinnedBottomMovePreviewOverlaySegments,
  leftPinnedBottomMovePreviewSeamOverlaySegments,
  centerPinnedBottomMovePreviewOverlaySegments,
  rightPinnedBottomMovePreviewOverlaySegments,
  rightPinnedBottomMovePreviewSeamOverlaySegments,
  leftCustomOverlayLanes,
  centerCustomOverlayLanes,
  rightCustomOverlayLanes,
  leftCustomSeamOverlayLanes,
  rightCustomSeamOverlayLanes,
  leftPinnedBottomCustomOverlayLanes,
  centerPinnedBottomCustomOverlayLanes,
  rightPinnedBottomCustomOverlayLanes,
  leftPinnedBottomCustomSeamOverlayLanes,
  rightPinnedBottomCustomSeamOverlayLanes,
  bodyViewportClientWidth,
  bodyViewportClientHeight,
  pinnedBottomViewportClientHeight,
  headerShellHeight,
  headerViewportClientWidth,
})

const pinnedPaneRenderApi: DataGridTableStagePinnedPaneRenderApi = {
  handleLinkedViewportWheel,
  absoluteRowIndex: resolveAbsoluteRowIndex,
  viewportRowOffset: resolveViewportRowOffset,
  rowStateClasses,
  paneRowStyle,
  handleRowContainerClick,
  setHoveredRow,
  isFullRowSelectionSafe,
  get rowIndexColumnStyle() {
    return resolvedRowIndexColumnStyle.value
  },
  rowIndexCellClasses,
  rowIndexCellStyle,
  rowIndexTabIndex,
  isRowIndexDraggable,
  handleRowIndexClickSafe,
  handleRowIndexKeydown: handleRowIndexKeydownSafe,
  handleRowIndexDragStart,
  handleRowIndexDragOver,
  handleRowIndexDrop,
  handleRowIndexDragEnd: clearRowIndexDragState,
  builtInCellClasses,
  cellStateClasses,
  resolveCellCustomClass,
  columnStyle,
  bodyCellPresentationStyle,
  bodyCellSelectionStyle,
  resolveCellCustomStyle,
  columnIndexByKey,
  cellTabIndex,
  cellAriaRole,
  cellAriaChecked,
  cellAriaPressed,
  cellAriaLabel,
  cellAriaDisabled,
  handleCellMouseDown,
  handleBodyCellClick,
  handleCellMouseMove,
  clearRangeMoveHandleHover,
  handleCellKeydown,
  startInlineEditIfAllowed,
  isCellEditableSafe,
  isFillHandleCellSafe,
  isEditingCellSafe,
  handleFillHandleMouseDown,
  handleFillHandleDoubleClick,
  isSelectEditorCell,
  resolveSelectEditorValue,
  resolveSelectEditorOptions,
  resolveSelectEditorOptionsLoader,
  handleSelectEditorCommit,
  handleSelectEditorCancel,
  handleSelectEditorOptionsResolved,
  isDateEditorCell,
  resolveDateEditorInputType,
  handleDateEditorChange,
  isTextEditorCell,
  updateEditingCellValue,
  handleEditorKeydown,
  handleTextEditorBlur,
  shouldRenderCheckboxCell,
  checkboxIndicatorClass,
  checkboxIndicatorMarkClass,
  readResolvedDisplayCell,
  renderResolvedCellContent,
}

const centerPaneRenderApi: DataGridTableStageCenterPaneRenderApi = {
  handleCenterViewportScroll,
  handleBodyViewportWheel,
  absoluteRowIndex: resolveAbsoluteRowIndex,
  viewportRowOffset: resolveViewportRowOffset,
  handleViewportKeydown(event) {
    viewport.value.handleViewportKeydown(event)
  },
  rowStateClasses,
  handleRowContainerClick,
  setHoveredRow,
  spacerStyle,
  builtInCellClasses,
  cellStateClasses,
  resolveCellCustomClass,
  columnStyle,
  bodyCellPresentationStyle,
  bodyCellSelectionStyle,
  resolveCellCustomStyle,
  columnIndexByKey,
  cellTabIndex,
  cellAriaRole,
  cellAriaChecked,
  cellAriaPressed,
  cellAriaLabel,
  cellAriaDisabled,
  handleCellMouseDown,
  handleBodyCellClick,
  handleCellMouseMove,
  clearRangeMoveHandleHover,
  handleCellKeydown,
  startInlineEditIfAllowed,
  isCellEditableSafe,
  isFillHandleCellSafe,
  isEditingCellSafe,
  handleFillHandleMouseDown,
  handleFillHandleDoubleClick,
  isSelectEditorCell,
  resolveSelectEditorValue,
  resolveSelectEditorOptions,
  resolveSelectEditorOptionsLoader,
  handleSelectEditorCommit,
  handleSelectEditorCancel,
  handleSelectEditorOptionsResolved,
  isDateEditorCell,
  resolveDateEditorInputType,
  handleDateEditorChange,
  isTextEditorCell,
  updateEditingCellValue,
  handleEditorKeydown,
  handleTextEditorBlur,
  shouldRenderCheckboxCell,
  checkboxIndicatorClass,
  checkboxIndicatorMarkClass,
  readResolvedDisplayCell,
  renderResolvedCellContent,
}

defineExpose({
  getStageRootElement: () => stageRootEl.value,
  getHeaderElement: () => stageRootEl.value?.querySelector<HTMLElement>(".grid-header-shell") ?? null,
  getBodyViewportElement: () => bodyViewportEl.value,
  getVisibleRowMetrics: () => resolveVisibleRowMetricsFromDom(rowMetrics.value),
})
</script>
