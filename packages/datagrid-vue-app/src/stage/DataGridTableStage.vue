<template>
  <section
    ref="stageRootEl"
    class="grid-stage"
    :class="{
      'grid-stage--canvas-chrome': true,
      'grid-stage--auto-row-height': mode === 'base' && rowHeightMode === 'auto',
      'grid-stage--fill-dragging': isFillDragging,
      'grid-stage--range-moving': isRangeMoving,
      'grid-stage--single-cell-selection': isSingleSelectedCell,
    }"
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

    <div ref="bodyShellRef" class="grid-body-shell" :style="paneLayoutStyle" @mouseleave="clearHoveredRow">
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
        :top-spacer-height="viewport.topSpacerHeight"
        :bottom-spacer-height="viewport.bottomSpacerHeight"
        :viewport-ref="captureBodyViewportRef"
        :handle-context-menu="onViewportContextMenu"
        :selection-overlay-segments="centerSelectionOverlaySegments"
        :fill-preview-overlay-segments="centerFillPreviewOverlaySegments"
        :move-preview-overlay-segments="centerMovePreviewOverlaySegments"
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
        viewport-class="grid-body-viewport grid-body-viewport--pinned-bottom"
        :viewport-ref="capturePinnedBottomViewportRef"
        :handle-scroll="handlePinnedBottomViewportScroll"
        :handle-wheel="handleBodyViewportWheel"
        :handle-keydown="handlePinnedBottomViewportKeydown"
        :handle-context-menu="onViewportContextMenu"
        :selection-overlay-segments="centerPinnedBottomSelectionOverlaySegments"
        :fill-preview-overlay-segments="centerPinnedBottomFillPreviewOverlaySegments"
        :move-preview-overlay-segments="centerPinnedBottomMovePreviewOverlaySegments"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance, type CSSProperties, type PropType } from "vue"
import { buildDataGridCellRenderModel } from "@affino/datagrid-vue"
import {
  useDataGridLinkedPaneScrollSync,
  useDataGridManagedWheelScroll,
} from "@affino/datagrid-vue/advanced"
import {
  buildDataGridChromeRenderModel,
  type DataGridChromePaneModel,
  type DataGridChromeRowBand,
} from "@affino/datagrid-chrome"
import DataGridTableStageHeader from "./DataGridTableStageHeader.vue"
import DataGridTableStageCenterPane from "./DataGridTableStageCenterPane.vue"
import DataGridTableStageFillActionMenu from "./DataGridTableStageFillActionMenu.vue"
import DataGridTableStagePinnedPane from "./DataGridTableStagePinnedPane.vue"
import type {
  DataGridTableStageBodyColumn as TableColumn,
  DataGridTableStageBodyRow as TableRow,
  DataGridTableStageCenterPaneRenderApi,
  DataGridTableStageOverlaySegment as OverlaySegment,
  DataGridTableStagePinnedPaneProps,
  DataGridTableStagePinnedPaneRenderApi,
  DataGridTableStageSelectEditorOption as SelectEditorOption,
  DataGridTableStageSelectEditorOptionsLoader as SelectEditorOptionsLoader,
} from "./dataGridTableStageBody.types"
import type {
  DataGridTableStageProps,
} from "./dataGridTableStage.types"
import {
  createDataGridTableStageContextFromProps,
  type DataGridTableStageContext,
  provideDataGridTableStageContext,
} from "./dataGridTableStageContext"
import type { DataGridFilterableComboboxOption } from "../overlays/dataGridFilterableCombobox"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"

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
const isFillDragging = computed(() => selection.value?.isFillDragging === true)
function columnStyle(key: string): CSSProperties {
  return layout.value.columnStyle(key)
}

function updateEditingCellValue(value: string): void {
  editing.value.updateEditingCellValue(value)
}

function handleEditorKeydown(event: KeyboardEvent): void {
  editing.value.handleEditorKeydown(event)
}

function handleCellMouseDown(event: MouseEvent, row: TableRow, rowOffset: number, columnIndex: number): void {
  interaction.value.handleCellMouseDown(event, row, rowOffset, columnIndex)
}

function handleCellKeydown(event: KeyboardEvent, row: TableRow, rowOffset: number, columnIndex: number): void {
  interaction.value.handleCellKeydown(event, row, rowOffset, columnIndex)
}

type OverlayRange = NonNullable<DataGridTableStageProps<Record<string, unknown>>["selection"]["selectionRange"]>
interface DataGridPivotHeaderMeta {
  groupLabels?: readonly string[]
}

const RANGE_MOVE_HANDLE_HOVER_EDGE_PX = 6
const FILL_ACTION_ROOT_SELECTOR = ".grid-fill-action"
const FILL_ACTION_TRIGGER_SIZE_PX = 14
const FILL_ACTION_VIEWPORT_MARGIN_PX = 8
const FILL_ACTION_HANDLE_CLEARANCE_PX = 10

const asyncSelectOptionCache = ref(new Map<string, readonly SelectEditorOption[]>())

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

function isPromiseLike<TValue>(value: unknown): value is PromiseLike<TValue> {
  return typeof value === "object"
    && value !== null
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function"
}

function isColumnEditable(column: TableColumn): boolean {
  return column.column.capabilities?.editable !== false
}

function bodyCellPresentationStyle(column: TableColumn): CSSProperties {
  const textAlign = resolveTextAlign(column.column.presentation?.align)
  return textAlign ? { textAlign } : {}
}

function resolveInlineRowStateFill(row: TableRow, rowOffset: number): CSSProperties | null {
  let overlayColor: string | null = null
  if (isHoveredRow(row, rowOffset)) {
    overlayColor = "var(--datagrid-row-band-hover-bg)"
  } else if (isStripedRow(row, rowOffset)) {
    overlayColor = "var(--datagrid-row-band-striped-bg)"
  }
  if (!overlayColor) {
    return null
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
  const rowStateFill = resolveInlineRowStateFill(row, rowOffset)
  if (rowStateFill) {
    return rowStateFill
  }
  return {}
}

function rowIndexCellStyle(row: TableRow, rowOffset: number): CSSProperties {
  const rowStateFill = resolveInlineRowStateFill(row, rowOffset)
  if (!rowStateFill) {
    return resolvedRowIndexColumnStyle.value
  }
  return {
    ...resolvedRowIndexColumnStyle.value,
    ...rowStateFill,
  }
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

function startInlineEditIfAllowed(row: TableRow, column: TableColumn, rowOffset: number): void {
  const columnIndex = columnIndexByKey(column.key)
  if (rowOffset < 0 || !isCellEditableSafe(row, rowOffset, column, columnIndex)) {
    return
  }
  editing.value.startInlineEdit(
    row,
    column.key,
    resolveCellEditorMode(row, column) === "select"
      ? { openOnMount: true }
      : undefined,
  )
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

function rowIndexTabIndex(row: TableRow): number {
  return isRowFocusedSafe(row) ? 0 : -1
}

function handleFillHandleMouseDown(event: MouseEvent): void {
  fillActionMenuOpen.value = false
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const cell = handle?.closest<HTMLElement>(".grid-cell")
  cell?.focus({ preventScroll: true })
  selection.value.startFillHandleDrag(event)
}

function handleFillHandleDoubleClick(event: MouseEvent): void {
  fillActionMenuOpen.value = false
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const cell = handle?.closest<HTMLElement>(".grid-cell")
  cell?.focus({ preventScroll: true })
  selection.value.startFillHandleDoubleClick(event)
}

function resolveViewportRowStart(): number {
  return viewport.value?.viewportRowStart ?? 0
}

function resolveLeftColumnSpacerWidth(): number {
  return viewport.value?.leftColumnSpacerWidth ?? 0
}

function resolveRightColumnSpacerWidth(): number {
  return viewport.value?.rightColumnSpacerWidth ?? 0
}

function focusFillActionAnchorCell(): void {
  const anchorCell = selection.value.fillActionAnchorCell
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

function toggleFloatingFillActionMenu(event: MouseEvent): void {
  if (!floatingFillActionStyle.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  focusFillActionAnchorCell()
  fillActionMenuOpen.value = !fillActionMenuOpen.value
}

function handleFillActionSelection(): void {
  fillActionMenuOpen.value = false
  focusFillActionAnchorCell()
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

function isFillHandleCellSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = selection.value.isFillHandleCell
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

const DEFAULT_INDEX_COLUMN_WIDTH = 72
const showRowIndex = computed(() => rows.value.showRowIndex !== false)

const indexColumnWidthPx = computed(() => {
  if (!showRowIndex.value) {
    return 0
  }
  const width = parsePixelValue(
    layout.value.indexColumnStyle.width ?? layout.value.indexColumnStyle.minWidth,
    DEFAULT_INDEX_COLUMN_WIDTH,
  )
  return width > 0 ? width : DEFAULT_INDEX_COLUMN_WIDTH
})

const resolvedRowIndexColumnStyle = computed<CSSProperties>(() => {
  const width = `${indexColumnWidthPx.value}px`
  return {
    ...layout.value.indexColumnStyle,
    width,
    minWidth: width,
    maxWidth: width,
  }
})

const isRangeMoving = computed(() => selection.value.isRangeMoving)

const pinnedLeftColumns = computed(() => visibleColumns.value.filter(column => column.pin === "left"))
const pinnedRightColumns = computed(() => visibleColumns.value.filter(column => column.pin === "right"))

const leftPaneWidth = computed(() => {
  return indexColumnWidthPx.value + (pinnedLeftColumns.value ?? []).reduce((sum, column) => sum + resolveColumnWidth(column), 0)
})

const rightPaneWidth = computed(() => {
  return (pinnedRightColumns.value ?? []).reduce((sum, column) => sum + resolveColumnWidth(column), 0)
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

const centerHeaderChromeCanvasStyle = computed<CSSProperties>(() => ({
  left: `${leftPaneWidth.value}px`,
  width: `${Math.max(0, headerViewportClientWidth.value)}px`,
  height: `${Math.max(0, headerShellHeight.value)}px`,
}))

const centerChromeCanvasStyle = computed<CSSProperties>(() => ({
  left: `${leftPaneWidth.value}px`,
  width: `${Math.max(0, bodyViewportClientWidth.value)}px`,
  height: `${Math.max(0, bodyViewportClientHeight.value)}px`,
}))

const centerBottomChromeCanvasStyle = computed<CSSProperties>(() => ({
  left: `${leftPaneWidth.value}px`,
  width: `${Math.max(0, bodyViewportClientWidth.value)}px`,
  height: `${Math.max(0, pinnedBottomViewportClientHeight.value)}px`,
}))

const stageRootEl = ref<HTMLElement | null>(null)
const bodyViewportEl = ref<HTMLElement | null>(null)
const bottomViewportEl = ref<HTMLElement | null>(null)
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
const hoveredRangeMoveHandleCell = ref<{ rowIndex: number; columnIndex: number } | null>(null)
const hoveredRowIndex = ref<number | null>(null)
const fillActionMenuOpen = ref(false)
const headerShellHeight = ref(0)
const headerViewportClientWidth = ref(0)
const bodyViewportScrollTop = ref(0)
const bodyViewportScrollLeft = ref(0)
const bodyViewportClientWidth = ref(0)
const bodyViewportClientHeight = ref(0)
const pinnedBottomViewportClientHeight = ref(0)
const bodyViewportTopOffset = ref(0)
const GLOBAL_FILL_DRAG_CURSOR_CLASS = "datagrid-fill-drag-cursor"
const restoreBodyCursor = ref<string | null>(null)
const restoreDocumentCursor = ref<string | null>(null)
let gridChromeAnimationFrame = 0
let gridChromeResizeObserver: ResizeObserver | null = null

function syncGlobalFillDragCursor(active: boolean): void {
  if (typeof document === "undefined") {
    return
  }
  const body = document.body
  const root = document.documentElement
  if (!body || !root) {
    return
  }
  if (active) {
    if (restoreBodyCursor.value == null) {
      restoreBodyCursor.value = body.style.cursor
    }
    if (restoreDocumentCursor.value == null) {
      restoreDocumentCursor.value = root.style.cursor
    }
    root.classList.add(GLOBAL_FILL_DRAG_CURSOR_CLASS)
    body.classList.add(GLOBAL_FILL_DRAG_CURSOR_CLASS)
    root.style.setProperty("cursor", "crosshair", "important")
    body.style.setProperty("cursor", "crosshair", "important")
    return
  }
  root.classList.remove(GLOBAL_FILL_DRAG_CURSOR_CLASS)
  body.classList.remove(GLOBAL_FILL_DRAG_CURSOR_CLASS)
  if (restoreDocumentCursor.value != null) {
    if (restoreDocumentCursor.value) {
      root.style.setProperty("cursor", restoreDocumentCursor.value)
    }
    else {
      root.style.removeProperty("cursor")
    }
    restoreDocumentCursor.value = null
  }
  if (restoreBodyCursor.value != null) {
    if (restoreBodyCursor.value) {
      body.style.setProperty("cursor", restoreBodyCursor.value)
    }
    else {
      body.style.removeProperty("cursor")
    }
    restoreBodyCursor.value = null
  }
}

function clearRangeMoveHandleHover(): void {
  hoveredRangeMoveHandleCell.value = null
}

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

function isCheckboxColumn(column: TableColumn): boolean {
  return column.column.cellType === "checkbox"
}

function isRowSelectionColumn(column: TableColumn): boolean {
  return column.column.meta?.rowSelection === true
}

function shouldRenderCheckboxCell(row: TableRow, column: TableColumn): boolean {
  return row.kind !== "group" && isCheckboxColumn(column)
}

function checkboxValueIsChecked(row: TableRow, column: TableColumn): boolean {
  const value = cells.value.readCell(row, column.key).trim().toLowerCase()
  return value === "true" || value === "1" || value === "yes" || value === "on"
}

function builtInCellClasses(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): Record<string, boolean> {
  const editorMode = row.kind !== "group" ? resolveCellEditorMode(row, column) : "none"
  const editable = isCellEditableSafe(row, rowOffset, column, columnIndex)
  return {
    "grid-cell--checkbox": shouldRenderCheckboxCell(row, column),
    "grid-cell--row-selection": isRowSelectionColumn(column),
    "grid-cell--select": editable && editorMode === "select",
    "grid-cell--date": editable && (editorMode === "date" || editorMode === "datetime"),
  }
}

function checkboxCellRole(row: TableRow, column: TableColumn): "checkbox" | undefined {
  return shouldRenderCheckboxCell(row, column) ? "checkbox" : undefined
}

function checkboxCellAriaChecked(row: TableRow, column: TableColumn): "true" | "false" | undefined {
  return shouldRenderCheckboxCell(row, column)
    ? (checkboxValueIsChecked(row, column) ? "true" : "false")
    : undefined
}

function checkboxIndicatorClass(row: TableRow, column: TableColumn): Record<string, boolean> {
  return {
    "grid-checkbox-indicator--checked": checkboxValueIsChecked(row, column),
  }
}

function checkboxIndicatorMarkClass(row: TableRow, column: TableColumn): Record<string, boolean> {
  return {
    "grid-checkbox-indicator__mark--checked": checkboxValueIsChecked(row, column),
  }
}

function resolveCellEditorMode(row: TableRow, column: TableColumn): "none" | "text" | "select" | "date" | "datetime" {
  return buildDataGridCellRenderModel({
    column: column.column,
    row: row.kind !== "group" ? row.data : undefined,
    editable: true,
  }).editorMode
}

function normalizeSelectEditorOption(option: unknown): SelectEditorOption {
  if (option && typeof option === "object" && "label" in option) {
    const record = option as { label?: unknown; value?: unknown }
    const label = String(record.label ?? "")
    return {
      label,
      value: String(record.value ?? label),
    }
  }
  return {
    label: String(option ?? ""),
    value: String(option ?? ""),
  }
}

function buildSelectEditorCacheKey(row: TableRow, columnKey: string): string | null {
  if (row.kind === "group") {
    return null
  }
  return `${String(row.rowId)}::${columnKey}`
}

function readCachedSelectEditorOptions(row: TableRow, columnKey: string): readonly SelectEditorOption[] {
  const cacheKey = buildSelectEditorCacheKey(row, columnKey)
  if (!cacheKey) {
    return []
  }
  return asyncSelectOptionCache.value.get(cacheKey) ?? []
}

function readRowCellValue(row: TableRow, column: TableColumn): unknown {
  if (row.kind === "group") {
    return undefined
  }
  if (typeof column.column.accessor === "function") {
    return column.column.accessor(row.data)
  }
  if (typeof column.column.valueGetter === "function") {
    return column.column.valueGetter(row.data)
  }
  const field = typeof column.column.field === "string" && column.column.field.length > 0
    ? column.column.field
    : column.key
  return isRecord(row.data) ? row.data[field] : undefined
}

function resolveSelectEditorOptionsSource(row: TableRow, column: TableColumn): unknown {
  const source = column.column.presentation?.options
  return typeof source === "function"
    ? (row.kind !== "group" ? source(row.data) : [])
    : source
}

function resolveSelectEditorOptions(row: TableRow, column: TableColumn): readonly SelectEditorOption[] {
  const resolved = resolveSelectEditorOptionsSource(row, column)
  if (Array.isArray(resolved)) {
    return resolved.map(normalizeSelectEditorOption)
  }
  if (isPromiseLike<readonly unknown[]>(resolved)) {
    return readCachedSelectEditorOptions(row, column.key)
  }
  return []
}

function resolveSelectEditorOptionsLoader(
  row: TableRow,
  column: TableColumn,
): SelectEditorOptionsLoader | undefined {
  if (row.kind === "group") {
    return undefined
  }
  const resolvedSource = resolveSelectEditorOptionsSource(row, column)
  if (!isPromiseLike<readonly unknown[]>(resolvedSource)) {
    return undefined
  }
  return async (_query: string) => {
    const resolved = resolveSelectEditorOptionsSource(row, column)
    if (isPromiseLike<readonly unknown[]>(resolved)) {
      const loaded = await resolved
      return Array.isArray(loaded) ? loaded.map(normalizeSelectEditorOption) : []
    }
    return Array.isArray(resolved) ? resolved.map(normalizeSelectEditorOption) : []
  }
}

function handleSelectEditorOptionsResolved(
  row: TableRow,
  column: TableColumn,
  options: ReadonlyArray<DataGridFilterableComboboxOption>,
): void {
  const cacheKey = buildSelectEditorCacheKey(row, column.key)
  if (!cacheKey) {
    return
  }
  const currentOptions = asyncSelectOptionCache.value.get(cacheKey)
  if (
    currentOptions
    && currentOptions.length === options.length
    && currentOptions.every((option, index) => (
      option.value === options[index]?.value && option.label === options[index]?.label
    ))
  ) {
    return
  }
  const nextCache = new Map(asyncSelectOptionCache.value)
  nextCache.set(cacheKey, [...options])
  asyncSelectOptionCache.value = nextCache
}

function readResolvedDisplayCell(row: TableRow, column: TableColumn): string {
  const displayValue = cells.value.readDisplayCell(row, column.key)
  if (row.kind === "group" || resolveCellEditorMode(row, column) !== "select") {
    return displayValue
  }
  const cachedOptions = readCachedSelectEditorOptions(row, column.key)
  if (cachedOptions.length === 0) {
    return displayValue
  }
  const rawValue = readRowCellValue(row, column)
  const match = cachedOptions.find(option => option.value === String(rawValue ?? ""))
  return match?.label ?? displayValue
}

function resolveSelectEditorValue(row: TableRow, column: TableColumn): string {
  const rawValue = readRowCellValue(row, column)
  return rawValue == null ? "" : String(rawValue)
}

function isSelectEditorCell(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): boolean {
  return isCellEditableSafe(row, rowOffset, column, columnIndex)
    && isEditingCellSafe(row, column.key)
    && resolveCellEditorMode(row, column) === "select"
}

function isDateEditorCell(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): boolean {
  const editorMode = resolveCellEditorMode(row, column)
  return isCellEditableSafe(row, rowOffset, column, columnIndex)
    && isEditingCellSafe(row, column.key)
    && (editorMode === "date" || editorMode === "datetime")
}

function resolveDateEditorInputType(row: TableRow, column: TableColumn): "date" | "datetime-local" {
  return resolveCellEditorMode(row, column) === "datetime" ? "datetime-local" : "date"
}

function isTextEditorCell(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): boolean {
  return isCellEditableSafe(row, rowOffset, column, columnIndex)
    && isEditingCellSafe(row, column.key)
    && resolveCellEditorMode(row, column) === "text"
}

function handleSelectEditorCommit(
  value: string,
  target: "stay" | "next" | "previous" = "stay",
): void {
  editing.value.updateEditingCellValue(value)
  editing.value.commitInlineEdit(target)
}

function handleSelectEditorCancel(): void {
  editing.value.cancelInlineEdit()
}

function handleDateEditorChange(value: string, target: "stay" | "next" | "previous" = "stay"): void {
  editing.value.updateEditingCellValue(value)
  editing.value.commitInlineEdit(target)
}

function handleTextEditorBlur(): void {
  editing.value.commitInlineEdit()
}

function handleRowClickSafe(row: TableRow): void {
  rows.value.handleRowClick?.(row)
}

function handleRowIndexClickSafe(row: TableRow, rowOffset: number, event: MouseEvent): void {
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  target?.focus({ preventScroll: true })
  rows.value.handleRowIndexClick?.(row, rowOffset, event.shiftKey)
}

function handleRowIndexKeydownSafe(event: KeyboardEvent, row: TableRow, rowOffset: number): void {
  rows.value.handleRowIndexKeydown?.(event, row, rowOffset)
}

function handleRowContainerClick(row: TableRow): void {
  handleRowClickSafe(row)
  if (row.kind === "group") {
    rows.value.toggleGroupRow(row)
  }
}

function rowStateClasses(row: TableRow, rowOffset: number): Record<string, boolean> {
  return {
    "grid-row--hoverable": rows.value.rowHover === true,
    "grid-row--hovered": isHoveredRow(row, rowOffset),
    "grid-row--striped": isStripedRow(row, rowOffset),
    "grid-row--clipboard-pending": rows.value.isRowInPendingClipboardCut?.(row) === true,
    "grid-row--focused": isRowFocusedSafe(row),
    "grid-row--checkbox-selected": isRowCheckboxSelectedSafe(row),
  }
}

function isFullRowSelectionSafe(rowOffset: number, row?: TableRow): boolean {
  const range = selectionRange.value
  const lastColumnIndex = visibleColumns.value.length - 1
  if (!range || lastColumnIndex < 0) {
    return false
  }
  const rowIndex = row ? resolveAbsoluteRowIndex(row, rowOffset) : viewport.value.viewportRowStart + rowOffset
  return rowIndex >= range.startRow
    && rowIndex <= range.endRow
    && range.startColumn === 0
    && range.endColumn >= lastColumnIndex
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

function isNearRangeMoveSelectionEdge(
  event: MouseEvent,
  rowOffset: number,
  columnIndex: number,
): boolean {
  if (mode.value !== "base" || isRangeMoving.value || !selectionRange.value) {
    return false
  }
  if (!isCellSelectedSafe(rowOffset, columnIndex)) {
    return false
  }
  const cell = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  if (!cell) {
    return false
  }
  const rect = cell.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return false
  }
  const edgeThreshold = Math.max(
    1,
    Math.min(
      RANGE_MOVE_HANDLE_HOVER_EDGE_PX,
      Math.floor(rect.width / 2),
      Math.floor(rect.height / 2),
    ),
  )
  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top
  return (
    (offsetY <= edgeThreshold && isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "top"))
    || (rect.height - offsetY <= edgeThreshold && isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "bottom"))
    || (offsetX <= edgeThreshold && isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "left"))
    || (rect.width - offsetX <= edgeThreshold && isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "right"))
  )
}

function handleCellMouseMove(event: MouseEvent, rowOffset: number, columnIndex: number): void {
  if (isFillDragging.value) {
    clearRangeMoveHandleHover()
    return
  }
  if (isNearRangeMoveSelectionEdge(event, rowOffset, columnIndex)) {
    hoveredRangeMoveHandleCell.value = {
      rowIndex: rowOffset + viewport.value.viewportRowStart,
      columnIndex,
    }
    return
  }
  clearRangeMoveHandleHover()
}

function handleGroupCellClick(row: TableRow): void {
  if (row.kind !== "group") {
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

function isRangeMoveHandleHoverCell(rowOffset: number, columnIndex: number): boolean {
  if (isFillDragging.value) {
    return false
  }
  return (
    hoveredRangeMoveHandleCell.value?.rowIndex === rowOffset + viewport.value.viewportRowStart
    && hoveredRangeMoveHandleCell.value?.columnIndex === columnIndex
  )
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

function resolveHeaderViewportElement(): HTMLElement | null {
  return resolveHeaderShellElement()?.querySelector<HTMLElement>(".grid-header-viewport") ?? null
}

function resolveHeaderShellElement(): HTMLElement | null {
  return stageRootEl.value?.querySelector<HTMLElement>(".grid-header-shell") ?? null
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
    focusVisibleAnchorCell()
    void nextTick(() => {
      focusVisibleAnchorCell()
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          focusVisibleAnchorCell()
        })
      }
    })
  }

function captureBodyViewportRef(value: Element | ComponentPublicInstance | null): void {
  bodyViewportEl.value = resolveElementRef(value)
  viewport.value.bodyViewportRef(value)
  syncBodyViewportMetrics()
  connectGridChromeResizeObserver()
  scheduleGridChromeRedraw()
}

function capturePinnedBottomViewportRef(value: Element | ComponentPublicInstance | null): void {
  bottomViewportEl.value = resolveElementRef(value)
  syncPinnedBottomViewportMetrics()
  syncPinnedBottomViewportScrollLeft()
}

function captureLeftPaneContentRef(value: Element | ComponentPublicInstance | null): void {
  leftPaneContentRef.value = resolveElementRef(value)
}

function captureRightPaneContentRef(value: Element | ComponentPublicInstance | null): void {
  rightPaneContentRef.value = resolveElementRef(value)
}

function captureLeftBottomPaneContentRef(value: Element | ComponentPublicInstance | null): void {
  leftBottomPaneContentRef.value = resolveElementRef(value)
}

function captureRightBottomPaneContentRef(value: Element | ComponentPublicInstance | null): void {
  rightBottomPaneContentRef.value = resolveElementRef(value)
}

function syncBodyViewportScrollState(viewport: HTMLElement): void {
  bodyViewportScrollTop.value = viewport.scrollTop
  bodyViewportScrollLeft.value = viewport.scrollLeft
  bodyViewportClientWidth.value = viewport.clientWidth
  bodyViewportClientHeight.value = viewport.clientHeight
}

function syncPinnedBottomViewportScrollLeft(): void {
  const viewport = bottomViewportEl.value
  if (!viewport || viewport.scrollLeft === bodyViewportScrollLeft.value) {
    return
  }
  viewport.scrollLeft = bodyViewportScrollLeft.value
}

function syncPinnedBottomViewportMetrics(): void {
  pinnedBottomViewportClientHeight.value = bottomViewportEl.value?.clientHeight ?? 0
}

function syncBodyViewportMetrics(): void {
  const viewport = bodyViewportEl.value
  const shell = bodyShellRef.value
  if (!viewport || !shell) {
    return
  }
  syncBodyViewportScrollState(viewport)
  const viewportRect = viewport.getBoundingClientRect()
  const shellRect = shell.getBoundingClientRect()
  bodyViewportTopOffset.value = Math.max(0, viewportRect.top - shellRect.top)
  headerShellHeight.value = resolveHeaderShellElement()?.getBoundingClientRect().height ?? 0
  headerViewportClientWidth.value = resolveHeaderViewportElement()?.clientWidth ?? bodyViewportClientWidth.value
  syncPinnedBottomViewportMetrics()
  syncPinnedBottomViewportScrollLeft()
}

function resolveGridChromeDevicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1
  }
  return Math.max(1, window.devicePixelRatio || 1)
}

function resolveGridChromeColor(variableName: string, fallback: string): string {
  const root = stageRootEl.value
  if (!root || typeof window === "undefined") {
    return fallback
  }
  const value = window.getComputedStyle(root).getPropertyValue(variableName).trim()
  return value || fallback
}

function resolveGridChromeLineWidth(variableName: string, fallback: number): number {
  const root = stageRootEl.value
  if (!root || typeof window === "undefined") {
    return fallback
  }
  const value = Number.parseFloat(window.getComputedStyle(root).getPropertyValue(variableName))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function prepareGridChromeCanvas(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  if (!canvas || width <= 0 || height <= 0) {
    if (canvas) {
      const context = canvas.getContext("2d")
      context?.clearRect(0, 0, canvas.width, canvas.height)
    }
    return null
  }
  const dpr = resolveGridChromeDevicePixelRatio()
  const pixelWidth = Math.max(1, Math.round(width * dpr))
  const pixelHeight = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== pixelWidth) {
    canvas.width = pixelWidth
  }
  if (canvas.height !== pixelHeight) {
    canvas.height = pixelHeight
  }
  const context = canvas.getContext("2d")
  if (!context) {
    return null
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)
  return context
}

function drawGridChromeHorizontalLines(
  context: CanvasRenderingContext2D,
  pane: DataGridChromePaneModel,
  rowDividerColor: string,
  rowDividerWidth: number,
): void {
  if (pane.width <= 0 || pane.height <= 0 || rowDividerWidth <= 0) {
    return
  }
  context.save()
  context.strokeStyle = rowDividerColor
  context.lineWidth = rowDividerWidth
  context.beginPath()
  for (const line of pane.horizontalLines) {
    const y = Math.round(line.position) - 0.5
    if (y < -rowDividerWidth || y > pane.height + rowDividerWidth) {
      continue
    }
    context.moveTo(0, y)
    context.lineTo(pane.width, y)
  }
  context.stroke()
  context.restore()
}

function resolveGridChromeBandColor(kind: string): string {
  switch (kind) {
    case "hover":
      return resolveGridChromeColor(
        "--datagrid-row-band-hover-bg",
        "rgba(251, 146, 60, 0.18)",
      )
    case "base":
      return resolveGridChromeColor(
        "--datagrid-row-band-base-bg",
        "rgba(255, 255, 255, 1)",
      )
    case "striped":
      return resolveGridChromeColor(
        "--datagrid-row-band-striped-bg",
        "rgba(59, 130, 246, 0.06)",
      )
    case "group":
      return resolveGridChromeColor(
        "--datagrid-row-band-group-bg",
        "rgba(59, 130, 246, 0.08)",
      )
    case "tree":
      return resolveGridChromeColor(
        "--datagrid-row-band-tree-bg",
        "rgba(59, 130, 246, 0.12)",
      )
    case "pivot":
      return resolveGridChromeColor(
        "--datagrid-row-band-pivot-bg",
        "rgba(59, 130, 246, 0.1)",
      )
    case "pivot-group":
      return resolveGridChromeColor(
        "--datagrid-row-band-pivot-group-bg",
        "rgba(59, 130, 246, 0.14)",
      )
    default:
      return ""
  }
}

function drawGridChromeBands(
  context: CanvasRenderingContext2D,
  pane: DataGridChromePaneModel,
): void {
  if (pane.width <= 0 || pane.height <= 0 || pane.bands.length === 0) {
    return
  }
  context.save()
  for (const band of pane.bands) {
    const fillStyle = resolveGridChromeBandColor(band.kind)
    if (!fillStyle) {
      continue
    }
    const top = Math.round(band.top)
    const height = Math.max(1, Math.round(band.height))
    const clippedTop = Math.max(0, top)
    const clippedBottom = Math.min(pane.height, top + height)
    const clippedHeight = clippedBottom - clippedTop
    if (clippedHeight <= 0) {
      continue
    }
    context.fillStyle = fillStyle
    context.fillRect(0, clippedTop, pane.width, clippedHeight)
  }
  context.restore()
}

function drawGridChromeVerticalLines(
  context: CanvasRenderingContext2D,
  pane: DataGridChromePaneModel,
  columnDividerColor: string,
  columnDividerWidth: number,
): void {
  if (pane.height <= 0 || columnDividerWidth <= 0 || pane.verticalLines.length === 0) {
    return
  }
  context.save()
  context.strokeStyle = columnDividerColor
  context.lineWidth = columnDividerWidth
  context.beginPath()
  for (const line of pane.verticalLines) {
    const x = Math.round(line.position) - 0.5
    if (x < -columnDividerWidth || x > pane.width + columnDividerWidth) {
      continue
    }
    context.moveTo(x, 0)
    context.lineTo(x, pane.height)
  }
  context.stroke()
  context.restore()
}

function drawGridChromeCanvas(): void {
  gridChromeAnimationFrame = 0
  const headerRenderModel = headerChromeRenderModel.value
  const renderModel = chromeRenderModel.value
  const rowDividerColor = resolveGridChromeColor("--datagrid-row-divider-color", "rgba(0, 0, 0, 0.08)")
  const columnDividerColor = resolveGridChromeColor("--datagrid-column-divider-color", "rgba(0, 0, 0, 0.08)")
  const headerColumnDividerColor = resolveGridChromeColor("--datagrid-header-column-divider-color", columnDividerColor)
  const rowDividerWidth = resolveGridChromeLineWidth("--datagrid-row-divider-size", 1)
  const columnDividerWidth = resolveGridChromeLineWidth("--datagrid-column-divider-size", 1)

  const leftHeaderContext = prepareGridChromeCanvas(
    leftHeaderChromeCanvasEl.value,
    headerRenderModel.left.width,
    headerRenderModel.left.height,
  )
  if (leftHeaderContext && !hasPivotHeaderGroups.value) {
    drawGridChromeVerticalLines(leftHeaderContext, headerRenderModel.left, headerColumnDividerColor, columnDividerWidth)
  }

  const centerHeaderContext = prepareGridChromeCanvas(
    centerHeaderChromeCanvasEl.value,
    headerRenderModel.center.width,
    headerRenderModel.center.height,
  )
  if (centerHeaderContext && !hasPivotHeaderGroups.value) {
    drawGridChromeVerticalLines(centerHeaderContext, headerRenderModel.center, headerColumnDividerColor, columnDividerWidth)
  }

  const rightHeaderContext = prepareGridChromeCanvas(
    rightHeaderChromeCanvasEl.value,
    headerRenderModel.right.width,
    headerRenderModel.right.height,
  )
  if (rightHeaderContext && !hasPivotHeaderGroups.value) {
    drawGridChromeVerticalLines(rightHeaderContext, headerRenderModel.right, headerColumnDividerColor, columnDividerWidth)
  }

  const leftContext = prepareGridChromeCanvas(leftChromeCanvasEl.value, renderModel.left.width, renderModel.left.height)
  if (leftContext) {
    drawGridChromeBands(leftContext, renderModel.left)
    drawGridChromeHorizontalLines(leftContext, renderModel.left, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(leftContext, renderModel.left, columnDividerColor, columnDividerWidth)
  }

  const centerContext = prepareGridChromeCanvas(centerChromeCanvasEl.value, renderModel.center.width, renderModel.center.height)
  if (centerContext) {
    drawGridChromeBands(centerContext, renderModel.center)
    drawGridChromeHorizontalLines(centerContext, renderModel.center, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(centerContext, renderModel.center, columnDividerColor, columnDividerWidth)
  }

  const rightContext = prepareGridChromeCanvas(rightChromeCanvasEl.value, renderModel.right.width, renderModel.right.height)
  if (rightContext) {
    drawGridChromeBands(rightContext, renderModel.right)
    drawGridChromeHorizontalLines(rightContext, renderModel.right, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(rightContext, renderModel.right, columnDividerColor, columnDividerWidth)
  }

  const bottomRenderModel = pinnedBottomChromeRenderModel.value

  const leftBottomContext = prepareGridChromeCanvas(
    leftBottomChromeCanvasEl.value,
    bottomRenderModel.left.width,
    bottomRenderModel.left.height,
  )
  if (leftBottomContext) {
    drawGridChromeBands(leftBottomContext, bottomRenderModel.left)
    drawGridChromeHorizontalLines(leftBottomContext, bottomRenderModel.left, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(leftBottomContext, bottomRenderModel.left, columnDividerColor, columnDividerWidth)
  }

  const centerBottomContext = prepareGridChromeCanvas(
    centerBottomChromeCanvasEl.value,
    bottomRenderModel.center.width,
    bottomRenderModel.center.height,
  )
  if (centerBottomContext) {
    drawGridChromeBands(centerBottomContext, bottomRenderModel.center)
    drawGridChromeHorizontalLines(centerBottomContext, bottomRenderModel.center, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(centerBottomContext, bottomRenderModel.center, columnDividerColor, columnDividerWidth)
  }

  const rightBottomContext = prepareGridChromeCanvas(
    rightBottomChromeCanvasEl.value,
    bottomRenderModel.right.width,
    bottomRenderModel.right.height,
  )
  if (rightBottomContext) {
    drawGridChromeBands(rightBottomContext, bottomRenderModel.right)
    drawGridChromeHorizontalLines(rightBottomContext, bottomRenderModel.right, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(rightBottomContext, bottomRenderModel.right, columnDividerColor, columnDividerWidth)
  }
}

function scheduleGridChromeRedraw(): void {
  if (typeof window === "undefined") {
    drawGridChromeCanvas()
    return
  }
  if (gridChromeAnimationFrame !== 0) {
    return
  }
  gridChromeAnimationFrame = window.requestAnimationFrame(() => {
    drawGridChromeCanvas()
  })
}

function connectGridChromeResizeObserver(): void {
  if (typeof ResizeObserver === "undefined") {
    return
  }
  if (!gridChromeResizeObserver) {
    gridChromeResizeObserver = new ResizeObserver(() => {
      syncBodyViewportMetrics()
      scheduleGridChromeRedraw()
    })
  }
  gridChromeResizeObserver.disconnect()
  if (bodyViewportEl.value) {
    gridChromeResizeObserver.observe(bodyViewportEl.value)
  }
  if (bottomViewportEl.value) {
    gridChromeResizeObserver.observe(bottomViewportEl.value)
  }
  if (bodyShellRef.value) {
    gridChromeResizeObserver.observe(bodyShellRef.value)
  }
  const headerShell = resolveHeaderShellElement()
  if (headerShell) {
    gridChromeResizeObserver.observe(headerShell)
  }
  const headerViewport = resolveHeaderViewportElement()
  if (headerViewport) {
    gridChromeResizeObserver.observe(headerViewport)
  }
}

const chromeRenderModel = computed(() => (
  buildDataGridChromeRenderModel({
    rowMetrics: resolveChromeRowMetrics(),
    rowBands: resolveChromeRowBands(),
    scrollTop: bodyViewportScrollTop.value,
    leftPaneWidth: leftPaneWidth.value,
    centerPaneWidth: bodyViewportClientWidth.value,
    rightPaneWidth: rightPaneWidth.value,
    viewportHeight: bodyViewportClientHeight.value,
    leftColumnWidths: [
      indexColumnWidthPx.value,
      ...(pinnedLeftColumns.value ?? []).map(resolveColumnWidth),
    ].filter(width => width > 0),
    centerColumnWidths: [
      resolveLeftColumnSpacerWidth(),
      ...(renderedColumns.value ?? []).map(resolveColumnWidth),
      resolveRightColumnSpacerWidth(),
    ].filter(width => width > 0),
    rightColumnWidths: (pinnedRightColumns.value ?? []).map(resolveColumnWidth),
    centerScrollLeft: bodyViewportScrollLeft.value,
  })
))

const headerChromeRenderModel = computed(() => (
  buildDataGridChromeRenderModel({
    rowMetrics: headerShellHeight.value > 0
      ? [{ top: 0, height: headerShellHeight.value }]
      : [],
    scrollTop: 0,
    leftPaneWidth: leftPaneWidth.value,
    centerPaneWidth: headerViewportClientWidth.value,
    rightPaneWidth: rightPaneWidth.value,
    viewportHeight: headerShellHeight.value,
    leftColumnWidths: [
      indexColumnWidthPx.value,
      ...(pinnedLeftColumns.value ?? []).map(resolveColumnWidth),
    ].filter(width => width > 0),
    centerColumnWidths: [
      resolveLeftColumnSpacerWidth(),
      ...(renderedColumns.value ?? []).map(resolveColumnWidth),
      resolveRightColumnSpacerWidth(),
    ].filter(width => width > 0),
    rightColumnWidths: (pinnedRightColumns.value ?? []).map(resolveColumnWidth),
    centerScrollLeft: bodyViewportScrollLeft.value,
  })
))

const pinnedBottomRowBands = computed<readonly DataGridChromeRowBand[]>(() => (
  pinnedBottomRows.value.flatMap((row, rowOffset) => {
    const metric = pinnedBottomRowMetrics.value[rowOffset]
    const kind = resolveChromeRowBandKind(row, resolveViewportRowOffset(row, rowOffset))
    if (!metric || !kind) {
      return []
    }
    return [{
      rowIndex: rowOffset,
      top: metric.top,
      height: metric.height,
      kind,
    }]
  })
))

function resolvePinnedBottomChromeRowBands(): readonly DataGridChromeRowBand[] {
  return pinnedBottomRowBands.value ?? []
}

const pinnedBottomChromeRenderModel = computed(() => (
  buildDataGridChromeRenderModel({
    rowMetrics: resolvePinnedBottomChromeRowMetrics(),
    rowBands: resolvePinnedBottomChromeRowBands(),
    scrollTop: 0,
    leftPaneWidth: leftPaneWidth.value,
    centerPaneWidth: bodyViewportClientWidth.value,
    rightPaneWidth: rightPaneWidth.value,
    viewportHeight: pinnedBottomViewportClientHeight.value,
    leftColumnWidths: [
      indexColumnWidthPx.value,
      ...(pinnedLeftColumns.value ?? []).map(resolveColumnWidth),
    ].filter(width => width > 0),
    centerColumnWidths: [
      resolveLeftColumnSpacerWidth(),
      ...(renderedColumns.value ?? []).map(resolveColumnWidth),
      resolveRightColumnSpacerWidth(),
    ].filter(width => width > 0),
    rightColumnWidths: (pinnedRightColumns.value ?? []).map(resolveColumnWidth),
    centerScrollLeft: bodyViewportScrollLeft.value,
  })
))

const hasPivotHeaderGroups = computed(() => {
  if (mode.value !== "pivot") {
    return false
  }
  return visibleColumns.value.some(column => (readPivotHeaderMeta(column)?.groupLabels?.length ?? 0) > 0)
})

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

const centerColumns = computed(() => visibleColumns.value.filter(column => column.pin !== "left" && column.pin !== "right"))

const effectiveBodyViewportWidth = computed(() => {
  return bodyViewportClientWidth.value > 0
    ? bodyViewportClientWidth.value
    : parsePixelValue(layout.value.gridContentStyle.width ?? layout.value.gridContentStyle.minWidth, 0)
})

function resolveVisibleFillActionAnchorCell(): { rowIndex: number; columnIndex: number } | null {
  const anchorCell = selection.value.fillActionAnchorCell
  if (!anchorCell) {
    return null
  }

  const visibleRowStart = resolveViewportRowStart()
  const visibleRowEnd = resolveViewportRowStart() + Math.max(0, displayRows.value.length - 1)
  const range = selectionRange.value
  const selectionRowStart = range ? Math.min(range.startRow, range.endRow) : anchorCell.rowIndex
  const selectionRowEnd = range ? Math.max(range.startRow, range.endRow) : anchorCell.rowIndex
  const selectionColumnStart = range ? Math.min(range.startColumn, range.endColumn) : anchorCell.columnIndex
  const selectionColumnEnd = range ? Math.max(range.startColumn, range.endColumn) : anchorCell.columnIndex
  const clampedRowStart = Math.max(selectionRowStart, visibleRowStart)
  const clampedRowEnd = Math.min(selectionRowEnd, visibleRowEnd)
  const rowIndex = clampedRowStart <= clampedRowEnd
    ? clamp(anchorCell.rowIndex, clampedRowStart, clampedRowEnd)
    : anchorCell.rowIndex

  const visibleCenterColumnKeys = new Set((renderedColumns.value ?? []).map(column => column.key))
  const visibleColumnIndexes = visibleColumns.value
    .map((column, columnIndex) => ({ column, columnIndex }))
    .filter(({ column, columnIndex }) => {
      if (columnIndex < selectionColumnStart || columnIndex > selectionColumnEnd) {
        return false
      }
      return column.pin === "left"
        || column.pin === "right"
        || visibleCenterColumnKeys.has(column.key)
    })
    .map(({ columnIndex }) => columnIndex)

  const columnIndex = visibleColumnIndexes.length > 0
    ? clamp(
        anchorCell.columnIndex,
        visibleColumnIndexes[0] ?? anchorCell.columnIndex,
        visibleColumnIndexes[visibleColumnIndexes.length - 1] ?? anchorCell.columnIndex,
      )
    : anchorCell.columnIndex

  return {
    rowIndex,
    columnIndex,
  }
}

function resolveFloatingFillActionLeft(): number | null {
  const anchorCell = resolveVisibleFillActionAnchorCell() ?? selection.value.fillActionAnchorCell
  if (!anchorCell) {
    return null
  }
  const relativeCellRect = resolveRelativeCellRect(anchorCell)
  if (relativeCellRect) {
    return clamp(
      relativeCellRect.right - FILL_ACTION_TRIGGER_SIZE_PX,
      FILL_ACTION_VIEWPORT_MARGIN_PX,
      leftPaneWidth.value + effectiveBodyViewportWidth.value + rightPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX,
    )
  }
  const column = visibleColumns.value[anchorCell.columnIndex]
  if (!column) {
    return null
  }

  if (column.pin === "left") {
    let cellRight = indexColumnWidthPx.value
    for (const pinnedColumn of pinnedLeftColumns.value) {
      cellRight += resolveColumnWidth(pinnedColumn)
      if (pinnedColumn.key === column.key) {
        break
      }
    }
    return clamp(
      cellRight - FILL_ACTION_TRIGGER_SIZE_PX,
      FILL_ACTION_VIEWPORT_MARGIN_PX,
      Math.max(FILL_ACTION_VIEWPORT_MARGIN_PX, leftPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX),
    )
  }

  if (column.pin === "right") {
    let cellRight = leftPaneWidth.value + effectiveBodyViewportWidth.value
    for (const pinnedColumn of pinnedRightColumns.value) {
      cellRight += resolveColumnWidth(pinnedColumn)
      if (pinnedColumn.key === column.key) {
        break
      }
    }
    const rightPaneStart = leftPaneWidth.value + effectiveBodyViewportWidth.value
    return clamp(
      cellRight - FILL_ACTION_TRIGGER_SIZE_PX,
      rightPaneStart + FILL_ACTION_VIEWPORT_MARGIN_PX,
      Math.max(
        rightPaneStart + FILL_ACTION_VIEWPORT_MARGIN_PX,
        rightPaneStart + rightPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX,
      ),
    )
  }

  let cellRight = leftPaneWidth.value - bodyViewportScrollLeft.value
  for (const centerColumn of centerColumns.value) {
    cellRight += resolveColumnWidth(centerColumn)
    if (centerColumn.key === column.key) {
      break
    }
  }
  const viewportLeft = leftPaneWidth.value + FILL_ACTION_VIEWPORT_MARGIN_PX
  const viewportRight = leftPaneWidth.value + effectiveBodyViewportWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX
  return clamp(cellRight - FILL_ACTION_TRIGGER_SIZE_PX, viewportLeft, viewportRight)
}

function resolveFloatingFillActionTop(): number {
  const viewportTop = bodyViewportTopOffset.value + FILL_ACTION_VIEWPORT_MARGIN_PX
  const viewportBottom = bodyViewportTopOffset.value + Math.max(
    0,
    bodyViewportClientHeight.value
      - FILL_ACTION_TRIGGER_SIZE_PX
      - FILL_ACTION_VIEWPORT_MARGIN_PX
      - FILL_ACTION_HANDLE_CLEARANCE_PX,
  )
  const anchorCell = selection.value.fillActionAnchorCell
  const targetCell = resolveVisibleFillActionAnchorCell()
  if (anchorCell && targetCell && anchorCell.rowIndex !== targetCell.rowIndex) {
    return viewportBottom
  }
  const relativeCellRect = resolveRelativeCellRect(targetCell)
  if (relativeCellRect) {
    return clamp(
      relativeCellRect.bottom - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_HANDLE_CLEARANCE_PX,
      viewportTop,
      viewportBottom,
    )
  }
  const shellRect = bodyShellRef.value?.getBoundingClientRect()
  const rowElement = targetCell ? resolveVisibleRowElement(targetCell.rowIndex) : null
  if (!shellRect || !rowElement) {
    return viewportBottom
  }
  const rowRect = rowElement.getBoundingClientRect()
  const rowBottom = rowRect.bottom - shellRect.top - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_HANDLE_CLEARANCE_PX
  return clamp(rowBottom, viewportTop, viewportBottom)
}

const floatingFillActionStyle = computed<CSSProperties | null>(() => {
  if (!selection.value.fillActionAnchorCell) {
    return null
  }
  const left = resolveFloatingFillActionLeft()
  if (left == null) {
    return null
  }
  const top = resolveFloatingFillActionTop()
  return {
    left: `${left}px`,
    top: `${top}px`,
  }
})

watch(
  () => selection.value.fillPreviewRange,
  (nextRange, previousRange) => {
    if (previousRange && !nextRange) {
      restoreAnchorCellFocus()
    }
  },
)

watch(
  () => selection.value.fillActionAnchorCell
    ? `${selection.value.fillActionAnchorCell.rowIndex}:${selection.value.fillActionAnchorCell.columnIndex}`
    : "",
  () => {
    fillActionMenuOpen.value = false
  },
)

watch(
  () => selection.value.isFillDragging,
  active => {
    if (active) {
      clearRangeMoveHandleHover()
    }
  },
)

watch(fillActionMenuOpen, (open, _previous, onCleanup) => {
  if (!open || typeof window === "undefined") {
    return
  }

  const handlePointerDown = (event: MouseEvent) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest(FILL_ACTION_ROOT_SELECTOR)) {
      return
    }
    fillActionMenuOpen.value = false
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      fillActionMenuOpen.value = false
      focusFillActionAnchorCell()
    }
  }

  window.addEventListener("mousedown", handlePointerDown, true)
  window.addEventListener("keydown", handleKeydown)
  onCleanup(() => {
    window.removeEventListener("mousedown", handlePointerDown, true)
    window.removeEventListener("keydown", handleKeydown)
  })
})

watch(
  () => selection.value.isFillDragging,
  active => {
    syncGlobalFillDragCursor(active)
  },
  { immediate: true },
)

const linkedPaneScrollSync = useDataGridLinkedPaneScrollSync({
  resolveSourceScrollTop: () => bodyViewportEl.value?.scrollTop ?? 0,
  mode: "direct-transform",
  resolvePaneElements: () => [leftPaneContentRef.value, rightPaneContentRef.value],
})

const managedWheelScroll = useDataGridManagedWheelScroll({
  resolveBodyViewport: () => bodyViewportEl.value,
  resolveMainViewport: () => bodyViewportEl.value,
  setHandledScrollTop: (value: number) => {
    if (bodyViewportEl.value) {
      bodyViewportEl.value.scrollTop = value
    }
  },
  setHandledScrollLeft: (value: number) => {
    if (bodyViewportEl.value) {
      bodyViewportEl.value.scrollLeft = value
    }
  },
  syncLinkedScroll: (scrollTop: number) => {
    linkedPaneScrollSync.syncNow(scrollTop)
  },
  scheduleLinkedScrollSyncLoop: linkedPaneScrollSync.scheduleSyncLoop,
  isLinkedScrollSyncLoopScheduled: linkedPaneScrollSync.isSyncLoopScheduled,
  onWheelConsumed: () => {
    const bodyViewport = bodyViewportEl.value
    if (!bodyViewport) {
      return
    }
    viewport.value.handleViewportScroll(createSyntheticScrollEvent(bodyViewport))
  },
})

function handleCenterViewportScroll(event: Event): void {
  viewport.value.handleViewportScroll(event)
  const element = event.target as HTMLElement | null
  if (!element) {
    return
  }
  linkedPaneScrollSync.onSourceScroll(element.scrollTop)
  syncBodyViewportScrollState(element)
  syncPinnedBottomViewportScrollLeft()
  scheduleGridChromeRedraw()
}

function handlePinnedBottomViewportScroll(event: Event): void {
  const element = event.target as HTMLElement | null
  const bodyViewport = bodyViewportEl.value
  if (!element || !bodyViewport || bodyViewport.scrollLeft === element.scrollLeft) {
    return
  }
  bodyViewport.scrollLeft = element.scrollLeft
  viewport.value.handleViewportScroll(createSyntheticScrollEvent(bodyViewport))
  syncBodyViewportScrollState(bodyViewport)
  scheduleGridChromeRedraw()
}

function handlePinnedBottomViewportKeydown(event: KeyboardEvent): void {
  viewport.value.handleViewportKeydown(event)
}

function handleLinkedViewportWheel(event: WheelEvent): void {
  managedWheelScroll.onLinkedViewportWheel(event)
}

function handleBodyViewportWheel(event: WheelEvent): void {
  managedWheelScroll.onBodyViewportWheel(event)
}

onBeforeUnmount(() => {
  syncGlobalFillDragCursor(false)
  linkedPaneScrollSync.reset()
  managedWheelScroll.reset()
  if (gridChromeAnimationFrame !== 0 && typeof window !== "undefined") {
    window.cancelAnimationFrame(gridChromeAnimationFrame)
    gridChromeAnimationFrame = 0
  }
  gridChromeResizeObserver?.disconnect()
  gridChromeResizeObserver = null
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", syncBodyViewportMetrics)
  }
})

onMounted(() => {
  syncBodyViewportMetrics()
  connectGridChromeResizeObserver()
  scheduleGridChromeRedraw()
  if (typeof window !== "undefined") {
    window.addEventListener("resize", syncBodyViewportMetrics)
  }
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

function buildEstimatedVisibleRowMetrics(): readonly { top: number; height: number }[] {
  const metrics: Array<{ top: number; height: number }> = []
  let currentTop = viewport.value?.topSpacerHeight ?? 0
  displayRows.value.forEach((row, rowOffset) => {
    const style = rows.value?.rowStyle(row, rowOffset) ?? {}
    const height = parsePixelValue(style.height ?? style.minHeight, 31)
    metrics.push({
      top: currentTop,
      height,
    })
    currentTop += height
  })
  return metrics
}

const rowMetrics = computed(() => {
  const estimated = buildEstimatedVisibleRowMetrics()
  if (mode.value === "base" && rowHeightMode.value === "auto") {
    return resolveVisibleRowMetricsFromDom(estimated)
  }
  return estimated
})

function resolveChromeRowMetrics(): readonly { top: number; height: number }[] {
  return rowMetrics.value ?? []
}

const pinnedBottomRowMetrics = computed(() => {
  const metrics: Array<{ top: number; height: number }> = []
  let currentTop = 0
  pinnedBottomRows.value.forEach((row, rowOffset) => {
    const style = rows.value?.rowStyle(row, resolveViewportRowOffset(row, rowOffset)) ?? {}
    const height = parsePixelValue(style.height ?? style.minHeight, 31)
    metrics.push({
      top: currentTop,
      height,
    })
    currentTop += height
  })
  return metrics
})

function resolvePinnedBottomChromeRowMetrics(): readonly { top: number; height: number }[] {
  return pinnedBottomRowMetrics.value ?? []
}

const rowMetricsSignature = computed(() => (
  rowMetrics.value.map(metric => `${metric.top}:${metric.height}`).join("|")
))

const pinnedBottomRowMetricsSignature = computed(() => (
  pinnedBottomRowMetrics.value.map(metric => `${metric.top}:${metric.height}`).join("|")
))

function resolveChromeRowBandKind(row: TableRow, rowOffset: number): string | null {
  if (isHoveredRow(row, rowOffset)) {
    return "hover"
  }
  const className = rows.value.rowClass(row)
  if (className.includes("row--group") && className.includes("row--pivot")) {
    return "pivot-group"
  }
  if (className.includes("row--group")) {
    return "group"
  }
  if (className.includes("row--tree")) {
    return "tree"
  }
  if (className.includes("row--pivot")) {
    return "pivot"
  }
  if (isStripedRow(row, rowOffset)) {
    return "striped"
  }
  return "base"
}

const rowBands = computed<readonly DataGridChromeRowBand[]>(() => (
  displayRows.value.flatMap((row, rowOffset) => {
    const metric = rowMetrics.value[rowOffset]
    const kind = resolveChromeRowBandKind(row, rowOffset)
    if (!metric || !kind) {
      return []
    }
    return [{
      rowIndex: rowOffset,
      top: metric.top,
      height: metric.height,
      kind,
    }]
  })
))

function resolveChromeRowBands(): readonly DataGridChromeRowBand[] {
  return rowBands.value ?? []
}

const rowBandsSignature = computed(() => (
  rowBands.value.map(band => `${band.kind}:${band.top}:${band.height}`).join("|")
))

const pinnedBottomRowBandsSignature = computed(() => (
  pinnedBottomRowBands.value.map(band => `${band.kind}:${band.top}:${band.height}`).join("|")
))

const leftChromeColumnsSignature = computed(() => (
  [
    indexColumnWidthPx.value,
    ...(pinnedLeftColumns.value ?? []).map(resolveColumnWidth),
  ].join("|")
))

const centerChromeColumnsSignature = computed(() => (
  [
    resolveLeftColumnSpacerWidth(),
    ...(renderedColumns.value ?? []).map(resolveColumnWidth),
    resolveRightColumnSpacerWidth(),
  ].join("|")
))

const rightChromeColumnsSignature = computed(() => (
  (pinnedRightColumns.value ?? []).map(resolveColumnWidth).join("|")
))

const headerPivotGroupsSignature = computed(() => (
  hasPivotHeaderGroups.value
    ? visibleColumns.value
      .map(column => `${column.key}:${readPivotHeaderMeta(column)?.groupLabels?.join(">") ?? ""}`)
      .join("|")
    : "none"
))

watch(
  () => [
    leftPaneWidth.value,
    rightPaneWidth.value,
    rowMetricsSignature.value,
    pinnedBottomRowMetricsSignature.value,
    rowBandsSignature.value,
    pinnedBottomRowBandsSignature.value,
    leftChromeColumnsSignature.value,
    centerChromeColumnsSignature.value,
    rightChromeColumnsSignature.value,
    headerPivotGroupsSignature.value,
  ].join("|"),
  () => {
    syncBodyViewportMetrics()
    scheduleGridChromeRedraw()
  },
)

function resolveVisibleRowMetricsFromDom(
  fallbackMetrics: readonly { top: number; height: number }[],
): readonly { top: number; height: number }[] {
  const viewport = bodyViewportEl.value
  if (!viewport) {
    return fallbackMetrics
  }
  const viewportRect = viewport.getBoundingClientRect()
  const rowElements = Array.from(
    viewport.querySelectorAll<HTMLElement>(".grid-body-content > .grid-row"),
  )
  if (rowElements.length !== displayRows.value.length) {
    return fallbackMetrics
  }
  return rowElements.map(rowElement => {
    const rowRect = rowElement.getBoundingClientRect()
    return {
      top: viewport.scrollTop + (rowRect.top - viewportRect.top),
      height: rowRect.height,
    }
  })
}

const visibleColumnIndexByKey = computed(() => {
  const indexByKey = new Map<string, number>()
  visibleColumns.value.forEach((column, index) => {
    indexByKey.set(column.key, index)
  })
  return indexByKey
})

const visibleSelectionBounds = computed(() => {
  let startRowOffset: number | null = null
  let endRowOffset: number | null = null
  let startColumnIndex: number | null = null
  let endColumnIndex: number | null = null

  for (let rowOffset = 0; rowOffset < displayRows.value.length; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < visibleColumns.value.length; columnIndex += 1) {
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

const visibleFillPreviewBounds = computed(() => {
  let startRowOffset: number | null = null
  let endRowOffset: number | null = null
  let startColumnIndex: number | null = null
  let endColumnIndex: number | null = null

  for (let rowOffset = 0; rowOffset < displayRows.value.length; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < visibleColumns.value.length; columnIndex += 1) {
      if (!isCellInFillPreviewSafe(rowOffset, columnIndex)) {
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

const isSingleSelectedCell = computed(() => {
  const range = selectionRange.value
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

function rangesEqual(left: OverlayRange | null, right: OverlayRange | null): boolean {
  if (!left || !right) {
    return false
  }
  return left.startRow === right.startRow
    && left.endRow === right.endRow
    && left.startColumn === right.startColumn
    && left.endColumn === right.endColumn
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
  return resolveVisibleRangeBoundsForRows(range, displayRows.value)
}

function resolvePinnedBottomVisibleRangeBounds(range: OverlayRange | null) {
  return resolveVisibleRangeBoundsForRows(range, pinnedBottomRows.value)
}

function resolveOverlayMetrics(bounds: {
  startRowOffset: number
  endRowOffset: number
  startColumnIndex: number
  endColumnIndex: number
} | null,
  metricsSource = rowMetrics.value,
) {
  if (!bounds) {
    return null
  }
  const startMetric = metricsSource[bounds.startRowOffset]
  const endMetric = metricsSource[bounds.endRowOffset]
  if (!startMetric || !endMetric) {
    return null
  }

  return {
    ...bounds,
    top: startMetric.top,
    height: Math.max(1, (endMetric.top + endMetric.height) - startMetric.top),
  }
}

function mergeOverlayBounds(
  left: {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
  } | null,
  right: {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
  } | null,
) {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }
  return {
    startRowOffset: Math.min(left.startRowOffset, right.startRowOffset),
    endRowOffset: Math.max(left.endRowOffset, right.endRowOffset),
    startColumnIndex: Math.min(left.startColumnIndex, right.startColumnIndex),
    endColumnIndex: Math.max(left.endColumnIndex, right.endColumnIndex),
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
    hideBorder?: boolean
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    topBleed?: number
    bottomBleed?: number
    leftBleed?: number
    rightBleed?: number
  },
): OverlaySegment {
  const topBleed = Math.max(0, options?.topBleed ?? 1)
  const bottomBleed = Math.max(0, options?.bottomBleed ?? 1)
  const leftBleed = options?.omitLeftBorder ? 0 : Math.max(0, options?.leftBleed ?? 1)
  const rightBleed = options?.omitRightBorder ? 0 : Math.max(0, options?.rightBleed ?? 1)
  return {
    key,
    style: {
      position: "absolute",
      top: `${top - topBleed}px`,
      left: `${left - leftBleed}px`,
      width: `${Math.max(1, width + leftBleed + rightBleed)}px`,
      height: `${Math.max(1, height + topBleed + bottomBleed)}px`,
      border: `${options?.hideBorder ? 0 : 2}px ${options?.borderStyle ?? "solid"} ${options?.borderColor ?? "var(--datagrid-selection-overlay-border)"}`,
      borderLeftWidth: options?.hideBorder || options?.omitLeftBorder ? "0px" : "2px",
      borderRightWidth: options?.hideBorder || options?.omitRightBorder ? "0px" : "2px",
      borderTopWidth: options?.hideBorder ? "0px" : "2px",
      borderBottomWidth: options?.hideBorder ? "0px" : "2px",
      background: options?.backgroundColor ?? "transparent",
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

function buildPaneOverlaySegments(
  metrics: {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
    top: number
    height: number
  } | null,
  pane: "left" | "center" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
  },
  viewportHeight = Math.max(0, bodyViewportClientHeight.value),
): OverlaySegment[] {
  if (!metrics) {
    return []
  }
  const isSingleSelectionSegment = keyPrefix === "selection"
    && metrics.startRowOffset === metrics.endRowOffset
    && metrics.startColumnIndex === metrics.endColumnIndex
  if (isSingleSelectionSegment) {
    return []
  }

  const topBleed = metrics.top <= 0 ? 0 : 1
  const bottomBleed = viewportHeight > 0 && metrics.top + metrics.height >= viewportHeight ? 0 : 1

  if (pane === "left") {
    const selectedColumns = pinnedLeftColumns.value.filter(column => {
      const index = columnIndexByKey(column.key)
      return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
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
    const paneWidth = leftPaneWidth.value
    const leftBleed = left <= 0 ? 0 : 1
    const rightBleed = paneWidth > 0 && left + width >= paneWidth ? 0 : 1
    return [
      buildOverlaySegment(
        `${keyPrefix}-left-${metrics.startRowOffset}-${metrics.endRowOffset}`,
        metrics.top,
        left,
        width,
        metrics.height,
        {
          hideBorder: isSingleSelectionSegment,
          omitRightBorder: metrics.endColumnIndex > lastSelectedIndex,
          topBleed,
          bottomBleed,
          leftBleed,
          rightBleed,
          borderColor: options?.borderColor,
          backgroundColor: options?.backgroundColor,
          borderStyle: options?.borderStyle,
        },
      ),
    ]
  }

  if (pane === "center") {
    const selectedColumns = renderedColumns.value.filter(column => {
      const index = columnIndexByKey(column.key)
      return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
    })
    if (selectedColumns.length === 0) {
      return []
    }

    let left = resolveLeftColumnSpacerWidth()
    for (const column of renderedColumns.value) {
      if (column.key === selectedColumns[0]?.key) {
        break
      }
      left += resolveColumnWidth(column)
    }

    const width = selectedColumns.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
    const firstSelectedIndex = columnIndexByKey(selectedColumns[0]?.key ?? "")
    const lastSelectedIndex = columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
    const contentWidth = Math.max(
      0,
      parsePixelValue(layout.value.gridContentStyle.width ?? layout.value.gridContentStyle.minWidth, 0),
    )
    const leftBleed = left <= 0 ? 0 : 1
    const rightBleed = contentWidth > 0 && left + width >= contentWidth ? 0 : 1
    return [
      buildOverlaySegment(
        `${keyPrefix}-center-${metrics.startRowOffset}-${metrics.endRowOffset}`,
        metrics.top,
        left,
        width,
        metrics.height,
        {
          hideBorder: isSingleSelectionSegment,
          omitLeftBorder: metrics.startColumnIndex < firstSelectedIndex,
          omitRightBorder: metrics.endColumnIndex > lastSelectedIndex,
          topBleed,
          bottomBleed,
          leftBleed,
          rightBleed,
          borderColor: options?.borderColor,
          backgroundColor: options?.backgroundColor,
          borderStyle: options?.borderStyle,
        },
      ),
    ]
  }

  const selectedColumns = pinnedRightColumns.value.filter(column => {
    const index = columnIndexByKey(column.key)
    return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
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
  const paneWidth = rightPaneWidth.value
  const leftBleed = left <= 0 ? 0 : 1
  const rightBleed = paneWidth > 0 && left + width >= paneWidth ? 0 : 1
  return [
    buildOverlaySegment(
      `${keyPrefix}-right-${metrics.startRowOffset}-${metrics.endRowOffset}`,
      metrics.top,
      left,
      width,
      metrics.height,
      {
        hideBorder: isSingleSelectionSegment,
        omitLeftBorder: metrics.startColumnIndex < firstSelectedIndex,
        topBleed,
        bottomBleed,
        leftBleed,
        rightBleed,
        borderColor: options?.borderColor,
        backgroundColor: options?.backgroundColor,
        borderStyle: options?.borderStyle,
      },
    ),
  ]
}

const normalizedMovePreviewRange = computed<OverlayRange | null>(() => {
  if (!selection.value.isRangeMoving || !selection.value.rangeMovePreviewRange) {
    return null
  }
  return rangesEqual(selection.value.rangeMovePreviewRange, selectionRange.value)
    ? null
    : selection.value.rangeMovePreviewRange
})

const visibleCombinedFillPreviewBounds = computed(() => {
  if (!visibleFillPreviewBounds.value) {
    return null
  }
  return mergeOverlayBounds(visibleSelectionBounds.value, visibleFillPreviewBounds.value)
})
const visibleSelectionOverlayMetrics = computed(() => {
  if (visibleFillPreviewBounds.value) {
    return null
  }
  return resolveOverlayMetrics(visibleSelectionBounds.value)
})
const visibleFillPreviewOverlayMetrics = computed(() => resolveOverlayMetrics(visibleCombinedFillPreviewBounds.value))
const visibleMovePreviewOverlayMetrics = computed(() => (
  resolveOverlayMetrics(resolveVisibleRangeBounds(normalizedMovePreviewRange.value))
))
const visiblePinnedBottomSelectionOverlayMetrics = computed(() => {
  if (visibleFillPreviewBounds.value) {
    return null
  }
  return resolveOverlayMetrics(
    resolvePinnedBottomVisibleRangeBounds(selectionRange.value),
    pinnedBottomRowMetrics.value,
  )
})
const visiblePinnedBottomFillPreviewOverlayMetrics = computed(() => resolveOverlayMetrics(
  mergeOverlayBounds(
    resolvePinnedBottomVisibleRangeBounds(selectionRange.value),
    resolvePinnedBottomVisibleRangeBounds(selection.value.fillPreviewRange),
  ),
  pinnedBottomRowMetrics.value,
))
const visiblePinnedBottomMovePreviewOverlayMetrics = computed(() => resolveOverlayMetrics(
  resolvePinnedBottomVisibleRangeBounds(normalizedMovePreviewRange.value),
  pinnedBottomRowMetrics.value,
))

const leftSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleSelectionOverlayMetrics.value, "left", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  })
))

const centerSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleSelectionOverlayMetrics.value, "center", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  })
))

const rightSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleSelectionOverlayMetrics.value, "right", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  })
))

const leftPinnedBottomSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomSelectionOverlayMetrics.value, "left", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

const centerPinnedBottomSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomSelectionOverlayMetrics.value, "center", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

const rightPinnedBottomSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomSelectionOverlayMetrics.value, "right", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

const leftFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleFillPreviewOverlayMetrics.value, "left", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  })
))

const centerFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleFillPreviewOverlayMetrics.value, "center", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  })
))

const rightFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleFillPreviewOverlayMetrics.value, "right", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  })
))

const leftPinnedBottomFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomFillPreviewOverlayMetrics.value, "left", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

const centerPinnedBottomFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomFillPreviewOverlayMetrics.value, "center", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

const rightPinnedBottomFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomFillPreviewOverlayMetrics.value, "right", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

const leftMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleMovePreviewOverlayMetrics.value, "left", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  })
))

const centerMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleMovePreviewOverlayMetrics.value, "center", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  })
))

const rightMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleMovePreviewOverlayMetrics.value, "right", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  })
))

const leftPinnedBottomMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomMovePreviewOverlayMetrics.value, "left", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

const centerPinnedBottomMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomMovePreviewOverlayMetrics.value, "center", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

const rightPinnedBottomMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visiblePinnedBottomMovePreviewOverlayMetrics.value, "right", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  }, bottomViewportEl.value?.clientHeight ?? 0)
))

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
  rowIndexCellStyle,
  rowIndexTabIndex,
  handleRowIndexClickSafe,
  handleRowIndexKeydown: handleRowIndexKeydownSafe,
  builtInCellClasses,
  cellStateClasses,
  resolveCellCustomClass,
  columnStyle,
  bodyCellPresentationStyle,
  bodyCellSelectionStyle,
  resolveCellCustomStyle,
  columnIndexByKey,
  cellTabIndex,
  checkboxCellRole,
  checkboxCellAriaChecked,
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
  checkboxCellRole,
  checkboxCellAriaChecked,
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
}

const leftPinnedPane = computed<DataGridTableStagePinnedPaneProps>(() => ({
  side: "left" as const,
  width: leftPaneWidth.value,
  style: leftPaneStyle.value,
  contentStyle: {} as CSSProperties,
  contentRef: captureLeftPaneContentRef,
  columns: pinnedLeftColumns.value,
  showIndexColumn: showRowIndex.value,
  displayRows: displayRows.value,
  topSpacerHeight: viewport.value.topSpacerHeight,
  bottomSpacerHeight: viewport.value.bottomSpacerHeight,
  selectionOverlaySegments: leftSelectionOverlaySegments.value,
  fillPreviewOverlaySegments: leftFillPreviewOverlaySegments.value,
  movePreviewOverlaySegments: leftMovePreviewOverlaySegments.value,
}))

const rightPinnedPane = computed<DataGridTableStagePinnedPaneProps>(() => ({
  side: "right" as const,
  width: rightPaneWidth.value,
  style: rightPaneStyle.value,
  contentStyle: {} as CSSProperties,
  contentRef: captureRightPaneContentRef,
  columns: pinnedRightColumns.value,
  showIndexColumn: false,
  displayRows: displayRows.value,
  topSpacerHeight: viewport.value.topSpacerHeight,
  bottomSpacerHeight: viewport.value.bottomSpacerHeight,
  selectionOverlaySegments: rightSelectionOverlaySegments.value,
  fillPreviewOverlaySegments: rightFillPreviewOverlaySegments.value,
  movePreviewOverlaySegments: rightMovePreviewOverlaySegments.value,
}))

const leftPinnedBottomPane = computed<DataGridTableStagePinnedPaneProps>(() => ({
  side: "left" as const,
  width: leftPaneWidth.value,
  style: leftPaneStyle.value,
  contentStyle: {} as CSSProperties,
  contentRef: captureLeftBottomPaneContentRef,
  columns: pinnedLeftColumns.value,
  showIndexColumn: showRowIndex.value,
  displayRows: pinnedBottomRows.value,
  selectionOverlaySegments: leftPinnedBottomSelectionOverlaySegments.value,
  fillPreviewOverlaySegments: leftPinnedBottomFillPreviewOverlaySegments.value,
  movePreviewOverlaySegments: leftPinnedBottomMovePreviewOverlaySegments.value,
}))

const rightPinnedBottomPane = computed<DataGridTableStagePinnedPaneProps>(() => ({
  side: "right" as const,
  width: rightPaneWidth.value,
  style: rightPaneStyle.value,
  contentStyle: {} as CSSProperties,
  contentRef: captureRightBottomPaneContentRef,
  columns: pinnedRightColumns.value,
  showIndexColumn: false,
  displayRows: pinnedBottomRows.value,
  selectionOverlaySegments: rightPinnedBottomSelectionOverlaySegments.value,
  fillPreviewOverlaySegments: rightPinnedBottomFillPreviewOverlaySegments.value,
  movePreviewOverlaySegments: rightPinnedBottomMovePreviewOverlaySegments.value,
}))

function cellStateClasses(row: TableRow, rowOffset: number, columnIndex: number): Record<string, boolean> {
  const columnKey = visibleColumns.value[columnIndex]?.key ?? ""
  const isAnchorCell = isVisualSelectionAnchorCell(rowOffset, columnIndex)
  return {
    "grid-cell--selected": !isAnchorCell && shouldHighlightSelectedCellVisual(rowOffset, columnIndex),
    "grid-cell--selection-anchor": isAnchorCell,
    "grid-cell--range-move-handle-hover": isRangeMoveHandleHoverCell(rowOffset, columnIndex),
    "grid-cell--fill-preview": isCellInFillPreviewSafe(rowOffset, columnIndex),
    "grid-cell--clipboard-pending": isCellInPendingClipboardRangeSafe(rowOffset, columnIndex),
    "grid-cell--clipboard-pending-top": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "top"),
    "grid-cell--clipboard-pending-right": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "right"),
    "grid-cell--clipboard-pending-bottom": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "bottom"),
    "grid-cell--clipboard-pending-left": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "left"),
    "grid-cell--editing": isEditingCellSafe(row, columnKey),
  }
}

defineExpose({
  getStageRootElement: () => stageRootEl.value,
  getHeaderElement: () => resolveHeaderShellElement(),
  getBodyViewportElement: () => bodyViewportEl.value,
  getVisibleRowMetrics: () => resolveVisibleRowMetricsFromDom(rowMetrics.value),
})
</script>
