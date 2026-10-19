import { normalizeViewportRange, type DataGridViewportRange } from "../rowModel.js"

export interface DataSourceViewportCoverage {
  readonly hitRows: number
  readonly missRows: number
  readonly hitRatio: number
  readonly blankViewportActive: boolean
}

export interface DataSourceViewportLoading {
  readonly viewportRowCount: number
  readonly viewportLoadedRowCount: number
  readonly viewportLoadingRowCount: number
  readonly viewportLoadingRowRatio: number
}

export function measureDataSourceViewportLoading(
  viewportRange: DataGridViewportRange,
  visibleRowCount: number,
  toSourceIndex: (visibleIndex: number) => number,
  hasRow: (sourceIndex: number) => boolean,
): DataSourceViewportLoading {
  if (visibleRowCount <= 0) {
    return {
      viewportRowCount: 0,
      viewportLoadedRowCount: 0,
      viewportLoadingRowCount: 0,
      viewportLoadingRowRatio: 0,
    }
  }
  const normalized = normalizeViewportRange(viewportRange, visibleRowCount)
  let loadedRows = 0
  let loadingRows = 0
  for (let index = normalized.start; index <= normalized.end; index += 1) {
    if (hasRow(toSourceIndex(index))) {
      loadedRows += 1
    } else {
      loadingRows += 1
    }
  }
  const viewportRows = loadedRows + loadingRows
  return {
    viewportRowCount: viewportRows,
    viewportLoadedRowCount: loadedRows,
    viewportLoadingRowCount: loadingRows,
    viewportLoadingRowRatio: viewportRows > 0 ? loadingRows / viewportRows : 0,
  }
}

export function countCoveredRowsForward(
  startIndex: number,
  upperBound: number,
  isIndexCached: (index: number) => boolean,
): number {
  if (startIndex > upperBound) {
    return 0
  }
  let covered = 0
  for (let index = startIndex; index <= upperBound; index += 1) {
    if (!isIndexCached(index)) {
      break
    }
    covered += 1
  }
  return covered
}

export function countCoveredRowsBackward(
  startIndex: number,
  lowerBound: number,
  isIndexCached: (index: number) => boolean,
): number {
  if (startIndex < lowerBound) {
    return 0
  }
  let covered = 0
  for (let index = startIndex; index >= lowerBound; index -= 1) {
    if (!isIndexCached(index)) {
      break
    }
    covered += 1
  }
  return covered
}

export function measureDataSourceViewportCoverage(
  sourceViewport: DataGridViewportRange,
  rowCount: number,
  isIndexCached: (index: number) => boolean,
): DataSourceViewportCoverage {
  const bounded = normalizeViewportRange(sourceViewport, rowCount)
  let hitRows = 0
  let missRows = 0
  for (let index = bounded.start; index <= bounded.end; index += 1) {
    if (isIndexCached(index)) {
      hitRows += 1
    } else {
      missRows += 1
    }
  }
  const viewportRows = hitRows + missRows
  return {
    hitRows,
    missRows,
    hitRatio: viewportRows > 0 ? hitRows / viewportRows : 1,
    blankViewportActive: viewportRows > 0 && hitRows === 0,
  }
}
