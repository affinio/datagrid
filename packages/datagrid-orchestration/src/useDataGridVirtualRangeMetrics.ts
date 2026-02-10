export interface DataGridVirtualRange {
  start: number
  end: number
}

export interface DataGridVirtualWindowRowSnapshot {
  rowStart: number
  rowEnd: number
  rowTotal: number
}

export interface UseDataGridVirtualRangeMetricsScrollOptions {
  totalRows: number
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  overscan: number
}

export interface UseDataGridVirtualRangeMetricsWindowOptions {
  virtualWindow: DataGridVirtualWindowRowSnapshot
  rowHeight: number
}

export type UseDataGridVirtualRangeMetricsOptions =
  | UseDataGridVirtualRangeMetricsScrollOptions
  | UseDataGridVirtualRangeMetricsWindowOptions

export interface DataGridVirtualRangeMetricsSnapshot {
  virtualRange: DataGridVirtualRange
  spacerTopHeight: number
  spacerBottomHeight: number
  rangeLabel: string
}

function hasVirtualWindow(
  options: UseDataGridVirtualRangeMetricsOptions,
): options is UseDataGridVirtualRangeMetricsWindowOptions {
  return "virtualWindow" in options && Boolean(options.virtualWindow)
}

export function computeDataGridVirtualRange(
  options: UseDataGridVirtualRangeMetricsOptions,
): DataGridVirtualRange {
  if (hasVirtualWindow(options)) {
    const total = Math.max(0, Math.trunc(options.virtualWindow.rowTotal))
    if (total === 0) {
      return { start: 0, end: -1 }
    }
    const start = Math.max(0, Math.min(total - 1, Math.trunc(options.virtualWindow.rowStart)))
    const end = Math.max(start, Math.min(total - 1, Math.trunc(options.virtualWindow.rowEnd)))
    return { start, end }
  }

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
  const totalRows = hasVirtualWindow(options)
    ? Math.max(0, Math.trunc(options.virtualWindow.rowTotal))
    : options.totalRows
  const spacerTopHeight = Math.max(0, virtualRange.start * options.rowHeight)
  const spacerBottomHeight = totalRows === 0 || virtualRange.end < virtualRange.start
    ? 0
    : Math.max(0, (totalRows - (virtualRange.end + 1)) * options.rowHeight)
  const rangeLabel = totalRows === 0 || virtualRange.end < virtualRange.start
    ? "0-0"
    : `${virtualRange.start + 1}-${virtualRange.end + 1}`

  return {
    virtualRange,
    spacerTopHeight,
    spacerBottomHeight,
    rangeLabel,
  }
}
