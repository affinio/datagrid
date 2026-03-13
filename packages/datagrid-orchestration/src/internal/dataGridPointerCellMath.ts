import type { DataGridColumnPin } from "@affino/datagrid-core"

export interface DataGridPointerColumnMetricLike {
  columnIndex: number
  start: number
  end: number
  width: number
}

export interface DataGridPointerColumnSnapshotLike {
  pin?: DataGridColumnPin | null
}

export interface DataGridPointerVirtualWindowSnapshotLike {
  rowTotal: number
  colTotal: number
}

export interface DataGridPointerViewportSnapshot {
  left: number
  top: number
  width: number
  height: number
  scrollTop: number
  scrollLeft: number
}

export interface DataGridPinnedWidthSnapshot {
  leftPinnedWidth: number
  rightPinnedWidth: number
}

export function resolveDataGridPointerRowCount(
  snapshot: DataGridPointerVirtualWindowSnapshotLike | null | undefined,
): number {
  return Math.max(0, Math.trunc(snapshot?.rowTotal ?? 0))
}

export function resolveDataGridPointerColumnCount(
  metricsLength: number,
  snapshot: DataGridPointerVirtualWindowSnapshotLike | null | undefined,
): number {
  if (!snapshot) {
    return 0
  }
  return Math.max(0, Math.min(metricsLength, Math.trunc(snapshot.colTotal)))
}

export function resolveDataGridColumnIndexByAbsoluteX(
  metrics: readonly DataGridPointerColumnMetricLike[],
  columnCount: number,
  absoluteX: number,
): number {
  const lastMetric = metrics[metrics.length - 1]
  if (!lastMetric || columnCount <= 0) {
    return -1
  }
  const lastAllowedMetric = metrics[Math.max(0, columnCount - 1)]
  if (!lastAllowedMetric) {
    return -1
  }
  const clampedX = Math.max(0, Math.min(absoluteX, Math.max(0, lastMetric.end - 1)))
  for (const metric of metrics) {
    if (clampedX < metric.end) {
      return Math.min(metric.columnIndex, lastAllowedMetric.columnIndex)
    }
  }
  return lastAllowedMetric.columnIndex
}

export function resolveDataGridPinnedWidths(
  metrics: readonly DataGridPointerColumnMetricLike[],
  columns: readonly DataGridPointerColumnSnapshotLike[],
): DataGridPinnedWidthSnapshot {
  let leftPinnedWidth = 0
  let rightPinnedWidth = 0
  for (const metric of metrics) {
    const column = columns[metric.columnIndex]
    if (column?.pin === "left") {
      leftPinnedWidth = metric.end
    } else if (column?.pin === "right") {
      rightPinnedWidth += metric.width
    }
  }
  return {
    leftPinnedWidth,
    rightPinnedWidth,
  }
}

export function resolveDataGridAbsolutePointerX(
  viewport: DataGridPointerViewportSnapshot,
  totalWidth: number,
  pinnedWidths: DataGridPinnedWidthSnapshot,
  clientX: number,
  allowHorizontalAutoScroll = true,
): number {
  const pointerXInViewport = clientX - viewport.left
  if (pointerXInViewport <= pinnedWidths.leftPinnedWidth) {
    return pointerXInViewport
  }
  if (
    allowHorizontalAutoScroll &&
    pinnedWidths.rightPinnedWidth > 0 &&
    pointerXInViewport >= viewport.width - pinnedWidths.rightPinnedWidth
  ) {
    return totalWidth - pinnedWidths.rightPinnedWidth + (pointerXInViewport - (viewport.width - pinnedWidths.rightPinnedWidth))
  }
  return viewport.scrollLeft + pointerXInViewport
}

export function resolveDataGridRowIndexFromPointer(
  viewport: DataGridPointerViewportSnapshot,
  clientY: number,
  headerHeight: number,
  rowHeight: number,
  resolveRowIndexAtOffset?: (offset: number) => number,
): number {
  const pointerYInViewport = clientY - viewport.top
  const clampedY = Math.max(0, Math.min(viewport.height - 1, pointerYInViewport))
  const rowOffset = viewport.scrollTop + clampedY - headerHeight
  return resolveRowIndexAtOffset
    ? resolveRowIndexAtOffset(rowOffset)
    : Math.floor(rowOffset / rowHeight)
}