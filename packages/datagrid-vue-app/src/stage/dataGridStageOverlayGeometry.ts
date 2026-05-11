import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageOverlayLane,
  DataGridTableStageOverlaySegment,
} from "./dataGridTableStageBody.types"
import type { DataGridTableStageCustomOverlay } from "./dataGridTableStage.types"

const overlayStrokeWidth = "var(--datagrid-selection-stroke-width)"
const pinnedPaneSeamOverlayWidth = `max(var(--datagrid-pinned-pane-separator-size), ${overlayStrokeWidth})`

export interface DataGridStageOverlayMetrics {
  startRowOffset: number
  endRowOffset: number
  startColumnIndex: number
  endColumnIndex: number
  top: number
  height: number
}

export interface DataGridStageOverlayBounds {
  startRowOffset: number
  endRowOffset: number
  startColumnIndex: number
  endColumnIndex: number
}

export interface DataGridStageOverlayMetricsSource {
  top: number
  height: number
}

export interface DataGridStageOverlayGeometryContext {
  bodyViewportClientHeight: number
  indexColumnWidthPx: number
  leftPaneWidth: number
  rightPaneWidth: number
  renderedColumns: readonly DataGridTableStageBodyColumn[]
  pinnedLeftColumns: readonly DataGridTableStageBodyColumn[]
  pinnedRightColumns: readonly DataGridTableStageBodyColumn[]
  layoutGridContentWidth: number
  columnIndexByKey: (columnKey: string) => number
  resolveColumnWidth: (column: DataGridTableStageBodyColumn) => number
  resolveLeftColumnSpacerWidth: () => number
}

export function mergeOverlayBounds(
  left: DataGridStageOverlayBounds | null,
  right: DataGridStageOverlayBounds | null,
): DataGridStageOverlayBounds | null {
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

export function resolveOverlayMetrics(
  bounds: DataGridStageOverlayBounds | null,
  metricsSource: readonly DataGridStageOverlayMetricsSource[] = [],
): DataGridStageOverlayMetrics | null {
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

export function resolveOverlayMetricsList<TRange>(
  ranges: readonly TRange[],
  resolveBounds: (range: TRange | null) => DataGridStageOverlayBounds | null,
  metricsSource: readonly DataGridStageOverlayMetricsSource[] = [],
): DataGridStageOverlayMetrics[] {
  return ranges
    .map(range => resolveOverlayMetrics(resolveBounds(range), metricsSource))
    .filter((metrics): metrics is DataGridStageOverlayMetrics => metrics != null)
}

export function buildOverlaySegment(
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
): DataGridTableStageOverlaySegment {
  const topBleed = Math.max(0, options?.topBleed ?? 1)
  const bottomBleed = Math.max(0, options?.bottomBleed ?? 1)
  const leftBleed = options?.omitLeftBorder ? 0 : Math.max(0, options?.leftBleed ?? 1)
  const rightBleed = options?.omitRightBorder ? 0 : Math.max(0, options?.rightBleed ?? 1)
  const borderWidth = options?.hideBorder ? "0px" : overlayStrokeWidth
  return {
    key,
    style: {
      position: "absolute",
      top: `${top - topBleed}px`,
      left: `${left - leftBleed}px`,
      width: `${Math.max(1, width + leftBleed + rightBleed)}px`,
      height: `${Math.max(1, height + topBleed + bottomBleed)}px`,
      border: `${borderWidth} ${options?.borderStyle ?? "solid"} ${options?.borderColor ?? "var(--datagrid-selection-overlay-border)"}`,
      borderLeftWidth: options?.hideBorder || options?.omitLeftBorder ? "0px" : overlayStrokeWidth,
      borderRightWidth: options?.hideBorder || options?.omitRightBorder ? "0px" : overlayStrokeWidth,
      borderTopWidth: borderWidth,
      borderBottomWidth: borderWidth,
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

export function buildPinnedPaneSeamOverlaySegment(
  key: string,
  top: number,
  height: number,
  side: "left" | "right",
  options?: {
    hideBorder?: boolean
    seamEdge?: "left" | "right"
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    zIndex?: number
    topBleed?: number
    bottomBleed?: number
  },
): DataGridTableStageOverlaySegment {
  const topBleed = Math.max(0, options?.topBleed ?? 1)
  const bottomBleed = Math.max(0, options?.bottomBleed ?? 1)
  const borderWidth = options?.hideBorder ? "0px" : overlayStrokeWidth
  const verticalBorderWidth = options?.hideBorder ? "0px" : overlayStrokeWidth
  return {
    key,
    style: {
      position: "absolute",
      top: `${top - topBleed}px`,
      left: side === "left" ? `calc(100% - ${pinnedPaneSeamOverlayWidth})` : "0px",
      width: pinnedPaneSeamOverlayWidth,
      height: `${Math.max(1, height + topBleed + bottomBleed)}px`,
      border: `${borderWidth} ${options?.borderStyle ?? "solid"} ${options?.borderColor ?? "var(--datagrid-selection-overlay-border)"}`,
      borderLeftWidth: options?.seamEdge === "left" ? verticalBorderWidth : "0px",
      borderRightWidth: options?.seamEdge === "right" ? verticalBorderWidth : "0px",
      borderTopWidth: borderWidth,
      borderBottomWidth: borderWidth,
      background: options?.backgroundColor ?? "transparent",
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: options?.zIndex ?? 6,
    },
  }
}

export function buildPaneOverlaySegments(
  context: DataGridStageOverlayGeometryContext,
  metrics: DataGridStageOverlayMetrics | null,
  pane: "left" | "center" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    hideSingleCell?: boolean
    zIndex?: number
  },
  viewportHeight = Math.max(0, context.bodyViewportClientHeight),
): DataGridTableStageOverlaySegment[] {
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
    const selectedColumns = context.pinnedLeftColumns.filter(column => {
      const index = context.columnIndexByKey(column.key)
      return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
    })
    if (selectedColumns.length === 0) {
      return []
    }

    let left = context.indexColumnWidthPx
    for (const column of context.pinnedLeftColumns) {
      if (column.key === selectedColumns[0]?.key) {
        break
      }
      left += context.resolveColumnWidth(column)
    }

    const width = selectedColumns.reduce((sum, column) => sum + context.resolveColumnWidth(column), 0)
    const lastSelectedIndex = context.columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
    const lastPinnedIndex = context.columnIndexByKey(context.pinnedLeftColumns[context.pinnedLeftColumns.length - 1]?.key ?? "")
    const paneWidth = context.leftPaneWidth
    const touchesPinnedSeam = lastPinnedIndex >= 0 && lastSelectedIndex === lastPinnedIndex
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
          omitRightBorder: touchesPinnedSeam || metrics.endColumnIndex > lastSelectedIndex,
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
    const selectedColumns = context.renderedColumns.filter(column => {
      const index = context.columnIndexByKey(column.key)
      return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
    })
    if (selectedColumns.length === 0) {
      return []
    }

    let left = context.resolveLeftColumnSpacerWidth()
    for (const column of context.renderedColumns) {
      if (column.key === selectedColumns[0]?.key) {
        break
      }
      left += context.resolveColumnWidth(column)
    }

    const width = selectedColumns.reduce((sum, column) => sum + context.resolveColumnWidth(column), 0)
    const firstSelectedIndex = context.columnIndexByKey(selectedColumns[0]?.key ?? "")
    const lastSelectedIndex = context.columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
    const leftBleed = left <= 0 ? 0 : 1
    const rightBleed = context.layoutGridContentWidth > 0 && left + width >= context.layoutGridContentWidth ? 0 : 1
    return [
      buildOverlaySegment(
        `${keyPrefix}-center-${metrics.startRowOffset}-${metrics.endRowOffset}`,
        metrics.top,
        left,
        width,
        metrics.height,
        {
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

  const selectedColumns = context.pinnedRightColumns.filter(column => {
    const index = context.columnIndexByKey(column.key)
    return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
  })
  if (selectedColumns.length === 0) {
    return []
  }

  let left = 0
  for (const column of context.pinnedRightColumns) {
    if (column.key === selectedColumns[0]?.key) {
      break
    }
    left += context.resolveColumnWidth(column)
  }

  const width = selectedColumns.reduce((sum, column) => sum + context.resolveColumnWidth(column), 0)
  const firstSelectedIndex = context.columnIndexByKey(selectedColumns[0]?.key ?? "")
  const firstPinnedIndex = context.columnIndexByKey(context.pinnedRightColumns[0]?.key ?? "")
  const paneWidth = context.rightPaneWidth
  const touchesPinnedSeam = firstPinnedIndex >= 0 && firstSelectedIndex === firstPinnedIndex
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
        omitLeftBorder: touchesPinnedSeam || metrics.startColumnIndex < firstSelectedIndex,
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

export function buildPinnedPaneSeamOverlaySegments(
  context: DataGridStageOverlayGeometryContext,
  metrics: DataGridStageOverlayMetrics | null,
  pane: "left" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    hideSingleCell?: boolean
    zIndex?: number
  },
  viewportHeight = Math.max(0, context.bodyViewportClientHeight),
): DataGridTableStageOverlaySegment[] {
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
    const selectedColumns = context.pinnedLeftColumns.filter(column => {
      const index = context.columnIndexByKey(column.key)
      return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
    })
    if (selectedColumns.length === 0) {
      return []
    }
    const lastSelectedIndex = context.columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
    const lastPinnedIndex = context.columnIndexByKey(context.pinnedLeftColumns[context.pinnedLeftColumns.length - 1]?.key ?? "")
    if (lastSelectedIndex !== lastPinnedIndex) {
      return []
    }
    const crossesIntoCenter = metrics.endColumnIndex > lastSelectedIndex
    return [
      buildPinnedPaneSeamOverlaySegment(
        `${keyPrefix}-left-seam-${metrics.startRowOffset}-${metrics.endRowOffset}`,
        metrics.top,
        metrics.height,
        "left",
        {
          seamEdge: crossesIntoCenter ? undefined : "right",
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

  const selectedColumns = context.pinnedRightColumns.filter(column => {
    const index = context.columnIndexByKey(column.key)
    return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
  })
  if (selectedColumns.length === 0) {
    return []
  }
  const firstSelectedIndex = context.columnIndexByKey(selectedColumns[0]?.key ?? "")
  const firstPinnedIndex = context.columnIndexByKey(context.pinnedRightColumns[0]?.key ?? "")
  if (firstSelectedIndex !== firstPinnedIndex) {
    return []
  }
  const crossesIntoCenter = metrics.startColumnIndex < firstSelectedIndex
  return [
    buildPinnedPaneSeamOverlaySegment(
      `${keyPrefix}-right-seam-${metrics.startRowOffset}-${metrics.endRowOffset}`,
      metrics.top,
      metrics.height,
      "right",
      {
        seamEdge: crossesIntoCenter ? undefined : "left",
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

export function buildPaneOverlaySegmentsForMetricsList(
  context: DataGridStageOverlayGeometryContext,
  metricsList: readonly DataGridStageOverlayMetrics[],
  pane: "left" | "center" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    hideSingleCell?: boolean
    zIndex?: number
  },
  viewportHeight = Math.max(0, context.bodyViewportClientHeight),
): DataGridTableStageOverlaySegment[] {
  if (metricsList.length === 0) {
    return []
  }
  return metricsList.flatMap((metrics, index) => buildPaneOverlaySegments(
    context,
    metrics,
    pane,
    metricsList.length === 1 ? keyPrefix : `${keyPrefix}-${index}`,
    options,
    viewportHeight,
  ))
}

export function buildPinnedPaneSeamOverlaySegmentsForMetricsList(
  context: DataGridStageOverlayGeometryContext,
  metricsList: readonly DataGridStageOverlayMetrics[],
  pane: "left" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    hideSingleCell?: boolean
    zIndex?: number
  },
  viewportHeight = Math.max(0, context.bodyViewportClientHeight),
): DataGridTableStageOverlaySegment[] {
  if (metricsList.length === 0) {
    return []
  }
  return metricsList.flatMap((metrics, index) => buildPinnedPaneSeamOverlaySegments(
    context,
    metrics,
    pane,
    metricsList.length === 1 ? keyPrefix : `${keyPrefix}-${index}`,
    options,
    viewportHeight,
  ))
}

export function buildCustomOverlayLane(
  context: DataGridStageOverlayGeometryContext,
  overlay: DataGridTableStageCustomOverlay,
  pane: "left" | "center" | "right",
  metricsList: readonly DataGridStageOverlayMetrics[],
  viewportHeight = Math.max(0, context.bodyViewportClientHeight),
): DataGridTableStageOverlayLane | null {
  const segments = buildPaneOverlaySegmentsForMetricsList(
    context,
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

export function buildCustomSeamOverlayLane(
  context: DataGridStageOverlayGeometryContext,
  overlay: DataGridTableStageCustomOverlay,
  pane: "left" | "right",
  metricsList: readonly DataGridStageOverlayMetrics[],
  viewportHeight = Math.max(0, context.bodyViewportClientHeight),
): DataGridTableStageOverlayLane | null {
  const segments = buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    context,
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
