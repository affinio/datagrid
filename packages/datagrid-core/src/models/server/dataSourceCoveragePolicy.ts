import { normalizeViewportRange, type DataGridViewportRange } from "../rowModel.js"

export interface DataSourceViewportCoverage {
  readonly hitRows: number
  readonly missRows: number
  readonly hitRatio: number
  readonly blankViewportActive: boolean
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
