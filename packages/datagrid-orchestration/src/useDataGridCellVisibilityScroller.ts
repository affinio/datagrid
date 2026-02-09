export interface DataGridCellVisibilityCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridCellVisibilityColumnMetric {
  start: number
  end: number
}

export interface DataGridCellVisibilityScrollPosition {
  top: number
  left: number
}

export interface UseDataGridCellVisibilityScrollerOptions<
  TCoord extends DataGridCellVisibilityCoord,
  TMetric extends DataGridCellVisibilityColumnMetric = DataGridCellVisibilityColumnMetric,
> {
  resolveViewportElement: () => HTMLElement | null
  resolveColumnMetric: (columnIndex: number) => TMetric | null | undefined
  resolveHeaderHeight: () => number
  resolveRowHeight: () => number
  setScrollPosition: (position: DataGridCellVisibilityScrollPosition) => void
}

export interface UseDataGridCellVisibilityScrollerResult<
  TCoord extends DataGridCellVisibilityCoord,
> {
  ensureCellVisible: (coord: TCoord) => void
}

export function useDataGridCellVisibilityScroller<
  TCoord extends DataGridCellVisibilityCoord,
  TMetric extends DataGridCellVisibilityColumnMetric = DataGridCellVisibilityColumnMetric,
>(
  options: UseDataGridCellVisibilityScrollerOptions<TCoord, TMetric>,
): UseDataGridCellVisibilityScrollerResult<TCoord> {
  function ensureCellVisible(coord: TCoord) {
    const viewport = options.resolveViewportElement()
    const columnMetric = options.resolveColumnMetric(coord.columnIndex)
    if (!viewport || !columnMetric) {
      return
    }

    const headerHeight = options.resolveHeaderHeight()
    const rowHeight = options.resolveRowHeight()
    const rowTop = headerHeight + coord.rowIndex * rowHeight
    const rowBottom = rowTop + rowHeight
    const visibleTop = viewport.scrollTop + headerHeight
    const visibleBottom = viewport.scrollTop + viewport.clientHeight

    if (rowTop < visibleTop) {
      viewport.scrollTop = Math.max(0, rowTop - headerHeight)
    } else if (rowBottom > visibleBottom) {
      viewport.scrollTop = Math.max(0, rowBottom - viewport.clientHeight)
    }

    if (columnMetric.start < viewport.scrollLeft) {
      viewport.scrollLeft = Math.max(0, columnMetric.start)
    } else if (columnMetric.end > viewport.scrollLeft + viewport.clientWidth) {
      viewport.scrollLeft = Math.max(0, columnMetric.end - viewport.clientWidth)
    }

    options.setScrollPosition({
      top: viewport.scrollTop,
      left: viewport.scrollLeft,
    })
  }

  return {
    ensureCellVisible,
  }
}
