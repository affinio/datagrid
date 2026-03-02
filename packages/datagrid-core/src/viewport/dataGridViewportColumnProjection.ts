import type { DataGridColumn } from "../types"
import type { AxisVirtualizerState } from "../virtualization/axisVirtualizer"
import {
  updateColumnSnapshot,
  type ColumnMetric,
  type ColumnVirtualizationSnapshot,
} from "../virtualization/columnSnapshot"
import type { HorizontalVirtualizerPayload } from "../virtualization/horizontalVirtualizer"
import type { DataGridViewportDerivedColumnSignals } from "./dataGridViewportSignals"
import type { DataGridViewportHorizontalMeta } from "./dataGridViewportHorizontalMeta"

interface ApplyColumnProjectionParams {
  meta: DataGridViewportHorizontalMeta
  start: number
  end: number
  payload: HorizontalVirtualizerPayload
  columnSnapshot: ColumnVirtualizationSnapshot<DataGridColumn>
  columnSignals: DataGridViewportDerivedColumnSignals
  horizontalState: AxisVirtualizerState<HorizontalVirtualizerPayload>
  getColumnKey: (column: DataGridColumn) => string
  resolveColumnWidth: (column: DataGridColumn, zoom: number) => number
  onUpdatePinnedOffsets: () => void
}

function columnsChanged(
  current: readonly DataGridColumn[],
  next: readonly ColumnMetric<DataGridColumn>[],
): boolean {
  if (current.length !== next.length) {
    return true
  }
  for (let index = 0; index < next.length; index += 1) {
    if (current[index] !== next[index]?.column) {
      return true
    }
  }
  return false
}

function entriesChanged<T>(
  current: readonly T[],
  next: readonly T[],
): boolean {
  if (current.length !== next.length) {
    return true
  }
  for (let index = 0; index < next.length; index += 1) {
    if (current[index] !== next[index]) {
      return true
    }
  }
  return false
}

export function applyColumnProjection(params: ApplyColumnProjectionParams): void {
  const {
    meta,
    start,
    end,
    payload,
    columnSnapshot,
    columnSignals,
    horizontalState,
    getColumnKey,
    resolveColumnWidth,
    onUpdatePinnedOffsets,
  } = params

  const previousMetaVersion = columnSnapshot.metaVersion
  const previousScrollableStart = columnSnapshot.scrollableStart
  const previousScrollableEnd = columnSnapshot.scrollableEnd
  const previousVisibleStart = columnSnapshot.visibleStart
  const previousVisibleEnd = columnSnapshot.visibleEnd

  columnSnapshot.columnWidthMap = columnSignals.columnWidthMap.value
  const { visibleStartIndex, visibleEndIndex } = updateColumnSnapshot({
    snapshot: columnSnapshot,
    meta: {
      scrollableColumns: meta.scrollableColumns,
      scrollableIndices: meta.scrollableIndices,
      metrics: meta.metrics,
      pinnedLeft: meta.pinnedLeft,
      pinnedRight: meta.pinnedRight,
      pinnedLeftWidth: meta.pinnedLeftWidth,
      pinnedRightWidth: meta.pinnedRightWidth,
      containerWidthForColumns: meta.containerWidthForColumns,
      indexColumnWidth: meta.indexColumnWidth,
      scrollDirection: meta.scrollDirection,
      version: meta.version,
      zoom: meta.zoom,
    },
    range: { start, end },
    payload,
    getColumnKey,
    resolveColumnWidth,
  })

  const layoutProjectionChanged = columnSnapshot.metaVersion !== previousMetaVersion
  const rangeProjectionChanged =
    columnSnapshot.scrollableStart !== previousScrollableStart ||
    columnSnapshot.scrollableEnd !== previousScrollableEnd ||
    columnSnapshot.visibleStart !== previousVisibleStart ||
    columnSnapshot.visibleEnd !== previousVisibleEnd

  if (layoutProjectionChanged || rangeProjectionChanged) {
    const visibleColumnsSnapshot = columnSnapshot.visibleColumns
    if (columnsChanged(columnSignals.visibleColumns.value, visibleColumnsSnapshot)) {
      columnSignals.visibleColumns.value = visibleColumnsSnapshot.map(entry => entry.column)
    }
    if (entriesChanged(columnSignals.visibleColumnEntries.value, visibleColumnsSnapshot)) {
      columnSignals.visibleColumnEntries.value = visibleColumnsSnapshot.slice()
    }

    const visibleScrollableSnapshot = columnSnapshot.visibleScrollable
    if (columnsChanged(columnSignals.visibleScrollableColumns.value, visibleScrollableSnapshot)) {
      columnSignals.visibleScrollableColumns.value = visibleScrollableSnapshot.map(entry => entry.column)
    }
    if (entriesChanged(columnSignals.visibleScrollableEntries.value, visibleScrollableSnapshot)) {
      columnSignals.visibleScrollableEntries.value = visibleScrollableSnapshot.slice()
    }
  }

  if (layoutProjectionChanged) {
    const pinnedLeftSnapshot = columnSnapshot.pinnedLeft
    if (columnsChanged(columnSignals.pinnedLeftColumns.value, pinnedLeftSnapshot)) {
      columnSignals.pinnedLeftColumns.value = pinnedLeftSnapshot.map(entry => entry.column)
    }
    if (entriesChanged(columnSignals.pinnedLeftEntries.value, pinnedLeftSnapshot)) {
      columnSignals.pinnedLeftEntries.value = pinnedLeftSnapshot.slice()
    }

    const pinnedRightSnapshot = columnSnapshot.pinnedRight
    if (columnsChanged(columnSignals.pinnedRightColumns.value, pinnedRightSnapshot)) {
      columnSignals.pinnedRightColumns.value = pinnedRightSnapshot.map(entry => entry.column)
    }
    if (entriesChanged(columnSignals.pinnedRightEntries.value, pinnedRightSnapshot)) {
      columnSignals.pinnedRightEntries.value = pinnedRightSnapshot.slice()
    }
  }

  columnSignals.leftPadding.value = payload.leftPadding
  columnSignals.rightPadding.value = payload.rightPadding
  if (columnSignals.columnWidthMap.value !== columnSnapshot.columnWidthMap) {
    columnSignals.columnWidthMap.value = columnSnapshot.columnWidthMap
  }

  columnSignals.visibleStartCol.value = visibleStartIndex
  columnSignals.visibleEndCol.value = visibleEndIndex
  columnSignals.scrollableRange.value = { start, end }

  const nextColumnState = {
    ...columnSignals.columnVirtualState.value,
    start,
    end,
    visibleStart: payload.visibleStart,
    visibleEnd: payload.visibleEnd,
    overscanLeading: horizontalState.overscanLeading,
    overscanTrailing: horizontalState.overscanTrailing,
    poolSize: horizontalState.poolSize,
    visibleCount: horizontalState.visibleCount,
    totalCount: meta.scrollableColumns.length,
    indexColumnWidth: meta.indexColumnWidth,
    pinnedRightWidth: meta.pinnedRightWidth,
  }
  columnSignals.columnVirtualState.value = nextColumnState

  onUpdatePinnedOffsets()
}
