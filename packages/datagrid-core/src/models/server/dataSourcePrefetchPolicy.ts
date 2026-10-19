import type { DataGridViewportRange } from "../rowModel.js"
import type { DataGridDataSourceBackpressureDiagnostics, DataGridDataSourcePullReason } from "./dataSourceProtocol.js"

export interface DataSourcePrefetchPolicyOptions {
  enabled: boolean
  triggerViewportFactor: number
  windowViewportFactor: number
  minBatchSize: number
  maxBatchSize: number
  directionalBias: "forward" | "backward" | "symmetric" | "scroll-direction"
}

export interface DataSourcePrefetchCandidate {
  range: DataGridViewportRange
  cachedRows: number
}

export function resolveDataSourcePrefetchCandidate(options: {
  policy: DataSourcePrefetchPolicyOptions
  sourceViewport: DataGridViewportRange
  rowCount: number
  lastViewportDirection: -1 | 0 | 1
  countCachedForward: (startIndex: number, upperBound: number) => number
  countCachedBackward: (startIndex: number, lowerBound: number) => number
}): DataSourcePrefetchCandidate | null {
  const { policy, sourceViewport, rowCount } = options
  if (!policy.enabled || rowCount <= 0) return null
  const viewportSize = Math.max(0, sourceViewport.end - sourceViewport.start + 1)
  if (viewportSize <= 0) return null
  const scaledSize = Math.ceil(viewportSize * policy.windowViewportFactor)
  const batchSize = Math.max(policy.minBatchSize, Math.min(policy.maxBatchSize, Math.max(1, scaledSize)))
  const triggerSize = Math.max(1, Math.ceil(viewportSize * policy.triggerViewportFactor))
  const directions = policy.directionalBias === "forward"
    ? ["forward"] as const
    : policy.directionalBias === "backward"
      ? ["backward"] as const
      : policy.directionalBias === "symmetric"
        ? ["forward", "backward"] as const
        : options.lastViewportDirection < 0
          ? ["backward", "forward"] as const
          : ["forward", "backward"] as const

  let bestCandidate: DataSourcePrefetchCandidate | null = null
  for (const direction of directions) {
    let candidate: DataSourcePrefetchCandidate | null = null
    if (direction === "forward" && sourceViewport.end < rowCount - 1) {
      const cachedRows = options.countCachedForward(sourceViewport.end + 1, rowCount - 1)
      if (cachedRows <= triggerSize) {
        const start = sourceViewport.end + 1 + cachedRows
        if (start < rowCount) {
          candidate = {
            range: { start, end: Math.min(rowCount - 1, start + batchSize - 1) },
            cachedRows,
          }
        }
      }
    } else if (direction === "backward" && sourceViewport.start > 0) {
      const cachedRows = options.countCachedBackward(sourceViewport.start - 1, 0)
      if (cachedRows <= triggerSize) {
        const end = sourceViewport.start - 1 - cachedRows
        if (end >= 0) {
          candidate = {
            range: { start: Math.max(0, end - batchSize + 1), end },
            cachedRows,
          }
        }
      }
    }
    if (candidate && (!bestCandidate || candidate.cachedRows < bestCandidate.cachedRows)) {
      bestCandidate = candidate
    }
    if (policy.directionalBias !== "symmetric") break
  }
  return bestCandidate
}

export function createDataSourcePrefetchRuntime(options: {
  policy: DataSourcePrefetchPolicyOptions
  diagnostics: Pick<
    DataGridDataSourceBackpressureDiagnostics,
    "cachedAheadRows" | "cachedBehindRows" | "prefetchSkippedCached" | "prefetchScheduled"
  >
  isDisposed: () => boolean
  getVisibleRowCount: () => number
  getRowCount: () => number
  getSourceViewport: () => DataGridViewportRange
  getLastViewportDirection: () => -1 | 0 | 1
  updateCoverage: (range: DataGridViewportRange) => void
  countCachedForward: (startIndex: number, upperBound: number) => number
  countCachedBackward: (startIndex: number, lowerBound: number) => number
  isRangeFullyCached: (range: DataGridViewportRange) => boolean
  pullRange: (
    range: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: "background",
  ) => Promise<void>
}) {
  return {
    schedule(): void {
      if (!options.policy.enabled || options.isDisposed()) {
        return
      }
      const visibleCount = options.getVisibleRowCount()
      const rowCount = options.getRowCount()
      if (visibleCount <= 0 || rowCount <= 0) {
        options.diagnostics.cachedAheadRows = 0
        options.diagnostics.cachedBehindRows = 0
        return
      }
      const sourceViewport = options.getSourceViewport()
      options.updateCoverage(sourceViewport)
      const candidate = resolveDataSourcePrefetchCandidate({
        policy: options.policy,
        sourceViewport,
        rowCount,
        lastViewportDirection: options.getLastViewportDirection(),
        countCachedForward: options.countCachedForward,
        countCachedBackward: options.countCachedBackward,
      })
      if (!candidate || options.isRangeFullyCached(candidate.range)) {
        options.diagnostics.prefetchSkippedCached += 1
        return
      }
      options.diagnostics.prefetchScheduled += 1
      void options.pullRange(candidate.range, "prefetch", "background")
    },
  }
}
