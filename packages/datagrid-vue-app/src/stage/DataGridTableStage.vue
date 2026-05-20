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
      'grid-stage--scrolling': isBodyViewportScrolling,
      'grid-stage--coarse-pointer': isCoarsePointer,
      'grid-stage--interaction-touch': interactionMode === 'touch',
      'grid-stage--interaction-desktop': interactionMode === 'desktop',
      'grid-stage--single-cell-selection': isSingleSelectedCell,
      'grid-stage--additive-selection': isAdditiveSelection,
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
      :is-coarse-pointer="isCoarsePointer"
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

    <div
      ref="bodyShellRef"
      class="grid-body-shell"
      :style="[paneLayoutStyle, layout.bodyShellStyle]"
      @mouseleave="clearHoveredRow"
      @touchstart.passive="handleBodyTouchStart"
      @touchmove.passive="handleBodyTouchMove"
      @touchend.passive="handleBodyTouchEnd"
      @touchcancel.passive="handleBodyTouchEnd"
      @contextmenu.capture="handleBodyContextMenuCapture"
    >
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
        :perf-trace-enabled="perfTraceEnabled"
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
        :viewport-tab-index="bodyViewportTabIndex"
        :report-center-pane-diagnostics="props.reportCenterPaneDiagnostics"
        :report-fill-plumbing-state="props.reportFillPlumbingState"
        :report-fill-plumbing-detail="props.reportFillPlumbingDetail"
        :perf-trace-enabled="perfTraceEnabled"
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
        :perf-trace-enabled="perfTraceEnabled"
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
        :perf-trace-enabled="perfTraceEnabled"
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
        :viewport-tab-index="pinnedBottomViewportTabIndex"
        :report-center-pane-diagnostics="props.reportCenterPaneDiagnostics"
        :report-fill-plumbing-state="props.reportFillPlumbingState"
        :report-fill-plumbing-detail="props.reportFillPlumbingDetail"
        :perf-trace-enabled="perfTraceEnabled"
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
        :perf-trace-enabled="perfTraceEnabled"
      >
        <template #chrome>
          <canvas ref="rightBottomChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        </template>
      </DataGridTableStagePinnedPane>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type CSSProperties, type PropType } from "vue"
import DataGridTableStageHeader from "./DataGridTableStageHeader.vue"
import DataGridTableStageCenterPane from "./DataGridTableStageCenterPane.vue"
import DataGridTableStageFillActionMenu from "./DataGridTableStageFillActionMenu.vue"
import DataGridTableStagePinnedPane from "./DataGridTableStagePinnedPane.vue"
import type {
  DataGridTableStageBodyColumn as TableColumn,
  DataGridTableStageBodyRow as TableRow,
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
import {
  hasGroupCellRenderer,
  parsePixelValue,
  readPivotHeaderMeta,
  resolveColumnWidth as resolveColumnWidthFromHelper,
  resolveTextAlign,
} from "./dataGridTableStageHelpers"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"
import { isDataGridPlaceholderSurfaceRow } from "./useDataGridTableStagePlaceholderRows"
import { resolveDataGridPerfTraceEnabled } from "../perf/dataGridPerfTrace"
import { useDataGridPerfTrace } from "./useDataGridPerfTrace"
import { useDataGridStageCellRendering } from "./useDataGridStageCellRendering"
import { useDataGridStageCellState } from "./useDataGridStageCellState"
import { useDataGridStageFillAction } from "./useDataGridStageFillAction"
import { useDataGridStageFocusRuntime } from "./useDataGridStageFocusRuntime"
import { useDataGridStagePointerInteractions } from "./useDataGridStagePointerInteractions"
import { useDataGridStageRowState } from "./useDataGridStageRowState"
import { useDataGridStageRowIndex } from "./useDataGridStageRowIndex"
import {
  useDataGridStageViewportRuntime,
  type UseDataGridStageViewportRuntimeSyncers,
} from "./useDataGridStageViewportRuntime"
import { useDataGridStagePanes } from "./useDataGridStagePanes.grouped"
import { useDataGridStageRenderApis } from "./useDataGridStageRenderApis.grouped"
import { useDataGridStageChromeModel } from "./useDataGridStageChromeModel"
import { useDataGridStageChromeCanvas } from "./useDataGridStageChromeCanvas"
import { useDataGridStageOverlays } from "./useDataGridStageOverlays"
import { installDataGridTouchPanGuard } from "../gestures/dataGridTouchPanGuard"
import {
  isTouchGeneratedMouseEvent,
  resolveDataGridInteractionMode,
  shouldPrioritizeNativeScrollForMouseDown,
} from "./dataGridMouseEventGuards"

ensureDataGridAppStyles()

const TOUCH_PAN_CLICK_SUPPRESSION_THRESHOLD_PX = 8
const TOUCH_PAN_CLICK_SUPPRESSION_TIMEOUT_MS = 700
const TOUCH_LONG_PRESS_DELAY_MS = 520
const perfTraceEnabled = resolveDataGridPerfTraceEnabled()

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

function resolveColumnWidth(column: TableColumn): number {
  return resolveColumnWidthFromHelper(column, layout.value.columnStyle)
}

function handleCellMouseDown(event: MouseEvent, row: TableRow, rowOffset: number, columnIndex: number): void {
  if (shouldPrioritizeNativeScrollForMouseDown(event, interactionModeInput.value)) {
    return
  }
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
function isColumnEditable(column: TableColumn): boolean {
  return column.column.capabilities?.editable !== false
}

function bodyCellPresentationStyle(column: TableColumn): CSSProperties {
  const textAlign = resolveTextAlign(column.column.presentation?.align)
  return textAlign ? { textAlign } : {}
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

function cellTabIndex(rowOffset: number, columnIndex: number): number {
  if (hasVisibleRowIndexFocusTarget.value) {
    return -1
  }
  return rowStateRuntime?.isVisualSelectionAnchorCell(rowOffset, columnIndex) === true ? 0 : -1
}

function hasVisibleCellAnchorInRows(rowsList: readonly TableRow[]): boolean {
  for (let rowOffset = 0; rowOffset < rowsList.length; rowOffset += 1) {
    const row = rowsList[rowOffset]
    if (!row) {
      continue
    }
    const viewportRowOffset = resolveViewportRowOffset(row, rowOffset)
    for (let columnIndex = 0; columnIndex < visibleColumns.value.length; columnIndex += 1) {
      if (isSelectionAnchorCellSafe(viewportRowOffset, columnIndex)) {
        return true
      }
    }
  }
  return false
}

function hasVisibleFocusedRowIndexInRows(rowsList: readonly TableRow[]): boolean {
  if (!showRowIndex.value || typeof rows.value.isRowFocused !== "function") {
    return false
  }
  return rowsList.some(row => rows.value.isRowFocused?.(row) === true)
}

const hasVisibleCellFocusTarget = computed(() => (
  hasVisibleCellAnchorInRows(rows.value.displayRows) || hasVisibleCellAnchorInRows(rows.value.pinnedBottomRows ?? [])
))

const hasVisibleRowIndexFocusTarget = computed(() => (
  hasVisibleFocusedRowIndexInRows(rows.value.displayRows) || hasVisibleFocusedRowIndexInRows(rows.value.pinnedBottomRows ?? [])
))

const bodyViewportTabIndex = computed(() => (
  hasVisibleCellFocusTarget.value || hasVisibleRowIndexFocusTarget.value ? -1 : 0
))

const pinnedBottomViewportTabIndex = computed(() => -1)

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

function resolveInlineRowStateFill(
  row: TableRow,
  rowOffset: number,
  options: { fullBleed?: boolean } = {},
): CSSProperties | null {
  return rowStateRuntime?.resolveInlineRowStateFill(row, rowOffset, options) ?? null
}

function rowStateClasses(row: TableRow, rowOffset: number): Record<string, boolean> {
  return rowStateRuntime?.rowStateClasses(row, rowOffset) ?? {}
}

function bodyCellSelectionStyle(
  row: TableRow,
  column: TableColumn,
  rowOffset: number,
  columnIndex: number,
): CSSProperties {
  return rowStateRuntime?.bodyCellSelectionStyle(row, column, rowOffset, columnIndex) ?? {}
}

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

function clearTouchClickSuppressionTimer(): void {
  if (suppressTouchClickTimer == null || typeof window === "undefined") {
    suppressTouchClickTimer = null
    return
  }
  window.clearTimeout(suppressTouchClickTimer)
  suppressTouchClickTimer = null
}

function scheduleTouchClickSuppressionClear(): void {
  if (typeof window === "undefined") {
    return
  }
  clearTouchClickSuppressionTimer()
  suppressTouchClickTimer = window.setTimeout(() => {
    suppressNextTouchClick = false
    suppressNextTouchContextMenu = false
    suppressTouchClickTimer = null
  }, TOUCH_PAN_CLICK_SUPPRESSION_TIMEOUT_MS)
}

function clearTouchLongPressTimer(): void {
  if (touchLongPressTimer == null || typeof window === "undefined") {
    touchLongPressTimer = null
    return
  }
  window.clearTimeout(touchLongPressTimer)
  touchLongPressTimer = null
}

function clearPendingTouchLongPress(): void {
  clearTouchLongPressTimer()
  pendingTouchLongPress = null
}

function resolveTouchLongPressCell(target: EventTarget | null): Omit<NonNullable<typeof pendingTouchLongPress>, "identifier" | "clientX" | "clientY"> | null {
  if (!(target instanceof Element)) {
    return null
  }
  if (target.closest(".cell-fill-handle, .row-resize-handle, .cell-editor-control, input, button, textarea, select, [contenteditable='true']")) {
    return null
  }
  const cell = target.closest<HTMLElement>(".grid-cell[data-row-id][data-row-index][data-column-index]")
  if (!cell || !bodyShellRef.value?.contains(cell)) {
    return null
  }
  const columnIndex = Number(cell.dataset.columnIndex)
  const absoluteRowIndex = Number(cell.dataset.rowIndex)
  const rowId = cell.dataset.rowId
  if (!Number.isFinite(columnIndex) || !Number.isFinite(absoluteRowIndex) || rowId == null) {
    return null
  }
  const column = visibleColumns.value[columnIndex]
  const row = [...displayRows.value, ...pinnedBottomRows.value].find(candidate => String(candidate.rowId) === rowId)
  if (!row || !column || row.kind === "group" || column.column.meta?.rowSelection === true) {
    return null
  }
  return {
    row,
    rowOffset: Math.trunc(absoluteRowIndex) - viewport.value.viewportRowStart,
    column,
    columnIndex: Math.trunc(columnIndex),
    cell,
  }
}

function startTouchLongPress(event: TouchEvent, touch: Touch): void {
  clearPendingTouchLongPress()
  if (interactionMode.value !== "touch") {
    return
  }
  const target = resolveTouchLongPressCell(event.target)
  if (!target || typeof window === "undefined") {
    return
  }
  pendingTouchLongPress = {
    identifier: touch.identifier,
    clientX: touch.clientX,
    clientY: touch.clientY,
    ...target,
  }
  touchLongPressTimer = window.setTimeout(() => {
    const pending = pendingTouchLongPress
    touchLongPressTimer = null
    pendingTouchLongPress = null
    if (!pending) {
      return
    }
    suppressNextTouchClick = true
    suppressNextTouchContextMenu = true
    scheduleTouchClickSuppressionClear()
    pending.cell.focus({ preventScroll: true })
    const mouseDown = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: pending.clientX,
      clientY: pending.clientY,
    })
    Object.defineProperty(mouseDown, "currentTarget", {
      configurable: true,
      value: pending.cell,
    })
    interaction.value.handleCellMouseDown(mouseDown, pending.row, pending.rowOffset, pending.columnIndex)
  }, TOUCH_LONG_PRESS_DELAY_MS)
}

function cancelTouchLongPressIfMoved(touch: Touch): void {
  if (!pendingTouchLongPress || touch.identifier !== pendingTouchLongPress.identifier) {
    return
  }
  const deltaX = Math.abs(touch.clientX - pendingTouchLongPress.clientX)
  const deltaY = Math.abs(touch.clientY - pendingTouchLongPress.clientY)
  if (Math.max(deltaX, deltaY) >= TOUCH_PAN_CLICK_SUPPRESSION_THRESHOLD_PX) {
    clearPendingTouchLongPress()
  }
}

function handleBodyTouchStart(event: TouchEvent): void {
  const touch = event.touches.length === 1 ? readFirstTouch(event.touches) : null
  bodyTouchStart = touch
    ? { identifier: touch.identifier, clientX: touch.clientX, clientY: touch.clientY }
    : null
  if (touch) {
    startTouchLongPress(event, touch)
  } else {
    clearPendingTouchLongPress()
  }
}

function handleBodyTouchMove(event: TouchEvent): void {
  if (!bodyTouchStart) {
    return
  }
  const touch = readTouchAt(event.touches, bodyTouchStart.identifier)
  if (!touch) {
    bodyTouchStart = null
    clearPendingTouchLongPress()
    return
  }
  cancelTouchLongPressIfMoved(touch)
  const deltaX = Math.abs(touch.clientX - bodyTouchStart.clientX)
  const deltaY = Math.abs(touch.clientY - bodyTouchStart.clientY)
  if (Math.max(deltaX, deltaY) < TOUCH_PAN_CLICK_SUPPRESSION_THRESHOLD_PX) {
    return
  }
  suppressNextTouchClick = true
  scheduleTouchClickSuppressionClear()
}

function handleBodyTouchEnd(): void {
  bodyTouchStart = null
  clearPendingTouchLongPress()
}

function consumeTouchPanClickSuppression(event: MouseEvent): boolean {
  if (!suppressNextTouchClick || !isTouchGeneratedMouseEvent(event)) {
    return false
  }
  suppressNextTouchClick = false
  return true
}

function handleBodyContextMenuCapture(event: MouseEvent): void {
  if (!suppressNextTouchContextMenu) {
    return
  }
  suppressNextTouchContextMenu = false
  event.preventDefault()
  event.stopPropagation()
}

function handleBodyCellClick(
  event: MouseEvent,
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): void {
  if (consumeTouchPanClickSuppression(event)) {
    return
  }
  rowStateRuntime?.handleBodyCellClick(event, row, rowOffset, column, columnIndex)
}

function handleTouchSelectionHandleMouseDown(event: MouseEvent): void {
  event.preventDefault()
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const cell = handle?.closest<HTMLElement>(".grid-cell")
  cell?.focus({ preventScroll: true })
}

function createTouchSelectionMouseEvent(type: "mousedown" | "mousemove" | "mouseup", touch: Touch): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: touch.clientX,
    clientY: touch.clientY,
    shiftKey: type === "mousedown",
  })
}

function createTouchRangeMoveMouseEvent(type: "mousedown" | "mousemove" | "mouseup", touch: Touch): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: touch.clientX,
    clientY: touch.clientY,
  })
}

function handleTouchSelectionHandleTouchStart(event: TouchEvent, row: TableRow, rowOffset: number, columnIndex: number): void {
  event.preventDefault()
  clearPendingTouchLongPress()
  bodyTouchStart = null
  const touch = event.touches.length === 1 ? readFirstTouch(event.touches) : null
  if (!touch) {
    activeTouchSelectionHandleTouchId = null
    return
  }
  activeTouchSelectionHandleTouchId = touch.identifier
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const cell = handle?.closest<HTMLElement>(".grid-cell")
  cell?.focus({ preventScroll: true })
  const mouseDown = createTouchSelectionMouseEvent("mousedown", touch)
  if (cell) {
    Object.defineProperty(mouseDown, "currentTarget", {
      configurable: true,
      value: cell,
    })
  }
  interaction.value.handleCellMouseDown(mouseDown, row, rowOffset, columnIndex)
}

function handleTouchSelectionHandleTouchMove(event: TouchEvent): void {
  if (activeTouchSelectionHandleTouchId == null || typeof window === "undefined") {
    return
  }
  const touch = readTouchAt(event.touches, activeTouchSelectionHandleTouchId)
  if (!touch) {
    return
  }
  event.preventDefault()
  window.dispatchEvent(createTouchSelectionMouseEvent("mousemove", touch))
}

function handleTouchSelectionHandleTouchEnd(event: TouchEvent): void {
  if (activeTouchSelectionHandleTouchId == null || typeof window === "undefined") {
    activeTouchSelectionHandleTouchId = null
    return
  }
  const touch = readTouchAt(event.changedTouches, activeTouchSelectionHandleTouchId)
  activeTouchSelectionHandleTouchId = null
  if (!touch) {
    return
  }
  event.preventDefault()
  window.dispatchEvent(createTouchSelectionMouseEvent("mouseup", touch))
}

function handleTouchRangeMoveHandleMouseDown(event: MouseEvent): void {
  event.preventDefault()
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const cell = handle?.closest<HTMLElement>(".grid-cell")
  cell?.focus({ preventScroll: true })
}

function handleTouchRangeMoveHandleTouchStart(event: TouchEvent, row: TableRow, rowOffset: number, columnIndex: number): void {
  event.preventDefault()
  clearPendingTouchLongPress()
  bodyTouchStart = null
  const touch = event.touches.length === 1 ? readFirstTouch(event.touches) : null
  if (!touch) {
    activeTouchRangeMoveHandleTouchId = null
    return
  }
  activeTouchRangeMoveHandleTouchId = touch.identifier
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const cell = handle?.closest<HTMLElement>(".grid-cell")
  cell?.focus({ preventScroll: true })
  const mouseDown = createTouchRangeMoveMouseEvent("mousedown", touch)
  if (cell) {
    Object.defineProperty(mouseDown, "currentTarget", {
      configurable: true,
      value: cell,
    })
  }
  interaction.value.handleCellMouseDown(mouseDown, row, rowOffset, columnIndex)
}

function handleTouchRangeMoveHandleTouchMove(event: TouchEvent): void {
  if (activeTouchRangeMoveHandleTouchId == null || typeof window === "undefined") {
    return
  }
  const touch = readTouchAt(event.touches, activeTouchRangeMoveHandleTouchId)
  if (!touch) {
    return
  }
  event.preventDefault()
  window.dispatchEvent(createTouchRangeMoveMouseEvent("mousemove", touch))
}

function handleTouchRangeMoveHandleTouchEnd(event: TouchEvent): void {
  if (activeTouchRangeMoveHandleTouchId == null || typeof window === "undefined") {
    activeTouchRangeMoveHandleTouchId = null
    return
  }
  const touch = readTouchAt(event.changedTouches, activeTouchRangeMoveHandleTouchId)
  activeTouchRangeMoveHandleTouchId = null
  if (!touch) {
    return
  }
  event.preventDefault()
  window.dispatchEvent(createTouchRangeMoveMouseEvent("mouseup", touch))
}

function isEditingCellSafeBase(row: TableRow, columnKey: string): boolean {
  const evaluate = editing.value.isEditingCell
  return typeof evaluate === "function"
    ? evaluate(row, columnKey)
    : false
}

function isCellEditableSafeBase(
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

function isVisualSelectionAnchorCell(rowOffset: number, columnIndex: number): boolean {
  return rowStateRuntime?.isVisualSelectionAnchorCell(rowOffset, columnIndex) === true
}

function shouldHighlightSelectedCellVisual(rowOffset: number, columnIndex: number): boolean {
  return rowStateRuntime?.shouldHighlightSelectedCellVisual(rowOffset, columnIndex) === true
}

function isSelectionAnchorCellSafe(rowOffset: number, columnIndex: number): boolean {
  return rowStateRuntime?.isSelectionAnchorCellSafe(rowOffset, columnIndex) === true
}

function isCellInFillPreviewSafe(rowOffset: number, columnIndex: number): boolean {
  return rowStateRuntime?.isCellInFillPreviewSafe(rowOffset, columnIndex) === true
}

function isCellInPendingClipboardRangeSafe(rowOffset: number, columnIndex: number): boolean {
  return rowStateRuntime?.isCellInPendingClipboardRangeSafe(rowOffset, columnIndex) === true
}

function isCellOnPendingClipboardEdgeSafe(
  rowOffset: number,
  columnIndex: number,
  edge: "top" | "right" | "bottom" | "left",
): boolean {
  return rowStateRuntime?.isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, edge) === true
}

function isEditingCellSafe(row: TableRow, columnKey: string): boolean {
  return rowStateRuntime?.isEditingCellSafe(row, columnKey) === true
}

function isCellEditableSafe(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): boolean {
  return rowStateRuntime?.isCellEditableSafe(row, rowOffset, column, columnIndex) === true
}

function isCellOnSelectionEdgeSafe(
  rowOffset: number,
  columnIndex: number,
  edge: "top" | "right" | "bottom" | "left",
): boolean {
  return rowStateRuntime?.isCellOnSelectionEdgeSafe(rowOffset, columnIndex, edge) === true
}

function isFillHandleCellSafe(rowOffset: number, columnIndex: number): boolean {
  return rowStateRuntime?.isFillHandleCellSafe(rowOffset, columnIndex) === true
}

function isVisibleCellEditableByAbsoluteCoord(rowIndex: number, columnIndex: number): boolean {
  return rowStateRuntime?.isVisibleCellEditableByAbsoluteCoord(rowIndex, columnIndex) === true
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
const gridFocusOwned = ref(false)
const hoveredRowIndex = ref<number | null>(null)
const isCoarsePointer = ref(false)
const isBodyViewportScrolling = ref(false)
const interactionModeInput = computed(() => ({
  interactionMode: "auto" as const,
  isCoarsePointer: isCoarsePointer.value,
}))
const interactionMode = computed(() => resolveDataGridInteractionMode(interactionModeInput.value))
const suppressHoverInteractions = computed(() => isCoarsePointer.value || isBodyViewportScrolling.value)
const preferLightweightCellRendering = computed(() => interactionMode.value === "touch" && isBodyViewportScrolling.value)
let coarsePointerQuery: MediaQueryList | null = null
let coarsePointerQueryListener: ((event: MediaQueryListEvent) => void) | null = null
let teardownTouchPanGuard: (() => void) | null = null
let bodyTouchStart: { identifier: number; clientX: number; clientY: number } | null = null
let pendingTouchLongPress: {
  identifier: number
  clientX: number
  clientY: number
  row: TableRow
  rowOffset: number
  column: TableColumn
  columnIndex: number
  cell: HTMLElement
} | null = null
let touchLongPressTimer: number | null = null
let activeTouchSelectionHandleTouchId: number | null = null
let activeTouchRangeMoveHandleTouchId: number | null = null
let suppressNextTouchClick = false
let suppressNextTouchContextMenu = false
let suppressTouchClickTimer: number | null = null
const gridChromeSyncers = shallowRef<UseDataGridStageViewportRuntimeSyncers>({
  syncBodyViewportMetrics: () => {},
  syncPinnedBottomViewportMetrics: () => {},
  syncPinnedBottomViewportScrollLeft: () => {},
  scheduleGridChromeRedraw: () => {},
  flushGridChromeRedraw: () => {},
  connectGridChromeResizeObserver: () => {},
  disconnectGridChromeResizeObserver: () => {},
})

function clearHoveredRow(): void {
  if (hoveredRowIndex.value == null) {
    return
  }
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
  if (!rows.value.rowHover || suppressHoverInteractions.value) {
    return
  }
  hoveredRowIndex.value = resolveAbsoluteRowIndex(row, rowOffset)
}

function isHoveredRow(row: TableRow, rowOffset: number): boolean {
  return !suppressHoverInteractions.value && rows.value.rowHover === true && hoveredRowIndex.value === resolveAbsoluteRowIndex(row, rowOffset)
}

function isStripedRow(row: TableRow, rowOffset: number): boolean {
  return rows.value.stripedRows === true && resolveAbsoluteRowIndex(row, rowOffset) % 2 === 1
}

const rowIndexState = useDataGridStageRowIndex({
  rows,
  layout,
  viewportRowStart: computed(() => viewport.value.viewportRowStart),
  selectionRange,
  selectionRanges,
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
  isBodyViewportScrolling: runtimeBodyViewportScrolling,
  runWhenBodyViewportScrollIdle,
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
  gridChromeSyncers,
})

watch(runtimeBodyViewportScrolling, value => {
  isBodyViewportScrolling.value = value
}, { immediate: true })

useDataGridPerfTrace({
  viewport,
  displayRows,
  bodyViewportScrollTop,
  perfTraceEnabled,
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

const handleRowContainerClick = handleRowClickSafe

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
  isCellEditableSafe: isCellEditableSafeBase,
  isEditingCellSafe: isEditingCellSafeBase,
  columnIndexByKey,
  suppressInlineEditStart: isBodyViewportScrolling,
  preferLightweightCellRendering,
  perfTraceEnabled,
})

const rowStateRuntime = useDataGridStageRowState({
  rows,
  selection,
  selectionRange,
  selectionRanges,
  displayRows,
  visibleColumns,
  viewportRowStart: computed(() => viewport.value.viewportRowStart),
  isHoveredRow,
  isStripedRow,
  resolveAbsoluteRowIndex,
  isCellSelectedSafe,
  isEditingCellSafe: isEditingCellSafeBase,
  isCellEditableSafe: isCellEditableSafeBase,
  resolveCellEditorMode,
  startInlineEditIfAllowed,
  handleCellClick: (row, rowOffset, column, columnIndex) => interaction.value.handleCellClick(row, rowOffset, column, columnIndex),
  hasExplicitGroupCellRenderer,
  cells: computed(() => ({
    isSelectionAnchorCell: cells.value.isSelectionAnchorCell,
    isCellInFillPreview: cells.value.isCellInFillPreview,
    isCellInPendingClipboardRange: cells.value.isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge: cells.value.isCellOnPendingClipboardEdge,
    isCellOnSelectionEdge: cells.value.isCellOnSelectionEdge,
  })),
})
const isRangeMoveHandleHoverCellBridge = shallowRef<(rowOffset: number, columnIndex: number) => boolean>(() => false)

function isRangeMoveHandleHoverCellSafe(rowOffset: number, columnIndex: number): boolean {
  return isRangeMoveHandleHoverCellBridge.value(rowOffset, columnIndex)
}

function isTouchSelectionAnchorHandleCell(row: TableRow, rowOffset: number, columnIndex: number): boolean {
  if (interactionMode.value !== "touch" || isBodyViewportScrolling.value || row.kind === "group") {
    return false
  }
  const column = visibleColumns.value[columnIndex]
  if (!column || isEditingCellSafeBase(row, column.key)) {
    return false
  }
  if (isCellEditableSafeBase(row, rowOffset, column, columnIndex) && isFillHandleCellSafe(rowOffset, columnIndex)) {
    return false
  }
  return isVisualSelectionAnchorCell(rowOffset, columnIndex)
}

function isTouchRangeMoveHandleCell(row: TableRow, rowOffset: number, columnIndex: number): boolean {
  if (
    interactionMode.value !== "touch"
    || isBodyViewportScrolling.value
    || mode.value !== "base"
    || row.kind === "group"
    || selection.value?.rangeMoveEnabled !== true
    || selection.value?.isFillDragging === true
  ) {
    return false
  }
  const column = visibleColumns.value[columnIndex]
  if (!column || isEditingCellSafeBase(row, column.key)) {
    return false
  }
  return isVisualSelectionAnchorCell(rowOffset, columnIndex)
    && isCellEditableSafeBase(row, rowOffset, column, columnIndex)
}

const {
  builtInCellClasses,
  cellStateClasses,
  cellAriaSelected,
  cellAriaRole,
  cellAriaChecked,
  cellAriaPressed,
  cellAriaLabel,
  cellAriaDisabled,
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
  isCellSelectedSafe,
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
  perfTraceEnabled,
})

gridChromeSyncers.value = {
  syncBodyViewportMetrics,
  syncPinnedBottomViewportMetrics,
  syncPinnedBottomViewportScrollLeft,
  scheduleGridChromeRedraw,
  flushGridChromeRedraw,
  connectGridChromeResizeObserver,
  disconnectGridChromeResizeObserver,
}

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

function hasVisibleInlineEditor(): boolean {
  return displayRows.value.some(row => (
    visibleColumns.value.some(column => editing.value.isEditingCell(row, column.key))
  ))
}

const focusRuntime = useDataGridStageFocusRuntime({
  bodyShellRef,
  bodyViewportEl,
  leftPaneContentRef,
  rightPaneContentRef,
  leftBottomPaneContentRef,
  rightBottomPaneContentRef,
  displayRows,
  visibleColumns,
  viewportRowStart: computed(() => viewport.value.viewportRowStart),
  resolveAbsoluteRowIndex,
  isSelectionAnchorCellSafe,
  isCellEditableSafe: isCellEditableSafeBase,
  isBodyViewportScrolling,
  runWhenBodyViewportScrollIdle,
  shouldRestoreAnchorFocus: () => !hasVisibleInlineEditor() && !isFillDragging.value && !isRangeMoving.value,
})

const remountFocusSignature = computed(() => {
  const firstRow = displayRows.value[0]
  const lastRow = displayRows.value[displayRows.value.length - 1]
  const firstColumn = visibleColumns.value[0]
  const lastColumn = visibleColumns.value[visibleColumns.value.length - 1]
  return [
    gridFocusOwned.value ? "focused" : "unfocused",
    viewport.value.viewportRowStart,
    displayRows.value.length,
    firstRow ? String(firstRow.rowId) : "",
    lastRow ? String(lastRow.rowId) : "",
    visibleColumns.value.length,
    firstColumn?.key ?? "",
    lastColumn?.key ?? "",
  ].join("|")
})

watch(
  remountFocusSignature,
  async () => {
    if (!gridFocusOwned.value) {
      return
    }
    await nextTick()
    focusRuntime.restoreAnchorCellFocus()
  },
  { flush: "post" },
)

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
  resolveVisibleCellElement: focusRuntime.resolveVisibleCellElement,
  resolveVisibleRowElement: focusRuntime.resolveVisibleRowElement,
  resolveRelativeCellRect: focusRuntime.resolveRelativeCellRect,
  isVisibleCellEditableByAbsoluteCoord,
  restoreAnchorCellFocus: focusRuntime.restoreAnchorCellFocus,
})

const {
  clearRangeMoveHandleHover,
  isRangeMoveHandleHoverCell: isRangeMoveHandleHoverCellFromPointer,
  handleCellMouseMove,
  handleFillHandleMouseDown,
  handleFillHandleDoubleClick,
  handleFillHandleTouchStart,
  handleFillHandleTouchMove,
  handleFillHandleTouchEnd,
} = useDataGridStagePointerInteractions({
  mode,
  selection,
  selectionRange,
  visibleColumns,
  displayRows,
  viewportRowStart: computed(() => viewport.value.viewportRowStart),
  fillActionMenuOpen,
  interactionModeInput,
  suppressHoverInteractions,
  isCellSelectedSafe,
  isCellEditableSafe,
  isCellOnSelectionEdgeSafe,
})

isRangeMoveHandleHoverCellBridge.value = isRangeMoveHandleHoverCellFromPointer

function syncCoarsePointerState(): void {
  isCoarsePointer.value = coarsePointerQuery?.matches === true
}

function shouldRouteTableTouchPan(target: EventTarget | null): boolean {
  const root = stageRootEl.value
  if (!root || !(target instanceof Element) || !root.contains(target)) {
    return false
  }
  if (bodyViewportEl.value?.contains(target)) {
    return false
  }
  const linkedScrollSurface = target.closest(".grid-body-pane, .grid-header-shell")
  return linkedScrollSurface instanceof HTMLElement && root.contains(linkedScrollSurface)
}

function isBodyGridFocusTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) {
    return false
  }
  return (
    target === bodyViewportEl.value
    || bodyShellRef.value?.contains(target) === true
    || leftPaneContentRef.value?.contains(target) === true
    || rightPaneContentRef.value?.contains(target) === true
    || leftBottomPaneContentRef.value?.contains(target) === true
    || rightBottomPaneContentRef.value?.contains(target) === true
  )
}

function handleStageFocusIn(event: FocusEvent): void {
  if (isBodyGridFocusTarget(event.target)) {
    gridFocusOwned.value = true
  }
}

function handleStageFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null
  if (!nextTarget) {
    return
  }
  if (!isBodyGridFocusTarget(nextTarget)) {
    gridFocusOwned.value = false
  }
}

onMounted(() => {
  if (stageRootEl.value) {
    stageRootEl.value.addEventListener("focusin", handleStageFocusIn)
    stageRootEl.value.addEventListener("focusout", handleStageFocusOut)
    teardownTouchPanGuard = installDataGridTouchPanGuard({
      root: stageRootEl.value,
      resolveScrollContainers: () => [bodyViewportEl.value],
      shouldHandleTarget: shouldRouteTableTouchPan,
    })
  }
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return
  }
  coarsePointerQuery = window.matchMedia("(hover: none) and (pointer: coarse)")
  coarsePointerQueryListener = event => {
    isCoarsePointer.value = event.matches
  }
  syncCoarsePointerState()
  if (typeof coarsePointerQuery.addEventListener === "function") {
    coarsePointerQuery.addEventListener("change", coarsePointerQueryListener)
  } else {
    coarsePointerQuery.addListener(coarsePointerQueryListener)
  }
})

onBeforeUnmount(() => {
  stageRootEl.value?.removeEventListener("focusin", handleStageFocusIn)
  stageRootEl.value?.removeEventListener("focusout", handleStageFocusOut)
  teardownTouchPanGuard?.()
  teardownTouchPanGuard = null
  clearTouchClickSuppressionTimer()
  clearPendingTouchLongPress()
  bodyTouchStart = null
  activeTouchSelectionHandleTouchId = null
  activeTouchRangeMoveHandleTouchId = null
  suppressNextTouchClick = false
  suppressNextTouchContextMenu = false
  if (!coarsePointerQuery || !coarsePointerQueryListener) {
    return
  }
  if (typeof coarsePointerQuery.removeEventListener === "function") {
    coarsePointerQuery.removeEventListener("change", coarsePointerQueryListener)
  } else {
    coarsePointerQuery.removeListener(coarsePointerQueryListener)
  }
  coarsePointerQuery = null
  coarsePointerQueryListener = null
})

watch(suppressHoverInteractions, suppressed => {
  if (suppressed) {
    clearHoveredRow()
    clearRangeMoveHandleHover()
  }
})

const rowRuntime = computed(() => ({
  rows,
  resolveAbsoluteRowIndex,
  resolveViewportRowOffset,
  rowStateClasses,
  handleRowContainerClick,
  setHoveredRow,
  isFullRowSelectionSafe,
  rowIndexColumnStyle: resolvedRowIndexColumnStyle,
  rowIndexCellClasses,
  rowIndexCellStyle,
  rowIndexTabIndex,
  isRowIndexDraggable: (row: TableRow) => !isCoarsePointer.value && isRowIndexDraggable(row),
  handleRowIndexClickSafe,
  handleRowIndexKeydownSafe,
  handleRowIndexDragStart,
  handleRowIndexDragOver,
  handleRowIndexDrop,
  clearRowIndexDragState,
  columnIndexByKey,
}))

const cellRuntime = computed(() => ({
  visibleColumns: visibleColumns.value,
  cells: {
    isSelectionAnchorCell: cells.value.isSelectionAnchorCell,
    isCellInFillPreview: cells.value.isCellInFillPreview,
    isCellInPendingClipboardRange: cells.value.isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge: cells.value.isCellOnPendingClipboardEdge,
    isCellOnSelectionEdge: cells.value.isCellOnSelectionEdge,
    readCell: cells.value.readCell,
    readDisplayCell: cells.value.readDisplayCell,
  },
  isCellEditableSafe: isCellEditableSafeBase,
  isEditingCellSafe: isEditingCellSafeBase,
  isCellSelectedSafe,
  isTouchSelectionAnchorHandleCell,
  isTouchRangeMoveHandleCell,
  isSelectionAnchorCellSafe,
  shouldHighlightSelectedCellVisual,
  isCellInFillPreviewSafe,
  isCellInPendingClipboardRangeSafe,
  isCellOnPendingClipboardEdgeSafe,
  isCellOnSelectionEdgeSafe,
  isFillHandleCellSafe,
  isVisibleCellEditableByAbsoluteCoord,
  builtInCellClasses,
  cellStateClasses,
  resolveCellCustomClass,
  columnStyle,
  bodyCellPresentationStyle,
  bodyCellSelectionStyle,
  resolveCellCustomStyle,
  cellTabIndex,
  cellAriaSelected,
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
  handleTouchSelectionHandleMouseDown,
  handleTouchSelectionHandleTouchStart,
  handleTouchSelectionHandleTouchMove,
  handleTouchSelectionHandleTouchEnd,
  handleTouchRangeMoveHandleMouseDown,
  handleTouchRangeMoveHandleTouchStart,
  handleTouchRangeMoveHandleTouchMove,
  handleTouchRangeMoveHandleTouchEnd,
  handleFillHandleMouseDown,
  handleFillHandleDoubleClick,
  handleFillHandleTouchStart,
  handleFillHandleTouchMove,
  handleFillHandleTouchEnd,
  shouldRenderCheckboxCell,
  checkboxIndicatorClass,
  checkboxIndicatorMarkClass,
}))

const editorRuntime = computed(() => ({
  mode: mode.value,
  rows,
  cells,
  editing,
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
}))

const viewportRuntime = computed(() => ({
  handleCenterViewportScroll,
  handleBodyViewportWheel,
  handleViewportKeydown: (event: KeyboardEvent) => viewport.value.handleViewportKeydown(event),
  handleLinkedViewportWheel,
}))

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

const isAdditiveSelection = computed(() => selectionRanges.value.length > 1)

function columnIndexByKey(columnKey: string): number {
  return visibleColumnIndexByKey.value.get(columnKey) ?? 0
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
  bodyViewportScrollTop,
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
  isAdditiveSelection,
  isFillDragging,
  isRangeMoving,
  resolveVisibleRangeBounds,
  resolvePinnedBottomVisibleRangeBounds,
  customOverlays,
  perfTraceEnabled,
})

const layoutRuntime = computed(() => ({
  leftPaneWidth: leftPaneWidth.value,
  rightPaneWidth: rightPaneWidth.value,
  bodyViewportClientWidth: bodyViewportClientWidth.value,
  bodyViewportClientHeight: bodyViewportClientHeight.value,
  pinnedBottomViewportClientHeight: pinnedBottomViewportClientHeight.value,
  headerShellHeight: headerShellHeight.value,
  headerViewportClientWidth: headerViewportClientWidth.value,
}))

const paneRuntime = computed(() => ({
  leftPaneContentRef,
  rightPaneContentRef,
  leftBottomPaneContentRef,
  rightBottomPaneContentRef,
  displayRows,
  pinnedBottomRows,
  showRowIndex: rowIndexState.showRowIndex,
  pinnedLeftColumns,
  pinnedRightColumns,
}))

const overlayRuntime = computed(() => ({
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
}))

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
  layoutRuntime,
  paneRuntime,
  overlayRuntime,
})

const {
  pinnedPaneRenderApi,
  centerPaneRenderApi,
} = useDataGridStageRenderApis({
  rowRuntime,
  cellRuntime,
  editorRuntime,
  viewportRuntime,
})

defineExpose({
  getStageRootElement: () => stageRootEl.value,
  getHeaderElement: () => stageRootEl.value?.querySelector<HTMLElement>(".grid-header-shell") ?? null,
  getBodyViewportElement: () => bodyViewportEl.value,
  getVisibleRowMetrics: () => resolveVisibleRowMetricsFromDom(rowMetrics.value),
})
</script>
