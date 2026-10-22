import type {
  DataGridRowId,
  DataGridRowModel,
  DataGridViewportRange,
} from "../models/index.js"
import type {
  DataGridCellRefreshOptions,
  DataGridCellRefreshRange,
  DataGridCellsRefreshListener,
} from "./gridApiCellRefresh"
import type { DataGridCoreViewportService } from "./gridCore"
import type {
  DataGridActivateCellOptions,
  DataGridActivateCellResult,
  DataGridActivateCellTarget,
  DataGridSetViewportPositionOptions,
  DataGridViewportCellTarget,
  DataGridViewportColumnTarget,
  DataGridViewportPositionSnapshot,
  DataGridViewportRowTarget,
} from "./gridApiViewContracts"

export interface DataGridApiCellRefreshQueue {
  queueByRowKeys: (
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ) => void
  queueByRanges: (
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ) => void
  subscribe: (listener: DataGridCellsRefreshListener) => () => void
}

export interface DataGridApiViewMethods {
  setViewportRange: (range: DataGridViewportRange) => void
  getViewportPosition: () => DataGridViewportPositionSnapshot | null
  setViewportPosition: (
    position: DataGridViewportPositionSnapshot,
    options?: DataGridSetViewportPositionOptions,
  ) => void
  scrollToRow: (target: DataGridViewportRowTarget) => void
  scrollToColumn: (target: DataGridViewportColumnTarget) => void
  scrollToCell: (target: DataGridViewportCellTarget) => void
  activateCell: (target: DataGridActivateCellTarget, options?: DataGridActivateCellOptions) => Promise<DataGridActivateCellResult>
  setRowHeightMode: (mode: "fixed" | "auto") => void
  setBaseRowHeight: (height: number) => void
  measureRowHeight: () => void
  getEffectiveRowHeight: () => number
  setRowHeightOverride: (rowIndex: number, height: number | null) => void
  getRowHeightOverride: (rowIndex: number) => number | null
  setRowHeightOverrideById: (rowId: DataGridRowId, height: number | null) => void
  getRowHeightOverrideById: (rowId: DataGridRowId) => number | null
  getRowHeightVersion: () => number
  getRowHeightOverridesSnapshot: () => ReadonlyMap<number, number>
  getLastRowHeightMutation: () => {
    version: number
    kind: "set" | "clear" | "clear-all"
    rowIndex: number | null
    previousHeight: number | null
    nextHeight: number | null
  } | null
  clearRowHeightOverrides: () => void
  refreshCellsByRowKeys: (
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ) => void
  refreshCellsByRanges: (
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ) => void
  onCellsRefresh: (listener: DataGridCellsRefreshListener) => () => void
}

export interface CreateDataGridApiViewMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getViewportService: () => DataGridCoreViewportService | null
  cellRefreshQueue: DataGridApiCellRefreshQueue
}

export function createDataGridApiViewMethods<TRow = unknown>(
  input: CreateDataGridApiViewMethodsInput<TRow>,
): DataGridApiViewMethods {
  const { rowModel, getViewportService, cellRefreshQueue } = input
  const rowHeightOverrideFallback = new Map<number, number>()
  const rowHeightOverrideById = new Map<DataGridRowId, number>()
  let rowHeightIdentityVersion = 0
  let lastRowHeightMutationFallback: {
    version: number
    kind: "set" | "clear" | "clear-all"
    rowIndex: number | null
    previousHeight: number | null
    nextHeight: number | null
  } | null = null
  const normalizeRowIndex = (value: number): number | null => {
    if (!Number.isFinite(value)) {
      return null
    }
    const normalized = Math.trunc(value)
    return normalized >= 0 ? normalized : null
  }

  const normalizeRowHeight = (value: number): number | null => {
    if (!Number.isFinite(value)) {
      return null
    }
    return Math.max(1, Math.trunc(value))
  }

  const assertViewportPositionSupport = (
    operation: string,
    options?: DataGridSetViewportPositionOptions,
  ): boolean => {
    if (!options?.strict) {
      return false
    }
    throw new Error(`[DataGridApi] viewport service does not implement ${operation} capability.`)
  }

  return {
    setViewportRange(range: DataGridViewportRange) {
      rowModel.setViewportRange(range)
      getViewportService()?.setViewportRange?.(range)
    },
    getViewportPosition() {
      return getViewportService()?.getViewportPosition?.() ?? null
    },
    setViewportPosition(
      position: DataGridViewportPositionSnapshot,
      options?: DataGridSetViewportPositionOptions,
    ) {
      const viewportService = getViewportService()
      if (typeof viewportService?.setViewportPosition !== "function") {
        assertViewportPositionSupport("setViewportPosition", options)
        return
      }
      viewportService.setViewportPosition(position, options)
    },
    scrollToRow(target: DataGridViewportRowTarget) {
      getViewportService()?.scrollToRow?.(target)
    },
    scrollToColumn(target: DataGridViewportColumnTarget) {
      getViewportService()?.scrollToColumn?.(target)
    },
    scrollToCell(target: DataGridViewportCellTarget) {
      getViewportService()?.scrollToCell?.(target)
    },
    async activateCell(target: DataGridActivateCellTarget, options: DataGridActivateCellOptions = {}) {
      if (options.signal?.aborted) return { status: "cancelled", reason: "aborted" }
      const activate = getViewportService()?.activateCell
      if (!activate) {
        return {
          status: "failed",
          error: new Error("The viewport adapter does not support logical cell activation."),
        }
      }
      try {
        return await activate(target, options)
      } catch (error) {
        if (options.signal?.aborted) return { status: "cancelled", reason: "aborted" }
        return { status: "failed", error: error instanceof Error ? error : new Error(String(error)) }
      }
    },
    setRowHeightMode(mode: "fixed" | "auto") {
      getViewportService()?.setRowHeightMode?.(mode)
    },
    setBaseRowHeight(height: number) {
      const normalized = normalizeRowHeight(height)
      if (normalized == null) {
        return
      }
      getViewportService()?.setBaseRowHeight?.(normalized)
    },
    measureRowHeight() {
      getViewportService()?.measureRowHeight?.()
    },
    getEffectiveRowHeight() {
      const viewportService = getViewportService()
      if (typeof viewportService?.getEffectiveRowHeight === "function") {
        return viewportService.getEffectiveRowHeight()
      }
      return 0
    },
    setRowHeightOverride(rowIndex: number, height: number | null) {
      const normalizedIndex = normalizeRowIndex(rowIndex)
      if (normalizedIndex == null) {
        return
      }
      const previousHeight = rowHeightOverrideFallback.get(normalizedIndex) ?? null
      const viewportService = getViewportService()
      if (typeof viewportService?.setRowHeightOverride === "function") {
        viewportService.setRowHeightOverride(normalizedIndex, height)
      }

      if (height == null) {
        rowHeightOverrideFallback.delete(normalizedIndex)
        lastRowHeightMutationFallback = {
          version: typeof viewportService?.getRowHeightVersion === "function"
            ? viewportService.getRowHeightVersion()
            : rowHeightOverrideFallback.size,
          kind: "clear",
          rowIndex: normalizedIndex,
          previousHeight,
          nextHeight: null,
        }
        return
      }

      const normalizedHeight = normalizeRowHeight(height)
      if (normalizedHeight == null) {
        return
      }
      rowHeightOverrideFallback.set(normalizedIndex, normalizedHeight)
      lastRowHeightMutationFallback = {
        version: typeof viewportService?.getRowHeightVersion === "function"
          ? viewportService.getRowHeightVersion()
          : rowHeightOverrideFallback.size,
        kind: "set",
        rowIndex: normalizedIndex,
        previousHeight,
        nextHeight: normalizedHeight,
      }
    },
    getRowHeightOverride(rowIndex: number) {
      const normalizedIndex = normalizeRowIndex(rowIndex)
      if (normalizedIndex == null) {
        return null
      }
      const viewportService = getViewportService()
      if (typeof viewportService?.getRowHeightOverride === "function") {
        const value = viewportService.getRowHeightOverride(normalizedIndex)
        if (value != null) {
          return value
        }
      }
      return rowHeightOverrideFallback.get(normalizedIndex) ?? null
    },
    setRowHeightOverrideById(rowId: DataGridRowId, height: number | null) {
      const previous = rowHeightOverrideById.get(rowId) ?? null
      const next = height == null ? null : normalizeRowHeight(height)
      if (height != null && next == null || previous === next) return
      if (next == null) rowHeightOverrideById.delete(rowId)
      else rowHeightOverrideById.set(rowId, next)
      rowHeightIdentityVersion += 1
    },
    getRowHeightOverrideById(rowId: DataGridRowId) {
      return rowHeightOverrideById.get(rowId) ?? null
    },
    getRowHeightVersion() {
      const viewportService = getViewportService()
      if (typeof viewportService?.getRowHeightVersion === "function") {
        return viewportService.getRowHeightVersion() + rowHeightIdentityVersion
      }
      return rowHeightOverrideFallback.size + rowHeightIdentityVersion
    },
    getRowHeightOverridesSnapshot() {
      const viewportService = getViewportService()
      if (typeof viewportService?.getRowHeightOverridesSnapshot === "function") {
        return viewportService.getRowHeightOverridesSnapshot()
      }
      return rowHeightOverrideFallback
    },
    getLastRowHeightMutation() {
      const viewportService = getViewportService()
      if (typeof viewportService?.getLastRowHeightMutation === "function") {
        return viewportService.getLastRowHeightMutation()
      }
      return lastRowHeightMutationFallback
    },
    clearRowHeightOverrides() {
      rowHeightOverrideFallback.clear()
      rowHeightOverrideById.clear()
      rowHeightIdentityVersion += 1
      const viewportService = getViewportService()
      viewportService?.clearRowHeightOverrides?.()
      lastRowHeightMutationFallback = {
        version: typeof viewportService?.getRowHeightVersion === "function"
          ? viewportService.getRowHeightVersion() + rowHeightIdentityVersion
          : rowHeightOverrideFallback.size,
        kind: "clear-all",
        rowIndex: null,
        previousHeight: null,
        nextHeight: null,
      }
    },
    refreshCellsByRowKeys(
      rowKeys: readonly DataGridRowId[],
      columnKeys: readonly string[],
      options?: DataGridCellRefreshOptions,
    ) {
      cellRefreshQueue.queueByRowKeys(rowKeys, columnKeys, options)
    },
    refreshCellsByRanges(
      ranges: readonly DataGridCellRefreshRange[],
      options?: DataGridCellRefreshOptions,
    ) {
      cellRefreshQueue.queueByRanges(ranges, options)
    },
    onCellsRefresh(listener: DataGridCellsRefreshListener) {
      return cellRefreshQueue.subscribe(listener)
    },
  }
}
