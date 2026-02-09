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

export interface UseDataGridPointerCellCoordResolverOptions<TCoord extends DataGridPointerCellCoord> {
  resolveViewportElement: () => HTMLElement | null
  resolveRowCount: () => number
  resolveColumnMetrics: () => readonly DataGridPointerColumnMetric[]
  resolveColumns: () => readonly DataGridPointerColumnSnapshot[]
  resolveHeaderHeight: () => number
  resolveRowHeight: () => number
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
  function resolveColumnIndexByAbsoluteX(absoluteX: number): number {
    const metrics = options.resolveColumnMetrics()
    const lastMetric = metrics[metrics.length - 1]
    if (!lastMetric) {
      return -1
    }
    const clampedX = Math.max(0, Math.min(absoluteX, Math.max(0, lastMetric.end - 1)))
    for (const metric of metrics) {
      if (clampedX < metric.end) {
        return metric.columnIndex
      }
    }
    return lastMetric.columnIndex
  }

  function resolveCellCoordFromPointer(clientX: number, clientY: number): TCoord | null {
    const viewport = options.resolveViewportElement()
    if (!viewport || options.resolveRowCount() === 0) {
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
    const rowRawIndex = Math.floor(
      (viewport.scrollTop + clampedY - options.resolveHeaderHeight()) / options.resolveRowHeight(),
    )

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

    return options.normalizeCellCoord({
      rowIndex: rowRawIndex,
      columnIndex,
    } as TCoord)
  }

  return {
    resolveColumnIndexByAbsoluteX,
    resolveCellCoordFromPointer,
  }
}
