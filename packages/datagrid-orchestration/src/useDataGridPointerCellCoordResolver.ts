export interface DataGridPointerCellCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridPointerColumnMetric {
  columnIndex: number
  start: number
  end: number
  width: number
}

import type { DataGridColumnPin } from "@affino/datagrid-core"

export interface DataGridPointerColumnSnapshot {
  pin?: DataGridColumnPin | null
}

export interface DataGridPointerVirtualWindowSnapshot {
  rowStart?: number
  rowEnd?: number
  rowTotal: number
  colStart?: number
  colEnd?: number
  colTotal: number
  overscan?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  }
}

export interface UseDataGridPointerCellCoordResolverOptions<TCoord extends DataGridPointerCellCoord> {
  resolveViewportElement: () => HTMLElement | null
  resolveColumnMetrics: () => readonly DataGridPointerColumnMetric[]
  resolveColumns: () => readonly DataGridPointerColumnSnapshot[]
  resolveVirtualWindow: () => DataGridPointerVirtualWindowSnapshot | null | undefined
  resolveHeaderHeight: () => number
  resolveRowHeight: () => number
  resolveRowIndexAtOffset?: (offset: number) => number
  resolveNearestNavigableColumnIndex: (columnIndex: number) => number
  normalizeCellCoord: (coord: TCoord) => TCoord | null
}

export interface UseDataGridPointerCellCoordResolverResult<TCoord extends DataGridPointerCellCoord> {
  resolveColumnIndexByAbsoluteX: (absoluteX: number) => number
  resolveCellCoordFromPointer: (clientX: number, clientY: number) => TCoord | null
}

export function useDataGridPointerCellCoordResolver<TCoord extends DataGridPointerCellCoord>(
  options: UseDataGridPointerCellCoordResolverOptions<TCoord>,
): UseDataGridPointerCellCoordResolverResult<TCoord> {
  function resolveRowCount(): number {
    const snapshot = options.resolveVirtualWindow()
    return Math.max(0, Math.trunc(snapshot?.rowTotal ?? 0))
  }

  function resolveColumnCountFromWindow(metricsLength: number): number {
    const snapshot = options.resolveVirtualWindow()
    if (!snapshot) {
      return 0
    }
    return Math.max(0, Math.min(metricsLength, Math.trunc(snapshot.colTotal)))
  }

  function resolveColumnIndexByAbsoluteX(absoluteX: number): number {
    const metrics = options.resolveColumnMetrics()
    const lastMetric = metrics[metrics.length - 1]
    if (!lastMetric) {
      return -1
    }
    const columnCount = resolveColumnCountFromWindow(metrics.length)
    if (columnCount <= 0) {
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

  function resolveCellCoordFromPointer(clientX: number, clientY: number): TCoord | null {
    const viewport = options.resolveViewportElement()
    const rowCount = resolveRowCount()
    if (!viewport || rowCount === 0) {
      return null
    }

    const rect = viewport.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }

    const metrics = options.resolveColumnMetrics()
    const lastMetric = metrics[metrics.length - 1]
    if (!lastMetric) {
      return null
    }
    const totalWidth = lastMetric.end
    if (totalWidth <= 0) {
      return null
    }

    let leftPinnedWidth = 0
    let rightPinnedWidth = 0
    const columns = options.resolveColumns()
    for (const metric of metrics) {
      const column = columns[metric.columnIndex]
      if (column?.pin === "left") {
        leftPinnedWidth = metric.end
      } else if (column?.pin === "right") {
        rightPinnedWidth += metric.width
      }
    }

    const pointerXInViewport = clientX - rect.left
    const pointerYInViewport = clientY - rect.top
    const clampedY = Math.max(0, Math.min(rect.height - 1, pointerYInViewport))
    const rowOffset = viewport.scrollTop + clampedY - options.resolveHeaderHeight()
    const rowRawIndex = options.resolveRowIndexAtOffset
      ? options.resolveRowIndexAtOffset(rowOffset)
      : Math.floor(rowOffset / options.resolveRowHeight())

    let absoluteX: number
    if (pointerXInViewport <= leftPinnedWidth) {
      absoluteX = pointerXInViewport
    } else if (rightPinnedWidth > 0 && pointerXInViewport >= rect.width - rightPinnedWidth) {
      absoluteX = totalWidth - rightPinnedWidth + (pointerXInViewport - (rect.width - rightPinnedWidth))
    } else {
      absoluteX = viewport.scrollLeft + pointerXInViewport
    }

    const columnRawIndex = resolveColumnIndexByAbsoluteX(absoluteX)
    if (columnRawIndex < 0) {
      return null
    }
    const columnIndex = options.resolveNearestNavigableColumnIndex(columnRawIndex)
    if (columnIndex < 0) {
      return null
    }

    const normalized = options.normalizeCellCoord({
      rowIndex: rowRawIndex,
      columnIndex,
    } as TCoord)
    if (!normalized) {
      return null
    }
    if (normalized.rowIndex < 0 || normalized.rowIndex >= rowCount) {
      return null
    }
    return normalized
  }

  return {
    resolveColumnIndexByAbsoluteX,
    resolveCellCoordFromPointer,
  }
}
