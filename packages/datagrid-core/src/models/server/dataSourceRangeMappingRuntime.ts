import {
  buildPaginationSnapshot,
  normalizeViewportRange,
  type DataGridPaginationInput,
  type DataGridPaginationSnapshot,
  type DataGridViewportRange,
} from "../rowModel.js"

export function createDataSourceRangeMappingRuntime(options: {
  getRowCount: () => number
  getPaginationInput: () => DataGridPaginationInput
  getLoadedIntervals: (range: DataGridViewportRange) => readonly DataGridViewportRange[]
}) {
  function getPaginationSnapshot(): DataGridPaginationSnapshot {
    return buildPaginationSnapshot(options.getRowCount(), options.getPaginationInput())
  }

  function getVisibleRowCount(): number {
    const pagination = getPaginationSnapshot()
    if (!pagination.enabled) {
      return pagination.totalRowCount
    }
    if (pagination.startIndex < 0 || pagination.endIndex < pagination.startIndex) {
      return 0
    }
    return pagination.endIndex - pagination.startIndex + 1
  }

  function toSourceIndex(index: number): number {
    const pagination = getPaginationSnapshot()
    if (!pagination.enabled || pagination.startIndex < 0) {
      return index
    }
    return pagination.startIndex + index
  }

  function toSourceRange(range: DataGridViewportRange): DataGridViewportRange {
    const visibleCount = getVisibleRowCount()
    if (visibleCount <= 0) {
      return { start: 0, end: 0 }
    }
    const normalized = normalizeViewportRange(range, visibleCount)
    return {
      start: toSourceIndex(normalized.start),
      end: toSourceIndex(normalized.end),
    }
  }

  function toVisibleLoadedIntervals(
    visibleRange: DataGridViewportRange,
    sourceRange: DataGridViewportRange,
  ): DataGridViewportRange[] {
    return options.getLoadedIntervals(sourceRange).map(interval => ({
      start: interval.start - sourceRange.start + visibleRange.start,
      end: interval.end - sourceRange.start + visibleRange.start,
    }))
  }

  return {
    getPaginationSnapshot,
    getVisibleRowCount,
    toSourceIndex,
    toSourceRange,
    toVisibleLoadedIntervals,
  }
}
