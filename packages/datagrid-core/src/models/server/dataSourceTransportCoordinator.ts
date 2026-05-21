import type { DataGridViewportRange } from "../rowModel.js"
import type {
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
  DataGridDataSourceTreePullContext,
} from "./dataSourceProtocol.js"
import type { DataGridRangeCacheLoadToken } from "./rangeCache.js"

export interface DataGridDataSourceInFlightPull {
  requestId: number
  controller: AbortController
  key: string
  stateKey: string
  range: DataGridViewportRange
  promise: Promise<void>
  priority: DataGridDataSourcePullPriority
  reason: DataGridDataSourcePullReason
  affectsLoading: boolean
  rangeCacheToken: DataGridRangeCacheLoadToken
}

export interface DataGridDataSourcePendingPull {
  range: DataGridViewportRange
  reason: DataGridDataSourcePullReason
  priority: DataGridDataSourcePullPriority
  key: string
  stateKey: string
  treeData: DataGridDataSourceTreePullContext | null
}

export interface DataGridDataSourcePullRangeOptions {
  replaceCacheOnSuccess?: boolean
  affectsLoading?: boolean
}

export function isAbortError(error: unknown): boolean {
  if (!error) {
    return false
  }
  const named = error as { name?: unknown }
  return named.name === "AbortError"
}

export function normalizeRequestedRange(range: DataGridViewportRange): DataGridViewportRange {
  const start = Number.isFinite(range.start) ? Math.max(0, Math.trunc(range.start)) : 0
  const endCandidate = Number.isFinite(range.end) ? Math.max(0, Math.trunc(range.end)) : start
  return {
    start,
    end: Math.max(start, endCandidate),
  }
}

export function rangesOverlap(left: DataGridViewportRange, right: DataGridViewportRange): boolean {
  return left.start <= right.end && right.start <= left.end
}

export function rangeContains(container: DataGridViewportRange, target: DataGridViewportRange): boolean {
  return container.start <= target.start && container.end >= target.end
}

export function intersectRanges(left: DataGridViewportRange, right: DataGridViewportRange): DataGridViewportRange | null {
  const start = Math.max(left.start, right.start)
  const end = Math.min(left.end, right.end)
  return start <= end ? { start, end } : null
}

export function serializePullState(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

export function resolvePriorityRank(priority: DataGridDataSourcePullPriority): number {
  switch (priority) {
    case "critical":
      return 3
    case "normal":
      return 2
    case "background":
      return 1
    default:
      return 0
  }
}

export function normalizeTreePullContext(
  treeData: DataGridDataSourceTreePullContext | null | undefined,
): DataGridDataSourceTreePullContext | null {
  if (!treeData) {
    return null
  }
  const seenGroupKeys = new Set<string>()
  const groupKeys: string[] = []
  for (const rawGroupKey of treeData.groupKeys ?? []) {
    if (typeof rawGroupKey !== "string") {
      continue
    }
    const normalizedGroupKey = rawGroupKey.trim()
    if (normalizedGroupKey.length === 0 || seenGroupKeys.has(normalizedGroupKey)) {
      continue
    }
    seenGroupKeys.add(normalizedGroupKey)
    groupKeys.push(normalizedGroupKey)
  }
  return {
    operation: treeData.operation,
    scope: treeData.scope,
    groupKeys,
  }
}
