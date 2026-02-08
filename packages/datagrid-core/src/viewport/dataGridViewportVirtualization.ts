import { createAxisVirtualizer, type AxisVirtualizerState } from "../virtualization/axisVirtualizer"
import { createVerticalAxisStrategy } from "../virtualization/verticalVirtualizer"
import { createVerticalOverscanController } from "../virtualization/dynamicOverscan"
import { clampScrollOffset, computeVerticalScrollLimit } from "../virtualization/scrollLimits"
import type { VisibleRow } from "../types"
import type { DataGridViewportDiagnostics } from "./dataGridViewportDiagnostics"
import type { RowPoolItem, DataGridViewportSignals } from "./dataGridViewportSignals"
import type { DataGridViewportImperativeCallbacks } from "./dataGridViewportTypes"
import type { ViewportClock } from "./dataGridViewportConfig"
import {
  FRAME_BUDGET_CONSTANTS,
  VERTICAL_VIRTUALIZATION_CONSTANTS,
  type AxisVirtualizationConstants,
  type ViewportFrameBudget,
} from "./dataGridViewportConstants"

interface VisibleRangePayload {
  start: number
  end: number
}

export interface DataGridViewportVirtualizationOptions {
  signals: DataGridViewportSignals
  diagnostics: DataGridViewportDiagnostics
  clock: ViewportClock
  frameBudget?: ViewportFrameBudget
  verticalConfig?: AxisVirtualizationConstants
}

export interface DataGridViewportVirtualizationUpdateArgs {
  resolveRow: (index: number) => VisibleRow | undefined
  resolveRowsInRange?: (range: { start: number; end: number }) => readonly VisibleRow[]
  totalRowCount: number
  viewportHeight: number
  resolvedRowHeight: number
  zoomFactor: number
  virtualizationEnabled: boolean
  pendingScrollTop: number
  lastScrollTopSample: number
  pendingScrollTopRequest: number | null
  measuredScrollTopFromPending: boolean
  cachedNativeScrollHeight: number
  containerHeight: number
  imperativeCallbacks: DataGridViewportImperativeCallbacks
}

export interface DataGridViewportVirtualizationResult {
  scrollTop: number
  lastScrollTopSample: number
  pendingScrollTop: number | null
  visibleRange: VisibleRangePayload
  syncedScrollTop: number | null
  timestamp: number
  pendingScrollWrite: number | null
}

export interface DataGridViewportVirtualizationPrepared {
  state: AxisVirtualizerState<undefined>
  scrollTop: number
  lastScrollTopSample: number
  pendingScrollTop: number | null
  visibleRange: VisibleRangePayload
  syncedScrollTop: number | null
  timestamp: number
  pendingScrollWrite: number | null
}

export interface DataGridViewportVirtualizationApplyArgs {
  resolveRow: (index: number) => VisibleRow | undefined
  resolveRowsInRange?: (range: { start: number; end: number }) => readonly VisibleRow[]
  imperativeCallbacks: DataGridViewportImperativeCallbacks
}

export interface DataGridViewportVirtualization {
  resetOverscan(timestamp: number): void
  resetScrollState(timestamp: number): void
  clampScrollTop(value: number): number
  prepare(args: DataGridViewportVirtualizationUpdateArgs): DataGridViewportVirtualizationPrepared | null
  applyPrepared(
    prepared: DataGridViewportVirtualizationPrepared,
    applyArgs: DataGridViewportVirtualizationApplyArgs,
  ): DataGridViewportVirtualizationResult
  update(args: DataGridViewportVirtualizationUpdateArgs): DataGridViewportVirtualizationResult | null
}

export function createDataGridViewportVirtualization(
  options: DataGridViewportVirtualizationOptions,
): DataGridViewportVirtualization {
  const { signals, diagnostics, clock } = options
  const frameBudget = options.frameBudget ?? FRAME_BUDGET_CONSTANTS
  const verticalConfig = options.verticalConfig ?? VERTICAL_VIRTUALIZATION_CONSTANTS
  const { input, core, derived } = signals
  const { scrollTop, virtualizationEnabled } = input
  const {
    totalRowCount,
    effectiveRowHeight,
    visibleCount,
    poolSize,
    totalContentHeight,
    startIndex,
    endIndex,
    overscanLeading,
    overscanTrailing,
  } = core
  const {
    rows: { visibleRange },
  } = derived

  const verticalVirtualizer = createAxisVirtualizer("vertical", createVerticalAxisStrategy(), undefined)
  const verticalOverscanController = createVerticalOverscanController({
    minOverscan: verticalConfig.minOverscan,
    velocityRatio: verticalConfig.velocityOverscanRatio,
    viewportRatio: verticalConfig.viewportOverscanRatio,
    decay: verticalConfig.overscanDecay,
    maxViewportMultiplier: verticalConfig.maxViewportMultiplier,
    teleportMultiplier: frameBudget.teleportMultiplier,
    frameDurationMs: frameBudget.frameDurationMs,
    minSampleMs: frameBudget.minVelocitySampleMs,
  })

  const visibleBuffers: VisibleRow[][] = [[], []]
  const visibleSnapshotBuffers: VisibleRow[][] = [[], [], []]
  const rowPool: RowPoolItem[] = []
  const rangeRowsByIndex = new Map<number, VisibleRow>()
  let activeBufferIndex = 0
  let activeSnapshotBufferIndex = 0
  let rowPoolVersion = 0
  let lastKnownViewportHeight = 0
  let lastKnownRowHeight = 0
  let lastKnownTotalRows = 0
  let lastKnownNativeLimit = 0
  let lastVirtualizationFlag = true
  let lastVisibleRowsSnapshot = visibleSnapshotBuffers[activeSnapshotBufferIndex] ?? []
  let lastRowsCallbackSignature = -1

  function ensureRowPoolSize(size: number): RowPoolItem[] {
    if (rowPool.length > size) {
      rowPool.length = size
      return rowPool
    }
    for (let index = rowPool.length; index < size; index += 1) {
      rowPool.push({ poolIndex: index, entry: null, displayIndex: -1, rowIndex: -1 })
    }
    return rowPool
  }

  function nextBufferIndex(current: number): number {
    return current === 0 ? 1 : 0
  }

  function nextSnapshotBufferIndex(current: number): number {
    return current >= visibleSnapshotBuffers.length - 1 ? 0 : current + 1
  }

  function copyToSnapshot(source: readonly VisibleRow[], size: number): VisibleRow[] {
    const nextIndex = nextSnapshotBufferIndex(activeSnapshotBufferIndex)
    const snapshot = visibleSnapshotBuffers[nextIndex] ?? (visibleSnapshotBuffers[nextIndex] = [])
    for (let index = 0; index < size; index += 1) {
      snapshot[index] = source[index] as VisibleRow
    }
    if (snapshot.length !== size) {
      snapshot.length = size
    }
    activeSnapshotBufferIndex = nextIndex
    return snapshot
  }

  function mixSignature(hash: number, value: number): number {
    const normalized = Number.isFinite(value) ? Math.trunc(value) : 0
    const mixed = (hash ^ normalized) * 16777619
    return mixed >>> 0
  }

  function computeRowsCallbackSignature(params: {
    poolVersion: number
    startIndex: number
    endIndex: number
    visibleCount: number
    visibleRowsLength: number
    totalRowCount: number
    rowHeight: number
    scrollTop: number
    viewportHeight: number
    overscanLeading: number
    overscanTrailing: number
  }): number {
    let hash = 2166136261
    hash = mixSignature(hash, params.poolVersion)
    hash = mixSignature(hash, params.startIndex)
    hash = mixSignature(hash, params.endIndex)
    hash = mixSignature(hash, params.visibleCount)
    hash = mixSignature(hash, params.visibleRowsLength)
    hash = mixSignature(hash, params.totalRowCount)
    hash = mixSignature(hash, Math.round(params.rowHeight * 1000))
    hash = mixSignature(hash, Math.round(params.scrollTop * 1000))
    hash = mixSignature(hash, Math.round(params.viewportHeight * 1000))
    hash = mixSignature(hash, params.overscanLeading)
    hash = mixSignature(hash, params.overscanTrailing)
    return hash
  }

  function bumpRowPoolVersion(): number {
    rowPoolVersion = rowPoolVersion >= Number.MAX_SAFE_INTEGER ? 0 : rowPoolVersion + 1
    return rowPoolVersion
  }

  function updateVisibleRows(
    resolveRow: (index: number) => VisibleRow | undefined,
    resolveRowsInRange: ((range: { start: number; end: number }) => readonly VisibleRow[]) | undefined,
    poolSizeValue: number,
    startIndexValue: number,
  ): { pool: RowPoolItem[]; visibleRows: VisibleRow[]; version: number } {
    const pool = ensureRowPoolSize(poolSizeValue)
    if (!poolSizeValue || totalRowCount.value === 0) {
      activeBufferIndex = nextBufferIndex(activeBufferIndex)
      const emptyBuffer = visibleBuffers[activeBufferIndex] ?? (visibleBuffers[activeBufferIndex] = [])
      if (emptyBuffer.length) {
        emptyBuffer.length = 0
      }
      if (lastVisibleRowsSnapshot.length === 0) {
        return { pool, visibleRows: lastVisibleRowsSnapshot, version: rowPoolVersion }
      }
      lastVisibleRowsSnapshot = copyToSnapshot(emptyBuffer, 0)
      const version = bumpRowPoolVersion()
      return { pool, visibleRows: lastVisibleRowsSnapshot, version }
    }

    const nextIndex = nextBufferIndex(activeBufferIndex)
    const buffer = visibleBuffers[nextIndex] ?? (visibleBuffers[nextIndex] = [])
    const rangeEnd = startIndexValue + Math.max(0, poolSizeValue - 1)
    const rowsInRange =
      typeof resolveRowsInRange === "function"
        ? resolveRowsInRange({ start: startIndexValue, end: rangeEnd })
        : []
    const rowsByIndex = rowsInRange.length ? rangeRowsByIndex : null
    if (rowsByIndex) {
      rowsByIndex.clear()
      for (const row of rowsInRange) {
        const displayIndex = Number.isFinite(row.displayIndex)
          ? Math.trunc(row.displayIndex as number)
          : Math.trunc(row.originalIndex)
        if (displayIndex < startIndexValue || displayIndex > rangeEnd) {
          continue
        }
        rowsByIndex.set(displayIndex, row)
      }
    }
    let filled = 0
    let changed = false

    for (let poolIndexValue = 0; poolIndexValue < poolSizeValue; poolIndexValue += 1) {
      const rowIndexValue = startIndexValue + poolIndexValue
      const sourceEntry = rowsByIndex ? (rowsByIndex.get(rowIndexValue) ?? null) : (resolveRow(rowIndexValue) ?? null)
      const item = pool[poolIndexValue]
      if (!item) {
        continue
      }
      const previousEntry = item.entry
      const previousRowIndex = item.rowIndex
      const previousDisplayIndex = item.displayIndex

      item.poolIndex = poolIndexValue
      item.rowIndex = rowIndexValue
      let entry = sourceEntry

      let nextDisplayIndex = rowIndexValue
      if (entry) {
        if (entry.displayIndex !== rowIndexValue) {
          // Keep viewport display index deterministic without mutating shared row objects.
          entry = {
            ...entry,
            displayIndex: rowIndexValue,
          }
        }
        nextDisplayIndex = entry.displayIndex ?? rowIndexValue
        item.entry = entry
        buffer[filled] = entry
        filled += 1
      } else {
        item.entry = null
      }

      item.displayIndex = nextDisplayIndex

      if (
        previousEntry !== item.entry ||
        previousRowIndex !== item.rowIndex ||
        previousDisplayIndex !== item.displayIndex
      ) {
        changed = true
      }
    }

    if (buffer.length !== filled) {
      buffer.length = filled
    }

    activeBufferIndex = nextIndex
    if (!changed) {
      if (lastVisibleRowsSnapshot.length !== filled) {
        changed = true
      } else {
        for (let index = 0; index < filled; index += 1) {
          if (lastVisibleRowsSnapshot[index] !== buffer[index]) {
            changed = true
            break
          }
        }
      }
    }

    if (!changed) {
      return { pool, visibleRows: lastVisibleRowsSnapshot, version: rowPoolVersion }
    }

    const snapshot = copyToSnapshot(buffer, filled)
    lastVisibleRowsSnapshot = snapshot
    const version = bumpRowPoolVersion()
    return { pool, visibleRows: lastVisibleRowsSnapshot, version }
  }

  function resetOverscan(timestamp: number): void {
    verticalOverscanController.reset(timestamp)
  }

  function resetScrollState(timestamp: number): void {
    verticalOverscanController.reset(timestamp)
    lastKnownViewportHeight = 0
    lastKnownRowHeight = 0
    lastKnownTotalRows = 0
    lastKnownNativeLimit = 0
    lastVirtualizationFlag = true
    const virtualState = verticalVirtualizer.getState()
    virtualState.offset = 0
    virtualState.startIndex = 0
    virtualState.endIndex = 0
    virtualState.visibleCount = 0
    virtualState.poolSize = 0
    startIndex.value = 0
    endIndex.value = 0
    visibleCount.value = 0
    poolSize.value = 0
    totalContentHeight.value = 0
    overscanLeading.value = 0
    overscanTrailing.value = 0
    scrollTop.value = 0
    totalRowCount.value = 0
    effectiveRowHeight.value = 0
    for (const buffer of visibleBuffers) {
      if (buffer.length) {
        buffer.length = 0
      }
    }
    for (const buffer of visibleSnapshotBuffers) {
      if (buffer.length) {
        buffer.length = 0
      }
    }
    activeSnapshotBufferIndex = 0
    rowPool.length = 0
    rangeRowsByIndex.clear()
    rowPoolVersion = 0
    lastVisibleRowsSnapshot = visibleSnapshotBuffers[activeSnapshotBufferIndex] ?? []
    lastRowsCallbackSignature = -1
    visibleRange.value = { start: 0, end: 0 }
  }

  function clampScrollTop(value: number): number {
    if (!Number.isFinite(value)) return 0
    const nativeLimit = Math.max(0, lastKnownNativeLimit)
    if (!lastVirtualizationFlag) {
      return clampScrollOffset({ offset: value, limit: nativeLimit })
    }
    const verticalState = verticalVirtualizer.getState()
    const limit = computeVerticalScrollLimit({
      estimatedItemSize: lastKnownRowHeight || 1,
      totalCount: lastKnownTotalRows,
      viewportSize: lastKnownViewportHeight || 1,
      overscanTrailing: verticalState.overscanTrailing,
      visibleCount: verticalState.visibleCount,
      nativeScrollLimit: nativeLimit,
      trailingPadding: verticalConfig.edgePadding,
    })
    return clampScrollOffset({ offset: value, limit })
  }

  function applyVirtualState(
    result: DataGridViewportVirtualizationPrepared,
    args: DataGridViewportVirtualizationApplyArgs,
  ): void {
    const { resolveRow, resolveRowsInRange, imperativeCallbacks } = args
    const {
      state: virtualState,
      scrollTop: nextScrollTop,
      visibleRange: nextRange,
      timestamp,
    } = result

    scrollTop.value = nextScrollTop
    visibleCount.value = virtualState.visibleCount
    poolSize.value = virtualState.poolSize
    startIndex.value = virtualState.startIndex
    endIndex.value = virtualState.endIndex
    totalContentHeight.value = totalRowCount.value * (effectiveRowHeight.value || 0)

    const { pool: poolSnapshot, visibleRows: visibleRowsSnapshot, version: poolVersion } =
      updateVisibleRows(resolveRow, resolveRowsInRange, virtualState.poolSize, virtualState.startIndex)

    const currentRange = visibleRange.value
    if (currentRange.start !== nextRange.start || currentRange.end !== nextRange.end) {
      visibleRange.value = nextRange
    }

    startIndex.value = virtualState.startIndex
    endIndex.value = virtualState.endIndex
    visibleCount.value = virtualState.visibleCount
    poolSize.value = virtualState.poolSize
    overscanLeading.value = virtualState.overscanLeading
    overscanTrailing.value = virtualState.overscanTrailing

    if (typeof imperativeCallbacks.onRows === "function") {
      const rowsCallbackSignature = computeRowsCallbackSignature({
        poolVersion,
        startIndex: virtualState.startIndex,
        endIndex: virtualState.endIndex,
        visibleCount: virtualState.visibleCount,
        visibleRowsLength: visibleRowsSnapshot.length,
        totalRowCount: totalRowCount.value,
        rowHeight: effectiveRowHeight.value || 0,
        scrollTop: nextScrollTop,
        viewportHeight: lastKnownViewportHeight,
        overscanLeading: virtualState.overscanLeading,
        overscanTrailing: virtualState.overscanTrailing,
      })

      if (rowsCallbackSignature !== lastRowsCallbackSignature) {
        lastRowsCallbackSignature = rowsCallbackSignature
        imperativeCallbacks.onRows({
          pool: poolSnapshot,
          visibleRows: visibleRowsSnapshot,
          startIndex: virtualState.startIndex,
          endIndex: virtualState.endIndex,
          visibleCount: virtualState.visibleCount,
          totalRowCount: totalRowCount.value,
          rowHeight: effectiveRowHeight.value || 0,
          scrollTop: nextScrollTop,
          viewportHeight: lastKnownViewportHeight,
          overscanLeading: virtualState.overscanLeading,
          overscanTrailing: virtualState.overscanTrailing,
          timestamp,
          version: poolVersion,
        })
      }
    }
  }

  function runUpdate(
    args: DataGridViewportVirtualizationUpdateArgs,
  ): DataGridViewportVirtualizationPrepared | null {
    const {
      totalRowCount: totalRows,
      viewportHeight: viewportHeightValue,
      resolvedRowHeight,
      zoomFactor,
      virtualizationEnabled: virtualizationFlag,
      pendingScrollTop,
      lastScrollTopSample,
      pendingScrollTopRequest,
      measuredScrollTopFromPending,
      cachedNativeScrollHeight,
      containerHeight,
    } = args

    const prevViewportHeight = lastKnownViewportHeight
    const prevRowHeight = lastKnownRowHeight
    const prevTotalRows = lastKnownTotalRows
    const prevVirtualizationFlag = lastVirtualizationFlag

    lastKnownViewportHeight = viewportHeightValue
    lastKnownRowHeight = resolvedRowHeight
    lastKnownTotalRows = totalRows
    lastKnownNativeLimit = Math.max(0, cachedNativeScrollHeight - containerHeight)
    lastVirtualizationFlag = virtualizationFlag

    if (totalRows <= 0 || viewportHeightValue <= 0) {
      verticalVirtualizer.update({
        axis: "vertical",
        viewportSize: viewportHeightValue,
        scrollOffset: 0,
        virtualizationEnabled: virtualizationFlag,
        estimatedItemSize: resolvedRowHeight || 1,
        totalCount: totalRows,
        overscan: 0,
        meta: {
          zoom: zoomFactor,
          scrollDirection: 0,
          nativeScrollLimit: lastKnownNativeLimit,
          debug: false,
          debugNativeScrollLimit: undefined,
        },
      })

      for (const buffer of visibleBuffers) {
        if (buffer.length) {
          buffer.length = 0
        }
      }
      for (const buffer of visibleSnapshotBuffers) {
        if (buffer.length) {
          buffer.length = 0
        }
      }
      activeSnapshotBufferIndex = 0
      rowPool.length = 0
      rowPoolVersion = 0
      lastVisibleRowsSnapshot = visibleSnapshotBuffers[activeSnapshotBufferIndex] ?? []
      lastRowsCallbackSignature = -1
      visibleRange.value = { start: 0, end: 0 }
      scrollTop.value = 0
      const timestamp = clock.now()

      return {
        state: verticalVirtualizer.getState(),
        scrollTop: 0,
        lastScrollTopSample: 0,
        pendingScrollTop: null,
        visibleRange: { start: 0, end: 0 },
        syncedScrollTop: null,
        timestamp,
        pendingScrollWrite: null,
      }
    }

    const nowTs = clock.now()
    const deltaTop = Math.abs(pendingScrollTop - lastScrollTopSample)
    const direction = pendingScrollTop === lastScrollTopSample ? 0 : pendingScrollTop > lastScrollTopSample ? 1 : -1

    let overscan = 0
    if (virtualizationFlag) {
      const canReuseOverscan =
        deltaTop === 0 &&
        prevViewportHeight === viewportHeightValue &&
        prevRowHeight === resolvedRowHeight &&
        prevTotalRows === totalRows &&
        prevVirtualizationFlag === virtualizationFlag

      if (canReuseOverscan) {
        overscan = verticalOverscanController.getState().lastOverscan
      } else {
        const overscanResult = verticalOverscanController.update({
          timestamp: nowTs,
          delta: deltaTop,
          viewportSize: viewportHeightValue,
          itemSize: resolvedRowHeight,
          virtualizationEnabled: true,
        })
        overscan = overscanResult.overscan
      }
    } else {
      verticalOverscanController.reset(nowTs)
    }

    const verticalState = verticalVirtualizer.update({
      axis: "vertical",
      viewportSize: viewportHeightValue,
      scrollOffset: pendingScrollTop,
      virtualizationEnabled: virtualizationFlag,
      estimatedItemSize: resolvedRowHeight,
      totalCount: totalRows,
      overscan,
      meta: {
        zoom: zoomFactor,
        scrollDirection: direction,
        nativeScrollLimit: lastKnownNativeLimit,
        debug: diagnostics.isDebugEnabled(),
        debugNativeScrollLimit: diagnostics.isDebugEnabled() ? lastKnownNativeLimit : undefined,
      },
    })

    let nextScrollTop = clampScrollOffset({
      offset: verticalState.offset,
      limit: computeVerticalScrollLimit({
        estimatedItemSize: resolvedRowHeight,
        totalCount: totalRows,
        viewportSize: viewportHeightValue,
        overscanTrailing: verticalState.overscanTrailing,
        visibleCount: verticalState.visibleCount,
        nativeScrollLimit: lastKnownNativeLimit,
        trailingPadding: verticalConfig.edgePadding,
      }),
    })

    const needsScrollWrite =
      Math.abs(lastScrollTopSample - nextScrollTop) > verticalConfig.scrollEpsilon ||
      pendingScrollTopRequest != null ||
      measuredScrollTopFromPending

    const syncedScrollTop = needsScrollWrite ? nextScrollTop : null
    const pendingScrollWrite = needsScrollWrite ? nextScrollTop : null

    if (!needsScrollWrite) {
      nextScrollTop = lastScrollTopSample
    }

    const visibleStartIndex = Math.max(
      verticalState.startIndex,
      Math.min(verticalState.endIndex, verticalState.startIndex + Math.max(0, verticalState.overscanLeading)),
    )
    const visibleEndIndex = Math.min(
      verticalState.endIndex,
      visibleStartIndex + Math.max(0, verticalState.visibleCount),
    )

    return {
      state: verticalState,
      scrollTop: nextScrollTop,
      lastScrollTopSample: nextScrollTop,
      pendingScrollTop: null,
      visibleRange: { start: visibleStartIndex, end: visibleEndIndex },
      syncedScrollTop,
      timestamp: nowTs,
      pendingScrollWrite,
    }
  }

  function prepare(
    args: DataGridViewportVirtualizationUpdateArgs,
  ): DataGridViewportVirtualizationPrepared | null {
    totalRowCount.value = args.totalRowCount
    effectiveRowHeight.value = args.resolvedRowHeight
    virtualizationEnabled.value = args.virtualizationEnabled

    return runUpdate(args)
  }

  function applyPrepared(
    prepared: DataGridViewportVirtualizationPrepared,
    applyArgs: DataGridViewportVirtualizationApplyArgs,
  ): DataGridViewportVirtualizationResult {
    applyVirtualState(prepared, applyArgs)

    return {
      scrollTop: prepared.scrollTop,
      lastScrollTopSample: prepared.lastScrollTopSample,
      pendingScrollTop: prepared.pendingScrollTop,
      visibleRange: prepared.visibleRange,
      syncedScrollTop: prepared.syncedScrollTop,
      timestamp: prepared.timestamp,
      pendingScrollWrite: prepared.pendingScrollWrite,
    }
  }

  function update(
    args: DataGridViewportVirtualizationUpdateArgs,
  ): DataGridViewportVirtualizationResult | null {
    const prepared = prepare(args)
    if (!prepared) {
      return null
    }

    return applyPrepared(prepared, {
      resolveRow: args.resolveRow,
      resolveRowsInRange: args.resolveRowsInRange,
      imperativeCallbacks: args.imperativeCallbacks,
    })
  }

  return {
    resetOverscan,
    resetScrollState,
    clampScrollTop,
    prepare,
    applyPrepared,
    update,
  }
}
