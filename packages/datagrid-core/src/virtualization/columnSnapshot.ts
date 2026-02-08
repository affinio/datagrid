import type { ColumnPinMode } from "./types"
import type { ColumnWidthMetrics } from "./columnSizing"

export interface ColumnMetric<TColumn> {
  column: TColumn
  index: number
  width: number
  pin: ColumnPinMode
  scrollableIndex?: number
  poolIndex?: number
  offset?: number
}

export interface ColumnVirtualizationSnapshot<TColumn> {
  pinnedLeft: ColumnMetric<TColumn>[]
  pinnedRight: ColumnMetric<TColumn>[]
  visibleScrollable: ColumnMetric<TColumn>[]
  visibleColumns: ColumnMetric<TColumn>[]
  columnWidthMap: Map<string, number>
  leftPadding: number
  rightPadding: number
  totalScrollableWidth: number
  visibleScrollableWidth: number
  scrollableStart: number
  scrollableEnd: number
  visibleStart: number
  visibleEnd: number
  pinnedLeftWidth: number
  pinnedRightWidth: number
  metrics: ColumnWidthMetrics
  containerWidthForColumns: number
  indexColumnWidth: number
  scrollDirection: number
  metaVersion: number
}

export function createEmptyColumnSnapshot<TColumn = unknown>(): ColumnVirtualizationSnapshot<TColumn> {
  return {
    pinnedLeft: [],
    pinnedRight: [],
    visibleScrollable: [],
    visibleColumns: [],
    columnWidthMap: new Map<string, number>(),
    leftPadding: 0,
    rightPadding: 0,
    totalScrollableWidth: 0,
    visibleScrollableWidth: 0,
    scrollableStart: 0,
    scrollableEnd: 0,
    visibleStart: 0,
    visibleEnd: 0,
    pinnedLeftWidth: 0,
    pinnedRightWidth: 0,
    metrics: { widths: [], offsets: [], totalWidth: 0 },
    containerWidthForColumns: 0,
    indexColumnWidth: 0,
    scrollDirection: 0,
    metaVersion: -1,
  }
}

export interface ColumnSnapshotMeta<TColumn> {
  scrollableColumns: TColumn[]
  scrollableIndices: number[]
  metrics: ColumnWidthMetrics
  pinnedLeft: ColumnMetric<TColumn>[]
  pinnedRight: ColumnMetric<TColumn>[]
  pinnedLeftWidth: number
  pinnedRightWidth: number
  containerWidthForColumns: number
  indexColumnWidth: number
  scrollDirection: number
  version: number
  zoom: number
}

export interface ColumnSnapshotPayload {
  visibleStart: number
  visibleEnd: number
  leftPadding: number
  rightPadding: number
  totalScrollableWidth: number
  visibleScrollableWidth: number
}

export interface UpdateColumnSnapshotOptions<TColumn> {
  snapshot: ColumnVirtualizationSnapshot<TColumn>
  meta: ColumnSnapshotMeta<TColumn>
  range: { start: number; end: number }
  payload: ColumnSnapshotPayload
  getColumnKey: (column: TColumn) => string
  resolveColumnWidth: (column: TColumn, zoom: number) => number
}

export interface UpdateColumnSnapshotResult {
  visibleStartIndex: number
  visibleEndIndex: number
}

export function updateColumnSnapshot<TColumn>(
  options: UpdateColumnSnapshotOptions<TColumn>,
): UpdateColumnSnapshotResult {
  const { snapshot, meta, range, payload, getColumnKey, resolveColumnWidth } = options
  const layoutChanged = snapshot.metaVersion !== meta.version
  const { start, end } = range
  const visibleScrollableEntries = snapshot.visibleScrollable
  const visibleColumnsEntries = snapshot.visibleColumns
  const scrollableCount = Math.max(0, end - start)

  if (visibleScrollableEntries.length > scrollableCount) {
    visibleScrollableEntries.length = scrollableCount
  }

  for (let localIndex = 0; localIndex < scrollableCount; localIndex += 1) {
    const idx = start + localIndex
    const column = meta.scrollableColumns[idx]
    if (!column) continue
    const widthValue = meta.metrics.widths[idx] ?? resolveColumnWidth(column, meta.zoom)
    const metric = visibleScrollableEntries[localIndex]
    const columnIndex = meta.scrollableIndices[idx] ?? idx
    if (metric) {
      metric.column = column
      metric.index = columnIndex
      metric.width = widthValue
      metric.pin = "none"
      metric.scrollableIndex = idx
      metric.poolIndex = localIndex
      metric.offset = meta.metrics.offsets[idx] ?? metric.offset ?? 0
    } else {
      visibleScrollableEntries[localIndex] = {
        column,
        index: columnIndex,
        width: widthValue,
        pin: "none",
        scrollableIndex: idx,
        poolIndex: localIndex,
        offset: meta.metrics.offsets[idx] ?? 0,
      }
    }
  }
  visibleScrollableEntries.length = scrollableCount

  if (layoutChanged) {
    const columnWidthMap = snapshot.columnWidthMap
    if (columnWidthMap.size) {
      columnWidthMap.clear()
    }
    meta.pinnedLeft.forEach(metric => {
      columnWidthMap.set(getColumnKey(metric.column), metric.width)
    })
    meta.pinnedRight.forEach(metric => {
      columnWidthMap.set(getColumnKey(metric.column), metric.width)
    })
    meta.scrollableColumns.forEach((column, idx) => {
      const widthValue = meta.metrics.widths[idx] ?? resolveColumnWidth(column, meta.zoom)
      columnWidthMap.set(getColumnKey(column), widthValue)
    })
  }

  const pinnedLeftEntries = snapshot.pinnedLeft
  const pinnedRightEntries = snapshot.pinnedRight
  if (layoutChanged) {
    pinnedLeftEntries.length = 0
    pinnedRightEntries.length = 0
    pinnedLeftEntries.push(...meta.pinnedLeft)
    pinnedRightEntries.push(...meta.pinnedRight)
  }

  visibleColumnsEntries.length = 0
  let visibleStartIndex = Number.POSITIVE_INFINITY
  let visibleEndIndex = -1
  const trackVisibleIndex = (index: number) => {
    if (index < visibleStartIndex) {
      visibleStartIndex = index
    }
    if (index > visibleEndIndex) {
      visibleEndIndex = index
    }
  }
  if (pinnedLeftEntries.length) {
    for (let index = 0; index < pinnedLeftEntries.length; index += 1) {
      const entry = pinnedLeftEntries[index]
      if (!entry) {
        continue
      }
      visibleColumnsEntries.push(entry)
      trackVisibleIndex(entry.index)
    }
  }
  if (visibleScrollableEntries.length) {
    for (let index = 0; index < visibleScrollableEntries.length; index += 1) {
      const entry = visibleScrollableEntries[index]
      if (!entry) {
        continue
      }
      visibleColumnsEntries.push(entry)
      trackVisibleIndex(entry.index)
    }
  }
  if (pinnedRightEntries.length) {
    for (let index = 0; index < pinnedRightEntries.length; index += 1) {
      const entry = pinnedRightEntries[index]
      if (!entry) {
        continue
      }
      visibleColumnsEntries.push(entry)
      trackVisibleIndex(entry.index)
    }
  }

  if (!Number.isFinite(visibleStartIndex) || visibleEndIndex < 0) {
    visibleStartIndex = 0
    visibleEndIndex = -1
  }
  const visibleEndExclusive = visibleEndIndex + 1

  snapshot.leftPadding = payload.leftPadding
  snapshot.rightPadding = payload.rightPadding
  snapshot.totalScrollableWidth = meta.metrics.totalWidth
  snapshot.visibleScrollableWidth = payload.visibleScrollableWidth
  snapshot.scrollableStart = start
  snapshot.scrollableEnd = end
  snapshot.visibleStart = visibleStartIndex
  snapshot.visibleEnd = visibleEndExclusive
  snapshot.pinnedLeftWidth = meta.pinnedLeftWidth
  snapshot.pinnedRightWidth = meta.pinnedRightWidth
  snapshot.metrics = meta.metrics
  snapshot.containerWidthForColumns = meta.containerWidthForColumns
  snapshot.indexColumnWidth = meta.indexColumnWidth
  snapshot.scrollDirection = meta.scrollDirection
  snapshot.metaVersion = meta.version

  return { visibleStartIndex, visibleEndIndex: visibleEndExclusive }
}
