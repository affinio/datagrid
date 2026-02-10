export interface DataGridHeaderResizeState {
  columnKey: string
  startClientX: number
  startWidth: number
  lastWidth: number
}

export type DataGridHeaderResizeApplyMode = "sync" | "raf"

export interface UseDataGridHeaderResizeOrchestrationOptions<TRow> {
  resolveColumnBaseWidth: (columnKey: string) => number | null | undefined
  resolveColumnLabel: (columnKey: string) => string | null | undefined
  resolveRowsForAutoSize: () => readonly TRow[]
  resolveCellText: (row: TRow, columnKey: string) => string
  resolveColumnWidthOverride: (columnKey: string) => number | null | undefined
  resolveColumnMinWidth: (columnKey: string) => number
  applyColumnWidth: (columnKey: string, width: number) => void
  isColumnResizable: (columnKey: string) => boolean
  isFillDragging: () => boolean
  stopFillSelection: (applyPreview: boolean) => void
  isDragSelecting: () => boolean
  stopDragSelection: () => void
  setLastAction: (message: string) => void
  autoSizeSampleLimit: number
  autoSizeCharWidth: number
  autoSizeHorizontalPadding: number
  autoSizeMaxWidth: number
  resizeApplyMode?: DataGridHeaderResizeApplyMode
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridHeaderResizeOrchestrationResult {
  getActiveColumnResize: () => DataGridHeaderResizeState | null
  isColumnResizing: () => boolean
  subscribe: (listener: (state: DataGridHeaderResizeState | null) => void) => () => void
  setColumnWidth: (columnKey: string, width: number) => void
  estimateColumnAutoWidth: (columnKey: string) => number
  onHeaderResizeHandleMouseDown: (columnKey: string, event: MouseEvent) => void
  onHeaderResizeHandleDoubleClick: (columnKey: string, event: MouseEvent) => void
  applyColumnResizeFromPointer: (clientX: number) => void
  stopColumnResize: () => void
  dispose: () => void
}

export function useDataGridHeaderResizeOrchestration<TRow>(
  options: UseDataGridHeaderResizeOrchestrationOptions<TRow>,
): UseDataGridHeaderResizeOrchestrationResult {
  const resizeApplyMode = options.resizeApplyMode ?? "raf"
  const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))

  let activeColumnResize: DataGridHeaderResizeState | null = null
  let pendingResizeClientX: number | null = null
  let pendingResizeFrame: number | null = null
  const listeners = new Set<(state: DataGridHeaderResizeState | null) => void>()

  function setActiveColumnResize(state: DataGridHeaderResizeState | null) {
    activeColumnResize = state
    listeners.forEach(listener => listener(state))
  }

  function subscribe(listener: (state: DataGridHeaderResizeState | null) => void): () => void {
    listeners.add(listener)
    listener(activeColumnResize)
    return () => {
      listeners.delete(listener)
    }
  }

  function clampColumnWidth(columnKey: string, width: number): number {
    const minWidth = options.resolveColumnMinWidth(columnKey)
    const rounded = Math.round(width)
    return Math.max(minWidth, Math.min(options.autoSizeMaxWidth, rounded))
  }

  function resolveColumnCurrentWidth(columnKey: string): number {
    const override = options.resolveColumnWidthOverride(columnKey)
    if (typeof override === "number") {
      return override
    }
    const baseWidth = options.resolveColumnBaseWidth(columnKey)
    if (typeof baseWidth === "number") {
      return baseWidth
    }
    return options.resolveColumnMinWidth(columnKey)
  }

  function setColumnWidth(columnKey: string, width: number) {
    options.applyColumnWidth(columnKey, clampColumnWidth(columnKey, width))
  }

  function cancelPendingResizeFrame() {
    if (pendingResizeFrame === null) {
      return
    }
    cancelFrame(pendingResizeFrame)
    pendingResizeFrame = null
  }

  function canUseRaf(): boolean {
    return resizeApplyMode === "raf" && typeof window !== "undefined"
  }

  function applyResizeFromClientX(clientX: number): boolean {
    if (!activeColumnResize) {
      return false
    }
    const delta = clientX - activeColumnResize.startClientX
    const nextWidth = clampColumnWidth(activeColumnResize.columnKey, activeColumnResize.startWidth + delta)
    if (nextWidth === activeColumnResize.lastWidth) {
      return false
    }
    setColumnWidth(activeColumnResize.columnKey, nextWidth)
    setActiveColumnResize({
      ...activeColumnResize,
      lastWidth: nextWidth,
    })
    return true
  }

  function flushPendingResize(): boolean {
    if (pendingResizeClientX === null) {
      return false
    }
    const nextClientX = pendingResizeClientX
    pendingResizeClientX = null
    return applyResizeFromClientX(nextClientX)
  }

  function schedulePendingResizeFlush() {
    if (!canUseRaf()) {
      flushPendingResize()
      return
    }
    if (pendingResizeFrame !== null) {
      return
    }
    pendingResizeFrame = requestFrame(() => {
      pendingResizeFrame = null
      flushPendingResize()
    })
  }

  function sampleRowsForAutoSize(rows: readonly TRow[], maxSamples: number): readonly TRow[] {
    if (rows.length <= maxSamples) {
      return rows
    }
    const step = Math.max(1, Math.floor(rows.length / maxSamples))
    const sample: TRow[] = []
    for (let index = 0; index < rows.length && sample.length < maxSamples; index += step) {
      const row = rows[index]
      if (row) {
        sample.push(row)
      }
    }
    return sample
  }

  function estimateColumnAutoWidth(columnKey: string): number {
    const columnLabel = options.resolveColumnLabel(columnKey) ?? columnKey
    const rows = sampleRowsForAutoSize(options.resolveRowsForAutoSize(), options.autoSizeSampleLimit)
    let maxTextLength = String(columnLabel).length
    for (const row of rows) {
      const text = options.resolveCellText(row, columnKey)
      if (text.length > maxTextLength) {
        maxTextLength = text.length
      }
    }
    const estimated = maxTextLength * options.autoSizeCharWidth + options.autoSizeHorizontalPadding
    return clampColumnWidth(columnKey, estimated)
  }

  function onHeaderResizeHandleMouseDown(columnKey: string, event: MouseEvent) {
    if (event.button !== 0 || !options.isColumnResizable(columnKey)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (options.isFillDragging()) {
      options.stopFillSelection(false)
    }
    if (options.isDragSelecting()) {
      options.stopDragSelection()
    }
    cancelPendingResizeFrame()
    pendingResizeClientX = null
    const startWidth = resolveColumnCurrentWidth(columnKey)
    setActiveColumnResize({
      columnKey,
      startClientX: event.clientX,
      startWidth,
      lastWidth: startWidth,
    })
  }

  function onHeaderResizeHandleDoubleClick(columnKey: string, event: MouseEvent) {
    if (!options.isColumnResizable(columnKey)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const nextWidth = estimateColumnAutoWidth(columnKey)
    setColumnWidth(columnKey, nextWidth)
    options.setLastAction(`Auto-sized ${columnKey} to ${nextWidth}px`)
  }

  function applyColumnResizeFromPointer(clientX: number) {
    if (!activeColumnResize) {
      return
    }
    pendingResizeClientX = clientX
    schedulePendingResizeFlush()
  }

  function stopColumnResize() {
    if (!activeColumnResize) {
      return
    }
    flushPendingResize()
    cancelPendingResizeFrame()
    pendingResizeClientX = null
    const state = activeColumnResize
    setActiveColumnResize(null)
    options.setLastAction(`Resized ${state.columnKey} to ${state.lastWidth}px`)
  }

  function dispose() {
    cancelPendingResizeFrame()
    pendingResizeClientX = null
    setActiveColumnResize(null)
  }

  return {
    getActiveColumnResize: () => activeColumnResize,
    isColumnResizing: () => activeColumnResize !== null,
    subscribe,
    setColumnWidth,
    estimateColumnAutoWidth,
    onHeaderResizeHandleMouseDown,
    onHeaderResizeHandleDoubleClick,
    applyColumnResizeFromPointer,
    stopColumnResize,
    dispose,
  }
}
