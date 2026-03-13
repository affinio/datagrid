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
import {
  resolveDataGridAbsolutePointerX,
  resolveDataGridColumnIndexByAbsoluteX,
  resolveDataGridPinnedWidths,
  resolveDataGridPointerColumnCount,
  resolveDataGridPointerRowCount,
  resolveDataGridRowIndexFromPointer,
  type DataGridPointerViewportSnapshot,
} from "../internal/dataGridPointerCellMath"

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
    return resolveDataGridPointerRowCount(options.resolveVirtualWindow())
  }

  function resolveColumnCountFromWindow(metricsLength: number): number {
    return resolveDataGridPointerColumnCount(metricsLength, options.resolveVirtualWindow())
  }

  function resolveColumnIndexByAbsoluteX(absoluteX: number): number {
    const metrics = options.resolveColumnMetrics()
    const columnCount = resolveColumnCountFromWindow(metrics.length)
    return resolveDataGridColumnIndexByAbsoluteX(metrics, columnCount, absoluteX)
  }

  function resolveCellCoordFromPointer(clientX: number, clientY: number): TCoord | null {
    const viewport = options.resolveViewportElement()
    const rowCount = resolveRowCount()
    if (!viewport || rowCount === 0) {
      return null
    }

    const rect = viewport.getBoundingClientRect()
    const viewportSnapshot: DataGridPointerViewportSnapshot = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      scrollTop: viewport.scrollTop,
      scrollLeft: viewport.scrollLeft,
    }
    if (viewportSnapshot.width <= 0 || viewportSnapshot.height <= 0) {
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

    const columns = options.resolveColumns()
    const pinnedWidths = resolveDataGridPinnedWidths(metrics, columns)
    const rowRawIndex = resolveDataGridRowIndexFromPointer(
      viewportSnapshot,
      clientY,
      options.resolveHeaderHeight(),
      options.resolveRowHeight(),
      options.resolveRowIndexAtOffset,
    )
    const absoluteX = resolveDataGridAbsolutePointerX(
      viewportSnapshot,
      totalWidth,
      pinnedWidths,
      clientX,
    )

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
