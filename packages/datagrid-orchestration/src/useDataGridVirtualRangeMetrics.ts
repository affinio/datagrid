export interface DataGridVirtualRange {
  start: number
  end: number
}

export interface UseDataGridVirtualRangeMetricsOptions {
  totalRows: number
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  overscan: number
}

export interface DataGridVirtualRangeMetricsSnapshot {
  virtualRange: DataGridVirtualRange
  spacerTopHeight: number
  spacerBottomHeight: number
  rangeLabel: string
}

export function computeDataGridVirtualRange(
  options: UseDataGridVirtualRangeMetricsOptions,
): DataGridVirtualRange {
  const total = options.totalRows
  if (total === 0) {
    return { start: 0, end: -1 }
  }
  const visible = Math.max(1, Math.ceil(options.viewportHeight / options.rowHeight) + options.overscan * 2)
  const start = Math.max(0, Math.floor(options.scrollTop / options.rowHeight) - options.overscan)
  const end = Math.min(total - 1, start + visible - 1)
  return { start, end }
}

export function useDataGridVirtualRangeMetrics(
  options: UseDataGridVirtualRangeMetricsOptions,
): DataGridVirtualRangeMetricsSnapshot {
  const virtualRange = computeDataGridVirtualRange(options)
  const spacerTopHeight = Math.max(0, virtualRange.start * options.rowHeight)
  const spacerBottomHeight = options.totalRows === 0 || virtualRange.end < virtualRange.start
    ? 0
    : Math.max(0, (options.totalRows - (virtualRange.end + 1)) * options.rowHeight)
  const rangeLabel = options.totalRows === 0 || virtualRange.end < virtualRange.start
    ? "0-0"
    : `${virtualRange.start + 1}-${virtualRange.end + 1}`

  return {
    virtualRange,
    spacerTopHeight,
    spacerBottomHeight,
    rangeLabel,
  }
}
