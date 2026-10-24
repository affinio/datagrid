import {
  buildDataGridChromePaneModel,
  type DataGridChromeRowMetric,
} from "@affino/datagrid-chrome"
import type { DomViewportRenderState } from "../viewport/createDomViewportController.js"
import { DOM_ROW_SELECTION_COLUMN_WIDTH } from "../rowSelectionConstants.js"

type CanvasContext = Pick<
  CanvasRenderingContext2D,
  "setTransform" | "clearRect" | "save" | "restore" | "beginPath" | "moveTo" | "lineTo" | "stroke" | "rect" | "clip"
> & { strokeStyle: string; lineWidth: number }

export function createDomCanvasGridChromeController(options: {
  grid: HTMLDivElement
  rowSelection: boolean
  resolveViewportState: () => DomViewportRenderState
}) {
  const document = options.grid.ownerDocument
  const anchor = document.createElement("div")
  const canvas = document.createElement("canvas")
  anchor.className = "affino-grid-dom__chrome-anchor"
  anchor.setAttribute("role", "presentation")
  anchor.setAttribute("aria-hidden", "true")
  canvas.className = "affino-grid-dom__chrome-canvas"
  canvas.setAttribute("aria-hidden", "true")
  anchor.append(canvas)

  let body: HTMLElement | null = null
  let context: CanvasContext | null = null
  let resizeObserver: ResizeObserver | null = null
  let scheduled = false
  let rafId = 0
  let cachedRowMetrics: DataGridChromeRowMetric[] = []
  let cachedRowCount = -1
  let rowColor = "rgba(0, 0, 0, 0.08)"
  let columnColor = rowColor
  let rowWidth = 1
  let columnWidth = 1

  const schedule = (refreshStyle = false): void => {
    if (refreshStyle) readStyle()
    if (scheduled) return
    scheduled = true
    const view = document.defaultView
    rafId = view?.requestAnimationFrame(() => {
      scheduled = false
      draw()
    }) ?? view?.setTimeout(() => {
      scheduled = false
      draw()
    }, 16) ?? 0
  }

  const onScroll = (): void => schedule()

  function readStyle(): void {
    const view = document.defaultView
    if (!view) return
    const style = view.getComputedStyle(options.grid)
    rowColor = style.getPropertyValue("--datagrid-row-divider-color").trim()
      || style.getPropertyValue("--datagrid-cell-border-color").trim()
      || "rgba(0, 0, 0, 0.08)"
    columnColor = style.getPropertyValue("--datagrid-column-divider-color").trim()
      || style.getPropertyValue("--datagrid-cell-border-color").trim()
      || rowColor
    rowWidth = resolveLineWidth(style.getPropertyValue("--datagrid-row-divider-size"), 1)
    columnWidth = resolveLineWidth(style.getPropertyValue("--datagrid-column-divider-size"), 1)
  }

  function draw(): void {
    if (!body || !context) return
    const width = body.clientWidth
    const height = body.clientHeight
    if (width <= 0 || height <= 0) {
      options.grid.classList.remove("affino-grid-dom--canvas-chrome-active")
      return
    }
    const dpr = Math.max(1, document.defaultView?.devicePixelRatio || 1)
    const pixelWidth = Math.max(1, Math.round(width * dpr))
    const pixelHeight = Math.max(1, Math.round(height * dpr))
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    anchor.style.width = `${width}px`
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    const viewportState = options.resolveViewportState()
    const rows = viewportState.virtualRows
    const window = viewportState.virtualColumns
    if (!rows || !window || rows.endIndex < rows.startIndex) {
      options.grid.classList.remove("affino-grid-dom--canvas-chrome-active")
      return
    }
    const rowCount = Math.max(0, rows.totalRowCount)
    if (cachedRowCount !== rowCount) {
      cachedRowMetrics = new Array(rowCount)
      cachedRowCount = rowCount
    }
    for (let index = rows.startIndex; index <= rows.endIndex; index += 1) {
      cachedRowMetrics[index] = { top: index * rows.rowHeight, height: rows.rowHeight }
    }
    const visibleRows = { start: rows.startIndex, end: rows.endIndex }
    const selectionWidth = options.rowSelection ? DOM_ROW_SELECTION_COLUMN_WIDTH : 0
    const leftColumns: Array<(typeof window.columns)[number]> = []
    const centerColumns: Array<(typeof window.columns)[number]> = []
    const rightColumns: Array<(typeof window.columns)[number]> = []
    for (const column of window.columns) {
      if (column.pin === "left") leftColumns.push(column)
      else if (column.pin === "right") rightColumns.push(column)
      else centerColumns.push(column)
    }
    const leftWidths = [
      ...(selectionWidth > 0 ? [selectionWidth] : []),
      ...leftColumns.map(column => column.width),
    ]
    const rightWidths = rightColumns.map(column => column.width)
    const centerWidths = [window.leftPadding, ...centerColumns.map(column => column.width), window.rightPadding]
    const leftPaneWidth = selectionWidth + leftColumns.reduce((sum, column) => sum + column.width, 0)
    const rightPaneWidth = rightWidths.reduce((sum, value) => sum + value, 0)
    const centerPaneWidth = Math.max(0, width - leftPaneWidth - rightPaneWidth)
    const leftModel = buildDataGridChromePaneModel({
      width: leftPaneWidth,
      height,
      rowMetrics: cachedRowMetrics,
      visibleRowRange: visibleRows,
      scrollTop: body.scrollTop,
      columnWidths: leftWidths,
    })
    const centerModel = buildDataGridChromePaneModel({
      width: centerPaneWidth,
      height,
      rowMetrics: cachedRowMetrics,
      visibleRowRange: visibleRows,
      scrollTop: body.scrollTop,
      columnWidths: centerWidths,
      scrollLeft: body.scrollLeft,
    })
    const rightModel = buildDataGridChromePaneModel({
      width: rightPaneWidth,
      height,
      rowMetrics: cachedRowMetrics,
      visibleRowRange: visibleRows,
      scrollTop: body.scrollTop,
      columnWidths: rightWidths,
    })
    const allHorizontalLines = centerModel.horizontalLines
    drawHorizontal(context, allHorizontalLines, width, height, rowColor, rowWidth, dpr)

    const columnWidthAligned = alignWidth(columnWidth, dpr)
    drawVertical(context, leftModel.verticalLines, [0, leftPaneWidth], 0, leftPaneWidth, height, columnColor, columnWidthAligned, dpr)
    drawVertical(
      context,
      centerModel.verticalLines,
      [...(leftPaneWidth === 0 ? [0] : []), centerPaneWidth],
      leftPaneWidth,
      centerPaneWidth,
      height,
      columnColor,
      columnWidthAligned,
      dpr,
    )
    drawVertical(context, rightModel.verticalLines, [rightPaneWidth], width - rightPaneWidth, rightPaneWidth, height, columnColor, columnWidthAligned, dpr)
    options.grid.classList.add("affino-grid-dom--canvas-chrome-active")
  }

  function attach(): void {
    context = canvas.getContext("2d") as CanvasContext | null
    if (!context) {
      options.grid.classList.remove("affino-grid-dom--canvas-chrome")
      options.grid.classList.remove("affino-grid-dom--canvas-chrome-active")
      return
    }
    bindBody(options.grid.querySelector<HTMLElement>(".affino-grid-dom__body"))
    readStyle()
    schedule()
  }

  function bindBody(nextBody: HTMLElement | null): void {
    if (body === nextBody) return
    resizeObserver?.disconnect()
    resizeObserver = null
    body?.removeEventListener("scroll", onScroll)
    body = nextBody
    if (!body || !context) return
    body.insertBefore(anchor, body.firstChild)
    body.addEventListener("scroll", onScroll, { passive: true })
    const ResizeObserverCtor = document.defaultView?.ResizeObserver
    if (ResizeObserverCtor) {
      resizeObserver = new ResizeObserverCtor(() => schedule(true))
      resizeObserver.observe(body)
    }
  }

  function sync(): void {
    if (!context) return
    bindBody(options.grid.querySelector<HTMLElement>(".affino-grid-dom__body"))
    if (!body) return
    if (anchor.parentElement !== body) body.insertBefore(anchor, body.firstChild)
    schedule()
  }

  function detach(): void {
    resizeObserver?.disconnect()
    resizeObserver = null
    body?.removeEventListener("scroll", onScroll)
    if (scheduled) {
      const view = document.defaultView
      if (rafId && view?.cancelAnimationFrame) view.cancelAnimationFrame(rafId)
      else if (rafId && view?.clearTimeout) view.clearTimeout(rafId)
    }
    anchor.remove()
    body = null
    context = null
    options.grid.classList.remove("affino-grid-dom--canvas-chrome-active")
    scheduled = false
  }

  return { attach, sync, detach }
}

function resolveLineWidth(value: string, fallback: number): number {
  const width = Number.parseFloat(value)
  return Number.isFinite(width) && width > 0 ? width : fallback
}

function alignWidth(width: number, dpr: number): number {
  return width > 0 ? Math.max(1, Math.round(width * dpr)) / dpr : 0
}

function alignCenter(boundary: number, width: number, dpr: number): number {
  const snapped = Math.round(boundary * dpr) / dpr
  return snapped - width / 2
}

function drawHorizontal(
  context: CanvasContext,
  lines: readonly { position: number }[],
  width: number,
  height: number,
  color: string,
  cssWidth: number,
  dpr: number,
): void {
  const lineWidth = alignWidth(cssWidth, dpr)
  if (lineWidth <= 0) return
  context.save()
  context.strokeStyle = color
  context.lineWidth = lineWidth
  context.beginPath()
  for (const line of lines) {
    if (line.position < -1 || line.position > height + 1) continue
    const y = alignCenter(line.position, lineWidth, dpr)
    context.moveTo(0, y)
    context.lineTo(width, y)
  }
  context.stroke()
  context.restore()
}

function drawVertical(
  context: CanvasContext,
  lines: readonly { position: number }[],
  extraBoundaries: readonly number[],
  paneLeft: number,
  paneWidth: number,
  height: number,
  color: string,
  lineWidth: number,
  dpr: number,
): void {
  if (paneWidth <= 0 || lineWidth <= 0) return
  context.save()
  context.beginPath()
  context.rect(paneLeft, 0, paneWidth, height)
  context.clip()
  context.strokeStyle = color
  context.lineWidth = lineWidth
  context.beginPath()
  const drawAt = (localPosition: number): void => {
    const position = paneLeft + localPosition
    if (position < paneLeft - 1 || position > paneLeft + paneWidth + 1) return
    const x = alignCenter(position, lineWidth, dpr)
    context.moveTo(x, 0)
    context.lineTo(x, height)
  }
  for (const line of lines) drawAt(line.position)
  for (const boundary of extraBoundaries) drawAt(boundary)
  context.stroke()
  context.restore()
}
