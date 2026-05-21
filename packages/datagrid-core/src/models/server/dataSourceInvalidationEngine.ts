import type { DataGridRowId, DataGridViewportRange } from "../rowModel.js"
import { intersectRanges } from "./dataSourceTransportCoordinator.js"

export interface DataGridRowsInvalidationRefresh {
  changed: boolean
  touchedViewport: boolean
  refreshRange: DataGridViewportRange | null
}

export function rangeFromIndexes(indexes: readonly number[]): DataGridViewportRange | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const rawIndex of indexes) {
    if (!Number.isFinite(rawIndex)) {
      continue
    }
    const index = Math.max(0, Math.trunc(rawIndex))
    min = Math.min(min, index)
    max = Math.max(max, index)
  }
  return Number.isFinite(min) && Number.isFinite(max)
    ? { start: min, end: max }
    : null
}

export function resolveVisibleRangeInvalidation(
  invalidatedRange: DataGridViewportRange,
  sourceViewport: DataGridViewportRange,
): DataGridViewportRange | null {
  return intersectRanges(invalidatedRange, sourceViewport)
}

export function resolveRowsInvalidationRefresh(
  rowIds: readonly DataGridRowId[],
  sourceViewport: DataGridViewportRange,
  findCachedIndexByRowId: (rowId: DataGridRowId) => number | null,
): DataGridRowsInvalidationRefresh {
  const touchedViewportIndexes: number[] = []
  let changed = false
  for (const rowId of new Set(rowIds)) {
    if (typeof rowId !== "string" && typeof rowId !== "number") {
      continue
    }
    const index = findCachedIndexByRowId(rowId)
    if (index === null) {
      continue
    }
    changed = true
    if (index >= sourceViewport.start && index <= sourceViewport.end) {
      touchedViewportIndexes.push(index)
    }
  }
  const refreshRange = rangeFromIndexes(touchedViewportIndexes)
  return {
    changed,
    touchedViewport: refreshRange !== null,
    refreshRange,
  }
}
