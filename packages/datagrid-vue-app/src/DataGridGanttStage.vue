<template>
  <section class="datagrid-gantt-stage">
    <div class="datagrid-gantt-stage__table" :style="tablePaneStyle">
      <DataGridTableStage ref="tableStageRef" v-bind="table" />
    </div>

    <div class="datagrid-gantt-stage__timeline">
      <div class="datagrid-gantt-stage__timeline-header">
        <div
          ref="timelineHeaderViewportRef"
          class="datagrid-gantt-timeline__viewport datagrid-gantt-timeline__viewport--header"
          @scroll="handleTimelineHeaderScroll"
          @wheel="handleTimelineWheel"
        >
          <div class="datagrid-gantt-timeline__track-spacer" :style="headerTrackStyle" />
          <canvas
            ref="headerCanvasRef"
            class="datagrid-gantt-timeline__canvas datagrid-gantt-timeline__canvas--header"
            aria-hidden="true"
          />
        </div>
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
          <canvas
            ref="bodyCanvasRef"
            class="datagrid-gantt-timeline__canvas datagrid-gantt-timeline__canvas--body"
            :style="{ cursor: canvasCursor }"
            @pointerdown="handleCanvasPointerDown"
            @pointermove="handleCanvasPointerMove"
            @pointerleave="handleCanvasPointerLeave"
          />
        </div>
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
import DataGridTableStage from "./DataGridTableStage.vue"
import type { DataGridTableStageProps } from "./dataGridTableStage.types"
import type { DataGridResolvedGanttOptions, DataGridGanttBarLayout, DataGridGanttHitTarget } from "./dataGridGantt"
import {
  DAY_MS,
  applyDataGridGanttDragDelta,
  buildDataGridGanttDependencyPaths,
  buildDataGridGanttRowEditPatch,
  buildDataGridGanttVisibleBars,
  formatDataGridGanttDayLabel,
  hitTestDataGridGanttBar,
  resolveDataGridGanttRangeFrame,
  resolveDataGridGanttTimelineState,
} from "./dataGridGantt"
import { ensureDataGridAppStyles } from "./ensureDataGridAppStyles"

ensureDataGridAppStyles()

interface DataGridTableStageExpose {
  getBodyViewportElement: () => HTMLElement | null
  getStageRootElement: () => HTMLElement | null
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

const HEADER_HEIGHT_PX = 48

const props = defineProps<{
  table: DataGridTableStageProps<Record<string, unknown>>
  runtime: Pick<UseDataGridRuntimeResult<Record<string, unknown>>, "api">
  gantt: DataGridResolvedGanttOptions | null
  baseRowHeight: number
  rowVersion: number
}>()

const tableStageRef = ref<DataGridTableStageExpose | null>(null)
const timelineHeaderViewportRef = ref<HTMLElement | null>(null)
const timelineBodyViewportRef = ref<HTMLElement | null>(null)
const headerCanvasRef = ref<HTMLCanvasElement | null>(null)
const bodyCanvasRef = ref<HTMLCanvasElement | null>(null)
const tableViewportRef = ref<HTMLElement | null>(null)
const tableScrollTop = ref(0)
const tableViewportHeight = ref(0)
const timelineScrollLeft = ref(0)
const timelineViewportWidth = ref(0)
const activeDragState = ref<ActiveDragState | null>(null)
const hoverTarget = ref<DataGridGanttHitTarget<Record<string, unknown>> | null>(null)
const redrawFrame = ref<number | null>(null)

let teardownTableViewport: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let syncingTimelineScroll = false

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

function syncTimelineViewportMetrics(): void {
  timelineViewportWidth.value = timelineBodyViewportRef.value?.clientWidth
    ?? timelineHeaderViewportRef.value?.clientWidth
    ?? 0
}

function scheduleRedraw(): void {
  if (redrawFrame.value != null || typeof window === "undefined") {
    return
  }
  redrawFrame.value = window.requestAnimationFrame(() => {
    redrawFrame.value = null
    drawTimelineHeader()
    drawTimelineBody()
  })
}

function clearScheduledRedraw(): void {
  if (redrawFrame.value == null || typeof window === "undefined") {
    return
  }
  window.cancelAnimationFrame(redrawFrame.value)
  redrawFrame.value = null
}

function resolveRowHeight(rowIndex: number): number {
  return props.runtime.api.view.getRowHeightOverride(rowIndex) ?? props.baseRowHeight
}

const timelineState = computed(() => {
  if (!props.gantt) {
    return null
  }
  void props.rowVersion
  return resolveDataGridGanttTimelineState({
    getCount: () => props.runtime.api.rows.getCount(),
    get: index => props.runtime.api.rows.get(index),
  }, props.gantt)
})

const visibleBars = computed<readonly DataGridGanttBarLayout<Record<string, unknown>>[]>(() => {
  if (!props.gantt || !timelineState.value) {
    return []
  }
  return buildDataGridGanttVisibleBars({
    rows: props.table.displayRows as readonly DataGridRowNode<Record<string, unknown>>[],
    viewportRowStart: props.table.viewportRowStart,
    scrollTop: tableScrollTop.value,
    topSpacerHeight: props.table.topSpacerHeight,
    viewportHeight: Math.max(
      tableViewportHeight.value,
      props.table.displayRows.length * props.baseRowHeight,
    ),
    baseRowHeight: props.baseRowHeight,
    resolveRowHeight,
    timeline: timelineState.value,
    options: props.gantt,
  })
})

const tablePaneStyle = computed<CSSProperties>(() => ({
  width: `${props.gantt?.paneWidth ?? 520}px`,
  minWidth: `${props.gantt?.paneWidth ?? 520}px`,
  maxWidth: `${props.gantt?.paneWidth ?? 520}px`,
}))

const headerTrackStyle = computed<CSSProperties>(() => ({
  width: `${timelineState.value?.totalWidth ?? 1}px`,
  minWidth: `${timelineState.value?.totalWidth ?? 1}px`,
  height: `${HEADER_HEIGHT_PX}px`,
}))

const bodyTrackStyle = computed<CSSProperties>(() => ({
  width: `${timelineState.value?.totalWidth ?? 1}px`,
  minWidth: `${timelineState.value?.totalWidth ?? 1}px`,
  height: `${Math.max(tableViewportHeight.value, 1)}px`,
}))

const canvasCursor = computed(() => {
  if (activeDragState.value) {
    return activeDragState.value.mode === "move" ? "grabbing" : "col-resize"
  }
  if (!hoverTarget.value) {
    return "default"
  }
  return hoverTarget.value.mode === "move" ? "grab" : "col-resize"
})

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

function drawTimelineGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelsPerDay: number,
  scrollLeft: number,
  majorStepDays: number,
  strokeStyle: string,
  backgroundStyle: string,
): void {
  context.fillStyle = backgroundStyle
  context.fillRect(0, 0, width, height)
  context.strokeStyle = strokeStyle
  context.lineWidth = 1

  const startDay = Math.floor(scrollLeft / pixelsPerDay)
  const endDay = Math.ceil((scrollLeft + width) / pixelsPerDay)

  for (let dayIndex = startDay; dayIndex <= endDay; dayIndex += 1) {
    const x = Math.round((dayIndex * pixelsPerDay) - scrollLeft) + 0.5
    if (majorStepDays > 1 && dayIndex % majorStepDays !== 0) {
      continue
    }
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
}

function drawTimelineHeader(): void {
  const timeline = timelineState.value
  const viewport = timelineHeaderViewportRef.value
  if (!timeline || !viewport) {
    return
  }

  const context = resizeCanvas(headerCanvasRef.value, viewport.clientWidth || timelineViewportWidth.value || 1, HEADER_HEIGHT_PX)
  if (!context) {
    return
  }

  const width = viewport.clientWidth || timelineViewportWidth.value || 1
  const minorStroke = readCssVar("--datagrid-column-divider-color", "rgba(148, 163, 184, 0.24)")
  const majorStroke = readCssVar("--datagrid-header-divider-color", "rgba(148, 163, 184, 0.42)")
  const background = readCssVar("--datagrid-header-row-bg", "#f8fafc")
  const textColor = readCssVar("--datagrid-text-primary", "#0f172a")
  const fontFamily = readCssVar("--datagrid-font-family", "ui-sans-serif, system-ui, sans-serif")

  drawTimelineGrid(
    context,
    width,
    HEADER_HEIGHT_PX,
    timeline.pixelsPerDay,
    timelineScrollLeft.value,
    props.gantt?.zoomLevel === "month" ? 30 : (props.gantt?.zoomLevel === "week" ? 7 : 1),
    minorStroke,
    background,
  )

  context.strokeStyle = majorStroke
  context.beginPath()
  context.moveTo(0, HEADER_HEIGHT_PX - 0.5)
  context.lineTo(width, HEADER_HEIGHT_PX - 0.5)
  context.stroke()

  context.fillStyle = textColor
  context.font = `12px ${fontFamily}`
  context.textBaseline = "middle"

  const visibleStartDay = Math.floor(timelineScrollLeft.value / timeline.pixelsPerDay)
  const visibleEndDay = Math.ceil((timelineScrollLeft.value + width) / timeline.pixelsPerDay)
  const majorStepDays = props.gantt?.zoomLevel === "month" ? 30 : (props.gantt?.zoomLevel === "week" ? 7 : 1)

  for (let dayIndex = visibleStartDay; dayIndex <= visibleEndDay; dayIndex += majorStepDays) {
    const x = (dayIndex * timeline.pixelsPerDay) - timelineScrollLeft.value
    const label = formatDataGridGanttDayLabel(timeline.startMs + dayIndex * DAY_MS, timeline.zoomLevel)
    context.fillText(label, x + 8, HEADER_HEIGHT_PX / 2)
  }
}

function drawTimelineBody(): void {
  const timeline = timelineState.value
  const viewport = timelineBodyViewportRef.value
  if (!timeline || !viewport) {
    return
  }

  const height = Math.max(1, tableViewportHeight.value || viewport.clientHeight || visibleBars.value.length * props.baseRowHeight)
  const width = Math.max(1, viewport.clientWidth || timelineViewportWidth.value || 1)
  const context = resizeCanvas(bodyCanvasRef.value, width, height)
  if (!context) {
    return
  }

  const background = readCssVar("--datagrid-viewport-bg", "#ffffff")
  const gridStroke = readCssVar("--datagrid-column-divider-color", "rgba(148, 163, 184, 0.16)")
  const rowStroke = readCssVar("--datagrid-row-divider-color", "rgba(148, 163, 184, 0.18)")
  const barFill = readCssVar("--datagrid-accent-strong", "#2563eb")
  const barFillMuted = readCssVar("--datagrid-selection-range-bg", "rgba(37, 99, 235, 0.16)")
  const barProgress = "rgba(255, 255, 255, 0.28)"
  const criticalStroke = "#dc2626"
  const dependencyStroke = "rgba(15, 23, 42, 0.32)"
  const labelColor = "#ffffff"
  const fontFamily = readCssVar("--datagrid-font-family", "ui-sans-serif, system-ui, sans-serif")

  context.fillStyle = background
  context.fillRect(0, 0, width, height)

  const startDay = Math.floor(timelineScrollLeft.value / timeline.pixelsPerDay)
  const endDay = Math.ceil((timelineScrollLeft.value + width) / timeline.pixelsPerDay)

  context.strokeStyle = gridStroke
  context.lineWidth = 1
  for (let dayIndex = startDay; dayIndex <= endDay; dayIndex += 1) {
    const x = Math.round((dayIndex * timeline.pixelsPerDay) - timelineScrollLeft.value) + 0.5
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }

  context.strokeStyle = rowStroke
  for (const bar of visibleBars.value) {
    const y = Math.round(bar.y + bar.height + 6) + 0.5
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }

  context.strokeStyle = dependencyStroke
  context.lineWidth = 1.5
  const dependencyPaths = buildDataGridGanttDependencyPaths({
    bars: visibleBars.value,
    resolveFrame: bar => {
      const preview = resolvePreviewRangeForBar(bar)
      const frame = resolveDataGridGanttRangeFrame(
        preview,
        timeline,
        props.gantt?.minBarWidth ?? 6,
      )
      return {
        x: frame.x - timelineScrollLeft.value,
        width: frame.width,
        y: bar.y,
        height: bar.height,
      }
    },
  })
  for (const path of dependencyPaths) {
    const [startPoint, secondPoint, thirdPoint, endPoint] = path.points
    if (!startPoint || !secondPoint || !thirdPoint || !endPoint) {
      continue
    }
    context.beginPath()
    context.moveTo(startPoint.x, startPoint.y)
    context.lineTo(secondPoint.x, secondPoint.y)
    context.lineTo(thirdPoint.x, thirdPoint.y)
    context.lineTo(endPoint.x, endPoint.y)
    context.stroke()
  }

  context.font = `12px ${fontFamily}`
  context.textBaseline = "middle"

  for (const bar of visibleBars.value) {
    const preview = resolvePreviewRangeForBar(bar)
    const frame = resolveDataGridGanttRangeFrame(
      preview,
      timeline,
      props.gantt?.minBarWidth ?? 6,
    )
    const x = frame.x - timelineScrollLeft.value
    const widthPx = frame.width
    drawRoundedRect(context, x, bar.y, widthPx, bar.height, 6)
    context.fillStyle = activeDragState.value?.rowId === bar.rowId ? barFillMuted : barFill
    context.fill()

    if (bar.progress > 0) {
      drawRoundedRect(context, x, bar.y, Math.max(0, widthPx * bar.progress), bar.height, 6)
      context.fillStyle = barProgress
      context.fill()
    }

    if (bar.critical) {
      drawRoundedRect(context, x, bar.y, widthPx, bar.height, 6)
      context.strokeStyle = criticalStroke
      context.lineWidth = 2
      context.stroke()
    }

    context.fillStyle = labelColor
    context.fillText(bar.label, x + 8, bar.y + (bar.height / 2))
  }
}

function syncTimelineScroll(nextScrollLeft: number, source: "body" | "header"): void {
  timelineScrollLeft.value = Math.max(0, nextScrollLeft)
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

function handleTimelineBodyScroll(event: Event): void {
  const element = event.target as HTMLElement | null
  if (!element) {
    return
  }
  syncTimelineViewportMetrics()
  syncTimelineScroll(element.scrollLeft, "body")
}

function handleTimelineHeaderScroll(event: Event): void {
  const element = event.target as HTMLElement | null
  if (!element) {
    return
  }
  syncTimelineScroll(element.scrollLeft, "header")
}

function handleTimelineWheel(event: WheelEvent): void {
  const tableViewport = tableViewportRef.value
  const timelineBodyViewport = timelineBodyViewportRef.value
  if (!tableViewport || !timelineBodyViewport) {
    return
  }
  const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : (event.shiftKey ? event.deltaY : 0)
  const verticalDelta = horizontalDelta === 0 ? event.deltaY : 0
  if (horizontalDelta === 0 && verticalDelta === 0) {
    return
  }

  event.preventDefault()
  if (horizontalDelta !== 0) {
    timelineBodyViewport.scrollLeft += horizontalDelta
    syncTimelineScroll(timelineBodyViewport.scrollLeft, "body")
  }
  if (verticalDelta !== 0) {
    tableViewport.scrollTop += verticalDelta
    tableViewport.dispatchEvent(new Event("scroll"))
  }
}

function resolveCanvasPoint(event: PointerEvent): { x: number; y: number } | null {
  const canvas = bodyCanvasRef.value
  if (!canvas) {
    return null
  }
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left + timelineScrollLeft.value,
    y: event.clientY - rect.top,
  }
}

function updateHoverTarget(event: PointerEvent): void {
  if (!props.gantt) {
    hoverTarget.value = null
    return
  }
  const point = resolveCanvasPoint(event)
  if (!point) {
    hoverTarget.value = null
    return
  }
  hoverTarget.value = hitTestDataGridGanttBar(
    visibleBars.value,
    point,
    props.gantt.resizeHandleWidth,
  )
}

function commitDrag(): void {
  if (!props.gantt || !activeDragState.value) {
    activeDragState.value = null
    return
  }
  const drag = activeDragState.value
  activeDragState.value = null
  if (drag.initialStartMs === drag.draftStartMs && drag.initialEndMs === drag.draftEndMs) {
    scheduleRedraw()
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
  scheduleRedraw()
}

function handleWindowPointerMove(event: PointerEvent): void {
  if (!activeDragState.value || !timelineState.value) {
    return
  }
  const point = resolveCanvasPoint(event)
  if (!point) {
    return
  }
  const dayDelta = Math.round((point.x - activeDragState.value.originX) / timelineState.value.pixelsPerDay)
  const nextRange = applyDataGridGanttDragDelta({
    startMs: activeDragState.value.initialStartMs,
    endMs: activeDragState.value.initialEndMs,
  }, activeDragState.value.mode, dayDelta)
  activeDragState.value = {
    ...activeDragState.value,
    draftStartMs: nextRange.startMs,
    draftEndMs: nextRange.endMs,
  }
  scheduleRedraw()
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
  const point = resolveCanvasPoint(event)
  if (!point) {
    return
  }
  const hit = hitTestDataGridGanttBar(
    visibleBars.value,
    point,
    props.gantt.resizeHandleWidth,
  )
  if (!hit) {
    return
  }
  event.preventDefault()
  bodyCanvasRef.value?.setPointerCapture?.(event.pointerId)
  activeDragState.value = {
    pointerId: event.pointerId,
    rowId: hit.bar.rowId,
    rowUpdateId: hit.bar.rowUpdateId,
    mode: hit.mode,
    originX: point.x,
    initialStartMs: hit.bar.startMs,
    initialEndMs: hit.bar.endMs,
    draftStartMs: hit.bar.startMs,
    draftEndMs: hit.bar.endMs,
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", handleWindowPointerMove)
    window.addEventListener("pointerup", handleWindowPointerUp)
  }
  scheduleRedraw()
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
  }
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
    syncTableViewportMetrics()
    syncTimelineViewportMetrics()
    scheduleRedraw()
  })
  if (tableViewportRef.value) {
    resizeObserver.observe(tableViewportRef.value)
  }
  if (timelineBodyViewportRef.value) {
    resizeObserver.observe(timelineBodyViewportRef.value)
  }
}

function attachTableViewport(): void {
  const viewport = tableStageRef.value?.getBodyViewportElement() ?? null
  if (viewport === tableViewportRef.value) {
    syncTableViewportMetrics()
    attachResizeObserver()
    scheduleRedraw()
    return
  }

  disconnectTableViewport()
  tableViewportRef.value = viewport
  if (!viewport) {
    scheduleRedraw()
    return
  }

  const onScroll = () => {
    syncTableViewportMetrics()
    scheduleRedraw()
  }

  viewport.addEventListener("scroll", onScroll, { passive: true })
  syncTableViewportMetrics()
  teardownTableViewport = () => {
    viewport.removeEventListener("scroll", onScroll)
  }
  attachResizeObserver()
  scheduleRedraw()
}

function handleWindowResize(): void {
  syncTableViewportMetrics()
  syncTimelineViewportMetrics()
  scheduleRedraw()
}

watch(
  () => [
    props.table.displayRows,
    props.table.topSpacerHeight,
    props.table.viewportRowStart,
    props.gantt,
    props.rowVersion,
  ],
  () => {
    void nextTick(() => {
      attachTableViewport()
      syncTimelineViewportMetrics()
      scheduleRedraw()
    })
  },
  { deep: true },
)

watch(
  () => [visibleBars.value, timelineState.value, tableScrollTop.value, tableViewportHeight.value, timelineScrollLeft.value],
  () => {
    scheduleRedraw()
  },
  { deep: true },
)

onMounted(() => {
  void nextTick(() => {
    attachTableViewport()
    syncTimelineViewportMetrics()
    scheduleRedraw()
  })
  if (typeof window !== "undefined") {
    window.addEventListener("resize", handleWindowResize)
  }
})

onBeforeUnmount(() => {
  clearScheduledRedraw()
  disconnectTableViewport()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleWindowResize)
    window.removeEventListener("pointermove", handleWindowPointerMove)
    window.removeEventListener("pointerup", handleWindowPointerUp)
  }
})
</script>
