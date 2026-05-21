import type { DataGridDataSourceBackpressureDiagnostics } from "./dataSourceProtocol.js"
import {
  createDataSourceRuntimeLifecycle,
  type DataSourceRuntimeLifecycle,
} from "./dataSourceRuntimeLifecycle.js"
import type { DataGridViewportRange } from "../rowModel.js"

export interface DataSourceTelemetryRuntime extends DataSourceRuntimeLifecycle {
  finishPlaceholderExposure(index: number, timestampMs?: number): void
  finishAllPlaceholderExposures(timestampMs?: number): void
  finishPlaceholderExposuresOutsideRange(range: DataGridViewportRange, timestampMs?: number): void
  reconcilePlaceholderExposure(options: {
    sourceViewport: DataGridViewportRange
    rowCount: number
    hasCachedRow: (index: number) => boolean
  }): void
  markViewportDataAvailabilityRequested(options: {
    range: DataGridViewportRange
    rowCount: number
    sourceViewport: DataGridViewportRange
    rangesOverlap: (left: DataGridViewportRange, right: DataGridViewportRange) => boolean
    isViewportFullyCached: () => boolean
  }): void
  finishViewportDataAvailability(options: {
    visibleRowCount: number
    isViewportFullyCached: () => boolean
  }, timestampMs?: number): void
  resetViewportDataAvailability(): void
  recordPullDuration(startedAtMs: number, timestampMs?: number): void
  readNowMs(): number
}

export function createDataSourceTelemetryRuntime(
  diagnostics: DataGridDataSourceBackpressureDiagnostics,
): DataSourceTelemetryRuntime {
  const activePlaceholderExposureRows = new Map<number, number>()
  let viewportDataAvailabilityStartedAtMs: number | null = null

  function readNowMs(): number {
    const now = globalThis.performance?.now?.()
    return Number.isFinite(now) ? now : 0
  }

  function resetViewportDataAvailability(): void {
    viewportDataAvailabilityStartedAtMs = null
  }

  function finishPlaceholderExposure(index: number, timestampMs = readNowMs()): void {
    if (lifecycle.isDisposed()) {
      return
    }
    const startedAtMs = activePlaceholderExposureRows.get(index)
    if (typeof startedAtMs !== "number") {
      return
    }
    activePlaceholderExposureRows.delete(index)
    const durationMs = Math.max(0, timestampMs - startedAtMs)
    diagnostics.placeholderExposureEvents += 1
    diagnostics.placeholderExposureLastMs = durationMs
    diagnostics.placeholderExposureTotalMs += durationMs
    diagnostics.placeholderExposureMaxMs = Math.max(diagnostics.placeholderExposureMaxMs, durationMs)
    diagnostics.placeholderExposureActiveRows = activePlaceholderExposureRows.size
  }

  function finishAllPlaceholderExposures(timestampMs = readNowMs()): void {
    for (const index of Array.from(activePlaceholderExposureRows.keys())) {
      finishPlaceholderExposure(index, timestampMs)
    }
  }

  function reconcilePlaceholderExposure(options: {
    sourceViewport: DataGridViewportRange
    rowCount: number
    hasCachedRow: (index: number) => boolean
  }): void {
    if (lifecycle.isDisposed()) {
      return
    }
    const timestampMs = readNowMs()
    const visiblePlaceholderIndexes = new Set<number>()
    if (options.rowCount > 0) {
      const start = Math.max(0, Math.min(options.sourceViewport.start, options.rowCount - 1))
      const end = Math.max(start, Math.min(options.sourceViewport.end, options.rowCount - 1))
      for (let index = start; index <= end; index += 1) {
        if (!options.hasCachedRow(index)) {
          visiblePlaceholderIndexes.add(index)
          if (!activePlaceholderExposureRows.has(index)) {
            activePlaceholderExposureRows.set(index, timestampMs)
          }
        }
      }
    }
    for (const index of Array.from(activePlaceholderExposureRows.keys())) {
      if (!visiblePlaceholderIndexes.has(index)) {
        finishPlaceholderExposure(index, timestampMs)
      }
    }
    diagnostics.placeholderExposureActiveRows = activePlaceholderExposureRows.size
  }

  function finishViewportDataAvailability(
    options: { visibleRowCount: number; isViewportFullyCached: () => boolean },
    timestampMs = readNowMs(),
  ): void {
    if (lifecycle.isDisposed()) {
      return
    }
    if (viewportDataAvailabilityStartedAtMs === null) {
      return
    }
    if (options.visibleRowCount > 0 && !options.isViewportFullyCached()) {
      return
    }
    const durationMs = Math.max(0, timestampMs - viewportDataAvailabilityStartedAtMs)
    viewportDataAvailabilityStartedAtMs = null
    diagnostics.viewportDataAvailabilityEvents += 1
    diagnostics.viewportDataAvailabilityLastMs = durationMs
    diagnostics.viewportDataAvailabilityTotalMs += durationMs
    diagnostics.viewportDataAvailabilityMaxMs = Math.max(diagnostics.viewportDataAvailabilityMaxMs, durationMs)
  }

  const lifecycle = createDataSourceRuntimeLifecycle({
    service: "telemetry-runtime",
    onAttach: resetViewportDataAvailability,
    onDispose() {
      finishAllPlaceholderExposures()
      resetViewportDataAvailability()
    },
  })

  return {
    ...lifecycle,
    finishPlaceholderExposure,
    finishAllPlaceholderExposures,
    finishPlaceholderExposuresOutsideRange(range, timestampMs = readNowMs()) {
      if (lifecycle.isDisposed()) {
        return
      }
      for (const index of Array.from(activePlaceholderExposureRows.keys())) {
        if (index < range.start || index > range.end) {
          finishPlaceholderExposure(index, timestampMs)
        }
      }
    },
    reconcilePlaceholderExposure,
    markViewportDataAvailabilityRequested(options) {
      if (lifecycle.isDisposed()) {
        return
      }
      if (options.rowCount <= 0 || !options.rangesOverlap(options.range, options.sourceViewport)) {
        return
      }
      if (options.isViewportFullyCached()) {
        return
      }
      viewportDataAvailabilityStartedAtMs ??= readNowMs()
    },
    finishViewportDataAvailability,
    resetViewportDataAvailability,
    recordPullDuration(startedAtMs, timestampMs = readNowMs()) {
      if (lifecycle.isDisposed()) {
        return
      }
      const durationMs = Math.max(0, timestampMs - startedAtMs)
      diagnostics.pullDurationEvents += 1
      diagnostics.pullDurationLastMs = durationMs
      diagnostics.pullDurationTotalMs += durationMs
      diagnostics.pullDurationMaxMs = Math.max(diagnostics.pullDurationMaxMs, durationMs)
    },
    readNowMs,
  }
}
