<template>
  <section ref="stageRootRef" class="datagrid-gantt-stage">
    <div class="datagrid-gantt-stage__table" :style="tablePaneStyle">
      <DataGridTableStage ref="tableStageRef" v-bind="embeddedTableStageProps" :stage-context="tableStageContext" />
    </div>

    <button
      v-if="gantt"
      type="button"
      class="datagrid-gantt-stage__splitter"
      :style="splitterStyle"
      aria-label="Resize gantt split"
      @pointerdown="handleSplitterPointerDown"
    />

    <div class="datagrid-gantt-stage__timeline">
      <div class="datagrid-gantt-stage__timeline-header" :style="timelineHeaderStyle">
        <div
          ref="timelineHeaderViewportRef"
          class="datagrid-gantt-timeline__viewport datagrid-gantt-timeline__viewport--header"
          :style="timelineHeaderViewportStyle"
          @scroll="handleTimelineHeaderScroll"
          @wheel="handleTimelineWheel"
        >
          <div class="datagrid-gantt-timeline__track-spacer" :style="headerTrackStyle" />
        </div>
        <canvas
          ref="headerCanvasRef"
          class="datagrid-gantt-timeline__canvas datagrid-gantt-timeline__canvas--header"
          aria-hidden="true"
        />
      </div>

      <div class="datagrid-gantt-stage__timeline-body">
        <div v-if="!gantt" class="datagrid-gantt-stage__empty">
          Configure `gantt.startKey` and `gantt.endKey` to enable the timeline renderer.
        </div>

        <div
          v-else
          ref="timelineBodyViewportRef"
          class="datagrid-gantt-timeline__viewport datagrid-gantt-timeline__viewport--body"
          @scroll="handleTimelineBodyScroll"
          @wheel="handleTimelineWheel"
        >
          <div class="datagrid-gantt-timeline__track-spacer" :style="bodyTrackStyle" />
        </div>
        <canvas
          ref="bodyCanvasRef"
          class="datagrid-gantt-timeline__canvas datagrid-gantt-timeline__canvas--body"
          :style="{ cursor: canvasCursor }"
          @pointerdown="handleCanvasPointerDown"
          @pointermove="handleCanvasPointerMove"
          @pointerleave="handleCanvasPointerLeave"
          @wheel="handleTimelineWheel"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties,
} from "vue"
import type { DataGridRowNode, UseDataGridRuntimeResult } from "@affino/datagrid-vue"
import DataGridTableStage from "../stage/DataGridTableStage.vue"
import type {
  DataGridResolvedGanttOptions,
  DataGridGanttBarLayout,
  DataGridGanttHitTarget,
  DataGridTimelineSegment,
} from "./dataGridGantt"
import {
  applyDataGridGanttDragDelta,
  buildDataGridGanttDependencyPaths,
  buildDataGridGanttRowEditPatch,
  buildDataGridTimelineRenderModels,
  buildDataGridGanttVisibleBars,
  clampDataGridTimelineScrollLeft,
  hitTestDataGridGanttBar,
  resolveDataGridGanttAnalysis,
  resolveDataGridGanttRangeFrame,
  resolveDataGridTimelineDateToPixel,
  resolveDataGridTimelineScrollLeftForDate,
} from "./dataGridGantt"
import { resolveDataGridGanttWheelIntent } from "./dataGridGanttWheel"
import {
  DATAGRID_GANTT_MIN_TABLE_PANE_WIDTH_PX,
  DATAGRID_GANTT_MIN_TIMELINE_PANE_WIDTH_PX,
  DATAGRID_GANTT_SPLITTER_SIZE_PX,
  clampDataGridGanttTablePaneWidth,
  resolveDataGridGanttTablePaneDragWidth,
} from "./dataGridGanttSplit"
import { resolveDataGridGanttInlineLabel } from "./dataGridGanttLabel"
import {
  hitTestDataGridGanttDependencyPath,
  resolveDataGridGanttDependencyPathKey,
} from "./dataGridGanttDependencySelection"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"
import {
  materializeDataGridTableStagePropsFromContext,
  type DataGridTableStageContext,
} from "../stage/dataGridTableStageContext"

ensureDataGridAppStyles()

interface DataGridTableStageExpose {
  getBodyViewportElement: () => HTMLElement | null
  getHeaderElement: () => HTMLElement | null
  getStageRootElement: () => HTMLElement | null
  getVisibleRowMetrics: () => readonly { top: number; height: number }[]
}

interface ActiveDragState {
  pointerId: number
  rowId: string
  rowUpdateId: string | number
  mode: "move" | "resize-start" | "resize-end"
  originX: number
  initialStartMs: number
  initialEndMs: number
  draftStartMs: number
  draftEndMs: number
}

interface ActiveSplitResizeState {
  pointerId: number
  originClientX: number
  originWidth: number
}

const DEFAULT_HEADER_HEIGHT_PX = 48
const TIMELINE_SEGMENT_BUFFER_PX = 240
const DRAG_AUTO_SCROLL_EDGE_PX = 40
const DRAG_AUTO_SCROLL_MAX_STEP_PX = 24
const EMPTY_CRITICAL_TASK_IDS = new Set<string>()

const props = defineProps<{
  stageContext: DataGridTableStageContext<Record<string, unknown>>
  runtime: Pick<UseDataGridRuntimeResult<Record<string, unknown>>, "api">
  gantt: DataGridResolvedGanttOptions | null
  baseRowHeight: number
  rowVersion: number
}>()

const tableStageContext = props.stageContext
const embeddedTableStageProps = computed(() => materializeDataGridTableStagePropsFromContext(tableStageContext))
const tableRows = computed(() => tableStageContext.rows.value)
const tableViewport = computed(() => tableStageContext.viewport.value)
const tableRowHeightMode = computed(() => tableStageContext.rowHeightMode.value)

const stageRootRef = ref<HTMLElement | null>(null)
const tableStageRef = ref<DataGridTableStageExpose | null>(null)
const timelineHeaderViewportRef = ref<HTMLElement | null>(null)
const timelineBodyViewportRef = ref<HTMLElement | null>(null)
const headerCanvasRef = ref<HTMLCanvasElement | null>(null)
const bodyCanvasRef = ref<HTMLCanvasElement | null>(null)
const tableViewportRef = ref<HTMLElement | null>(null)
const headerHeightPx = ref(DEFAULT_HEADER_HEIGHT_PX)
const tableScrollTop = ref(0)
const tableViewportHeight = ref(0)
const stageWidth = ref(0)
const timelineScrollLeft = ref(0)
const timelineViewportWidth = ref(0)
const activeDragState = ref<ActiveDragState | null>(null)
const activeSplitResizeState = ref<ActiveSplitResizeState | null>(null)
const hoverTarget = ref<DataGridGanttHitTarget<Record<string, unknown>> | null>(null)
const hoverDependencyKey = ref<string | null>(null)
const selectedDependencyKey = ref<string | null>(null)
const hasAutoFocusedTimeline = ref(false)
const redrawFrame = ref<number | null>(null)
let pendingHeaderRedraw = false
let pendingBodyRedraw = false

let teardownTableViewport: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let syncingTimelineScroll = false

function resolveUtcDayStart(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function getCanvas2dContext(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas) {
    return null
  }
  try {
    return canvas.getContext("2d")
  } catch {
    return null
  }
}

function readCssVar(name: string, fallback: string): string {
  const root = tableStageRef.value?.getStageRootElement() ?? timelineBodyViewportRef.value
  if (!root || typeof window === "undefined") {
    return fallback
  }
  const value = window.getComputedStyle(root).getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

function resizeCanvas(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const context = getCanvas2dContext(canvas)
  if (!canvas || !context) {
    return null
  }
  const pixelRatio = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1)
  const nextWidth = Math.max(1, Math.round(width))
  const nextHeight = Math.max(1, Math.round(height))
  if (canvas.width !== Math.round(nextWidth * pixelRatio) || canvas.height !== Math.round(nextHeight * pixelRatio)) {
    canvas.width = Math.round(nextWidth * pixelRatio)
    canvas.height = Math.round(nextHeight * pixelRatio)
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, nextWidth, nextHeight)
  return context
}

function resolveViewportWidth(element: HTMLElement | null): number {
  if (!element) {
    return 0
  }
  return Math.max(
    element.clientWidth,
    Math.round(element.getBoundingClientRect().width),
  )
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2))
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

function drawDiamond(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
): void {
  const halfSize = Math.max(1, size / 2)
  context.beginPath()
  context.moveTo(centerX, centerY - halfSize)
  context.lineTo(centerX + halfSize, centerY)
  context.lineTo(centerX, centerY + halfSize)
  context.lineTo(centerX - halfSize, centerY)
  context.closePath()
}

function drawVarianceMarker(
  context: CanvasRenderingContext2D,
  startX: number,
  endX: number,
  y: number,
  color: string,
): void {
  if (Math.abs(endX - startX) < 2) {
    return
  }
  context.save()
  context.strokeStyle = color
  context.lineWidth = 1.5
  context.lineCap = "round"
  context.beginPath()
  context.moveTo(startX, y)
  context.lineTo(endX, y)
  context.moveTo(startX, y - 3)
  context.lineTo(startX, y + 3)
  context.moveTo(endX, y - 3)
  context.lineTo(endX, y + 3)
  context.stroke()
  context.restore()
}

function drawDependencyPolyline(
  context: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  dependencyType: "FS" | "SS" | "FF" | "SF",
  color: string,
  underlayColor: string,
): void {
  const firstPoint = points[0]
  if (!firstPoint || points.length < 2) {
    return
  }

  context.save()
  const dashPattern = dependencyType === "FS"
    ? []
    : dependencyType === "SS"
      ? [5, 3]
      : dependencyType === "FF"
        ? [8, 3]
        : [2, 3]
  context.setLineDash(dashPattern)
  context.strokeStyle = underlayColor
  context.lineWidth = 4
  context.lineJoin = "round"
  context.lineCap = "round"
  context.beginPath()
  context.moveTo(firstPoint.x, firstPoint.y)
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    if (!point) {
      continue
    }
    context.lineTo(point.x, point.y)
  }
  context.stroke()

  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = 1.5
  context.lineJoin = "round"
  context.lineCap = "round"
  context.beginPath()
  context.moveTo(firstPoint.x, firstPoint.y)
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    if (!point) {
      continue
    }
    context.lineTo(point.x, point.y)
  }
  context.stroke()

  const lastPoint = points[points.length - 1]
  const previousPoint = points[points.length - 2]
  if (lastPoint && previousPoint) {
    const sourcePortRadius = 1.75
    const targetPortRadius = 2.5
    context.fillStyle = "rgba(255, 255, 255, 0.85)"
    context.beginPath()
    context.arc(firstPoint.x, firstPoint.y, sourcePortRadius + 1.25, 0, Math.PI * 2)
    context.arc(lastPoint.x, lastPoint.y, targetPortRadius + 1.5, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = color
    context.beginPath()
    context.arc(firstPoint.x, firstPoint.y, sourcePortRadius, 0, Math.PI * 2)
    context.arc(lastPoint.x, lastPoint.y, targetPortRadius, 0, Math.PI * 2)
    context.fill()

    const angle = Math.atan2(lastPoint.y - previousPoint.y, lastPoint.x - previousPoint.x)
    const arrowLength = 6
    const arrowWidth = Math.PI / 8
    context.beginPath()
    context.moveTo(lastPoint.x, lastPoint.y)
    context.lineTo(
      lastPoint.x - (arrowLength * Math.cos(angle - arrowWidth)),
      lastPoint.y - (arrowLength * Math.sin(angle - arrowWidth)),
    )
    context.lineTo(
      lastPoint.x - (arrowLength * Math.cos(angle + arrowWidth)),
      lastPoint.y - (arrowLength * Math.sin(angle + arrowWidth)),
    )
    context.closePath()
    context.fill()
  }
  context.restore()
}

function drawBarLabel(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const horizontalPadding = 8
  const availableWidth = Math.max(0, width - (horizontalPadding * 2))
  const resolvedLabel = resolveDataGridGanttInlineLabel(
    label,
    availableWidth,
    text => context.measureText(text).width,
  )
  if (!resolvedLabel) {
    return
  }

  context.save()
  context.beginPath()
  context.rect(x, y, width, height)
  context.clip()
  context.fillText(resolvedLabel, x + horizontalPadding, y + (height / 2))
  context.restore()
}

function syncTableViewportMetrics(): void {
  const viewport = tableViewportRef.value
  if (!viewport) {
    tableScrollTop.value = 0
    tableViewportHeight.value = 0
    return
  }
  tableScrollTop.value = viewport.scrollTop
  tableViewportHeight.value = viewport.clientHeight
}

function syncTableHeaderMetrics(): void {
  const headerElement = tableStageRef.value?.getHeaderElement() ?? null
  const nextHeight = Math.max(
    1,
    Math.round(
      headerElement?.offsetHeight
      || headerElement?.clientHeight
      || headerElement?.getBoundingClientRect().height
      || DEFAULT_HEADER_HEIGHT_PX,
    ),
  )
  if (headerHeightPx.value !== nextHeight) {
    headerHeightPx.value = nextHeight
  }
}

function syncStageMetrics(): void {
  stageWidth.value = stageRootRef.value?.clientWidth ?? 0
}

function syncTimelineViewportMetrics(): void {
  timelineViewportWidth.value = Math.max(
    resolveViewportWidth(timelineBodyViewportRef.value),
    resolveViewportWidth(timelineHeaderViewportRef.value),
  )
}

function syncTimelineViewportWidthFromElement(element: HTMLElement | null): void {
  if (!element) {
    return
  }
  const nextWidth = Math.max(0, element.clientWidth)
  if (nextWidth > 0 && timelineViewportWidth.value !== nextWidth) {
    timelineViewportWidth.value = nextWidth
  }
}

function scheduleRedraw(target: "both" | "header" | "body" = "both"): void {
  pendingHeaderRedraw = pendingHeaderRedraw || target !== "body"
  pendingBodyRedraw = pendingBodyRedraw || target !== "header"
  if (redrawFrame.value != null || typeof window === "undefined") {
    return
  }
  redrawFrame.value = window.requestAnimationFrame(() => {
    const shouldDrawHeader = pendingHeaderRedraw
    const shouldDrawBody = pendingBodyRedraw
    redrawFrame.value = null
    pendingHeaderRedraw = false
    pendingBodyRedraw = false
    if (shouldDrawHeader) {
      drawTimelineHeader()
    }
    if (shouldDrawBody) {
      drawTimelineBody()
    }
  })
}

function clearScheduledRedraw(): void {
  if (redrawFrame.value == null || typeof window === "undefined") {
    return
  }
  window.cancelAnimationFrame(redrawFrame.value)
  redrawFrame.value = null
  pendingHeaderRedraw = false
  pendingBodyRedraw = false
}

function resolveRowHeight(rowIndex: number): number {
  return props.runtime.api.view.getRowHeightOverride(rowIndex) ?? props.baseRowHeight
}

const rowHeightVersion = computed(() => props.runtime.api.view.getRowHeightVersion())

const visibleRowMetrics = computed(() => {
  void displayRowsSignature.value
  void rowHeightVersion.value

  if (tableRowHeightMode.value !== "auto") {
    const metrics: Array<{ top: number; height: number }> = []
    let currentTop = tableViewport.value.topSpacerHeight
    for (let rowOffset = 0; rowOffset < tableRows.value.displayRows.length; rowOffset += 1) {
      const rowIndex = tableViewport.value.viewportRowStart + rowOffset
      const height = Math.max(1, resolveRowHeight(rowIndex))
      metrics.push({
        top: currentTop,
        height,
      })
      currentTop += height
    }
    return metrics
  }

  return tableStageRef.value?.getVisibleRowMetrics() ?? []
})

const ganttAnalysis = computed(() => {
  if (!props.gantt) {
    return null
  }
  void props.rowVersion
  return resolveDataGridGanttAnalysis({
    getCount: () => props.runtime.api.rows.getCount(),
    get: index => props.runtime.api.rows.get(index),
  }, props.gantt)
})

const timelineState = computed(() => ganttAnalysis.value?.timeline ?? null)

const criticalTaskIds = computed<ReadonlySet<string>>(() => ganttAnalysis.value?.criticalTaskIds ?? EMPTY_CRITICAL_TASK_IDS)

const visibleBars = computed<readonly DataGridGanttBarLayout<Record<string, unknown>>[]>(() => {
  if (!props.gantt || !timelineState.value) {
    return []
  }
  void props.rowVersion
  void rowHeightVersion.value
  return buildDataGridGanttVisibleBars({
    rows: tableRows.value.displayRows as readonly DataGridRowNode<Record<string, unknown>>[],
    rowMetrics: visibleRowMetrics.value,
    viewportRowStart: tableViewport.value.viewportRowStart,
    scrollTop: tableScrollTop.value,
    topSpacerHeight: tableViewport.value.topSpacerHeight,
    viewportHeight: Math.max(
      tableViewportHeight.value,
      tableRows.value.displayRows.length * props.baseRowHeight,
    ),
    baseRowHeight: props.baseRowHeight,
    resolveRowHeight,
    timeline: timelineState.value,
    options: props.gantt,
    criticalTaskIds: criticalTaskIds.value,
  })
})

const visibleRowDividerYs = computed<readonly number[]>(() => {
  void props.rowVersion
  void rowHeightVersion.value
  const dividerYs: number[] = []
  const viewportHeight = Math.max(tableViewportHeight.value, 0)

  visibleRowMetrics.value.forEach(metric => {
    const dividerY = Math.round(metric.top - tableScrollTop.value + metric.height) + 0.5
    if (dividerY >= -1 && dividerY <= viewportHeight + 1) {
      dividerYs.push(dividerY)
    }
  })

  return dividerYs
})

const visibleDependencyPaths = computed(() => {
  const timeline = timelineState.value
  if (!timeline || !props.gantt) {
    return []
  }
  return buildDataGridGanttDependencyPaths({
    bars: visibleBars.value,
    resolveFrame: bar => {
      const preview = resolvePreviewRangeForBar(bar)
      const frame = resolveDataGridGanttRangeFrame(
        preview,
        timeline,
        props.gantt?.minBarWidth ?? 6,
        bar.milestone ? bar.height : undefined,
      )
      return {
        x: frame.x - timelineScrollLeft.value,
        width: frame.width,
        y: bar.y,
        height: bar.height,
      }
    },
  })
})

const selectedDependencyPath = computed(() => {
  if (!selectedDependencyKey.value) {
    return null
  }
  return visibleDependencyPaths.value.find(path => (
    resolveDataGridGanttDependencyPathKey(path) === selectedDependencyKey.value
  )) ?? null
})

const selectedDependencyRowIds = computed(() => {
  const path = selectedDependencyPath.value
  if (!path) {
    return new Set<string>()
  }
  return new Set([
    path.sourceBar.rowId,
    path.targetBar.rowId,
  ])
})

const displayRowsSignature = computed(() => tableRows.value.displayRows
  .map((row, index) => `${row.rowId == null ? index : String(row.rowId)}`)
  .join("|"))

const ganttConfigSignature = computed(() => {
  if (!props.gantt) {
    return "off"
  }
  const workingCalendarSignature = [
    props.gantt.workingCalendar.workingWeekdays.join(","),
    props.gantt.workingCalendar.holidayDayStarts.join(","),
  ].join("@")
  return [
    props.gantt.startKey,
    props.gantt.endKey,
    props.gantt.baselineStartKey ?? "",
    props.gantt.baselineEndKey ?? "",
    props.gantt.progressKey ?? "",
    props.gantt.dependencyKey ?? "",
    props.gantt.labelKey ?? "",
    props.gantt.idKey ?? "",
    props.gantt.criticalKey ?? "",
    props.gantt.computedCriticalPath ? "computed-critical" : "",
    props.gantt.zoomLevel,
    props.gantt.pixelsPerDay,
    props.gantt.timelineStart == null ? "" : String(props.gantt.timelineStart),
    props.gantt.timelineEnd == null ? "" : String(props.gantt.timelineEnd),
    props.gantt.rangePaddingDays,
    workingCalendarSignature,
    props.gantt.rowBarHeight,
    props.gantt.minBarWidth,
    props.gantt.resizeHandleWidth,
    props.gantt.paneWidth,
  ].join("|")
})

const timelineStateSignature = computed(() => {
  if (!timelineState.value) {
    return "none"
  }
  return [
    timelineState.value.startMs,
    timelineState.value.endMs,
    timelineState.value.totalWidth,
    timelineState.value.pixelsPerDay,
    timelineState.value.zoomLevel,
  ].join("|")
})

const visibleBarsSignature = computed(() => visibleBars.value
  .map(bar => [
    String(bar.rowUpdateId),
    bar.startMs,
    bar.endMs,
    bar.x,
    bar.width,
    bar.y,
    bar.height,
    bar.progress,
    bar.critical ? 1 : 0,
    bar.criticalSource ?? "",
    bar.milestone ? 1 : 0,
    bar.summary ? 1 : 0,
    bar.baselineStartMs ?? "",
    bar.baselineEndMs ?? "",
    bar.dependencyRefs.map(dependency => `${dependency.taskId}:${dependency.type}`).join(","),
  ].join(":"))
  .join("|"))

const visibleRowDividerSignature = computed(() => visibleRowDividerYs.value.join("|"))

const requestedTablePaneWidth = ref(props.gantt?.paneWidth ?? 520)

const resolvedTablePaneWidth = computed(() => clampDataGridGanttTablePaneWidth({
  requestedWidth: requestedTablePaneWidth.value,
  stageWidth: stageWidth.value,
  minTableWidth: DATAGRID_GANTT_MIN_TABLE_PANE_WIDTH_PX,
  minTimelineWidth: DATAGRID_GANTT_MIN_TIMELINE_PANE_WIDTH_PX,
}))

const tablePaneStyle = computed<CSSProperties>(() => ({
  width: `${resolvedTablePaneWidth.value}px`,
  minWidth: `${resolvedTablePaneWidth.value}px`,
  maxWidth: `${resolvedTablePaneWidth.value}px`,
}))

const splitterStyle = computed<CSSProperties>(() => ({
  left: `${resolvedTablePaneWidth.value}px`,
  width: `${DATAGRID_GANTT_SPLITTER_SIZE_PX}px`,
}))

const timelineHeaderStyle = computed<CSSProperties>(() => ({
  height: `${headerHeightPx.value}px`,
}))

const timelineHeaderViewportStyle = computed<CSSProperties>(() => ({
  height: `${headerHeightPx.value}px`,
}))

const headerTrackStyle = computed<CSSProperties>(() => ({
  width: `${timelineState.value?.totalWidth ?? 1}px`,
  minWidth: `${timelineState.value?.totalWidth ?? 1}px`,
  height: `${headerHeightPx.value}px`,
}))

const bodyTrackStyle = computed<CSSProperties>(() => ({
  width: `${timelineState.value?.totalWidth ?? 1}px`,
  minWidth: `${timelineState.value?.totalWidth ?? 1}px`,
  height: `${Math.max(tableViewportHeight.value, 1)}px`,
}))

const canvasCursor = computed(() => {
  if (activeSplitResizeState.value) {
    return "col-resize"
  }
  if (activeDragState.value) {
    return activeDragState.value.mode === "move" ? "grabbing" : "col-resize"
  }
  if (!hoverTarget.value) {
    return hoverDependencyKey.value ? "pointer" : "default"
  }
  return hoverTarget.value.mode === "move" ? "grab" : "col-resize"
})

function clearDependencySelection(): void {
  if (selectedDependencyKey.value == null && hoverDependencyKey.value == null) {
    return
  }
  selectedDependencyKey.value = null
  hoverDependencyKey.value = null
  scheduleRedraw("body")
}

function resolvePreviewRangeForBar(bar: DataGridGanttBarLayout<Record<string, unknown>>): { startMs: number; endMs: number } {
  const drag = activeDragState.value
  if (!drag || drag.rowId !== bar.rowId) {
    return {
      startMs: bar.startMs,
      endMs: bar.endMs,
    }
  }
  return {
    startMs: drag.draftStartMs,
    endMs: drag.draftEndMs,
  }
}

function setSplitResizeGlobalCursor(active: boolean): void {
  if (typeof document === "undefined") {
    return
  }
  document.body.style.cursor = active ? "col-resize" : ""
  document.body.style.userSelect = active ? "none" : ""
}

function drawTimelineSegmentLabels(
  context: CanvasRenderingContext2D,
  segments: readonly DataGridTimelineSegment[],
  bandTop: number,
  bandHeight: number,
  viewportWidth: number,
): void {
  for (const segment of segments) {
    if (segment.width < 18) {
      continue
    }
    const visibleStart = Math.max(0, segment.x)
    const visibleEnd = Math.min(viewportWidth, segment.x + segment.width)
    if (visibleEnd <= visibleStart) {
      continue
    }
    context.save()
    context.beginPath()
    context.rect(visibleStart, bandTop, visibleEnd - visibleStart, bandHeight)
    context.clip()
    context.fillText(
      segment.label,
      Math.max(visibleStart + 8, segment.x + 8),
      bandTop + (bandHeight / 2),
    )
    context.restore()
  }
}

function drawTimelineHeader(): void {
  const timeline = timelineState.value
  const viewport = timelineHeaderViewportRef.value
  if (!timeline || !viewport) {
    return
  }

  const headerHeight = Math.max(1, headerHeightPx.value)
  const width = Math.max(1, timelineViewportWidth.value || viewport.clientWidth || 1)
  const model = buildDataGridTimelineRenderModels({
    timeline,
    scrollLeft: timelineScrollLeft.value,
    viewportWidth: width,
    workingCalendar: props.gantt?.workingCalendar ?? null,
    headerBufferPx: 0,
    bodyBufferPx: TIMELINE_SEGMENT_BUFFER_PX,
  }).header
  const context = resizeCanvas(
    headerCanvasRef.value,
    width,
    headerHeight,
  )
  if (!context) {
    return
  }

  const minorStroke = readCssVar("--datagrid-column-divider-color", "rgba(148, 163, 184, 0.24)")
  const majorStroke = readCssVar("--datagrid-header-divider-color", "rgba(148, 163, 184, 0.42)")
  const background = readCssVar("--datagrid-header-row-bg", "#f8fafc")
  const weekendFill = readCssVar("--datagrid-weekend-bg", "rgba(148, 163, 184, 0.12)")
  const textColor = readCssVar("--datagrid-text-primary", "#0f172a")
  const fontFamily = readCssVar("--datagrid-font-family", "ui-sans-serif, system-ui, sans-serif")
  const todayStroke = readCssVar("--datagrid-accent-strong", "#2563eb")
  const primaryBandHeight = Math.max(16, Math.round(headerHeight * 0.46))
  const secondaryBandTop = primaryBandHeight
  const secondaryBandHeight = Math.max(1, headerHeight - primaryBandHeight)

  context.fillStyle = background
  context.fillRect(0, 0, width, headerHeight)

  context.fillStyle = weekendFill
  for (const span of model.nonWorkingSpans) {
    const visibleStart = Math.max(0, span.x)
    const visibleEnd = Math.min(width, span.x + span.width)
    if (visibleEnd <= visibleStart) {
      continue
    }
    context.fillRect(visibleStart, secondaryBandTop, visibleEnd - visibleStart, secondaryBandHeight)
  }

  context.strokeStyle = minorStroke
  context.lineWidth = 1
  for (const line of model.secondaryLines) {
    const x = Math.round(line.x) + 0.5
    context.beginPath()
    context.moveTo(x, secondaryBandTop)
    context.lineTo(x, headerHeight)
    context.stroke()
  }

  context.strokeStyle = majorStroke
  for (const line of model.primaryLines) {
    const x = Math.round(line.x) + 0.5
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, headerHeight)
    context.stroke()
  }

  context.beginPath()
  context.moveTo(0, secondaryBandTop - 0.5)
  context.lineTo(width, secondaryBandTop - 0.5)
  context.stroke()

  context.strokeStyle = majorStroke
  context.beginPath()
  context.moveTo(0, headerHeight - 0.5)
  context.lineTo(width, headerHeight - 0.5)
  context.stroke()

  context.fillStyle = textColor
  context.font = `12px ${fontFamily}`
  context.textBaseline = "middle"
  drawTimelineSegmentLabels(context, model.primarySegments, 0, primaryBandHeight, width)
  drawTimelineSegmentLabels(context, model.secondarySegments, secondaryBandTop, secondaryBandHeight, width)

  const todayX = resolveDataGridTimelineDateToPixel(resolveUtcDayStart(Date.now()), timeline) - timelineScrollLeft.value
  if (todayX >= -1 && todayX <= width + 1) {
    context.strokeStyle = todayStroke
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(Math.round(todayX) + 0.5, 0)
    context.lineTo(Math.round(todayX) + 0.5, headerHeight)
    context.stroke()
  }
}

function drawTimelineBody(): void {
  const timeline = timelineState.value
  const viewport = timelineBodyViewportRef.value
  if (!timeline || !viewport) {
    return
  }

  const height = Math.max(1, tableViewportHeight.value || viewport.clientHeight || visibleBars.value.length * props.baseRowHeight)
  const width = Math.max(1, timelineViewportWidth.value || viewport.clientWidth || 1)
  const model = buildDataGridTimelineRenderModels({
    timeline,
    scrollLeft: timelineScrollLeft.value,
    viewportWidth: width,
    workingCalendar: props.gantt?.workingCalendar ?? null,
    headerBufferPx: 0,
    bodyBufferPx: TIMELINE_SEGMENT_BUFFER_PX,
  }).body
  const context = resizeCanvas(bodyCanvasRef.value, width, height)
  if (!context) {
    return
  }

  const background = readCssVar("--datagrid-viewport-bg", "#ffffff")
  const gridStroke = readCssVar("--datagrid-column-divider-color", "rgba(148, 163, 184, 0.16)")
  const rowStroke = readCssVar("--datagrid-row-divider-color", "rgba(148, 163, 184, 0.18)")
  const weekendFill = readCssVar("--datagrid-weekend-bg", "rgba(148, 163, 184, 0.08)")
  const barFill = readCssVar("--datagrid-accent-strong", "#2563eb")
  const barFillMuted = readCssVar("--datagrid-selection-range-bg", "rgba(37, 99, 235, 0.16)")
  const summaryBarFill = "rgba(30, 64, 175, 0.24)"
  const summaryBarStroke = "rgba(30, 64, 175, 0.96)"
  const summaryBarAccent = "rgba(59, 130, 246, 0.92)"
  const baselineFill = "rgba(100, 116, 139, 0.28)"
  const baselineStroke = "rgba(71, 85, 105, 0.44)"
  const varianceLateStroke = "rgba(220, 38, 38, 0.62)"
  const varianceEarlyStroke = "rgba(5, 150, 105, 0.56)"
  const barProgress = "rgba(255, 255, 255, 0.28)"
  const criticalStroke = "#dc2626"
  const computedCriticalStroke = "rgba(220, 38, 38, 0.76)"
  const dependencyStroke = "rgba(15, 23, 42, 0.32)"
  const dependencyUnderlay = "rgba(255, 255, 255, 0.72)"
  const dependencySelectedStroke = "rgba(15, 23, 42, 0.84)"
  const dependencySelectedUnderlay = "rgba(255, 255, 255, 0.94)"
  const majorGridStroke = readCssVar("--datagrid-header-divider-color", "rgba(148, 163, 184, 0.3)")
  const labelColor = "#ffffff"
  const fontFamily = readCssVar("--datagrid-font-family", "ui-sans-serif, system-ui, sans-serif")
  const todayStroke = readCssVar("--datagrid-accent-strong", "#2563eb")
  const selectedBarStroke = "rgba(15, 23, 42, 0.85)"
  const selectedBarUnderlay = "rgba(255, 255, 255, 0.96)"

  context.fillStyle = background
  context.fillRect(0, 0, width, height)

  context.fillStyle = weekendFill
  for (const span of model.nonWorkingSpans) {
    const visibleStart = Math.max(0, span.x)
    const visibleEnd = Math.min(width, span.x + span.width)
    if (visibleEnd <= visibleStart) {
      continue
    }
    context.fillRect(visibleStart, 0, visibleEnd - visibleStart, height)
  }

  context.strokeStyle = gridStroke
  context.lineWidth = 1
  for (const line of model.secondaryLines) {
    const x = Math.round(line.x) + 0.5
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }

  context.strokeStyle = majorGridStroke
  for (const line of model.primaryLines) {
    const x = Math.round(line.x) + 0.5
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }

  context.strokeStyle = rowStroke
  for (const y of visibleRowDividerYs.value) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }

  const todayX = resolveDataGridTimelineDateToPixel(resolveUtcDayStart(Date.now()), timeline) - timelineScrollLeft.value
  if (todayX >= -1 && todayX <= width + 1) {
    context.strokeStyle = todayStroke
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(Math.round(todayX) + 0.5, 0)
    context.lineTo(Math.round(todayX) + 0.5, height)
    context.stroke()
  }

  for (const path of visibleDependencyPaths.value) {
    const isSelected = resolveDataGridGanttDependencyPathKey(path) === selectedDependencyKey.value
    drawDependencyPolyline(
      context,
      path.points,
      path.dependencyType,
      isSelected ? dependencySelectedStroke : dependencyStroke,
      isSelected ? dependencySelectedUnderlay : dependencyUnderlay,
    )
  }

  context.font = `12px ${fontFamily}`
  context.textBaseline = "middle"

  for (const bar of visibleBars.value) {
    const preview = resolvePreviewRangeForBar(bar)
    const frame = resolveDataGridGanttRangeFrame(
      preview,
      timeline,
      props.gantt?.minBarWidth ?? 6,
      bar.milestone ? bar.height : undefined,
    )
    const x = frame.x - timelineScrollLeft.value
    const widthPx = frame.width
    const isDependencySelectedBar = selectedDependencyRowIds.value.has(bar.rowId)
    const hasBaseline = bar.baselineStartMs != null
      && bar.baselineEndMs != null
      && (bar.baselineStartMs !== bar.startMs || bar.baselineEndMs !== bar.endMs)
    const fillStyle = bar.summary
      ? summaryBarFill
      : (activeDragState.value?.rowId === bar.rowId ? barFillMuted : barFill)
    if (hasBaseline) {
      const baselineFrame = resolveDataGridGanttRangeFrame(
        {
          startMs: bar.baselineStartMs!,
          endMs: bar.baselineEndMs!,
        },
        timeline,
        props.gantt?.minBarWidth ?? 6,
        bar.milestone ? bar.height : undefined,
      )
      const baselineX = baselineFrame.x - timelineScrollLeft.value
      const actualStartX = x
      const actualEndX = x + widthPx
      const baselineStartX = baselineX
      const baselineEndX = baselineX + baselineFrame.width
      if (bar.milestone) {
        drawDiamond(
          context,
          baselineX + (baselineFrame.width / 2),
          bar.y + (bar.height / 2),
          Math.max(Math.max(8, baselineFrame.width - 2), bar.height - 2),
        )
        context.fillStyle = baselineFill
        context.fill()
        drawDiamond(
          context,
          baselineX + (baselineFrame.width / 2),
          bar.y + (bar.height / 2),
          Math.max(Math.max(8, baselineFrame.width - 2), bar.height - 2),
        )
        context.strokeStyle = baselineStroke
        context.lineWidth = 1
        context.stroke()
      } else {
        const baselineHeight = Math.max(4, Math.min(6, Math.round(bar.height * 0.34)))
        const baselineY = bar.y + bar.height - baselineHeight
        drawRoundedRect(context, baselineX, baselineY, baselineFrame.width, baselineHeight, 3)
        context.fillStyle = baselineFill
        context.fill()
        drawRoundedRect(context, baselineX, baselineY, baselineFrame.width, baselineHeight, 3)
        context.strokeStyle = baselineStroke
        context.lineWidth = 1
        context.stroke()
      }
      drawVarianceMarker(
        context,
        baselineStartX,
        actualStartX,
        bar.y + 2.5,
        actualStartX >= baselineStartX ? varianceLateStroke : varianceEarlyStroke,
      )
      drawVarianceMarker(
        context,
        baselineEndX,
        actualEndX,
        bar.y + bar.height - 2.5,
        actualEndX >= baselineEndX ? varianceLateStroke : varianceEarlyStroke,
      )
    }
    if (bar.milestone) {
      drawDiamond(context, x + (widthPx / 2), bar.y + (bar.height / 2), Math.max(widthPx, bar.height))
      context.fillStyle = fillStyle
      context.fill()
      if (isDependencySelectedBar) {
        drawDiamond(context, x + (widthPx / 2), bar.y + (bar.height / 2), Math.max(widthPx, bar.height))
        context.strokeStyle = selectedBarUnderlay
        context.lineWidth = 4
        context.stroke()
        drawDiamond(context, x + (widthPx / 2), bar.y + (bar.height / 2), Math.max(widthPx, bar.height))
        context.strokeStyle = selectedBarStroke
        context.lineWidth = 2
        context.stroke()
      }
      if (bar.critical) {
        drawDiamond(context, x + (widthPx / 2), bar.y + (bar.height / 2), Math.max(widthPx, bar.height))
        context.strokeStyle = bar.criticalSource === "computed" ? computedCriticalStroke : criticalStroke
        context.lineWidth = 2
        context.stroke()
      }
      continue
    }

    drawRoundedRect(context, x, bar.y, widthPx, bar.height, bar.summary ? 4 : 6)
    context.fillStyle = fillStyle
    context.fill()

    if (bar.summary) {
      context.fillStyle = summaryBarAccent
      context.fillRect(x + 4, bar.y + 3, Math.max(8, widthPx - 8), 2)
      context.strokeStyle = summaryBarStroke
      context.lineWidth = 2.5
      context.beginPath()
      context.moveTo(x, bar.y + bar.height)
      context.lineTo(x + 6, bar.y)
      context.lineTo(x + widthPx - 6, bar.y)
      context.lineTo(x + widthPx, bar.y + bar.height)
      context.stroke()
    }

    if (!bar.summary && bar.progress > 0) {
      drawRoundedRect(context, x, bar.y, Math.max(0, widthPx * bar.progress), bar.height, 6)
      context.fillStyle = barProgress
      context.fill()
    }

    if (isDependencySelectedBar) {
      drawRoundedRect(context, x, bar.y, widthPx, bar.height, 6)
      context.strokeStyle = selectedBarUnderlay
      context.lineWidth = 4
      context.stroke()

      drawRoundedRect(context, x, bar.y, widthPx, bar.height, 6)
      context.strokeStyle = selectedBarStroke
      context.lineWidth = 2
      context.stroke()
    }

    if (bar.critical) {
      drawRoundedRect(context, x, bar.y, widthPx, bar.height, 6)
      context.strokeStyle = bar.criticalSource === "computed" ? computedCriticalStroke : criticalStroke
      context.lineWidth = 2
      context.stroke()
    }

    context.fillStyle = labelColor
    drawBarLabel(context, bar.label, x, bar.y, widthPx, bar.height)
  }
}

function resolveDragAutoScrollDelta(clientX: number): number {
  const viewport = timelineBodyViewportRef.value
  if (!viewport) {
    return 0
  }
  const rect = viewport.getBoundingClientRect()
  if (clientX <= rect.left + DRAG_AUTO_SCROLL_EDGE_PX) {
    const distance = Math.max(0, clientX - rect.left)
    const intensity = 1 - (distance / DRAG_AUTO_SCROLL_EDGE_PX)
    return -Math.max(1, Math.round(DRAG_AUTO_SCROLL_MAX_STEP_PX * intensity))
  }
  if (clientX >= rect.right - DRAG_AUTO_SCROLL_EDGE_PX) {
    const distance = Math.max(0, rect.right - clientX)
    const intensity = 1 - (distance / DRAG_AUTO_SCROLL_EDGE_PX)
    return Math.max(1, Math.round(DRAG_AUTO_SCROLL_MAX_STEP_PX * intensity))
  }
  return 0
}

function syncTimelineScroll(nextScrollLeft: number, source: "body" | "header"): void {
  timelineScrollLeft.value = clampDataGridTimelineScrollLeft(
    nextScrollLeft,
    timelineState.value?.totalWidth ?? 0,
    timelineViewportWidth.value,
  )
  if (syncingTimelineScroll) {
    scheduleRedraw()
    return
  }
  syncingTimelineScroll = true
  if (source !== "header" && timelineHeaderViewportRef.value && timelineHeaderViewportRef.value.scrollLeft !== timelineScrollLeft.value) {
    timelineHeaderViewportRef.value.scrollLeft = timelineScrollLeft.value
  }
  if (source !== "body" && timelineBodyViewportRef.value && timelineBodyViewportRef.value.scrollLeft !== timelineScrollLeft.value) {
    timelineBodyViewportRef.value.scrollLeft = timelineScrollLeft.value
  }
  syncingTimelineScroll = false
  scheduleRedraw()
}

function syncTimelineScrollBounds(): void {
  if (!timelineState.value) {
    syncTimelineScroll(0, "body")
    return
  }
  syncTimelineScroll(timelineScrollLeft.value, "body")
}

function autoFocusTimelineViewport(): void {
  if (hasAutoFocusedTimeline.value || !timelineState.value || timelineViewportWidth.value <= 0) {
    return
  }
  const todayMs = resolveUtcDayStart(Date.now())
  const nextScrollLeft = todayMs >= timelineState.value.startMs && todayMs <= timelineState.value.endMs
    ? resolveDataGridTimelineScrollLeftForDate({
      dateMs: todayMs,
      timeline: timelineState.value,
      viewportWidth: timelineViewportWidth.value,
      align: "center",
    })
    : 0
  syncTimelineScroll(nextScrollLeft, "body")
  hasAutoFocusedTimeline.value = true
}

function handleTimelineBodyScroll(event: Event): void {
  const element = event.target as HTMLElement | null
  if (!element) {
    return
  }
  syncTimelineViewportWidthFromElement(element)
  syncTimelineScroll(element.scrollLeft, "body")
}

function handleTimelineHeaderScroll(event: Event): void {
  const element = event.target as HTMLElement | null
  if (!element) {
    return
  }
  syncTimelineViewportWidthFromElement(element)
  syncTimelineScroll(element.scrollLeft, "header")
}

function handleTimelineWheel(event: WheelEvent): void {
  const tableViewport = tableViewportRef.value
  const timelineBodyViewport = timelineBodyViewportRef.value
  if (!tableViewport || !timelineBodyViewport) {
    return
  }
  const { horizontalDelta, verticalDelta } = resolveDataGridGanttWheelIntent({
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    shiftKey: event.shiftKey,
  })
  if (horizontalDelta === 0 && verticalDelta === 0) {
    return
  }

  event.preventDefault()
  if (horizontalDelta !== 0) {
    timelineBodyViewport.scrollLeft += horizontalDelta
    syncTimelineScroll(timelineBodyViewport.scrollLeft, "body")
  }
  if (verticalDelta !== 0) {
    const previousScrollTop = tableViewport.scrollTop
    tableViewport.scrollTop = previousScrollTop + verticalDelta
    if (tableViewport.scrollTop !== previousScrollTop) {
      syncTableViewportMetrics()
      scheduleRedraw("body")
    }
  }
}

function finishSplitResize(pointerId?: number): void {
  if (
    pointerId != null
    && activeSplitResizeState.value
    && activeSplitResizeState.value.pointerId !== pointerId
  ) {
    return
  }
  activeSplitResizeState.value = null
  setSplitResizeGlobalCursor(false)
  if (typeof window !== "undefined") {
    window.removeEventListener("pointermove", handleWindowSplitterPointerMove)
    window.removeEventListener("pointerup", handleWindowSplitterPointerUp)
  }
}

function handleWindowSplitterPointerMove(event: PointerEvent): void {
  const activeResize = activeSplitResizeState.value
  if (!activeResize) {
    return
  }
  requestedTablePaneWidth.value = resolveDataGridGanttTablePaneDragWidth({
    originWidth: activeResize.originWidth,
    deltaX: event.clientX - activeResize.originClientX,
    stageWidth: stageWidth.value,
    minTableWidth: DATAGRID_GANTT_MIN_TABLE_PANE_WIDTH_PX,
    minTimelineWidth: DATAGRID_GANTT_MIN_TIMELINE_PANE_WIDTH_PX,
  })
  syncTimelineViewportMetrics()
  scheduleRedraw()
}

function handleWindowSplitterPointerUp(event: PointerEvent): void {
  finishSplitResize(event.pointerId)
}

function handleSplitterPointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }
  event.preventDefault()
  syncStageMetrics()
  activeSplitResizeState.value = {
    pointerId: event.pointerId,
    originClientX: event.clientX,
    originWidth: resolvedTablePaneWidth.value,
  }
  setSplitResizeGlobalCursor(true)
  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", handleWindowSplitterPointerMove)
    window.addEventListener("pointerup", handleWindowSplitterPointerUp)
  }
}

function resolveCanvasViewportPoint(event: PointerEvent): { x: number; y: number } | null {
  const canvas = bodyCanvasRef.value
  if (!canvas) {
    return null
  }
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function resolveCanvasTimelinePoint(event: PointerEvent): { x: number; y: number } | null {
  const point = resolveCanvasViewportPoint(event)
  if (!point) {
    return null
  }
  return {
    x: point.x + timelineScrollLeft.value,
    y: point.y,
  }
}

function updateHoverTarget(event: PointerEvent): void {
  if (!props.gantt) {
    hoverTarget.value = null
    return
  }
  const viewportPoint = resolveCanvasViewportPoint(event)
  const timelinePoint = resolveCanvasTimelinePoint(event)
  if (!viewportPoint || !timelinePoint) {
    hoverTarget.value = null
    hoverDependencyKey.value = null
    return
  }
  const dependencyHit = hitTestDataGridGanttDependencyPath(visibleDependencyPaths.value, viewportPoint)
  hoverDependencyKey.value = dependencyHit ? resolveDataGridGanttDependencyPathKey(dependencyHit) : null
  hoverTarget.value = hitTestDataGridGanttBar(
    visibleBars.value,
    timelinePoint,
    props.gantt.resizeHandleWidth,
  )
  if (hoverTarget.value) {
    hoverDependencyKey.value = null
  }
}

function commitDrag(): void {
  if (!props.gantt || !activeDragState.value) {
    activeDragState.value = null
    return
  }
  const drag = activeDragState.value
  activeDragState.value = null
  if (drag.initialStartMs === drag.draftStartMs && drag.initialEndMs === drag.draftEndMs) {
    scheduleRedraw("body")
    return
  }
  props.runtime.api.rows.applyEdits([buildDataGridGanttRowEditPatch(
    drag.rowUpdateId,
    {
      startMs: drag.draftStartMs,
      endMs: drag.draftEndMs,
    },
    props.gantt,
  )], {
    reapply: true,
  })
  scheduleRedraw("body")
}

function handleWindowPointerMove(event: PointerEvent): void {
  if (!activeDragState.value || !timelineState.value) {
    return
  }
  const autoScrollDelta = resolveDragAutoScrollDelta(event.clientX)
  if (autoScrollDelta !== 0) {
    syncTimelineScroll(timelineScrollLeft.value + autoScrollDelta, "body")
  }
  const point = resolveCanvasTimelinePoint(event)
  if (!point) {
    return
  }
  const dayDelta = (point.x - activeDragState.value.originX) / timelineState.value.pixelsPerDay
  const nextRange = applyDataGridGanttDragDelta({
    startMs: activeDragState.value.initialStartMs,
    endMs: activeDragState.value.initialEndMs,
  }, activeDragState.value.mode, dayDelta, timelineState.value.zoomLevel, props.gantt?.workingCalendar)
  activeDragState.value = {
    ...activeDragState.value,
    draftStartMs: nextRange.startMs,
    draftEndMs: nextRange.endMs,
  }
  scheduleRedraw("body")
}

function handleWindowPointerUp(event: PointerEvent): void {
  if (!activeDragState.value || event.pointerId !== activeDragState.value.pointerId) {
    return
  }
  if (bodyCanvasRef.value?.hasPointerCapture?.(event.pointerId)) {
    bodyCanvasRef.value.releasePointerCapture(event.pointerId)
  }
  commitDrag()
  if (typeof window !== "undefined") {
    window.removeEventListener("pointermove", handleWindowPointerMove)
    window.removeEventListener("pointerup", handleWindowPointerUp)
  }
}

function handleCanvasPointerDown(event: PointerEvent): void {
  if (!props.gantt || !timelineState.value) {
    return
  }
  const viewportPoint = resolveCanvasViewportPoint(event)
  const timelinePoint = resolveCanvasTimelinePoint(event)
  if (!viewportPoint || !timelinePoint) {
    return
  }
  const hit = hitTestDataGridGanttBar(
    visibleBars.value,
    timelinePoint,
    props.gantt.resizeHandleWidth,
  )
  if (hit) {
    selectedDependencyKey.value = null
    hoverDependencyKey.value = null
  }
  if (!hit) {
    const dependencyHit = hitTestDataGridGanttDependencyPath(visibleDependencyPaths.value, viewportPoint)
    if (dependencyHit) {
      event.preventDefault()
      selectedDependencyKey.value = resolveDataGridGanttDependencyPathKey(dependencyHit)
      scheduleRedraw("body")
      return
    }
    clearDependencySelection()
    return
  }
  event.preventDefault()
  bodyCanvasRef.value?.setPointerCapture?.(event.pointerId)
  activeDragState.value = {
    pointerId: event.pointerId,
    rowId: hit.bar.rowId,
    rowUpdateId: hit.bar.rowUpdateId,
    mode: hit.mode,
    originX: timelinePoint.x,
    initialStartMs: hit.bar.startMs,
    initialEndMs: hit.bar.endMs,
    draftStartMs: hit.bar.startMs,
    draftEndMs: hit.bar.endMs,
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", handleWindowPointerMove)
    window.addEventListener("pointerup", handleWindowPointerUp)
  }
  scheduleRedraw("body")
}

function handleCanvasPointerMove(event: PointerEvent): void {
  if (activeDragState.value) {
    return
  }
  updateHoverTarget(event)
}

function handleCanvasPointerLeave(): void {
  if (!activeDragState.value) {
    hoverTarget.value = null
    hoverDependencyKey.value = null
  }
}

function handleWindowKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || activeDragState.value) {
    return
  }
  clearDependencySelection()
}

function disconnectTableViewport(): void {
  teardownTableViewport?.()
  teardownTableViewport = null
  tableViewportRef.value = null
}

function attachResizeObserver(): void {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (typeof window === "undefined" || typeof window.ResizeObserver !== "function") {
    return
  }
  resizeObserver = new window.ResizeObserver(() => {
    syncStageMetrics()
    syncTableHeaderMetrics()
    syncTableViewportMetrics()
    syncTimelineViewportMetrics()
    syncTimelineScrollBounds()
    scheduleRedraw()
  })
  const headerElement = tableStageRef.value?.getHeaderElement() ?? null
  if (headerElement) {
    resizeObserver.observe(headerElement)
  }
  if (tableViewportRef.value) {
    resizeObserver.observe(tableViewportRef.value)
  }
  if (stageRootRef.value) {
    resizeObserver.observe(stageRootRef.value)
  }
  if (timelineBodyViewportRef.value) {
    resizeObserver.observe(timelineBodyViewportRef.value)
  }
}

function attachTableViewport(): void {
  const viewport = tableStageRef.value?.getBodyViewportElement() ?? null
  if (viewport === tableViewportRef.value) {
    syncStageMetrics()
    syncTableHeaderMetrics()
    syncTableViewportMetrics()
    attachResizeObserver()
    syncTimelineScrollBounds()
    scheduleRedraw()
    return
  }

  disconnectTableViewport()
  tableViewportRef.value = viewport
  if (!viewport) {
    syncStageMetrics()
    syncTableHeaderMetrics()
    syncTimelineScrollBounds()
    scheduleRedraw()
    return
  }

  const onScroll = () => {
    syncTableViewportMetrics()
    scheduleRedraw("body")
  }

  viewport.addEventListener("scroll", onScroll, { passive: true })
  syncStageMetrics()
  syncTableHeaderMetrics()
  syncTableViewportMetrics()
  teardownTableViewport = () => {
    viewport.removeEventListener("scroll", onScroll)
  }
  attachResizeObserver()
  syncTimelineScrollBounds()
  scheduleRedraw()
}

function handleWindowResize(): void {
  syncStageMetrics()
  syncTableHeaderMetrics()
  syncTableViewportMetrics()
  syncTimelineViewportMetrics()
  syncTimelineScrollBounds()
  scheduleRedraw()
}

watch(
  () => props.gantt?.paneWidth,
  nextPaneWidth => {
    requestedTablePaneWidth.value = nextPaneWidth ?? 520
  },
  { immediate: true },
)

watch(
  () => [
    displayRowsSignature.value,
    tableRows.value.displayRows.length,
    tableViewport.value.topSpacerHeight,
    tableViewport.value.viewportRowStart,
    ganttConfigSignature.value,
    props.rowVersion,
    rowHeightVersion.value,
  ],
  () => {
    void nextTick(() => {
      attachTableViewport()
      syncTableViewportMetrics()
      syncTimelineViewportMetrics()
      syncTimelineScrollBounds()
      autoFocusTimelineViewport()
      scheduleRedraw()
    })
  },
)

watch(
  () => [timelineState.value?.totalWidth ?? 0, timelineViewportWidth.value],
  () => {
    syncTimelineScrollBounds()
    autoFocusTimelineViewport()
  },
)

watch(
  () => [
    visibleBarsSignature.value,
    visibleRowDividerSignature.value,
    tableScrollTop.value,
    tableViewportHeight.value,
  ],
  () => {
    scheduleRedraw("body")
  },
)

watch(
  () => [
    timelineStateSignature.value,
    headerHeightPx.value,
  ],
  () => {
    scheduleRedraw()
  },
)

watch(
  () => visibleDependencyPaths.value.map(path => resolveDataGridGanttDependencyPathKey(path)).join("|"),
  nextSignature => {
    if (
      selectedDependencyKey.value
      && !nextSignature.split("|").includes(selectedDependencyKey.value)
    ) {
      selectedDependencyKey.value = null
      scheduleRedraw("body")
    }
  },
)

onMounted(() => {
  void nextTick(() => {
    syncStageMetrics()
    attachTableViewport()
    syncTimelineViewportMetrics()
    syncTimelineScrollBounds()
    autoFocusTimelineViewport()
    scheduleRedraw()
  })
  if (typeof window !== "undefined") {
    window.addEventListener("resize", handleWindowResize)
    window.addEventListener("keydown", handleWindowKeyDown)
  }
})

onBeforeUnmount(() => {
  clearScheduledRedraw()
  disconnectTableViewport()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleWindowResize)
    window.removeEventListener("keydown", handleWindowKeyDown)
    window.removeEventListener("pointermove", handleWindowPointerMove)
    window.removeEventListener("pointerup", handleWindowPointerUp)
    window.removeEventListener("pointermove", handleWindowSplitterPointerMove)
    window.removeEventListener("pointerup", handleWindowSplitterPointerUp)
  }
  setSplitResizeGlobalCursor(false)
})
</script>
