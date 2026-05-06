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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance, type CSSProperties, type PropType, type VNodeChild } from "vue"
import {
  buildDataGridCellRenderModel,
  getDataGridRowRenderMeta,
  invokeDataGridCellInteraction,
  resolveDataGridCellInteraction,
  type DataGridCellInteractionInvocationTrigger,
} from "@affino/datagrid-vue"
import {
  useDataGridLinkedPaneScrollSync,
  useDataGridManagedWheelScroll,
} from "@affino/datagrid-vue/advanced"
import { restoreDataGridFocus } from "@affino/datagrid-vue/app"
import {
  buildDataGridChromeRenderModel,
  type DataGridChromePaneModel,
  type DataGridChromeRowBand,
} from "@affino/datagrid-chrome"
import DataGridTableStageHeader from "./DataGridTableStageHeader.vue"
import DataGridTableStageCenterPane from "./DataGridTableStageCenterPane.vue"
import DataGridTableStageFillActionMenu from "./DataGridTableStageFillActionMenu.vue"
import DataGridTableStagePinnedPane from "./DataGridTableStagePinnedPane.vue"
import {
  resolveDataGridVirtualChromeRowMetrics,
  resolveDeviceAlignedCanvasLineWidth,
  resolveDeviceAlignedCanvasStrokeCenter,
} from "./dataGridChromeCanvasMath"
import type {
  DataGridTableStageBodyColumn as TableColumn,
  DataGridTableStageBodyRow as TableRow,
  DataGridTableStageCenterPaneRenderApi,
  DataGridTableStageOverlayLane,
  DataGridTableStageOverlaySegment as OverlaySegment,
  DataGridTableStagePinnedPaneProps,
  DataGridTableStagePinnedPaneRenderApi,
  DataGridTableStageSelectEditorOption as SelectEditorOption,
  DataGridTableStageSelectEditorOptionsLoader as SelectEditorOptionsLoader,
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
import type {
  DataGridAppCellRendererInteractiveContext,
  DataGridAppRowSurfaceContext,
} from "../config/dataGridFormulaOptions"
import { installDataGridTouchPanGuard } from "../gestures/dataGridTouchPanGuard"
import type { DataGridFilterableComboboxOption } from "../overlays/dataGridFilterableCombobox"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"
import { isDataGridPlaceholderSurfaceRow } from "./useDataGridTableStagePlaceholderRows"

ensureDataGridAppStyles()

const DATA_GRID_PERF_TRACE_QUERY_PARAM = "dgPerfTrace"
const DATA_GRID_PERF_TRACE_STORAGE_KEY = "affino-datagrid-perf-trace"
const DATA_GRID_PERF_STORE_KEY = "__AFFINO_DATAGRID_PERF__"
const DATA_GRID_PERF_SAMPLE_LIMIT = 400

type DataGridPerfSample = {
  scope: string
  ts: number
  totalMs: number
  [key: string]: string | number
}

type DataGridPerfStore = {
  samples: DataGridPerfSample[]
  push: (sample: DataGridPerfSample) => void
  clear: () => void
  latest: (scope?: string) => DataGridPerfSample | null
  summary: () => Array<{ scope: string; count: number; meanMs: number; p95Ms: number; maxMs: number }>
}

function parseDataGridBooleanToken(value: string | null): boolean | null {
  if (!value) {
    return null
  }
  const normalizedValue = value.trim().toLowerCase()
  if (normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "on") {
    return true
  }
  if (normalizedValue === "0" || normalizedValue === "false" || normalizedValue === "off") {
    return false
  }
  return null
}

function resolveDataGridPerfTraceEnabled(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  const queryFlag = parseDataGridBooleanToken(
    new URLSearchParams(window.location.search).get(DATA_GRID_PERF_TRACE_QUERY_PARAM),
  )
  if (queryFlag != null) {
    return queryFlag
  }
  try {
    const storedFlag = parseDataGridBooleanToken(
      window.localStorage?.getItem(DATA_GRID_PERF_TRACE_STORAGE_KEY) ?? null,
    )
    return storedFlag ?? false
  }
  catch {
    return false
  }
}

function resolveDataGridPerfNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function createDataGridPerfStore(): DataGridPerfStore {
  const samples: DataGridPerfSample[] = []
  return {
    samples,
    push(sample) {
      samples.push(sample)
      if (samples.length > DATA_GRID_PERF_SAMPLE_LIMIT) {
        samples.splice(0, samples.length - DATA_GRID_PERF_SAMPLE_LIMIT)
      }
    },
    clear() {
      samples.length = 0
    },
    latest(scope) {
      if (!scope) {
        return samples.length > 0 ? (samples[samples.length - 1] ?? null) : null
      }
      for (let index = samples.length - 1; index >= 0; index -= 1) {
        if (samples[index]?.scope === scope) {
          return samples[index] ?? null
        }
      }
      return null
    },
    summary() {
      const grouped = new Map<string, number[]>()
      for (const sample of samples) {
        const bucket = grouped.get(sample.scope) ?? []
        bucket.push(sample.totalMs)
        grouped.set(sample.scope, bucket)
      }
      return Array.from(grouped.entries()).map(([scope, values]) => {
        const sortedValues = [...values].sort((left, right) => left - right)
        const total = sortedValues.reduce((sum, value) => sum + value, 0)
        const p95Index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * 0.95) - 1))
        return {
          scope,
          count: sortedValues.length,
          meanMs: total / Math.max(1, sortedValues.length),
          p95Ms: sortedValues[p95Index] ?? 0,
          maxMs: sortedValues.length > 0 ? (sortedValues[sortedValues.length - 1] ?? 0) : 0,
        }
      })
    },
  }
}

function resolveDataGridPerfStore(): DataGridPerfStore | null {
  if (typeof window === "undefined") {
    return null
  }
  const perfWindow = window as typeof window & { [DATA_GRID_PERF_STORE_KEY]?: DataGridPerfStore }
  if (!perfWindow[DATA_GRID_PERF_STORE_KEY]) {
    perfWindow[DATA_GRID_PERF_STORE_KEY] = createDataGridPerfStore()
  }
  return perfWindow[DATA_GRID_PERF_STORE_KEY] ?? null
}

function recordDataGridPerfSample(sample: DataGridPerfSample): void {
  resolveDataGridPerfStore()?.push(sample)
}

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
const perfTraceEnabled = resolveDataGridPerfTraceEnabled()

if (perfTraceEnabled) {
  resolveDataGridPerfStore()
}

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

function updateEditingCellValue(value: string): void {
  editing.value.updateEditingCellValue(value)
}

function emitRuntimeBodyDiagnostics(reason: string): void {
  const viewportStart = viewport.value.viewportRowStart
  const viewportEnd = viewport.value.viewportRowEnd ?? (viewportStart + Math.max(0, displayRows.value.length - 1))
  const visibleRows = displayRows.value
  const firstVisibleRows = visibleRows
    .slice(0, 5)
    .map(row => String(row.rowId))
    .join(", ")
  const sampleVisibleIndex = visibleRows.findIndex(row => String(row.rowId) === "srv-000025")
  const sampleRow = sampleVisibleIndex >= 0 ? visibleRows[sampleVisibleIndex] : null
  const sampleValue = sampleRow && sampleRow.kind !== "group"
    ? String((sampleRow.row as Record<string, unknown>).region ?? "none")
    : "none"
  props.reportFillPlumbingDetail?.("runtime_viewport_range", `${viewportStart}..${viewportEnd}`)
  props.reportFillPlumbingDetail?.("runtime_visible_first5", firstVisibleRows || "none")
  props.reportFillPlumbingDetail?.("runtime_sample_row25_visible_index", sampleVisibleIndex >= 0 ? String(sampleVisibleIndex) : "none")
  props.reportFillPlumbingDetail?.("runtime_sample_row25_region", sampleValue)
  props.reportFillPlumbingDetail?.("runtime_redraw_reason", reason)
  props.reportFillPlumbingState?.("runtime_redraw_happened", true)
}

function handleEditorKeydown(event: KeyboardEvent): void {
  editing.value.handleEditorKeydown(event)
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

function hasGroupCellRenderer(column: TableColumn): boolean {
  const authoredColumn = column.column as typeof column.column & {
    groupCellRenderer?: unknown
  }
  return typeof authoredColumn.groupCellRenderer === "function"
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

function rowIndexCellStyle(row: TableRow, rowOffset: number): CSSProperties {
  const rowStateFill = resolveInlineRowStateFill(row, rowOffset, { fullBleed: true })
  if (!rowStateFill) {
    return resolvedRowIndexColumnStyle.value
  }
  return {
    ...resolvedRowIndexColumnStyle.value,
    ...rowStateFill,
  }
}

function isFullRowSelectionIndex(rowIndex: number): boolean {
  const range = selectionRange.value
  const lastColumnIndex = visibleColumns.value.length - 1
  if (!range || lastColumnIndex < 0) {
    return false
  }
  return rowIndex >= range.startRow
    && rowIndex <= range.endRow
    && range.startColumn === 0
    && range.endColumn >= lastColumnIndex
}

function rowIndexCellClasses(row: TableRow, rowOffset: number): Record<string, boolean> {
  const rowIndex = resolveAbsoluteRowIndex(row, rowOffset)
  const rowId = row.rowId == null ? null : String(row.rowId)
  const classes: Record<string, boolean> = {
    "grid-cell--index-reorder-source": rowId != null && draggedRowIndexRowId.value === rowId,
    "grid-cell--index-drop-before": rowId != null && dragOverRowIndexRowId.value === rowId && dragOverRowIndexPlacement.value === "before",
    "grid-cell--index-drop-after": rowId != null && dragOverRowIndexRowId.value === rowId && dragOverRowIndexPlacement.value === "after",
  }
  if (!isFullRowSelectionIndex(rowIndex)) {
    return classes
  }
  const previousSelected = isFullRowSelectionIndex(rowIndex - 1)
  const nextSelected = isFullRowSelectionIndex(rowIndex + 1)
  return {
    ...classes,
    "grid-cell--index-selected": true,
    "grid-cell--index-selected-single": !previousSelected && !nextSelected,
    "grid-cell--index-selected-top": !previousSelected && nextSelected,
    "grid-cell--index-selected-middle": previousSelected && nextSelected,
    "grid-cell--index-selected-bottom": previousSelected && !nextSelected,
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

function clearRowIndexDragState(): void {
  draggedRowIndexRowId.value = null
  dragOverRowIndexRowId.value = null
  dragOverRowIndexPlacement.value = null
}

function isRowIndexDraggable(row: TableRow): boolean {
  return typeof rows.value.reorderRowsByIndex === "function"
    && row.kind !== "group"
    && row.rowId != null
    && row.state.pinned === "none"
    && !isDataGridPlaceholderSurfaceRow(row)
}

function resolveRowIndexDropPlacement(event: DragEvent): "before" | "after" {
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const rect = target?.getBoundingClientRect()
  if (!rect || rect.height <= 0) {
    return "after"
  }
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after"
}

function handleRowIndexDragStart(event: DragEvent, row: TableRow, rowOffset: number): void {
  if (!isRowIndexDraggable(row)) {
    clearRowIndexDragState()
    return
  }
  draggedRowIndexRowId.value = String(row.rowId)
  dragOverRowIndexRowId.value = null
  dragOverRowIndexPlacement.value = null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.dropEffect = "move"
    event.dataTransfer.setData("text/plain", `${String(row.rowId)}:${resolveAbsoluteRowIndex(row, rowOffset)}`)
  }
}

function handleRowIndexDragOver(event: DragEvent, row: TableRow, _rowOffset: number): void {
  if (!draggedRowIndexRowId.value || !isRowIndexDraggable(row)) {
    dragOverRowIndexRowId.value = null
    dragOverRowIndexPlacement.value = null
    return
  }
  const targetRowId = String(row.rowId)
  if (draggedRowIndexRowId.value === targetRowId) {
    dragOverRowIndexRowId.value = null
    dragOverRowIndexPlacement.value = null
    return
  }
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move"
  }
  dragOverRowIndexRowId.value = targetRowId
  dragOverRowIndexPlacement.value = resolveRowIndexDropPlacement(event)
}

function handleRowIndexDrop(event: DragEvent, row: TableRow, _rowOffset: number): void {
  if (!draggedRowIndexRowId.value || !isRowIndexDraggable(row)) {
    clearRowIndexDragState()
    return
  }
  const targetRowId = String(row.rowId)
  if (draggedRowIndexRowId.value === targetRowId) {
    clearRowIndexDragState()
    return
  }
  event.preventDefault()
  rows.value.reorderRowsByIndex?.({
    sourceRowId: draggedRowIndexRowId.value,
    targetRowId,
    placement: resolveRowIndexDropPlacement(event),
  })
  clearRowIndexDragState()
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

function resolveVirtualRowTotal(): number {
  const explicitTotal = viewport.value?.virtualRowTotal
  if (Number.isFinite(explicitTotal)) {
    return Math.max(0, Math.trunc(explicitTotal as number))
  }
  return Math.max(
    resolveViewportRowEnd() + 1,
    displayRows.value.length,
    selection.value?.totalRowCount ?? 0,
  )
}

function resolveBaseRowHeight(): number {
  const explicitHeight = viewport.value?.baseRowHeight
  if (Number.isFinite(explicitHeight) && (explicitHeight as number) > 0) {
    return Math.max(1, Math.trunc(explicitHeight as number))
  }
  const firstRow = displayRows.value[0]
  if (firstRow) {
    const style = rows.value?.rowStyle(firstRow, resolveViewportRowOffset(firstRow, 0)) ?? {}
    return Math.max(1, Math.trunc(parsePixelValue(style.height ?? style.minHeight, 31)))
  }
  return 31
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

function isVisibleCellEditableByAbsoluteCoord(rowIndex: number, columnIndex: number): boolean {
  const rowOffset = rowIndex - viewport.value.viewportRowStart
  const row = displayRows.value[rowOffset]
  const column = visibleColumns.value[columnIndex]
  if (rowOffset < 0 || !row || !column) {
    return false
  }
  return isCellEditableSafe(row, rowOffset, column, columnIndex)
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
const draggedRowIndexRowId = ref<string | null>(null)
const dragOverRowIndexRowId = ref<string | null>(null)
const dragOverRowIndexPlacement = ref<"before" | "after" | null>(null)
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
type GridChromeRedrawMode = "full" | "center-scroll"
let pendingGridChromeRedrawMode: GridChromeRedrawMode = "full"
let teardownTouchPanGuard: (() => void) | null = null

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
  const interaction = resolveCellInteraction(row, rowOffset, column, columnIndex)
  return {
    "grid-cell--checkbox": shouldRenderCheckboxCell(row, column),
    "grid-cell--row-selection": isRowSelectionColumn(column),
    "grid-cell--select": editable && editorMode === "select",
    "grid-cell--date": editable && (editorMode === "date" || editorMode === "datetime"),
    "grid-cell--interactive": interaction !== null,
  }
}

function resolveCellInteraction(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
) {
  return resolveDataGridCellInteraction({
    column: column.column,
    row: row.kind !== "group" ? row.data : undefined,
    rowId: row.rowId,
    editable: isCellEditableSafe(row, rowOffset, column, columnIndex),
  })
}

function cellAriaRole(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): string | undefined {
  return resolveCellInteraction(row, rowOffset, column, columnIndex)?.role
    ?? (shouldRenderCheckboxCell(row, column) ? "checkbox" : undefined)
}

function cellAriaChecked(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): "true" | "false" | "mixed" | undefined {
  return resolveCellInteraction(row, rowOffset, column, columnIndex)?.checked
    ?? (shouldRenderCheckboxCell(row, column)
      ? (checkboxValueIsChecked(row, column) ? "true" : "false")
      : undefined)
}

function cellAriaPressed(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): "true" | "false" | "mixed" | undefined {
  return resolveCellInteraction(row, rowOffset, column, columnIndex)?.pressed
}

function cellAriaLabel(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): string | undefined {
  return resolveCellInteraction(row, rowOffset, column, columnIndex)?.label
}

function cellAriaDisabled(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): "true" | undefined {
  return resolveCellInteraction(row, rowOffset, column, columnIndex)?.disabled ? "true" : undefined
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

function resolveRowSurfaceContext(row: TableRow): DataGridAppRowSurfaceContext {
  return {
    kind: isDataGridPlaceholderSurfaceRow(row) ? "placeholder" : "real",
  }
}

function renderResolvedCellContent(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): VNodeChild {
  const displayValue = readResolvedDisplayCell(row, column)
  const surface = resolveRowSurfaceContext(row)
  const editable = isCellEditableSafe(row, rowOffset, column, columnIndex)
  const interaction = resolveDataGridCellInteraction({
    column: column.column,
    row: row.kind !== "group" ? row.data : undefined,
    rowId: row.rowId,
    editable,
  })

  const interactive: DataGridAppCellRendererInteractiveContext | null = interaction
    ? {
      enabled: interaction.disabled !== true,
      click: interaction.click,
      keyboard: interaction.keyboard,
      role: interaction.role,
      ariaLabel: interaction.label,
      ariaPressed: interaction.pressed,
      ariaChecked: interaction.checked,
      ariaDisabled: interaction.disabled ? "true" : undefined,
      activate: (trigger?: DataGridCellInteractionInvocationTrigger) => invokeDataGridCellInteraction({
        column: column.column,
        row: row.kind !== "group" ? row.data : undefined,
        rowId: row.rowId,
        editable,
        trigger: trigger ?? "click",
      }),
    }
    : null

  if (row.kind === "group") {
    const renderer = column.column.groupCellRenderer ?? column.column.cellRenderer
    if (typeof renderer !== "function") {
      return displayValue
    }
    const groupRow = row as TableRow & { kind: "group" }
    const childrenCount = Number.isFinite(row.groupMeta?.childrenCount)
      ? Math.max(0, Math.trunc(row.groupMeta?.childrenCount as number))
      : 0
    const renderMeta = getDataGridRowRenderMeta(groupRow)
    return renderer({
      row: undefined,
      rowNode: groupRow,
      surface,
      rowOffset,
      column,
      columnIndex,
      value: cells.value.readCell(row, column.key),
      displayValue,
      interactive,
      group: {
        key: row.groupMeta?.groupKey ?? String(row.rowId ?? ""),
        field: String(row.groupMeta?.groupField ?? "group"),
        value: String(row.groupMeta?.groupValue ?? row.rowId ?? ""),
        childrenCount,
        isLabelColumn: props.mode === "tree"
          ? column.key === "name"
          : column.key === (props.columns.visibleColumns[0]?.key ?? "name"),
        renderMeta: {
          ...renderMeta,
          isGroup: true,
        },
        toggle: () => {
          rows.value.toggleGroupRow(row)
        },
      },
    }) ?? displayValue
  }

  const renderer = column.column.cellRenderer
  if (typeof renderer !== "function") {
    return displayValue
  }

  return renderer({
    row: row.data,
    rowNode: row,
    surface,
    rowOffset,
    column,
    columnIndex,
    value: cells.value.readCell(row, column.key),
    displayValue,
    interactive,
  }) ?? displayValue
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
  editing.value.handleEditorBlur()
}

function handleRowClickSafe(row: TableRow): void {
  rows.value.handleRowClick?.(row)
}

function handleRowIndexClickSafe(row: TableRow, rowOffset: number, event: MouseEvent): void {
  if (rows.value.consumeRecentRowResizeInteraction?.() === true) {
    return
  }
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  target?.focus({ preventScroll: true })
  rows.value.handleRowIndexClick?.(row, rowOffset, event.shiftKey)
}

function handleRowIndexKeydownSafe(event: KeyboardEvent, row: TableRow, rowOffset: number): void {
  rows.value.handleRowIndexKeydown?.(event, row, rowOffset)
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

function isFullRowSelectionSafe(rowOffset: number, row?: TableRow): boolean {
  const rowIndex = row ? resolveAbsoluteRowIndex(row, rowOffset) : viewport.value.viewportRowStart + rowOffset
  return isFullRowSelectionIndex(rowIndex)
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
  const row = displayRows.value[rowOffset]
  const column = visibleColumns.value[columnIndex]
  if (!row || !column || !isCellEditableSafe(row, rowOffset, column, columnIndex)) {
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
  if (isFillDragging.value || selection.value.rangeMoveEnabled !== true) {
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

function isRangeMoveHandleHoverCell(rowOffset: number, columnIndex: number): boolean {
  if (isFillDragging.value || selection.value.rangeMoveEnabled !== true) {
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
  void restoreDataGridFocus(focusVisibleAnchorCell)
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

watch(
  () => bodyViewportScrollTop.value,
  scrollTop => {
    if (!perfTraceEnabled) {
      return
    }
    const startedAt = resolveDataGridPerfNow()
    const rowStart = viewport.value.viewportRowStart
    const rowCount = displayRows.value.length
    void nextTick(() => {
      recordDataGridPerfSample({
        scope: "stageScrollFlush",
        ts: Date.now(),
        totalMs: resolveDataGridPerfNow() - startedAt,
        scrollTop,
        rowStart,
        rowCount,
      })
    })
  },
)

watch(
  () => [viewport.value.viewportRowStart, viewport.value.topSpacerHeight, viewport.value.bottomSpacerHeight, displayRows.value.length].join("|"),
  () => {
    if (!perfTraceEnabled) {
      return
    }
    const startedAt = resolveDataGridPerfNow()
    const rowStart = viewport.value.viewportRowStart
    const rowCount = displayRows.value.length
    const topSpacerHeight = viewport.value.topSpacerHeight
    const bottomSpacerHeight = viewport.value.bottomSpacerHeight
    void nextTick(() => {
      recordDataGridPerfSample({
        scope: "stageWindowFlush",
        ts: Date.now(),
        totalMs: resolveDataGridPerfNow() - startedAt,
        rowStart,
        rowCount,
        topSpacerHeight,
        bottomSpacerHeight,
      })
    })
  },
)

watch(
  () => [
    viewport.value.viewportRowStart,
    viewport.value.viewportRowEnd,
    displayRows.value
      .map(row => `${String(row.rowId)}:${String((row.row as Record<string, unknown> | undefined)?.region ?? "")}`)
      .join("|"),
  ].join("|"),
  () => {
    void nextTick(() => {
      emitRuntimeBodyDiagnostics("body-rows-update")
    })
  },
  { immediate: true },
)

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

function resolveGridChromeVariable(variableName: string): string {
  if (typeof window === "undefined") {
    return ""
  }
  let element: HTMLElement | null = stageRootEl.value
  while (element) {
    const value = window.getComputedStyle(element).getPropertyValue(variableName).trim()
    if (value.length > 0) {
      return value
    }
    element = element.parentElement
  }
  return window.getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
}

function resolveGridChromeColor(variableName: string, fallback: string): string {
  const value = resolveGridChromeVariable(variableName)
  return value || fallback
}

function resolveGridChromeLineWidth(variableName: string, fallback: number): number {
  const rawValue = resolveGridChromeVariable(variableName)
  if (rawValue.length === 0) {
    return fallback
  }
  const value = Number.parseFloat(rawValue)
  return Number.isFinite(value) && value >= 0 ? value : fallback
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
  const devicePixelRatio = resolveGridChromeDevicePixelRatio()
  const alignedRowDividerWidth = resolveDeviceAlignedCanvasLineWidth(rowDividerWidth, devicePixelRatio)
  context.save()
  context.strokeStyle = rowDividerColor
  context.lineWidth = alignedRowDividerWidth
  context.beginPath()
  for (const line of pane.horizontalLines) {
    const y = resolveDeviceAlignedCanvasStrokeCenter(line.position, alignedRowDividerWidth, devicePixelRatio)
    if (y < -alignedRowDividerWidth || y > pane.height + alignedRowDividerWidth) {
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
  const devicePixelRatio = resolveGridChromeDevicePixelRatio()
  const alignedColumnDividerWidth = resolveDeviceAlignedCanvasLineWidth(columnDividerWidth, devicePixelRatio)
  context.save()
  context.strokeStyle = columnDividerColor
  context.lineWidth = alignedColumnDividerWidth
  context.beginPath()
  for (const line of pane.verticalLines) {
    // Pane boundaries already have dedicated CSS borders; avoid double-width seams
    // by skipping chrome lines that land exactly on the pane edges.
    if (line.position <= 0.5 || line.position >= pane.width - 0.5) {
      continue
    }
    const x = resolveDeviceAlignedCanvasStrokeCenter(line.position, alignedColumnDividerWidth, devicePixelRatio)
    if (x < -alignedColumnDividerWidth || x > pane.width + alignedColumnDividerWidth) {
      continue
    }
    context.moveTo(x, 0)
    context.lineTo(x, pane.height)
  }
  context.stroke()
  context.restore()
}

function drawGridChromeBodyPane(
  context: CanvasRenderingContext2D | null,
  pane: DataGridChromePaneModel,
  rowDividerColor: string,
  rowDividerWidth: number,
  columnDividerColor: string,
  columnDividerWidth: number,
): void {
  if (!context) {
    return
  }
  drawGridChromeBands(context, pane)
  drawGridChromeHorizontalLines(context, pane, rowDividerColor, rowDividerWidth)
  drawGridChromeVerticalLines(context, pane, columnDividerColor, columnDividerWidth)
}

function drawGridChromeHeaderPane(
  context: CanvasRenderingContext2D | null,
  pane: DataGridChromePaneModel,
  columnDividerColor: string,
  columnDividerWidth: number,
): void {
  if (!context || hasPivotHeaderGroups.value) {
    return
  }
  drawGridChromeVerticalLines(context, pane, columnDividerColor, columnDividerWidth)
}

function drawGridChromeCanvas(mode: GridChromeRedrawMode = "full"): void {
  gridChromeAnimationFrame = 0
  pendingGridChromeRedrawMode = "full"
  const headerRenderModel = headerChromeRenderModel.value
  const renderModel = chromeRenderModel.value
  const rowDividerColor = resolveGridChromeColor("--datagrid-row-divider-color", "rgba(0, 0, 0, 0.08)")
  const columnDividerColor = resolveGridChromeColor("--datagrid-column-divider-color", "rgba(0, 0, 0, 0.08)")
  const headerColumnDividerColor = resolveGridChromeColor("--datagrid-header-column-divider-color", columnDividerColor)
  const rowDividerWidth = resolveGridChromeLineWidth("--datagrid-row-divider-size", 1)
  const columnDividerWidth = resolveGridChromeLineWidth("--datagrid-column-divider-size", 1)
  const headerColumnDividerWidth = resolveGridChromeLineWidth("--datagrid-header-column-divider-size", columnDividerWidth)

  const leftHeaderContext = mode === "full"
    ? prepareGridChromeCanvas(
      leftHeaderChromeCanvasEl.value,
      headerRenderModel.left.width,
      headerRenderModel.left.height,
    )
    : null
  if (leftHeaderContext) {
    drawGridChromeHeaderPane(leftHeaderContext, headerRenderModel.left, headerColumnDividerColor, headerColumnDividerWidth)
  }

  const centerHeaderContext = prepareGridChromeCanvas(
    centerHeaderChromeCanvasEl.value,
    headerRenderModel.center.width,
    headerRenderModel.center.height,
  )
  drawGridChromeHeaderPane(centerHeaderContext, headerRenderModel.center, headerColumnDividerColor, headerColumnDividerWidth)

  const rightHeaderContext = mode === "full"
    ? prepareGridChromeCanvas(
      rightHeaderChromeCanvasEl.value,
      headerRenderModel.right.width,
      headerRenderModel.right.height,
    )
    : null
  if (rightHeaderContext) {
    drawGridChromeHeaderPane(rightHeaderContext, headerRenderModel.right, headerColumnDividerColor, headerColumnDividerWidth)
  }

  const leftContext = mode === "full"
    ? prepareGridChromeCanvas(leftChromeCanvasEl.value, renderModel.left.width, renderModel.left.height)
    : null
  if (leftContext) {
    drawGridChromeBodyPane(
      leftContext,
      renderModel.left,
      rowDividerColor,
      rowDividerWidth,
      columnDividerColor,
      0,
    )
  }

  const centerContext = prepareGridChromeCanvas(centerChromeCanvasEl.value, renderModel.center.width, renderModel.center.height)
  drawGridChromeBodyPane(
    centerContext,
    renderModel.center,
    rowDividerColor,
    rowDividerWidth,
    columnDividerColor,
    columnDividerWidth,
  )

  const rightContext = mode === "full"
    ? prepareGridChromeCanvas(rightChromeCanvasEl.value, renderModel.right.width, renderModel.right.height)
    : null
  if (rightContext) {
    drawGridChromeBodyPane(
      rightContext,
      renderModel.right,
      rowDividerColor,
      rowDividerWidth,
      columnDividerColor,
      0,
    )
  }

  const bottomRenderModel = pinnedBottomChromeRenderModel.value

  const leftBottomContext = mode === "full"
    ? prepareGridChromeCanvas(
      leftBottomChromeCanvasEl.value,
      bottomRenderModel.left.width,
      bottomRenderModel.left.height,
    )
    : null
  if (leftBottomContext) {
    drawGridChromeBodyPane(
      leftBottomContext,
      bottomRenderModel.left,
      rowDividerColor,
      rowDividerWidth,
      columnDividerColor,
      0,
    )
  }

  const centerBottomContext = prepareGridChromeCanvas(
    centerBottomChromeCanvasEl.value,
    bottomRenderModel.center.width,
    bottomRenderModel.center.height,
  )
  drawGridChromeBodyPane(
    centerBottomContext,
    bottomRenderModel.center,
    rowDividerColor,
    rowDividerWidth,
    columnDividerColor,
    columnDividerWidth,
  )

  const rightBottomContext = mode === "full"
    ? prepareGridChromeCanvas(
      rightBottomChromeCanvasEl.value,
      bottomRenderModel.right.width,
      bottomRenderModel.right.height,
    )
    : null
  if (rightBottomContext) {
    drawGridChromeBodyPane(
      rightBottomContext,
      bottomRenderModel.right,
      rowDividerColor,
      rowDividerWidth,
      columnDividerColor,
      0,
    )
  }
}

function scheduleGridChromeRedraw(mode: GridChromeRedrawMode = "full"): void {
  pendingGridChromeRedrawMode = gridChromeAnimationFrame === 0
    ? mode
    : (mode === "full" || pendingGridChromeRedrawMode === "full" ? "full" : "center-scroll")
  if (typeof window === "undefined") {
    drawGridChromeCanvas(pendingGridChromeRedrawMode)
    return
  }
  if (gridChromeAnimationFrame !== 0) {
    return
  }
  gridChromeAnimationFrame = window.requestAnimationFrame(() => {
    drawGridChromeCanvas(pendingGridChromeRedrawMode)
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

  if (!isVisibleCellEditableByAbsoluteCoord(rowIndex, columnIndex)) {
    return null
  }

  return {
    rowIndex,
    columnIndex,
  }
}

function resolveFloatingFillActionLeft(): number | null {
  const anchorCell = resolveVisibleFillActionAnchorCell()
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

function resolveFloatingFillActionTop(): number | null {
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
  if (!targetCell) {
    return null
  }
  if (anchorCell && anchorCell.rowIndex !== targetCell.rowIndex) {
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
  const top = resolveFloatingFillActionTop()
  if (left == null || top == null) {
    return null
  }
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
  const previousScrollTop = bodyViewportScrollTop.value
  const previousScrollLeft = bodyViewportScrollLeft.value
  linkedPaneScrollSync.onSourceScroll(element.scrollTop)
  syncBodyViewportScrollState(element)
  syncPinnedBottomViewportScrollLeft()
  scheduleGridChromeRedraw(
    element.scrollLeft !== previousScrollLeft && element.scrollTop === previousScrollTop
      ? "center-scroll"
      : "full",
  )
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
  scheduleGridChromeRedraw("center-scroll")
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
  teardownTouchPanGuard?.()
  teardownTouchPanGuard = null
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
  if (stageRootEl.value) {
    teardownTouchPanGuard = installDataGridTouchPanGuard({
      root: stageRootEl.value,
      resolveScrollContainers: () => [
        bodyViewportEl.value,
        bottomViewportEl.value,
        resolveHeaderViewportElement(),
      ],
    })
  }
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
  const virtualMetrics = resolveDataGridVirtualChromeRowMetrics({
    rowStart: resolveViewportRowStart(),
    rowEnd: resolveViewportRowEnd(),
    rowTotal: resolveVirtualRowTotal(),
    topSpacerHeight: viewport.value?.topSpacerHeight ?? 0,
    baseRowHeight: resolveBaseRowHeight(),
    resolveRowHeight: viewport.value?.resolveRowHeight,
    resolveRowOffset: viewport.value?.resolveRowOffset,
  })
  return virtualMetrics.map(metric => ({
    top: metric.top,
    height: metric.height,
  }))
}

const rowMetrics = computed(() => {
  const estimated = buildEstimatedVisibleRowMetrics()
  if (mode.value === "base" && rowHeightMode.value === "auto") {
    bodyViewportScrollTop.value
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

const rowBands = computed<readonly DataGridChromeRowBand[]>(() => {
  const viewportRowStart = resolveViewportRowStart()
  const virtualBands = rowMetrics.value.map((metric, metricOffset) => {
    const absoluteRowIndex = viewportRowStart + metricOffset
    return {
      rowIndex: metricOffset,
      top: metric.top,
      height: metric.height,
      kind: rows.value.stripedRows === true && absoluteRowIndex % 2 === 1 ? "striped" : "base",
    }
  })
  const loadedBands = displayRows.value.flatMap((row, rowOffset) => {
    const metricOffset = resolveAbsoluteRowIndex(row, rowOffset) - viewportRowStart
    const metric = rowMetrics.value[metricOffset]
    const kind = resolveChromeRowBandKind(row, resolveViewportRowOffset(row, rowOffset))
    if (!metric || !kind) {
      return []
    }
    return [{
      rowIndex: metricOffset,
      top: metric.top,
      height: metric.height,
      kind,
    }]
  })
  return [
    ...virtualBands,
    ...loadedBands,
  ]
})

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
  () => [
    rowMetricsSignature.value,
    pinnedBottomRowMetricsSignature.value,
    rowBandsSignature.value,
    pinnedBottomRowBandsSignature.value,
  ].join("|"),
  () => {
    // Auto-height row metrics can shift during scroll; redraw chrome, but avoid
    // re-reading shell/header layout metrics that belong to resize/column sync.
    scheduleGridChromeRedraw()
  },
)

function resolveVisibleRowMetricsFromDom(
  fallbackMetrics: readonly { top: number; height: number }[],
): readonly { top: number; height: number }[] {
  if (displayRows.value.length !== fallbackMetrics.length) {
    return fallbackMetrics
  }
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
    zIndex?: number
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
      zIndex: options?.zIndex ?? 6,
    },
  }
}

function buildPinnedPaneSeamOverlaySegment(
  key: string,
  top: number,
  height: number,
  side: "left" | "right",
  options?: {
    hideBorder?: boolean
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    zIndex?: number
    topBleed?: number
    bottomBleed?: number
  },
): OverlaySegment {
  const topBleed = Math.max(0, options?.topBleed ?? 1)
  const bottomBleed = Math.max(0, options?.bottomBleed ?? 1)
  return {
    key,
    style: {
      position: "absolute",
      top: `${top - topBleed}px`,
      left: side === "left" ? "calc(100% - var(--datagrid-pinned-pane-separator-size))" : "0px",
      width: "var(--datagrid-pinned-pane-separator-size)",
      height: `${Math.max(1, height + topBleed + bottomBleed)}px`,
      border: `${options?.hideBorder ? 0 : 2}px ${options?.borderStyle ?? "solid"} ${options?.borderColor ?? "var(--datagrid-selection-overlay-border)"}`,
      borderLeftWidth: "0px",
      borderRightWidth: "0px",
      borderTopWidth: options?.hideBorder ? "0px" : "2px",
      borderBottomWidth: options?.hideBorder ? "0px" : "2px",
      background: options?.backgroundColor ?? "transparent",
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: options?.zIndex ?? 6,
    },
  }
}

function buildPinnedPaneSeamOverlaySegments(
  metrics: {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
    top: number
    height: number
  } | null,
  pane: "left" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    hideSingleCell?: boolean
    zIndex?: number
  },
  viewportHeight = Math.max(0, bodyViewportClientHeight.value),
): OverlaySegment[] {
  if (!metrics) {
    return []
  }
  const isSingleSelectionSegment = options?.hideSingleCell === true
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
    const lastSelectedIndex = columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
    if (metrics.endColumnIndex <= lastSelectedIndex) {
      return []
    }
    return [
      buildPinnedPaneSeamOverlaySegment(
        `${keyPrefix}-left-seam-${metrics.startRowOffset}-${metrics.endRowOffset}`,
        metrics.top,
        metrics.height,
        "left",
        {
          topBleed,
          bottomBleed,
          borderColor: options?.borderColor,
          backgroundColor: options?.backgroundColor,
          borderStyle: options?.borderStyle,
          zIndex: options?.zIndex,
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
  const firstSelectedIndex = columnIndexByKey(selectedColumns[0]?.key ?? "")
  if (metrics.startColumnIndex >= firstSelectedIndex) {
    return []
  }
  return [
    buildPinnedPaneSeamOverlaySegment(
      `${keyPrefix}-right-seam-${metrics.startRowOffset}-${metrics.endRowOffset}`,
      metrics.top,
      metrics.height,
      "right",
      {
        topBleed,
        bottomBleed,
        borderColor: options?.borderColor,
        backgroundColor: options?.backgroundColor,
        borderStyle: options?.borderStyle,
        zIndex: options?.zIndex,
      },
    ),
  ]
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
    hideSingleCell?: boolean
    zIndex?: number
  },
  viewportHeight = Math.max(0, bodyViewportClientHeight.value),
): OverlaySegment[] {
  if (!metrics) {
    return []
  }
  const isSingleSelectionSegment = options?.hideSingleCell === true
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
          zIndex: options?.zIndex,
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
          zIndex: options?.zIndex,
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
        zIndex: options?.zIndex,
      },
    ),
  ]
}

function resolveOverlayMetricsList(
  ranges: readonly OverlayRange[],
  resolveBounds: (range: OverlayRange | null) => {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
  } | null,
  metricsSource = rowMetrics.value,
): Array<{
  startRowOffset: number
  endRowOffset: number
  startColumnIndex: number
  endColumnIndex: number
  top: number
  height: number
}> {
  return ranges
    .map(range => resolveOverlayMetrics(resolveBounds(range), metricsSource))
    .filter((metrics): metrics is NonNullable<typeof metrics> => metrics != null)
}

function buildPaneOverlaySegmentsForMetricsList(
  metricsList: readonly {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
    top: number
    height: number
  }[],
  pane: "left" | "center" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    hideSingleCell?: boolean
    zIndex?: number
  },
  viewportHeight = Math.max(0, bodyViewportClientHeight.value),
): OverlaySegment[] {
  if (metricsList.length === 0) {
    return []
  }
  return metricsList.flatMap((metrics, index) => buildPaneOverlaySegments(
    metrics,
    pane,
    metricsList.length === 1 ? keyPrefix : `${keyPrefix}-${index}`,
    options,
    viewportHeight,
  ))
}

function buildPinnedPaneSeamOverlaySegmentsForMetricsList(
  metricsList: readonly {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
    top: number
    height: number
  }[],
  pane: "left" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    hideSingleCell?: boolean
    zIndex?: number
  },
  viewportHeight = Math.max(0, bodyViewportClientHeight.value),
): OverlaySegment[] {
  if (metricsList.length === 0) {
    return []
  }
  return metricsList.flatMap((metrics, index) => buildPinnedPaneSeamOverlaySegments(
    metrics,
    pane,
    metricsList.length === 1 ? keyPrefix : `${keyPrefix}-${index}`,
    options,
    viewportHeight,
  ))
}

const customOverlays = computed(() => props.customOverlays ?? [])

function buildCustomOverlayLane(
  overlay: DataGridTableStageCustomOverlay,
  pane: "left" | "center" | "right",
  metricsList: readonly {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
    top: number
    height: number
  }[],
  viewportHeight = Math.max(0, bodyViewportClientHeight.value),
): DataGridTableStageOverlayLane | null {
  const segments = buildPaneOverlaySegmentsForMetricsList(
    metricsList,
    pane,
    overlay.key,
    {
      borderColor: overlay.borderColor,
      backgroundColor: overlay.backgroundColor,
      borderStyle: overlay.borderStyle,
      hideSingleCell: overlay.hideSingleCell,
      zIndex: overlay.zIndex,
    },
    viewportHeight,
  )
  if (segments.length === 0) {
    return null
  }
  return {
    key: overlay.key,
    className: overlay.className,
    segmentClassName: overlay.segmentClassName,
    segments,
  }
}

function buildCustomSeamOverlayLane(
  overlay: DataGridTableStageCustomOverlay,
  pane: "left" | "right",
  metricsList: readonly {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
    top: number
    height: number
  }[],
  viewportHeight = Math.max(0, bodyViewportClientHeight.value),
): DataGridTableStageOverlayLane | null {
  const segments = buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    metricsList,
    pane,
    overlay.key,
    {
      borderColor: overlay.borderColor,
      backgroundColor: overlay.backgroundColor,
      borderStyle: overlay.borderStyle,
      hideSingleCell: overlay.hideSingleCell,
      zIndex: overlay.zIndex,
    },
    viewportHeight,
  )
  if (segments.length === 0) {
    return null
  }
  return {
    key: overlay.key,
    className: overlay.className,
    segmentClassName: overlay.segmentClassName,
    segments,
  }
}

const customOverlayMetrics = computed(() => customOverlays.value.map(overlay => ({
  overlay,
  body: resolveOverlayMetricsList(overlay.ranges, resolveVisibleRangeBounds),
  pinnedBottom: resolveOverlayMetricsList(
    overlay.ranges,
    resolvePinnedBottomVisibleRangeBounds,
    pinnedBottomRowMetrics.value,
  ),
})))

const leftCustomOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, body }) => buildCustomOverlayLane(overlay, "left", body))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const centerCustomOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, body }) => buildCustomOverlayLane(overlay, "center", body))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const rightCustomOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, body }) => buildCustomOverlayLane(overlay, "right", body))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const leftCustomSeamOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, body }) => buildCustomSeamOverlayLane(overlay, "left", body))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const rightCustomSeamOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, body }) => buildCustomSeamOverlayLane(overlay, "right", body))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const leftPinnedBottomCustomOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(
    overlay,
    "left",
    pinnedBottom,
    bottomViewportEl.value?.clientHeight ?? 0,
  ))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const centerPinnedBottomCustomOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(
    overlay,
    "center",
    pinnedBottom,
    bottomViewportEl.value?.clientHeight ?? 0,
  ))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const rightPinnedBottomCustomOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(
    overlay,
    "right",
    pinnedBottom,
    bottomViewportEl.value?.clientHeight ?? 0,
  ))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const leftPinnedBottomCustomSeamOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, pinnedBottom }) => buildCustomSeamOverlayLane(
    overlay,
    "left",
    pinnedBottom,
    bottomViewportEl.value?.clientHeight ?? 0,
  ))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

const rightPinnedBottomCustomSeamOverlayLanes = computed<DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
  .map(({ overlay, pinnedBottom }) => buildCustomSeamOverlayLane(
    overlay,
    "right",
    pinnedBottom,
    bottomViewportEl.value?.clientHeight ?? 0,
  ))
  .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

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
const visibleSelectionOverlayMetricsList = computed(() => {
  if (visibleFillPreviewBounds.value) {
    return []
  }
  return resolveOverlayMetricsList(selectionRanges.value, resolveVisibleRangeBounds)
})
const visibleFillPreviewOverlayMetrics = computed(() => resolveOverlayMetrics(visibleCombinedFillPreviewBounds.value))
const visibleMovePreviewOverlayMetrics = computed(() => (
  resolveOverlayMetrics(resolveVisibleRangeBounds(normalizedMovePreviewRange.value))
))
const visiblePinnedBottomSelectionOverlayMetricsList = computed(() => {
  if (visibleFillPreviewBounds.value) {
    return []
  }
  return resolveOverlayMetricsList(
    selectionRanges.value,
    resolvePinnedBottomVisibleRangeBounds,
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

const leftSelectionOverlaySegments = computed<OverlaySegment[]>(() => buildPaneOverlaySegmentsForMetricsList(
  visibleSelectionOverlayMetricsList.value,
  "left",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
))

const leftSelectionSeamOverlaySegments = computed<OverlaySegment[]>(() => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
  visibleSelectionOverlayMetricsList.value,
  "left",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
))

const centerSelectionOverlaySegments = computed<OverlaySegment[]>(() => buildPaneOverlaySegmentsForMetricsList(
  visibleSelectionOverlayMetricsList.value,
  "center",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
))

const rightSelectionOverlaySegments = computed<OverlaySegment[]>(() => buildPaneOverlaySegmentsForMetricsList(
  visibleSelectionOverlayMetricsList.value,
  "right",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
))

const rightSelectionSeamOverlaySegments = computed<OverlaySegment[]>(() => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
  visibleSelectionOverlayMetricsList.value,
  "right",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
))

const leftPinnedBottomSelectionOverlaySegments = computed<OverlaySegment[]>(() => buildPaneOverlaySegmentsForMetricsList(
  visiblePinnedBottomSelectionOverlayMetricsList.value,
  "left",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
  bottomViewportEl.value?.clientHeight ?? 0,
))

const leftPinnedBottomSelectionSeamOverlaySegments = computed<OverlaySegment[]>(() => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
  visiblePinnedBottomSelectionOverlayMetricsList.value,
  "left",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
  bottomViewportEl.value?.clientHeight ?? 0,
))

const centerPinnedBottomSelectionOverlaySegments = computed<OverlaySegment[]>(() => buildPaneOverlaySegmentsForMetricsList(
  visiblePinnedBottomSelectionOverlayMetricsList.value,
  "center",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
  bottomViewportEl.value?.clientHeight ?? 0,
))

const rightPinnedBottomSelectionOverlaySegments = computed<OverlaySegment[]>(() => buildPaneOverlaySegmentsForMetricsList(
  visiblePinnedBottomSelectionOverlayMetricsList.value,
  "right",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
  bottomViewportEl.value?.clientHeight ?? 0,
))

const rightPinnedBottomSelectionSeamOverlaySegments = computed<OverlaySegment[]>(() => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
  visiblePinnedBottomSelectionOverlayMetricsList.value,
  "right",
  "selection",
  {
    borderColor: "var(--datagrid-selection-overlay-border)",
    hideSingleCell: isSingleSelectedCell.value,
  },
  bottomViewportEl.value?.clientHeight ?? 0,
))

const leftFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleFillPreviewOverlayMetrics.value, "left", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  })
))

const leftFillPreviewSeamOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPinnedPaneSeamOverlaySegments(visibleFillPreviewOverlayMetrics.value, "left", "fill-preview", {
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

const rightFillPreviewSeamOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPinnedPaneSeamOverlaySegments(visibleFillPreviewOverlayMetrics.value, "right", "fill-preview", {
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

const leftPinnedBottomFillPreviewSeamOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPinnedPaneSeamOverlaySegments(visiblePinnedBottomFillPreviewOverlayMetrics.value, "left", "fill-preview", {
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

const rightPinnedBottomFillPreviewSeamOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPinnedPaneSeamOverlaySegments(visiblePinnedBottomFillPreviewOverlayMetrics.value, "right", "fill-preview", {
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

const leftMovePreviewSeamOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPinnedPaneSeamOverlaySegments(visibleMovePreviewOverlayMetrics.value, "left", "move-preview", {
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

const rightMovePreviewSeamOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPinnedPaneSeamOverlaySegments(visibleMovePreviewOverlayMetrics.value, "right", "move-preview", {
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

const leftPinnedBottomMovePreviewSeamOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPinnedPaneSeamOverlaySegments(visiblePinnedBottomMovePreviewOverlayMetrics.value, "left", "move-preview", {
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

const rightPinnedBottomMovePreviewSeamOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPinnedPaneSeamOverlaySegments(visiblePinnedBottomMovePreviewOverlayMetrics.value, "right", "move-preview", {
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
  overlayLanes: leftCustomOverlayLanes.value,
  selectionSeamOverlaySegments: leftSelectionSeamOverlaySegments.value,
  fillPreviewSeamOverlaySegments: leftFillPreviewSeamOverlaySegments.value,
  movePreviewSeamOverlaySegments: leftMovePreviewSeamOverlaySegments.value,
  seamOverlayLanes: leftCustomSeamOverlayLanes.value,
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
  overlayLanes: rightCustomOverlayLanes.value,
  selectionSeamOverlaySegments: rightSelectionSeamOverlaySegments.value,
  fillPreviewSeamOverlaySegments: rightFillPreviewSeamOverlaySegments.value,
  movePreviewSeamOverlaySegments: rightMovePreviewSeamOverlaySegments.value,
  seamOverlayLanes: rightCustomSeamOverlayLanes.value,
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
  overlayLanes: leftPinnedBottomCustomOverlayLanes.value,
  selectionSeamOverlaySegments: leftPinnedBottomSelectionSeamOverlaySegments.value,
  fillPreviewSeamOverlaySegments: leftPinnedBottomFillPreviewSeamOverlaySegments.value,
  movePreviewSeamOverlaySegments: leftPinnedBottomMovePreviewSeamOverlaySegments.value,
  seamOverlayLanes: leftPinnedBottomCustomSeamOverlayLanes.value,
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
  overlayLanes: rightPinnedBottomCustomOverlayLanes.value,
  selectionSeamOverlaySegments: rightPinnedBottomSelectionSeamOverlaySegments.value,
  fillPreviewSeamOverlaySegments: rightPinnedBottomFillPreviewSeamOverlaySegments.value,
  movePreviewSeamOverlaySegments: rightPinnedBottomMovePreviewSeamOverlaySegments.value,
  seamOverlayLanes: rightPinnedBottomCustomSeamOverlayLanes.value,
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
