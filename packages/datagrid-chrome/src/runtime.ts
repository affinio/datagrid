import type {
  BuildDataGridChromePaneModelInput,
  BuildDataGridChromeRenderModelInput,
  DataGridChromeBand,
  DataGridChromeLine,
  DataGridChromePaneModel,
  DataGridChromeRenderModel,
  DataGridChromeVisibleRange,
} from "./contracts.js"

function normalizeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function normalizeVisibleRange(
  range: DataGridChromeVisibleRange | null | undefined,
  length: number,
): DataGridChromeVisibleRange | null {
  if (!range || length <= 0) {
    return null
  }
  const start = Math.max(0, Math.min(length - 1, Math.floor(range.start)))
  const end = Math.max(start, Math.min(length - 1, Math.floor(range.end)))
  return { start, end }
}

export function buildDataGridChromePaneModel(
  input: BuildDataGridChromePaneModelInput,
): DataGridChromePaneModel {
  const width = normalizeDimension(input.width)
  const height = normalizeDimension(input.height)
  const scrollTop = Number.isFinite(input.scrollTop) ? input.scrollTop ?? 0 : 0
  const scrollLeft = Number.isFinite(input.scrollLeft) ? input.scrollLeft ?? 0 : 0
  const visibleRowRange = normalizeVisibleRange(input.visibleRowRange, input.rowMetrics.length)
  const visibleColumnRange = normalizeVisibleRange(input.visibleColumnRange, input.columnWidths.length)

  let currentX = 0
  const columnStart = visibleColumnRange?.start ?? 0
  const columnEnd = visibleColumnRange?.end ?? (input.columnWidths.length - 1)
  for (let index = 0; index < columnStart; index += 1) {
    const columnWidth = input.columnWidths[index]
    if (columnWidth == null) {
      continue
    }
    if (Number.isFinite(columnWidth) && columnWidth > 0) {
      currentX += columnWidth
    }
  }
  const verticalLines: DataGridChromeLine[] = []
  for (let index = columnStart; index <= columnEnd; index += 1) {
    const columnWidth = input.columnWidths[index]
    if (columnWidth == null) {
      continue
    }
    if (!Number.isFinite(columnWidth) || columnWidth <= 0) {
      continue
    }
    currentX += columnWidth
    verticalLines.push({
      position: currentX - scrollLeft,
    })
  }

  const rowStart = visibleRowRange?.start ?? 0
  const rowEnd = visibleRowRange?.end ?? (input.rowMetrics.length - 1)
  const horizontalLines: DataGridChromeLine[] = []
  for (let index = rowStart; index <= rowEnd; index += 1) {
    const metric = input.rowMetrics[index]
    if (!metric) {
      continue
    }
    if (!Number.isFinite(metric.top) || !Number.isFinite(metric.height) || metric.height <= 0) {
      continue
    }
    horizontalLines.push({
      position: (metric.top + metric.height) - scrollTop,
    })
  }

  const bands: DataGridChromeBand[] = []
  const rowBands = input.rowBands ?? []
  for (let index = 0; index < rowBands.length; index += 1) {
    const band = rowBands[index]
    if (!band) {
      continue
    }
    const bandRowIndex = Number.isFinite(band.rowIndex) ? Math.floor(band.rowIndex as number) : index
    if (bandRowIndex < rowStart || bandRowIndex > rowEnd) {
      continue
    }
    if (
      !Number.isFinite(band.top)
      || !Number.isFinite(band.height)
      || band.height <= 0
      || typeof band.kind !== "string"
      || band.kind.length === 0
    ) {
      continue
    }
    bands.push({
      top: band.top - scrollTop,
      height: band.height,
      kind: band.kind,
    })
  }

  return {
    width,
    height,
    bands,
    horizontalLines,
    verticalLines,
  }
}

export function buildDataGridChromeRenderModel(
  input: BuildDataGridChromeRenderModelInput,
): DataGridChromeRenderModel {
  return {
    left: buildDataGridChromePaneModel({
      width: input.leftPaneWidth,
      height: input.viewportHeight,
      rowMetrics: input.rowMetrics,
      rowBands: input.rowBands,
      visibleRowRange: input.visibleRowRange,
      scrollTop: input.scrollTop,
      columnWidths: input.leftColumnWidths,
      visibleColumnRange: input.leftVisibleColumnRange,
    }),
    center: buildDataGridChromePaneModel({
      width: input.centerPaneWidth,
      height: input.viewportHeight,
      rowMetrics: input.rowMetrics,
      rowBands: input.rowBands,
      visibleRowRange: input.visibleRowRange,
      scrollTop: input.scrollTop,
      columnWidths: input.centerColumnWidths,
      visibleColumnRange: input.centerVisibleColumnRange,
      scrollLeft: input.centerScrollLeft,
    }),
    right: buildDataGridChromePaneModel({
      width: input.rightPaneWidth,
      height: input.viewportHeight,
      rowMetrics: input.rowMetrics,
      rowBands: input.rowBands,
      visibleRowRange: input.visibleRowRange,
      scrollTop: input.scrollTop,
      columnWidths: input.rightColumnWidths,
      visibleColumnRange: input.rightVisibleColumnRange,
    }),
  }
}
