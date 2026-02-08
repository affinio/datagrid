import type { ColumnPinMode } from "./types"
import { resolveColumnWidth } from "./columnSizing"

export interface LayoutColumnLike {
  key: string
  width?: number | null
  minWidth?: number | null
  maxWidth?: number | null
}

export interface ColumnLayoutMetric<TColumn> {
  column: TColumn
  index: number
  width: number
  pin: ColumnPinMode
  offset: number
}

export interface ColumnLayoutInput<TColumn extends LayoutColumnLike> {
  columns: readonly TColumn[]
  zoom: number
  resolvePinMode: (column: TColumn) => ColumnPinMode
}

export interface ColumnLayoutOutput<TColumn extends LayoutColumnLike> {
  zoom: number
  pinnedLeft: ColumnLayoutMetric<TColumn>[]
  pinnedRight: ColumnLayoutMetric<TColumn>[]
  pinnedLeftWidth: number
  pinnedRightWidth: number
  scrollableColumns: TColumn[]
  scrollableIndices: number[]
  scrollableMetrics: {
    widths: number[]
    offsets: number[]
    totalWidth: number
  }
}

interface ColumnLayoutCacheEntry {
  columns: readonly LayoutColumnLike[]
  zoom: number
  resolvePinMode: unknown
  output: ColumnLayoutOutput<LayoutColumnLike>
}

const columnLayoutCache: Array<ColumnLayoutCacheEntry | null> = [null, null]
let columnLayoutCacheWriteIndex = 0

export function computeColumnLayout<TColumn extends LayoutColumnLike>(
  input: ColumnLayoutInput<TColumn>,
): ColumnLayoutOutput<TColumn> {
  for (let index = 0; index < columnLayoutCache.length; index += 1) {
    const cached = columnLayoutCache[index]
    if (
      cached &&
      cached.columns === input.columns &&
      cached.zoom === input.zoom &&
      cached.resolvePinMode === input.resolvePinMode
    ) {
      return cached.output as ColumnLayoutOutput<TColumn>
    }
  }

  const pinnedLeft: ColumnLayoutMetric<TColumn>[] = []
  const pinnedRight: ColumnLayoutMetric<TColumn>[] = []
  const scrollableColumns: TColumn[] = []
  const scrollableIndices: number[] = []
  const scrollableWidths: number[] = []
  const scrollableOffsets: number[] = []

  let accumulatedWidth = 0
  let pinnedLeftCursor = 0
  let pinnedRightCursor = 0
  const pinnedRightBuffer: ColumnLayoutMetric<TColumn>[] = []

  input.columns.forEach((column, index) => {
    const pin = input.resolvePinMode(column)
    const width = resolveColumnWidth(column, input.zoom)
    const metric: ColumnLayoutMetric<TColumn> = { column, index, width, pin, offset: 0 }

    if (pin === "left") {
      metric.offset = pinnedLeftCursor
      pinnedLeftCursor += width
      pinnedLeft.push(metric)
      return
    }
    if (pin === "right") {
      pinnedRightBuffer.push(metric)
      return
    }

    scrollableColumns.push(column)
    scrollableIndices.push(index)
    scrollableOffsets.push(accumulatedWidth)
    scrollableWidths.push(width)
    accumulatedWidth += width
  })

  if (pinnedRightBuffer.length) {
    for (let index = pinnedRightBuffer.length - 1; index >= 0; index -= 1) {
      const metric = pinnedRightBuffer[index]
      if (!metric) {
        continue
      }
      metric.offset = pinnedRightCursor
      pinnedRightCursor += metric.width
      pinnedRight.unshift(metric)
    }
  }

  const scrollableMetrics = {
    widths: scrollableWidths,
    offsets: scrollableOffsets,
    totalWidth: accumulatedWidth,
  }

  const pinnedLeftWidth = pinnedLeft.reduce((sum, metric) => sum + metric.width, 0)
  const pinnedRightWidth = pinnedRight.reduce((sum, metric) => sum + metric.width, 0)

  const output: ColumnLayoutOutput<TColumn> = {
    zoom: input.zoom,
    pinnedLeft,
    pinnedRight,
    pinnedLeftWidth,
    pinnedRightWidth,
    scrollableColumns,
    scrollableIndices,
    scrollableMetrics,
  }

  columnLayoutCache[columnLayoutCacheWriteIndex] = {
    columns: input.columns,
    zoom: input.zoom,
    resolvePinMode: input.resolvePinMode,
    output: output as unknown as ColumnLayoutOutput<LayoutColumnLike>,
  }
  columnLayoutCacheWriteIndex = (columnLayoutCacheWriteIndex + 1) % columnLayoutCache.length

  return output
}
