export interface DataGridAppRowHeightMetricsOptions {
  totalRows: () => number
  resolveBaseRowHeight: () => number
  resolveRowHeightOverride: (rowIndex: number) => number | null
  resolveRowHeightVersion?: () => number
  hasRowHeightOverrides?: () => boolean
}

export interface DataGridAppRowHeightMetrics {
  resolveRowHeight: (rowIndex: number) => number
  resolveRowOffset: (rowIndex: number) => number
  resolveRowIndexAtOffset: (offset: number) => number
  resolveViewportRange: (scrollTop: number, clientHeight: number, overscan: number) => {
    start: number
    end: number
  }
  resolveTotalHeight: () => number
}

interface CachedMetrics {
  totalRows: number
  baseRowHeight: number
  version: number
  prefixOffsets: number[] | null
}

function normalizeRowHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }
  return Math.max(1, Math.trunc(value))
}

export function createDataGridAppRowHeightMetrics(
  options: DataGridAppRowHeightMetricsOptions,
): DataGridAppRowHeightMetrics {
  let cachedMetrics: CachedMetrics | null = null

  const resolveCachedMetrics = (): CachedMetrics => {
    const totalRows = Math.max(0, Math.trunc(options.totalRows()))
    const baseRowHeight = normalizeRowHeight(options.resolveBaseRowHeight())
    const version = options.resolveRowHeightVersion?.() ?? 0
    const hasRowHeightOverrides = options.hasRowHeightOverrides?.() ?? true

    if (
      cachedMetrics
      && cachedMetrics.totalRows === totalRows
      && cachedMetrics.baseRowHeight === baseRowHeight
      && cachedMetrics.version === version
    ) {
      return cachedMetrics
    }

    let prefixOffsets: number[] | null = null
    if (hasRowHeightOverrides) {
      prefixOffsets = new Array<number>(totalRows + 1)
      prefixOffsets[0] = 0
      for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
        const override = options.resolveRowHeightOverride(rowIndex)
        const previousOffset = prefixOffsets[rowIndex] ?? 0
        prefixOffsets[rowIndex + 1] = previousOffset + normalizeRowHeight(override ?? baseRowHeight)
      }
    }

    cachedMetrics = {
      totalRows,
      baseRowHeight,
      version,
      prefixOffsets,
    }
    return cachedMetrics
  }

  const resolveRowHeight = (rowIndex: number): number => {
    const metrics = resolveCachedMetrics()
    if (metrics.totalRows <= 0) {
      return metrics.baseRowHeight
    }
    if (metrics.prefixOffsets == null) {
      return metrics.baseRowHeight
    }
    const normalizedIndex = Math.max(0, Math.min(metrics.totalRows - 1, Math.trunc(rowIndex)))
    const start = metrics.prefixOffsets[normalizedIndex] ?? 0
    const end = metrics.prefixOffsets[normalizedIndex + 1] ?? (start + metrics.baseRowHeight)
    return end - start
  }

  const resolveRowOffset = (rowIndex: number): number => {
    const metrics = resolveCachedMetrics()
    if (metrics.totalRows <= 0) {
      return 0
    }
    const normalizedIndex = Math.max(0, Math.min(metrics.totalRows, Math.trunc(rowIndex)))
    if (metrics.prefixOffsets == null) {
      return normalizedIndex * metrics.baseRowHeight
    }
    return metrics.prefixOffsets[normalizedIndex] ?? 0
  }

  const resolveRowIndexAtOffset = (offset: number): number => {
    const metrics = resolveCachedMetrics()
    if (metrics.totalRows <= 0) {
      return 0
    }
    if (metrics.prefixOffsets == null) {
      const normalizedHeight = Math.max(1, metrics.baseRowHeight)
      return Math.max(
        0,
        Math.min(metrics.totalRows - 1, Math.floor(Math.max(0, offset) / normalizedHeight)),
      )
    }
    const totalHeight = metrics.prefixOffsets[metrics.totalRows] ?? 0
    if (totalHeight <= 0) {
      return 0
    }
    const clampedOffset = Math.max(0, Math.min(totalHeight - 1, offset))
    let low = 0
    let high = metrics.totalRows - 1
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const rowStart = metrics.prefixOffsets[middle] ?? 0
      const rowEnd = metrics.prefixOffsets[middle + 1] ?? totalHeight
      if (clampedOffset < rowStart) {
        high = middle - 1
        continue
      }
      if (clampedOffset >= rowEnd) {
        low = middle + 1
        continue
      }
      return middle
    }
    return Math.max(0, Math.min(metrics.totalRows - 1, low))
  }

  const resolveViewportRange = (scrollTop: number, clientHeight: number, overscan: number) => {
    const metrics = resolveCachedMetrics()
    if (metrics.totalRows <= 0) {
      return { start: 0, end: 0 }
    }
    const normalizedOverscan = Math.max(0, Math.trunc(overscan))
    const start = Math.max(0, resolveRowIndexAtOffset(scrollTop) - normalizedOverscan)
    const visibleBottomOffset = Math.max(0, scrollTop + Math.max(1, clientHeight) - 1)
    const end = Math.min(
      metrics.totalRows - 1,
      resolveRowIndexAtOffset(visibleBottomOffset) + normalizedOverscan,
    )
    return { start, end }
  }

  const resolveTotalHeight = (): number => {
    const metrics = resolveCachedMetrics()
    if (metrics.prefixOffsets == null) {
      return metrics.totalRows * metrics.baseRowHeight
    }
    return metrics.prefixOffsets[metrics.totalRows] ?? 0
  }

  return {
    resolveRowHeight,
    resolveRowOffset,
    resolveRowIndexAtOffset,
    resolveViewportRange,
    resolveTotalHeight,
  }
}
