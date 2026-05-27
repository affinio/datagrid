import { type ComputedRef, type Ref } from "vue"
import type { DataGridChromePaneModel, DataGridChromeRenderModel } from "@affino/datagrid-chrome"
import {
  resolveDeviceAlignedCanvasLineWidth,
  resolveDeviceAlignedCanvasStrokeCenter,
} from "./dataGridChromeCanvasMath"
import {
  recordDataGridPerfSample,
  resolveDataGridPerfNow,
} from "../perf/dataGridPerfTrace"

type GridChromeRedrawMode = "full" | "center-scroll" | "body-scroll"

export interface UseDataGridStageChromeCanvasOptions {
  stageRootEl: Ref<HTMLElement | null>
  bodyShellRef: Ref<HTMLElement | null>
  bodyViewportEl: Ref<HTMLElement | null>
  verticalBodyViewportEl: Ref<HTMLElement | null>
  bottomViewportEl: Ref<HTMLElement | null>
  leftHeaderChromeCanvasEl: Ref<HTMLCanvasElement | null>
  centerHeaderChromeCanvasEl: Ref<HTMLCanvasElement | null>
  rightHeaderChromeCanvasEl: Ref<HTMLCanvasElement | null>
  leftChromeCanvasEl: Ref<HTMLCanvasElement | null>
  centerChromeCanvasEl: Ref<HTMLCanvasElement | null>
  rightChromeCanvasEl: Ref<HTMLCanvasElement | null>
  leftBottomChromeCanvasEl: Ref<HTMLCanvasElement | null>
  centerBottomChromeCanvasEl: Ref<HTMLCanvasElement | null>
  rightBottomChromeCanvasEl: Ref<HTMLCanvasElement | null>
  bodyViewportScrollTop: Ref<number>
  bodyViewportScrollLeft: Ref<number>
  bodyViewportClientWidth: Ref<number>
  bodyViewportClientHeight: Ref<number>
  bodyViewportShellClientWidth: Ref<number>
  pinnedBottomViewportClientHeight: Ref<number>
  bodyViewportTopOffset: Ref<number>
  headerShellHeight: Ref<number>
  headerViewportClientWidth: Ref<number>
  chromeRenderModel: ComputedRef<DataGridChromeRenderModel>
  headerChromeRenderModel: ComputedRef<DataGridChromeRenderModel>
  pinnedBottomChromeRenderModel: ComputedRef<DataGridChromeRenderModel>
  hasPivotHeaderGroups: ComputedRef<boolean>
  perfTraceEnabled?: boolean
}

export interface UseDataGridStageChromeCanvasResult {
  syncBodyViewportMetrics: () => void
  syncPinnedBottomViewportMetrics: () => void
  syncPinnedBottomViewportScrollLeft: () => void
  scheduleGridChromeRedraw: (mode?: GridChromeRedrawMode) => void
  flushGridChromeRedraw: (mode?: GridChromeRedrawMode) => void
  connectGridChromeResizeObserver: () => void
  disconnectGridChromeResizeObserver: () => void
}

interface GridChromeResolvedStyle {
  rowDividerColor: string
  columnDividerColor: string
  headerColumnDividerColor: string
  rowBandBaseColor: string
  rowBandHoverColor: string
  rowBandStripedColor: string
  rowBandGroupColor: string
  rowBandTreeColor: string
  rowBandPivotColor: string
  rowBandPivotGroupColor: string
  rowDividerWidth: number
  columnDividerWidth: number
  headerColumnDividerWidth: number
}

function mergeGridChromeRedrawMode(current: GridChromeRedrawMode, next: GridChromeRedrawMode): GridChromeRedrawMode {
  if (current === next) {
    return current
  }
  if (current === "full" || next === "full") {
    return "full"
  }
  return "full"
}

function resolveGridChromeDevicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1
  }
  return Math.max(1, window.devicePixelRatio || 1)
}

function resolveGridChromeVariable(stageRootEl: Ref<HTMLElement | null>, variableName: string): string {
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

function resolveGridChromeColor(stageRootEl: Ref<HTMLElement | null>, variableName: string, fallback: string): string {
  const value = resolveGridChromeVariable(stageRootEl, variableName)
  return value || fallback
}

function resolveGridChromeLineWidth(stageRootEl: Ref<HTMLElement | null>, variableName: string, fallback: number): number {
  const rawValue = resolveGridChromeVariable(stageRootEl, variableName)
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

function resolveGridChromeBandColor(style: GridChromeResolvedStyle, kind: string): string {
  switch (kind) {
    case "hover":
      return style.rowBandHoverColor
    case "base":
      return style.rowBandBaseColor
    case "striped":
      return style.rowBandStripedColor
    case "group":
      return style.rowBandGroupColor
    case "tree":
      return style.rowBandTreeColor
    case "pivot":
      return style.rowBandPivotColor
    case "pivot-group":
      return style.rowBandPivotGroupColor
    default:
      return ""
  }
}

function drawGridChromeBands(
  style: GridChromeResolvedStyle,
  context: CanvasRenderingContext2D,
  pane: DataGridChromePaneModel,
): void {
  if (pane.width <= 0 || pane.height <= 0 || pane.bands.length === 0) {
    return
  }
  context.save()
  for (const band of pane.bands) {
    const fillStyle = resolveGridChromeBandColor(style, band.kind)
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
  style: GridChromeResolvedStyle,
  context: CanvasRenderingContext2D | null,
  pane: DataGridChromePaneModel,
): void {
  if (!context) {
    return
  }
  drawGridChromeBands(style, context, pane)
  drawGridChromeHorizontalLines(context, pane, style.rowDividerColor, style.rowDividerWidth)
  drawGridChromeVerticalLines(context, pane, style.columnDividerColor, style.columnDividerWidth)
}

function drawGridChromeHeaderPane(
  context: CanvasRenderingContext2D | null,
  pane: DataGridChromePaneModel,
  columnDividerColor: string,
  columnDividerWidth: number,
  hasPivotHeaderGroups: ComputedRef<boolean>,
): void {
  if (!context || hasPivotHeaderGroups.value) {
    return
  }
  drawGridChromeVerticalLines(context, pane, columnDividerColor, columnDividerWidth)
}


function countGridChromePaneLines(model: DataGridChromeRenderModel): number {
  return model.left.horizontalLines.length
    + model.left.verticalLines.length
    + model.center.horizontalLines.length
    + model.center.verticalLines.length
    + model.right.horizontalLines.length
    + model.right.verticalLines.length
}

function countGridChromePaneBands(model: DataGridChromeRenderModel): number {
  return model.left.bands.length + model.center.bands.length + model.right.bands.length
}

export function useDataGridStageChromeCanvas(
  options: UseDataGridStageChromeCanvasOptions,
): UseDataGridStageChromeCanvasResult {
  let gridChromeAnimationFrame = 0
  let gridChromeResizeObserver: ResizeObserver | null = null
  type GridChromeRedrawMode = "full" | "center-scroll" | "body-scroll"
  let pendingGridChromeRedrawMode: GridChromeRedrawMode = "full"
  let cachedGridChromeStyle: GridChromeResolvedStyle | null = null

  function readGridChromeStyle(): GridChromeResolvedStyle {
    const rowDividerColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-row-divider-color", "rgba(0, 0, 0, 0.08)")
    const columnDividerColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-column-divider-color", "rgba(0, 0, 0, 0.08)")
    const headerColumnDividerColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-header-column-divider-color", columnDividerColor)
    const rowBandBaseColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-row-band-base-bg", "rgba(255, 255, 255, 1)")
    const rowBandHoverColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-row-band-hover-bg", "rgba(251, 146, 60, 0.18)")
    const rowBandStripedColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-row-band-striped-bg", "rgba(59, 130, 246, 0.06)")
    const rowBandGroupColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-row-band-group-bg", "rgba(59, 130, 246, 0.08)")
    const rowBandTreeColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-row-band-tree-bg", "rgba(59, 130, 246, 0.12)")
    const rowBandPivotColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-row-band-pivot-bg", "rgba(59, 130, 246, 0.1)")
    const rowBandPivotGroupColor = resolveGridChromeColor(options.stageRootEl, "--datagrid-row-band-pivot-group-bg", "rgba(59, 130, 246, 0.14)")
    const rowDividerWidth = resolveGridChromeLineWidth(options.stageRootEl, "--datagrid-row-divider-size", 1)
    const columnDividerWidth = resolveGridChromeLineWidth(options.stageRootEl, "--datagrid-column-divider-size", 1)
    const headerColumnDividerWidth = resolveGridChromeLineWidth(options.stageRootEl, "--datagrid-header-column-divider-size", columnDividerWidth)
    return {
      rowDividerColor,
      columnDividerColor,
      headerColumnDividerColor,
      rowBandBaseColor,
      rowBandHoverColor,
      rowBandStripedColor,
      rowBandGroupColor,
      rowBandTreeColor,
      rowBandPivotColor,
      rowBandPivotGroupColor,
      rowDividerWidth,
      columnDividerWidth,
      headerColumnDividerWidth,
    }
  }

  function resolveGridChromeStyle(mode: GridChromeRedrawMode): GridChromeResolvedStyle {
    if (mode === "full" || !cachedGridChromeStyle) {
      cachedGridChromeStyle = readGridChromeStyle()
    }
    return cachedGridChromeStyle
  }

  function syncPinnedBottomViewportScrollLeft(): void {
    const viewport = options.bottomViewportEl.value
    if (!viewport || viewport.scrollLeft === options.bodyViewportScrollLeft.value) {
      return
    }
    viewport.scrollLeft = options.bodyViewportScrollLeft.value
  }

  function syncPinnedBottomViewportMetrics(): void {
    options.pinnedBottomViewportClientHeight.value = options.bottomViewportEl.value?.clientHeight ?? 0
  }

  function syncBodyViewportMetrics(): void {
    const viewport = options.bodyViewportEl.value
    const verticalViewport = options.verticalBodyViewportEl.value ?? viewport
    const shell = options.bodyShellRef.value
    if (!viewport || !verticalViewport || !shell) {
      return
    }
    options.bodyViewportScrollTop.value = verticalViewport.scrollTop
    options.bodyViewportScrollLeft.value = viewport.scrollLeft
    const viewportClientWidth = viewport.clientWidth
    const viewportShellClientWidth = viewport.parentElement?.clientWidth ?? shell.clientWidth
    options.bodyViewportClientWidth.value = viewportClientWidth
    options.bodyViewportClientHeight.value = verticalViewport.clientHeight
    options.bodyViewportShellClientWidth.value = Math.max(viewportShellClientWidth, viewportClientWidth)
    const viewportRect = verticalViewport.getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    options.bodyViewportTopOffset.value = Math.max(0, viewportRect.top - shellRect.top)
    options.headerShellHeight.value = options.stageRootEl.value?.querySelector<HTMLElement>(".grid-header-shell")?.getBoundingClientRect().height ?? 0
    const headerViewport = options.stageRootEl.value?.querySelector<HTMLElement>(".grid-header-viewport")
    options.headerViewportClientWidth.value = headerViewport?.clientWidth ?? options.bodyViewportClientWidth.value
    syncPinnedBottomViewportMetrics()
    syncPinnedBottomViewportScrollLeft()
  }

  function drawGridChromeCanvas(mode: GridChromeRedrawMode = "full"): void {
    const startedAt = options.perfTraceEnabled ? resolveDataGridPerfNow() : 0
    gridChromeAnimationFrame = 0
    pendingGridChromeRedrawMode = "full"
    const headerRenderModel = options.headerChromeRenderModel.value
    const renderModel = options.chromeRenderModel.value
    const bottomRenderModel = options.pinnedBottomChromeRenderModel.value
    const style = resolveGridChromeStyle(mode)
    const shouldDrawHeaderCenter = mode === "full" || mode === "center-scroll"
    const shouldDrawBodyCenter = mode === "full" || mode === "center-scroll" || mode === "body-scroll"
    const shouldDrawBodyPinned = mode === "full" || mode === "body-scroll"
    const shouldDrawBottomCenter = mode === "full" || mode === "center-scroll"

    const leftHeaderContext = mode === "full"
      ? prepareGridChromeCanvas(options.leftHeaderChromeCanvasEl.value, headerRenderModel.left.width, headerRenderModel.left.height)
      : null
    if (leftHeaderContext) {
      drawGridChromeHeaderPane(leftHeaderContext, headerRenderModel.left, style.headerColumnDividerColor, style.headerColumnDividerWidth, options.hasPivotHeaderGroups)
    }

    const centerHeaderContext = shouldDrawHeaderCenter
      ? prepareGridChromeCanvas(options.centerHeaderChromeCanvasEl.value, headerRenderModel.center.width, headerRenderModel.center.height)
      : null
    drawGridChromeHeaderPane(centerHeaderContext, headerRenderModel.center, style.headerColumnDividerColor, style.headerColumnDividerWidth, options.hasPivotHeaderGroups)

    const rightHeaderContext = mode === "full"
      ? prepareGridChromeCanvas(options.rightHeaderChromeCanvasEl.value, headerRenderModel.right.width, headerRenderModel.right.height)
      : null
    if (rightHeaderContext) {
      drawGridChromeHeaderPane(rightHeaderContext, headerRenderModel.right, style.headerColumnDividerColor, style.headerColumnDividerWidth, options.hasPivotHeaderGroups)
    }

    const leftContext = shouldDrawBodyPinned
      ? prepareGridChromeCanvas(options.leftChromeCanvasEl.value, renderModel.left.width, renderModel.left.height)
      : null
    if (leftContext) {
      drawGridChromeBodyPane(style, leftContext, renderModel.left)
    }

    const centerContext = shouldDrawBodyCenter
      ? prepareGridChromeCanvas(options.centerChromeCanvasEl.value, renderModel.center.width, renderModel.center.height)
      : null
    drawGridChromeBodyPane(style, centerContext, renderModel.center)

    const rightContext = shouldDrawBodyPinned
      ? prepareGridChromeCanvas(options.rightChromeCanvasEl.value, renderModel.right.width, renderModel.right.height)
      : null
    if (rightContext) {
      drawGridChromeBodyPane(style, rightContext, renderModel.right)
    }

    const leftBottomContext = mode === "full"
      ? prepareGridChromeCanvas(options.leftBottomChromeCanvasEl.value, bottomRenderModel.left.width, bottomRenderModel.left.height)
      : null
    if (leftBottomContext) {
      drawGridChromeBodyPane(style, leftBottomContext, bottomRenderModel.left)
    }

    const centerBottomContext = shouldDrawBottomCenter
      ? prepareGridChromeCanvas(options.centerBottomChromeCanvasEl.value, bottomRenderModel.center.width, bottomRenderModel.center.height)
      : null
    drawGridChromeBodyPane(style, centerBottomContext, bottomRenderModel.center)

    const rightBottomContext = mode === "full"
      ? prepareGridChromeCanvas(options.rightBottomChromeCanvasEl.value, bottomRenderModel.right.width, bottomRenderModel.right.height)
      : null
    if (rightBottomContext) {
      drawGridChromeBodyPane(style, rightBottomContext, bottomRenderModel.right)
    }

    if (options.perfTraceEnabled) {
      const drawnPaneCount = [
        leftHeaderContext,
        centerHeaderContext,
        rightHeaderContext,
        leftContext,
        centerContext,
        rightContext,
        leftBottomContext,
        centerBottomContext,
        rightBottomContext,
      ].filter(Boolean).length
      const finishedAt = resolveDataGridPerfNow()
      recordDataGridPerfSample({
        scope: "chromeDraw",
        ts: finishedAt,
        totalMs: finishedAt - startedAt,
        redrawMode: mode,
        drawnPaneCount,
        bodyLineCount: countGridChromePaneLines(renderModel),
        headerLineCount: countGridChromePaneLines(headerRenderModel),
        pinnedBottomLineCount: countGridChromePaneLines(bottomRenderModel),
        bodyBandCount: countGridChromePaneBands(renderModel),
        pinnedBottomBandCount: countGridChromePaneBands(bottomRenderModel),
      })
    }
  }

  function scheduleGridChromeRedraw(mode: GridChromeRedrawMode = "full"): void {
    pendingGridChromeRedrawMode = gridChromeAnimationFrame === 0
      ? mode
      : mergeGridChromeRedrawMode(pendingGridChromeRedrawMode, mode)
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

  function flushGridChromeRedraw(mode: GridChromeRedrawMode = "full"): void {
    const nextMode = gridChromeAnimationFrame === 0
      ? mode
      : mergeGridChromeRedrawMode(pendingGridChromeRedrawMode, mode)
    if (gridChromeAnimationFrame !== 0 && typeof window !== "undefined") {
      window.cancelAnimationFrame(gridChromeAnimationFrame)
      gridChromeAnimationFrame = 0
    }
    drawGridChromeCanvas(nextMode)
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
    if (options.bodyViewportEl.value) {
      gridChromeResizeObserver.observe(options.bodyViewportEl.value)
    }
    if (options.verticalBodyViewportEl.value && options.verticalBodyViewportEl.value !== options.bodyViewportEl.value) {
      gridChromeResizeObserver.observe(options.verticalBodyViewportEl.value)
    }
    if (options.bottomViewportEl.value) {
      gridChromeResizeObserver.observe(options.bottomViewportEl.value)
    }
    if (options.bodyShellRef.value) {
      gridChromeResizeObserver.observe(options.bodyShellRef.value)
    }
    const headerShell = options.stageRootEl.value?.querySelector<HTMLElement>(".grid-header-shell")
    if (headerShell) {
      gridChromeResizeObserver.observe(headerShell)
    }
    const headerViewport = options.stageRootEl.value?.querySelector<HTMLElement>(".grid-header-viewport")
    if (headerViewport) {
      gridChromeResizeObserver.observe(headerViewport)
    }
  }

  function disconnectGridChromeResizeObserver(): void {
    if (gridChromeAnimationFrame !== 0 && typeof window !== "undefined") {
      window.cancelAnimationFrame(gridChromeAnimationFrame)
      gridChromeAnimationFrame = 0
    }
    gridChromeResizeObserver?.disconnect()
    gridChromeResizeObserver = null
  }

  return {
    syncBodyViewportMetrics,
    syncPinnedBottomViewportMetrics,
    syncPinnedBottomViewportScrollLeft,
    scheduleGridChromeRedraw,
    flushGridChromeRedraw,
    connectGridChromeResizeObserver,
    disconnectGridChromeResizeObserver,
  }
}
