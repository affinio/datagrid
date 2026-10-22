function normalizeDevicePixelRatio(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function normalizeCssLineWidth(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function normalizeVirtualRowIndex(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback
}

export interface DataGridVirtualChromeRowMetric {
  rowIndex: number
  top: number
  height: number
}

export interface DataGridVirtualChromeRowMetricsOptions {
  rowStart: number
  rowEnd: number
  rowTotal: number
  topSpacerHeight: number
  baseRowHeight: number
  resolveRowHeight?: (rowIndex: number) => number
  resolveRowOffset?: (rowIndex: number) => number
}

export function resolveDataGridVirtualChromeRowMetrics(
  options: DataGridVirtualChromeRowMetricsOptions,
): readonly DataGridVirtualChromeRowMetric[] {
  const rowTotal = normalizeVirtualRowIndex(options.rowTotal, 0)
  if (rowTotal <= 0) {
    return []
  }
  const maxRowIndex = rowTotal - 1
  const rowStart = Math.min(normalizeVirtualRowIndex(options.rowStart, 0), maxRowIndex)
  const rowEnd = Math.min(
    Math.max(rowStart, normalizeVirtualRowIndex(options.rowEnd, rowStart)),
    maxRowIndex,
  )
  const baseRowHeight = Math.max(1, Math.trunc(Number.isFinite(options.baseRowHeight) ? options.baseRowHeight : 1))
  const topSpacerHeight = Number.isFinite(options.topSpacerHeight) ? Math.max(0, options.topSpacerHeight) : 0
  const rowMetrics: DataGridVirtualChromeRowMetric[] = []
  let currentTop = topSpacerHeight

  for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
    const resolvedTop = options.resolveRowOffset?.(rowIndex)
    const top = Number.isFinite(resolvedTop) ? Math.max(0, resolvedTop as number) : currentTop
    const resolvedHeight = options.resolveRowHeight?.(rowIndex)
    const resolvedNextOffset = options.resolveRowOffset?.(rowIndex + 1)
    const offsetHeight = Number.isFinite(resolvedNextOffset) && Number.isFinite(resolvedTop)
      ? Math.max(1, (resolvedNextOffset as number) - (resolvedTop as number))
      : null
    const height = Math.max(
      1,
      Math.trunc(
        Number.isFinite(resolvedHeight)
          ? (resolvedHeight as number)
          : (offsetHeight ?? baseRowHeight),
      ),
    )
    rowMetrics.push({ rowIndex, top, height })
    currentTop = top + height
  }

  return rowMetrics
}

export function resolveDeviceAlignedCanvasLineWidth(
  cssLineWidth: number,
  devicePixelRatio: number,
): number {
  const normalizedCssLineWidth = normalizeCssLineWidth(cssLineWidth)
  if (normalizedCssLineWidth <= 0) {
    return 0
  }
  const normalizedDevicePixelRatio = normalizeDevicePixelRatio(devicePixelRatio)
  const physicalLineWidth = Math.max(1, Math.round(normalizedCssLineWidth * normalizedDevicePixelRatio))
  return physicalLineWidth / normalizedDevicePixelRatio
}

export function resolveDeviceAlignedCanvasStrokeCenter(
  boundaryPosition: number,
  cssLineWidth: number,
  devicePixelRatio: number,
): number {
  const normalizedDevicePixelRatio = normalizeDevicePixelRatio(devicePixelRatio)
  const alignedLineWidth = resolveDeviceAlignedCanvasLineWidth(cssLineWidth, normalizedDevicePixelRatio)
  const snappedBoundary = Math.round(boundaryPosition * normalizedDevicePixelRatio) / normalizedDevicePixelRatio
  return snappedBoundary - (alignedLineWidth / 2)
}
