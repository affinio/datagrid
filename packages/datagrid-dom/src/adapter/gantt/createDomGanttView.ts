import type { DataGridApi, DataGridClientRowPatch, DataGridRowNode } from "@affino/datagrid-core"
import {
  applyDataGridGanttDragDelta,
  buildDataGridGanttRowEditPatch,
  buildDataGridGanttDependencyPaths,
  buildDataGridGanttVisibleBars,
  buildDataGridTimelineRenderModels,
  DAY_MS,
  hitTestDataGridGanttBar,
  normalizeDataGridGanttOptions,
  resolveDataGridGanttCriticalTaskIds,
  resolveDataGridGanttDateMs,
  resolveDataGridGanttRangeFrame,
  resolveDataGridGanttTimelineState,
  type DataGridGanttOptions,
  type DataGridResolvedGanttOptions,
  type DataGridGanttTimelineState,
  type DataGridTimelineModel,
} from "@affino/datagrid-gantt"
import { createHistoryPatch, createHistorySnapshot, type DomHistoryIntent } from "../controllers/historyController.js"

const EMPTY_ROWS: readonly DataGridRowNode<unknown>[] = []

export interface DomGanttView {
  readonly root: HTMLDivElement
  sync(): void
  detach(): void
}

interface ActiveBarDrag {
  pointerId: number
  rowId: string
  rowUpdateId: string | number
  rowIndex: number
  mode: "move" | "resize-start" | "resize-end"
  originX: number
  initialStartMs: number
  initialEndMs: number
  initialStartValue: unknown
  initialEndValue: unknown
  draftStartMs: number
  draftEndMs: number
}

/** Adds an interactive timeline beside the existing Core-backed table view. */
export function createDomGanttView<TRow>(input: {
  host: HTMLElement
  grid: HTMLDivElement
  api: DataGridApi<TRow>
  options: DataGridGanttOptions
  rowHeight: number
  setRowSelection: (rowIndex: number, rowId: unknown, columnCount: number) => void
  getColumnCount: () => number
  recordIntent: (intent: DomHistoryIntent<TRow>) => Promise<string | null>
  onHistoryKeyDown: (event: KeyboardEvent) => void
}): DomGanttView {
  const document = input.host.ownerDocument
  const options = normalizeDataGridGanttOptions(input.options) as DataGridResolvedGanttOptions
  const root = document.createElement("div")
  root.className = "affino-grid-dom-gantt"
  root.style.setProperty("--affino-grid-dom-gantt-pane-width", `${options.paneWidth}px`)
  const timeline = document.createElement("section")
  timeline.className = "affino-grid-dom-gantt__timeline"
  timeline.setAttribute("aria-label", "Gantt timeline")
  const header = document.createElement("div")
  header.className = "affino-grid-dom-gantt__header"
  const headerTrack = document.createElement("div")
  headerTrack.className = "affino-grid-dom-gantt__track"
  const headerCanvas = document.createElement("canvas")
  headerCanvas.className = "affino-grid-dom-gantt__canvas affino-grid-dom-gantt__canvas--header"
  headerCanvas.setAttribute("aria-hidden", "true")
  header.append(headerTrack, headerCanvas)
  const body = document.createElement("div")
  body.className = "affino-grid-dom-gantt__body"
  body.tabIndex = 0
  body.setAttribute("role", "region")
  body.setAttribute("aria-label", "Gantt timeline rows")
  const bodyTrack = document.createElement("div")
  bodyTrack.className = "affino-grid-dom-gantt__track"
  const bodyCanvas = document.createElement("canvas")
  bodyCanvas.className = "affino-grid-dom-gantt__canvas affino-grid-dom-gantt__canvas--body"
  bodyCanvas.setAttribute("aria-hidden", "true")
  body.append(bodyTrack, bodyCanvas)
  timeline.append(header, body)
  root.append(input.grid, timeline)
  input.host.replaceChildren(root)
  input.grid.classList.add("affino-grid-dom--gantt-table")

  let detached = false
  let frame: number | null = null
  let syncingScroll = false
  let tableBodyElement: HTMLElement | null = null
  let tableHeaderElement: HTMLElement | null = null
  let observer: ResizeObserver | null = null
  let modelRevision: number | null = null
  let activeDrag: ActiveBarDrag | null = null
  let visibleBars: ReturnType<typeof buildDataGridGanttVisibleBars<TRow>> = []
  let timelineState = resolveDataGridGanttTimelineState({
    getCount: () => input.api.rows.getCount(),
    get: index => input.api.rows.get(index),
  }, options)
  let criticalTaskIds = options.computedCriticalPath
    ? resolveDataGridGanttCriticalTaskIds({
      getCount: () => input.api.rows.getCount(),
      get: index => input.api.rows.get(index),
    }, options)
    : null

  const readContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
    try { return canvas.getContext("2d") } catch { return null }
  }
  const resizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null => {
    const context = readContext(canvas)
    if (!context) return null
    const ratio = Math.max(1, input.host.ownerDocument.defaultView?.devicePixelRatio ?? 1)
    const cssWidth = Math.max(1, Math.round(width))
    const cssHeight = Math.max(1, Math.round(height))
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`
    if (canvas.width !== Math.round(cssWidth * ratio) || canvas.height !== Math.round(cssHeight * ratio)) {
      canvas.width = Math.round(cssWidth * ratio)
      canvas.height = Math.round(cssHeight * ratio)
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, cssWidth, cssHeight)
    return context
  }
  const getColor = (name: string, fallback: string): string => {
    const view = document.defaultView
    if (!view) return fallback
    const value = view.getComputedStyle(input.grid).getPropertyValue(name).trim()
    return value || fallback
  }
  const refreshModel = (): void => {
    const snapshot = input.api.rows.getSnapshot()
    const revision = snapshot.revision ?? snapshot.projection?.recomputeVersion ?? snapshot.projection?.version ?? null
    if (revision === modelRevision) return
    modelRevision = revision
    timelineState = resolveDataGridGanttTimelineState({
      getCount: () => input.api.rows.getCount(),
      get: index => input.api.rows.get(index),
    }, options)
    criticalTaskIds = options.computedCriticalPath
      ? resolveDataGridGanttCriticalTaskIds({
        getCount: () => input.api.rows.getCount(),
        get: index => input.api.rows.get(index),
      }, options)
      : null
  }

  const drawHeader = (): void => {
    const tableHeader = input.grid.querySelector<HTMLElement>(".affino-grid-dom__header-shell")
    if (tableHeader) header.style.height = `${tableHeader.getBoundingClientRect().height}px`
    const width = header.clientWidth
    const height = header.clientHeight
    headerTrack.style.width = `${timelineState.totalWidth}px`
    headerCanvas.style.left = `${header.scrollLeft}px`
    const context = resizeCanvas(headerCanvas, width, height)
    if (!context) return
    const model = buildDataGridTimelineRenderModels({
      timeline: timelineState,
      scrollLeft: header.scrollLeft,
      viewportWidth: width,
      workingCalendar: options.workingCalendar,
    }).header
    drawTimelineHeader(context, model, height, getColor("--datagrid-cell-border-color", "#d8dee8"), getColor("--datagrid-text-color", "#354255"))
  }

  const drawBody = (): void => {
    attachTableBody()
    refreshModel()
    const width = body.clientWidth
    const height = body.clientHeight
    bodyTrack.style.width = `${timelineState.totalWidth}px`
    const tableBody = tableBodyElement
    const totalHeight = tableBody?.scrollHeight ?? input.api.rows.getCount() * input.rowHeight
    bodyTrack.style.height = `${Math.max(height, totalHeight)}px`
    bodyCanvas.style.left = `${body.scrollLeft}px`
    bodyCanvas.style.top = `${body.scrollTop}px`
    const context = resizeCanvas(bodyCanvas, width, height)
    if (!context || !tableBody) return

    const mounted = Array.from(input.grid.querySelectorAll<HTMLElement>(".affino-grid-dom__body > .affino-grid-dom__row[data-row-index]"))
      .map(element => ({ element, index: Number(element.dataset.rowIndex) }))
      .filter(entry => Number.isInteger(entry.index))
      .sort((a, b) => a.index - b.index)
    if (mounted.length === 0) return
    const firstIndex = mounted[0]!.index
    const lastIndex = mounted[mounted.length - 1]!.index
    const rows = input.api.rows.getRange({ start: firstIndex, end: lastIndex })
    const bodyRect = tableBody.getBoundingClientRect()
    const metrics = mounted.map(({ element }) => ({
      top: element.getBoundingClientRect().top - bodyRect.top + tableBody.scrollTop,
      height: element.getBoundingClientRect().height,
    }))
    const rowBoundaries = metrics.map(metric => metric.top - tableBody.scrollTop + metric.height)
    const rowFrames = metrics.map((metric, offset) => ({
      rowIndex: firstIndex + offset,
      top: metric.top - tableBody.scrollTop,
      height: metric.height,
    }))
    const computedBars = buildDataGridGanttVisibleBars({
      rows: rows.length ? rows : EMPTY_ROWS as readonly DataGridRowNode<TRow>[],
      rowMetrics: metrics,
      viewportRowStart: firstIndex,
      scrollTop: tableBody.scrollTop,
      topSpacerHeight: 0,
      viewportHeight: height,
      baseRowHeight: input.rowHeight,
      resolveRowHeight: () => input.rowHeight,
      timeline: timelineState,
      options,
      criticalTaskIds,
    })
    visibleBars = activeDrag
      ? computedBars.map(bar => {
        if (bar.rowId !== activeDrag?.rowId) return bar
        const frame = resolveDataGridGanttRangeFrame({
          startMs: activeDrag.draftStartMs,
          endMs: activeDrag.draftEndMs,
        }, timelineState, options.minBarWidth, bar.milestone ? bar.height : undefined)
        return { ...bar, ...frame, startMs: activeDrag.draftStartMs, endMs: activeDrag.draftEndMs }
      })
      : computedBars
    const renderModels = buildDataGridTimelineRenderModels({
      timeline: timelineState,
      scrollLeft: body.scrollLeft,
      viewportWidth: width,
      workingCalendar: options.workingCalendar,
    })
    drawTimelineBody(context, renderModels.body, timelineState, visibleBars, buildDataGridGanttDependencyPaths({ bars: visibleBars }), {
      scrollLeft: body.scrollLeft,
      width,
      height,
      rowBoundaries,
      rowFrames,
      activeRowIndex: input.api.selection.getSnapshot()?.activeCell?.rowIndex ?? null,
      colors: {
        line: getColor("--datagrid-cell-border-color", "#d8dee8"),
        nonWorking: getColor("--datagrid-header-background-color", "#f4f6f8"),
        bar: getColor("--datagrid-gantt-bar-color", "#4b82c3"),
        progress: getColor("--datagrid-gantt-progress-color", "#285b91"),
        critical: getColor("--datagrid-gantt-critical-color", "#c84f4f"),
        summary: getColor("--datagrid-gantt-summary-color", "#697b91"),
        baseline: getColor("--datagrid-gantt-baseline-color", "#94a9be"),
        dependency: getColor("--datagrid-gantt-dependency-color", "#78899d"),
        text: getColor("--datagrid-text-color", "#354255"),
        selection: getColor("--datagrid-selection-active-border", "#245ea8"),
        rowSelection: getColor("--datagrid-row-selected-background-color", "#eaf2fc"),
      },
    })
  }

  const draw = (): void => {
    frame = null
    if (detached) return
    attachTableBody()
    drawHeader()
    drawBody()
  }
  const scheduleDraw = (): void => {
    if (frame != null || detached) return
    const view = document.defaultView
    frame = view?.requestAnimationFrame(draw) ?? null
    if (frame == null) draw()
  }
  const syncVertical = (source: HTMLElement, target: HTMLElement): void => {
    if (syncingScroll) return
    syncingScroll = true
    target.scrollTop = source.scrollTop
    syncingScroll = false
    scheduleDraw()
  }
  const syncHorizontal = (source: HTMLElement, target: HTMLElement): void => {
    if (syncingScroll) return
    syncingScroll = true
    target.scrollLeft = source.scrollLeft
    syncingScroll = false
    scheduleDraw()
  }
  const onGridScroll = (): void => {
    if (tableBodyElement) syncVertical(tableBodyElement, body)
  }
  const onBodyScroll = (): void => {
    if (tableBodyElement) syncVertical(body, tableBodyElement)
    syncHorizontal(body, header)
  }
  const onHeaderScroll = (): void => syncHorizontal(header, body)
  const resolveTimelinePoint = (event: PointerEvent): { x: number; y: number } => {
    const rect = bodyCanvas.getBoundingClientRect()
    return { x: event.clientX - rect.left + body.scrollLeft, y: event.clientY - rect.top }
  }
  const updateCanvasCursor = (event: PointerEvent): void => {
    if (activeDrag) {
      bodyCanvas.style.cursor = activeDrag.mode === "move" ? "grabbing" : "ew-resize"
      return
    }
    const hit = hitTestDataGridGanttBar(visibleBars, resolveTimelinePoint(event), options.resizeHandleWidth)
    bodyCanvas.style.cursor = hit ? hit.mode === "move" ? "grab" : "ew-resize" : "default"
  }
  const cancelDrag = (): void => {
    const drag = activeDrag
    if (!drag) return
    activeDrag = null
    try {
      if (bodyCanvas.hasPointerCapture(drag.pointerId)) bodyCanvas.releasePointerCapture(drag.pointerId)
    } catch { /* Pointer capture may already have been released by the browser. */ }
    bodyCanvas.style.cursor = "default"
    scheduleDraw()
  }
  const commitDrag = async (drag: ActiveBarDrag): Promise<void> => {
    if (drag.initialStartMs === drag.draftStartMs && drag.initialEndMs === drag.draftEndMs) {
      scheduleDraw()
      return
    }
    const beforeSelection = input.api.selection.getSnapshot()
    const beforeData = {
      [options.startKey]: drag.initialStartValue,
      [options.endKey]: drag.initialEndValue,
    } as Partial<TRow>
    const afterData = {
      [options.startKey]: new Date(drag.draftStartMs),
      [options.endKey]: new Date(drag.draftEndMs),
    } as Partial<TRow>
    try {
      const patch = buildDataGridGanttRowEditPatch(drag.rowUpdateId, {
        startMs: drag.draftStartMs,
        endMs: drag.draftEndMs,
      }, options) as unknown as DataGridClientRowPatch<TRow>
      await input.api.rows.applyEdits([patch], { reapply: true, source: "grid" })
      await input.recordIntent({
        intent: "edit",
        label: drag.mode === "move" ? "Move Gantt task" : "Resize Gantt task",
        affectedRange: {
          startRow: drag.rowIndex,
          endRow: drag.rowIndex,
          startColumn: 0,
          endColumn: Math.max(0, input.getColumnCount() - 1),
        },
        before: createHistorySnapshot([createHistoryPatch(drag.rowUpdateId, beforeData)], beforeSelection),
        after: createHistorySnapshot([createHistoryPatch(drag.rowUpdateId, afterData)], input.api.selection.getSnapshot()),
      })
    } catch {
      // Core owns failed writes; discard the visual draft and redraw from its current rows.
    }
    scheduleDraw()
  }
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || event.pointerType === "touch" || !input.api.rows.hasPatchSupport()) return
    const point = resolveTimelinePoint(event)
    const hit = hitTestDataGridGanttBar(visibleBars, point, options.resizeHandleWidth)
    if (!hit || hit.bar.row.kind !== "leaf") return
    const rowData = hit.bar.row.row as Record<string, unknown>
    const initialStartMs = resolveDataGridGanttDateMs(rowData[options.startKey])
    const initialEndMs = resolveDataGridGanttDateMs(rowData[options.endKey])
    if (initialStartMs == null || initialEndMs == null) return
    event.preventDefault()
    body.focus({ preventScroll: true })
    input.setRowSelection(hit.bar.rowIndex, hit.bar.row.rowId, input.getColumnCount())
    activeDrag = {
      pointerId: event.pointerId,
      rowId: hit.bar.rowId,
      rowUpdateId: hit.bar.rowUpdateId,
      rowIndex: hit.bar.rowIndex,
      mode: hit.mode,
      originX: point.x,
      initialStartMs,
      initialEndMs,
      initialStartValue: rowData[options.startKey],
      initialEndValue: rowData[options.endKey],
      draftStartMs: initialStartMs,
      draftEndMs: initialEndMs,
    }
    try { bodyCanvas.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional in test DOMs. */ }
    updateCanvasCursor(event)
    scheduleDraw()
  }
  const onPointerMove = (event: PointerEvent): void => {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      updateCanvasCursor(event)
      return
    }
    const point = resolveTimelinePoint(event)
    const dayDelta = (point.x - activeDrag.originX) / timelineState.pixelsPerDay
    const next = applyDataGridGanttDragDelta({
      startMs: activeDrag.initialStartMs,
      endMs: activeDrag.initialEndMs,
    }, activeDrag.mode, dayDelta, timelineState.zoomLevel, options.workingCalendar)
    activeDrag = { ...activeDrag, draftStartMs: next.startMs, draftEndMs: next.endMs }
    scheduleDraw()
  }
  const onPointerUp = (event: PointerEvent): void => {
    const drag = activeDrag
    if (!drag || event.pointerId !== drag.pointerId) return
    activeDrag = null
    try {
      if (bodyCanvas.hasPointerCapture(event.pointerId)) bodyCanvas.releasePointerCapture(event.pointerId)
    } catch { /* Pointer capture may already have been released by the browser. */ }
    bodyCanvas.style.cursor = "default"
    void commitDrag(drag)
  }
  const onPointerCancel = (): void => cancelDrag()
  const onLostPointerCapture = (): void => { if (activeDrag) cancelDrag() }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && activeDrag) {
      event.preventDefault()
      event.stopPropagation()
      cancelDrag()
      return
    }
    input.onHistoryKeyDown(event)
  }
  const attachTableBody = (): void => {
    const next = input.grid.querySelector<HTMLElement>(".affino-grid-dom__body")
    const nextHeader = input.grid.querySelector<HTMLElement>(".affino-grid-dom__header-shell")
    if (next !== tableBodyElement) {
      tableBodyElement?.removeEventListener("scroll", onGridScroll)
      tableBodyElement = next
      tableBodyElement?.addEventListener("scroll", onGridScroll, { passive: true })
      if (tableBodyElement) body.scrollTop = tableBodyElement.scrollTop
    }
    if (nextHeader !== tableHeaderElement) {
      if (tableHeaderElement) observer?.unobserve(tableHeaderElement)
      tableHeaderElement = nextHeader
      if (tableHeaderElement) observer?.observe(tableHeaderElement)
    }
  }
  body.addEventListener("scroll", onBodyScroll, { passive: true })
  header.addEventListener("scroll", onHeaderScroll, { passive: true })
  bodyCanvas.addEventListener("pointerdown", onPointerDown)
  bodyCanvas.addEventListener("pointermove", onPointerMove)
  bodyCanvas.addEventListener("pointerup", onPointerUp)
  bodyCanvas.addEventListener("pointercancel", onPointerCancel)
  bodyCanvas.addEventListener("lostpointercapture", onLostPointerCapture)
  body.addEventListener("keydown", onKeyDown)
  observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleDraw)
  observer?.observe(root)
  observer?.observe(header)
  observer?.observe(body)
  const view = document.defaultView
  view?.addEventListener("resize", scheduleDraw)

  return {
    root,
    sync: scheduleDraw,
    detach() {
      if (detached) return
      detached = true
      if (frame != null) view?.cancelAnimationFrame(frame)
      cancelDrag()
      observer?.disconnect()
      view?.removeEventListener("resize", scheduleDraw)
      tableBodyElement?.removeEventListener("scroll", onGridScroll)
      tableHeaderElement = null
      body.removeEventListener("scroll", onBodyScroll)
      header.removeEventListener("scroll", onHeaderScroll)
      bodyCanvas.removeEventListener("pointerdown", onPointerDown)
      bodyCanvas.removeEventListener("pointermove", onPointerMove)
      bodyCanvas.removeEventListener("pointerup", onPointerUp)
      bodyCanvas.removeEventListener("pointercancel", onPointerCancel)
      bodyCanvas.removeEventListener("lostpointercapture", onLostPointerCapture)
      body.removeEventListener("keydown", onKeyDown)
      root.remove()
    },
  }
}

function drawTimelineHeader(
  context: CanvasRenderingContext2D,
  model: DataGridTimelineModel,
  height: number,
  lineColor: string,
  textColor: string,
): void {
  const primaryHeight = Math.min(24, Math.floor(height / 2))
  context.font = "600 11px system-ui, sans-serif"
  context.textBaseline = "middle"
  context.fillStyle = textColor
  for (const segment of model.primarySegments) {
    const x = segment.x
    if (x + segment.width < 0 || x > model.viewport.viewportWidth) continue
    context.fillText(segment.label, x + 7, primaryHeight / 2, Math.max(0, segment.width - 12))
  }
  context.font = "11px system-ui, sans-serif"
  for (const segment of model.secondarySegments) {
    const x = segment.x
    if (x + segment.width < 0 || x > model.viewport.viewportWidth) continue
    context.fillText(segment.label, x + 5, primaryHeight + ((height - primaryHeight) / 2), Math.max(0, segment.width - 10))
  }
  context.strokeStyle = lineColor
  context.lineWidth = 1
  context.beginPath()
  for (const line of [...model.primaryLines, ...model.secondaryLines]) {
    const x = Math.round(line.x) + 0.5
    context.moveTo(x, line.key.startsWith("primary") ? 0 : primaryHeight)
    context.lineTo(x, height)
  }
  context.moveTo(0, primaryHeight + 0.5)
  context.lineTo(model.viewport.viewportWidth, primaryHeight + 0.5)
  context.lineTo(model.viewport.viewportWidth, height)
  context.stroke()
}

function drawTimelineBody<TRow>(
  context: CanvasRenderingContext2D,
  model: DataGridTimelineModel,
  timeline: DataGridGanttTimelineState,
  bars: ReturnType<typeof buildDataGridGanttVisibleBars<TRow>>,
  dependencies: ReturnType<typeof buildDataGridGanttDependencyPaths<TRow>>,
  input: {
    scrollLeft: number
    width: number
    height: number
    rowBoundaries: readonly number[]
    rowFrames: readonly { rowIndex: number; top: number; height: number }[]
    activeRowIndex: number | null
    colors: Record<string, string>
  },
): void {
  context.fillStyle = input.colors.nonWorking!
  for (const span of model.nonWorkingSpans) {
    context.fillRect(span.x, 0, span.width, input.height)
  }
  const activeRow = input.rowFrames.find(frame => frame.rowIndex === input.activeRowIndex)
  if (activeRow) {
    context.save()
    context.fillStyle = input.colors.rowSelection!
    context.fillRect(0, activeRow.top, input.width, activeRow.height)
    context.restore()
  }
  context.strokeStyle = input.colors.line!
  context.lineWidth = 1
  context.beginPath()
  for (const line of model.secondaryLines) {
    const x = Math.round(line.x) + 0.5
    context.moveTo(x, 0)
    context.lineTo(x, input.height)
  }
  for (const boundary of input.rowBoundaries) {
    if (boundary <= 0 || boundary >= input.height) continue
    const y = Math.round(boundary) + 0.5
    context.moveTo(0, y)
    context.lineTo(input.width, y)
  }
  context.stroke()

  for (const bar of bars) {
    const x = bar.x - input.scrollLeft
    const y = bar.y
    if (bar.baselineStartMs != null && bar.baselineEndMs != null) {
      const baselineX = ((bar.baselineStartMs - timeline.startMs) / DAY_MS) * timeline.pixelsPerDay - input.scrollLeft
      const baselineWidth = Math.max(2, ((bar.baselineEndMs - bar.baselineStartMs) / DAY_MS) * timeline.pixelsPerDay)
      context.fillStyle = input.colors.baseline!
      context.fillRect(baselineX, y + bar.height + 2, baselineWidth, 3)
    }
    context.fillStyle = bar.summary ? input.colors.summary! : bar.critical ? input.colors.critical! : input.colors.bar!
    context.beginPath()
    if (bar.milestone) {
      const centerX = x + (bar.width / 2)
      const centerY = y + (bar.height / 2)
      context.moveTo(centerX, y)
      context.lineTo(x + bar.width, centerY)
      context.lineTo(centerX, y + bar.height)
      context.lineTo(x, centerY)
      context.closePath()
      context.fill()
    } else {
      const radius = Math.min(4, bar.height / 2, bar.width / 2)
      context.roundRect(x, y, bar.width, bar.height, radius)
      context.fill()
      if (bar.progress > 0 && !bar.summary) {
        context.fillStyle = input.colors.progress!
        context.save()
        context.beginPath()
        context.roundRect(x, y, Math.max(0, bar.width * bar.progress), bar.height, radius)
        context.clip()
        context.fillRect(x, y, bar.width * bar.progress, bar.height)
        context.restore()
      }
      if (bar.label && bar.width > 54) {
        context.fillStyle = "#fff"
        context.font = "11px system-ui, sans-serif"
        context.textBaseline = "middle"
        context.fillText(bar.label, x + 7, y + (bar.height / 2), Math.max(0, bar.width - 14))
      }
    }
    if (bar.rowIndex === input.activeRowIndex) {
      context.strokeStyle = input.colors.selection!
      context.lineWidth = 2
      if (bar.milestone) {
        const centerX = x + (bar.width / 2)
        const centerY = y + (bar.height / 2)
        context.beginPath()
        context.moveTo(centerX, y)
        context.lineTo(x + bar.width, centerY)
        context.lineTo(centerX, y + bar.height)
        context.lineTo(x, centerY)
        context.closePath()
      } else {
        context.beginPath()
        context.roundRect(x, y, bar.width, bar.height, Math.min(4, bar.height / 2, bar.width / 2))
      }
      context.stroke()
    }
  }

  context.strokeStyle = input.colors.dependency!
  context.lineWidth = 1.25
  context.beginPath()
  for (const dependency of dependencies) {
    dependency.points.forEach((point, index) => {
      const x = point.x - input.scrollLeft
      if (index === 0) context.moveTo(x, point.y)
      else context.lineTo(x, point.y)
    })
  }
  context.stroke()
}
