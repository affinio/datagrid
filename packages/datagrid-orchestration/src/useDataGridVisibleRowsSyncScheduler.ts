export interface DataGridVisibleRowsRange {
  start: number
  end: number
}

export interface UseDataGridVisibleRowsSyncSchedulerOptions<TRowSource, TVisibleRow> {
  resolveRows: () => readonly TRowSource[]
  resolveRange: () => DataGridVisibleRowsRange
  setRows: (rows: readonly TRowSource[]) => void
  syncRowsInRange: (range: DataGridVisibleRowsRange) => readonly TVisibleRow[]
  applyVisibleRows: (rows: readonly TVisibleRow[]) => void
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridVisibleRowsSyncSchedulerResult {
  syncVisibleRows: () => void
  scheduleVisibleRowsSync: () => void
  resetVisibleRowsSyncCache: () => void
  dispose: () => void
}

export function useDataGridVisibleRowsSyncScheduler<TRowSource, TVisibleRow>(
  options: UseDataGridVisibleRowsSyncSchedulerOptions<TRowSource, TVisibleRow>,
): UseDataGridVisibleRowsSyncSchedulerResult {
  const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))

  let frame: number | null = null
  let pending = false
  let lastSyncedRowsRef: readonly TRowSource[] | null = null
  let lastSyncedRangeStart = Number.NaN
  let lastSyncedRangeEnd = Number.NaN

  function syncVisibleRows() {
    const rows = options.resolveRows()
    const range = options.resolveRange()
    const hasSameRowsRef = lastSyncedRowsRef === rows
    const hasSameRange = lastSyncedRangeStart === range.start && lastSyncedRangeEnd === range.end
    if (hasSameRowsRef && hasSameRange) {
      return
    }

    if (!hasSameRowsRef) {
      options.setRows(rows)
    }

    if (range.end < range.start) {
      options.applyVisibleRows([])
      lastSyncedRowsRef = rows
      lastSyncedRangeStart = range.start
      lastSyncedRangeEnd = range.end
      return
    }

    const nextVisibleRows = options.syncRowsInRange({
      start: range.start,
      end: range.end,
    })
    options.applyVisibleRows(nextVisibleRows)
    lastSyncedRowsRef = rows
    lastSyncedRangeStart = range.start
    lastSyncedRangeEnd = range.end
  }

  function flushVisibleRowsSync() {
    frame = null
    pending = false
    syncVisibleRows()
  }

  function scheduleVisibleRowsSync() {
    if (pending) {
      return
    }
    pending = true
    if (typeof window === "undefined") {
      flushVisibleRowsSync()
      return
    }
    frame = requestFrame(() => flushVisibleRowsSync())
  }

  function resetVisibleRowsSyncCache() {
    lastSyncedRowsRef = null
    lastSyncedRangeStart = Number.NaN
    lastSyncedRangeEnd = Number.NaN
  }

  function dispose() {
    if (frame !== null) {
      cancelFrame(frame)
      frame = null
    }
    pending = false
  }

  return {
    syncVisibleRows,
    scheduleVisibleRowsSync,
    resetVisibleRowsSyncCache,
    dispose,
  }
}
