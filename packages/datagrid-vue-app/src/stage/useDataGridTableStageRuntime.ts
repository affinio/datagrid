import { computed, nextTick, onMounted, ref, type ComputedRef, type CSSProperties, type Ref } from "vue"
import type {
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationSnapshot,
  DataGridRowNode,
  DataGridColumnSnapshot,
  DataGridRowSelectionSnapshot,
  DataGridSelectionSnapshot,
  DataGridSortState,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import {
  createDataGridAppRowHeightMetrics,
  type DataGridAppPasteOptions,
  useDataGridAppActiveCellViewport,
  useDataGridAppCellSelection,
  useDataGridAppClipboard,
  useDataGridAppHeaderResize,
  useDataGridAppInlineEditing,
  useDataGridAppInteractionController,
  useDataGridAppRowPresentation,
  useDataGridAppRowSizing,
  useDataGridAppViewport,
  useDataGridAppRuntimeSync,
  useDataGridAppViewportLifecycle,
} from "@affino/datagrid-vue/app"
import type { DataGridCellEditablePredicate } from "../dataGridEditability"
import type { DataGridHistoryController } from "../dataGridHistory"
import type {
  DataGridColumnMenuActionOptions,
  DataGridColumnMenuCustomItem,
  DataGridColumnMenuDisabledReasons,
  DataGridColumnMenuItemKey,
  DataGridColumnMenuItemLabels,
  DataGridColumnMenuTriggerMode,
} from "../overlays/dataGridColumnMenu"
import type { DataGridLayoutMode } from "../config/dataGridLayout"
import type { DataGridPlaceholderRowsOptions } from "../config/dataGridPlaceholderRows"
import type { DataGridVirtualizationOptions } from "../config/dataGridVirtualization"
import type { DataGridTableStageContext } from "./dataGridTableStageContext"
import { useDataGridTableStageBindings } from "./useDataGridTableStageBindings"
import { useDataGridTableStageCellIo } from "./useDataGridTableStageCellIo"
import { useDataGridTableStageColumns } from "./useDataGridTableStageColumns"
import { useDataGridTableStageFillAction } from "./useDataGridTableStageFillAction"
import { useDataGridTableStagePlaceholderRows } from "./useDataGridTableStagePlaceholderRows"
import type { DataGridTableStageHistoryAdapter } from "./useDataGridTableStageHistory"
import { useDataGridTableStageHistory } from "./useDataGridTableStageHistory"
import { useDataGridTableStageRowSelection } from "./useDataGridTableStageRowSelection"
import { useDataGridTableStageScrollSync } from "./useDataGridTableStageScrollSync"
import { useDataGridTableStageViewportKeyboard } from "./useDataGridTableStageViewportKeyboard"
import { useDataGridTableStageVisualSelection } from "./useDataGridTableStageVisualSelection"
import type {
  DataGridColumnMenuValueEntriesResult,
  DataGridTableRow,
  DataGridTableStageCellClass,
  DataGridTableStageCenterPaneDiagnostics,
  DataGridTableStageCustomOverlay,
  DataGridTableStageProps,
} from "./dataGridTableStage.types"

const DEFAULT_COLUMN_WIDTH = 140
const INDEX_COLUMN_WIDTH = 72
const MIN_COLUMN_WIDTH = 80
const MIN_ROW_HEIGHT = 24
const AUTO_RESIZE_SAMPLE_LIMIT = 400

export type { DataGridTableStageHistoryAdapter } from "./useDataGridTableStageHistory"

interface DataGridAppFillProjectionContext {
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
  treeData: null
  pivot: null
  pagination: DataGridPaginationSnapshot
}

interface DataGridAppResolveFillBoundaryRequest {
  direction: "up" | "down" | "left" | "right"
  baseRange: DataGridCopyRange
  fillColumns: readonly string[]
  referenceColumns: readonly string[]
  projection: DataGridAppFillProjectionContext
  startRowIndex: number
  startColumnIndex: number
  limit?: number | null
}

interface DataGridAppResolveFillBoundaryResult {
  endRowIndex: number | null
  endRowId?: string | number | null
  boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
  scannedRowCount?: number
  truncated?: boolean
  revision?: string | null
  projectionHash?: string | null
  boundaryToken?: string | null
}

interface DataGridAppFillOperationRecord {
  operationId: string
  revision?: string | number | null
  affectedRange: DataGridCopyRange | null
  mode: DataGridFillBehavior
}

type DataGridAppServerFillState = "committed" | "undone" | null

type DataGridFillBehavior = "copy" | "series"

interface DataGridTableStageRenderedBodyViewport {
  startRow: number
  endRow: number
}

type DataGridTableStageBodyRuntime<TRow extends Record<string, unknown>> = {
  api: UseDataGridRuntimeResult<TRow>["api"]
  rowModel?: UseDataGridRuntimeResult<TRow>["rowModel"]
  syncBodyRowsInRange: UseDataGridRuntimeResult<TRow>["syncBodyRowsInRange"]
  setViewportRange: UseDataGridRuntimeResult<TRow>["setViewportRange"]
  setRows?: UseDataGridRuntimeResult<TRow>["setRows"]
  rowPartition: UseDataGridRuntimeResult<TRow>["rowPartition"]
  virtualWindow: UseDataGridRuntimeResult<TRow>["virtualWindow"]
  columnSnapshot: UseDataGridRuntimeResult<TRow>["columnSnapshot"]
  setVirtualWindowRange?: (range: { start: number; end: number }) => void
} & {
  getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<TRow> | null
  resolveBodyRowIndexById: (rowId: string | number) => number
}

export interface UseDataGridTableStageRuntimeOptions<TRow extends Record<string, unknown>> {
  mode: Ref<"base" | "tree" | "pivot" | "worker">
  layoutMode: Ref<DataGridLayoutMode>
  minRows: Ref<number | null>
  maxRows: Ref<number | null>
  placeholderRows: Ref<DataGridPlaceholderRowsOptions<TRow>>
  enableFillHandle: Ref<boolean>
  enableRangeMove: Ref<boolean>
  rows: Ref<readonly TRow[]>
  sourceRows?: Ref<readonly TRow[]>
  runtime: DataGridTableStageBodyRuntime<TRow>
  runtimeRowModel?: {
    subscribe: UseDataGridRuntimeResult<TRow>["rowModel"]["subscribe"]
    getSnapshot: UseDataGridRuntimeResult<TRow>["rowModel"]["getSnapshot"]
    dataSource?: {
      resolveFillBoundary?: (
        request: DataGridAppResolveFillBoundaryRequest,
      ) => Promise<DataGridAppResolveFillBoundaryResult> | DataGridAppResolveFillBoundaryResult
      commitFillOperation?: (request: {
        operationId?: string | null
        revision?: string | number | null
        baseRevision?: string | null
        projectionHash?: string | null
        boundaryToken?: string | null
        projection: DataGridAppFillProjectionContext
        sourceRange: DataGridCopyRange
        targetRange: DataGridCopyRange
        sourceRowIds?: readonly (string | number)[]
        targetRowIds?: readonly (string | number)[]
        fillColumns: readonly string[]
        referenceColumns: readonly string[]
        mode: DataGridFillBehavior
        metadata?: { origin?: "drag-fill" | "double-click-fill" | "menu-reapply"; behaviorSource?: "default" | "explicit" } | null
      }) => Promise<{ operationId: string; revision?: string | number | null; affectedRowCount: number; affectedCellCount?: number; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
      undoFillOperation?: (request: {
        operationId: string
        revision?: string | number | null
        projection: DataGridAppFillProjectionContext
      }) => Promise<{ operationId: string; revision?: string | number | null; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
      redoFillOperation?: (request: {
        operationId: string
        revision?: string | number | null
        projection: DataGridAppFillProjectionContext
      }) => Promise<{ operationId: string; revision?: string | number | null; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
    }
    rowModel?: {
      dataSource?: {
        resolveFillBoundary?: (
          request: DataGridAppResolveFillBoundaryRequest,
        ) => Promise<DataGridAppResolveFillBoundaryResult> | DataGridAppResolveFillBoundaryResult
        commitFillOperation?: (request: {
          operationId?: string | null
          revision?: string | number | null
          baseRevision?: string | null
          projectionHash?: string | null
          boundaryToken?: string | null
          projection: DataGridAppFillProjectionContext
          sourceRange: DataGridCopyRange
          targetRange: DataGridCopyRange
          sourceRowIds?: readonly (string | number)[]
          targetRowIds?: readonly (string | number)[]
          fillColumns: readonly string[]
          referenceColumns: readonly string[]
          mode: DataGridFillBehavior
          metadata?: { origin?: "drag-fill" | "double-click-fill" | "menu-reapply"; behaviorSource?: "default" | "explicit" } | null
        }) => Promise<{ operationId: string; revision?: string | number | null; affectedRowCount: number; affectedCellCount?: number; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
        undoFillOperation?: (request: {
          operationId: string
          revision?: string | number | null
          projection: DataGridAppFillProjectionContext
        }) => Promise<{ operationId: string; revision?: string | number | null; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
        redoFillOperation?: (request: {
          operationId: string
          revision?: string | number | null
          projection: DataGridAppFillProjectionContext
        }) => Promise<{ operationId: string; revision?: string | number | null; invalidation?: { kind: "range"; range: DataGridCopyRange; reason?: string } | null; warnings?: readonly string[] } | null>
      }
    }
  } | null
  rowVersion: Ref<number>
  totalRuntimeRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  rowRenderMode: Ref<"virtualization" | "pagination">
  rowHeightMode: Ref<"fixed" | "auto">
  normalizedBaseRowHeight: Ref<number>
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  selectionAnchor: Ref<unknown>
  syncSelectionSnapshotFromRuntime: () => void
  rowSelectionSnapshot: Ref<DataGridRowSelectionSnapshot | null>
  rowHover?: Ref<boolean>
  stripedRows?: Ref<boolean>
  chromeSignature?: Ref<string | undefined>
  showRowIndex?: Ref<boolean>
  showRowSelection?: Ref<boolean>
  isRowInPendingClipboardCut?: (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>) => boolean
  syncRowSelectionSnapshotFromRuntime?: () => void
  flushRowSelectionSnapshotUpdates?: () => void
  firstColumnKey: Ref<string>
  columnFilterTextByKey: Ref<Record<string, string>>
  virtualization: Ref<DataGridVirtualizationOptions>
  reorderColumnsByHeader?: (payload: {
    sourceColumnKey: string
    targetColumnKey: string
    placement: "before" | "after"
  }) => boolean
  toggleSortForColumn: (columnKey: string, additive?: boolean) => void
  handleHeaderColumnClick?: (columnKey: string, options: { additive: boolean; extend: boolean }) => void
  sortIndicator: (columnKey: string) => string
  setColumnFilterText: (columnKey: string, value: string) => void
  columnMenuEnabled?: Ref<boolean>
  columnMenuTrigger?: Ref<DataGridColumnMenuTriggerMode>
  columnMenuValueFilterEnabled?: Ref<boolean>
  columnMenuValueFilterRowLimit?: Ref<number>
  columnMenuMaxFilterValues?: Ref<number>
  resolveColumnMenuItems?: (columnKey: string) => readonly DataGridColumnMenuItemKey[]
  resolveColumnMenuDisabledItems?: (columnKey: string) => readonly DataGridColumnMenuItemKey[]
  resolveColumnMenuDisabledReasons?: (columnKey: string) => DataGridColumnMenuDisabledReasons
  resolveColumnMenuLabels?: (columnKey: string) => DataGridColumnMenuItemLabels
  resolveColumnMenuActionOptions?: (columnKey: string) => DataGridColumnMenuActionOptions
  resolveColumnMenuCustomItems?: (columnKey: string) => readonly DataGridColumnMenuCustomItem[]
  isColumnFilterActive?: (columnKey: string) => boolean
  isColumnGrouped?: (columnKey: string) => boolean
  resolveColumnGroupOrder?: (columnKey: string) => number | null
  resolveColumnMenuSortDirection?: (columnKey: string) => "asc" | "desc" | null
  resolveColumnMenuSelectedTokens?: (columnKey: string) => readonly string[]
  resolveColumnMenuValueEntries?: (columnKey: string, search?: string) => DataGridColumnMenuValueEntriesResult
  applyColumnMenuSort?: (columnKey: string, direction: "asc" | "desc" | null) => void
  applyColumnMenuPin?: (columnKey: string, pin: import("@affino/datagrid-vue").DataGridColumnPin) => void
  applyColumnMenuGroupBy?: (columnKey: string, grouped: boolean) => void
  applyColumnMenuFilter?: (columnKey: string, tokens: readonly string[]) => void
  clearColumnMenuFilter?: (columnKey: string) => void
  onCellEdit?: (payload: {
    rowId: string | number
    columnKey: string
    oldValue: unknown
    newValue: unknown
    patch: {
      rowId: string | number
      data: Partial<TRow>
    }
  }) => void
  applyRowHeightSettings: () => void
  cloneRowData: (row: TRow) => TRow
  readClipboardCell?: (row: DataGridRowNode<TRow>, columnKey: string) => string
  readSelectionCell?: (row: DataGridRowNode<TRow>, columnKey: string) => unknown
  applyClipboardEdits?: (
    range: DataGridCopyRange,
    matrix: string[][],
    options?: { recordHistory?: boolean },
  ) => number
  buildFillMatrixFromRange?: (range: DataGridCopyRange) => string[][]
  buildPasteSpecialMatrixFromRange?: (
    range: DataGridCopyRange,
    mode: "values",
  ) => string[][]
  applyRangeMove?: (baseRange: DataGridCopyRange, targetRange: DataGridCopyRange) => boolean | Promise<boolean>
  isCellEditable?: DataGridCellEditablePredicate<TRow>
  history?: DataGridTableStageHistoryAdapter
  historyEnabled?: Ref<boolean>
  historyMaxDepth?: Ref<number | undefined>
  historyShortcuts?: Ref<false | "grid" | "window">
  isContextMenuVisible?: () => boolean
  closeContextMenu?: () => void
  openContextMenuFromCurrentCell?: () => void
  clearExternalPendingClipboardOperation?: () => boolean
  reportFillWarning?: (message: string) => void
  reportCenterPaneDiagnostics?: (payload: DataGridTableStageCenterPaneDiagnostics) => void
  reportFillPlumbingState?: (layer: string, present: boolean) => void
  reportFillPlumbingDetail?: (layer: string, value: string) => void
  runRowIndexKeyboardAction?: (
    action: "insert-row-above" | "copy-row" | "cut-row" | "paste-row" | "delete-selected-rows" | "open-row-menu",
    rowId: string | number,
  ) => Promise<boolean> | boolean
  reorderRowsByIndex?: (payload: {
    sourceRowId: string | number
    targetRowId: string | number
    placement: "before" | "after"
  }) => boolean
  cellClass?: (
    row: DataGridTableRow<TRow>,
    rowIndex: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ) => DataGridTableStageCellClass | null | undefined
  cellStyle?: (
    row: DataGridTableRow<TRow>,
    rowIndex: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ) => CSSProperties | null | undefined
}

export interface UseDataGridTableStageRuntimeResult<TRow extends Record<string, unknown>> {
  tableStageProps: ComputedRef<DataGridTableStageProps<TRow>>
  tableStageContext: DataGridTableStageContext<TRow>
  historyController: DataGridHistoryController
  syncViewportFromDom: () => void
  copySelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelectedCells: (
    trigger?: "keyboard" | "context-menu",
    options?: DataGridAppPasteOptions,
  ) => Promise<boolean>
  cutSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  clearSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  captureHistorySnapshot: () => unknown
  captureHistorySnapshotForRowIds: (rowIds: readonly (string | number)[]) => unknown
  recordHistoryIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
  ) => void
  revealCellInComfortZone: (rowIndex: number, columnIndex: number) => Promise<void>
}

type StageInteractionControllerResult<TRow extends Record<string, unknown>> =
  ReturnType<typeof useDataGridAppInteractionController<TRow, unknown>> & {
    handleRowIndexKeydown: (
      event: KeyboardEvent,
      row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
      rowOffset: number,
    ) => void
    clearSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  }

export function useDataGridTableStageRuntime<
  TRow extends Record<string, unknown>,
>(
  options: UseDataGridTableStageRuntimeOptions<TRow>,
): UseDataGridTableStageRuntimeResult<TRow> {
  const syncRowSelectionSnapshotFromRuntime = options.syncRowSelectionSnapshotFromRuntime ?? (() => undefined)
  const flushRowSelectionSnapshotUpdates = options.flushRowSelectionSnapshotUpdates ?? (() => undefined)
  const rowSelectionSnapshotRef = options.rowSelectionSnapshot ?? ref<DataGridRowSelectionSnapshot | null>(null)
  const latestRenderedBodyViewport = ref<DataGridTableStageRenderedBodyViewport | null>(null)
  const showRowIndex = computed(() => options.showRowIndex?.value !== false)
  const totalBodyRows = computed(() => options.runtime.rowPartition.value.bodyRowCount)
  const placeholderRows = useDataGridTableStagePlaceholderRows<TRow>({
    runtime: options.runtime,
    sourceRows: options.sourceRows ?? options.rows,
    totalBodyRows,
    placeholderRows: options.placeholderRows,
    cloneRowData: options.cloneRowData,
  })
  const totalSelectableRows = computed(() => Math.max(0, placeholderRows.totalVisualRows.value))
  const totalInteractiveRows = computed(() => {
    return Math.max(0, totalSelectableRows.value + options.runtime.rowPartition.value.pinnedBottomRows.length)
  })
  const effectiveIndexColumnWidth = computed(() => (showRowIndex.value ? INDEX_COLUMN_WIDTH : 0))
  const columnService = useDataGridTableStageColumns<TRow>({
    runtime: options.runtime,
    visibleColumns: options.visibleColumns,
    showRowSelection: options.showRowSelection,
    isCellEditable: options.isCellEditable,
  })
  const {
    orderedVisibleColumns,
    centerColumns,
    resolveColumnWidth,
    isRowSelectionColumnKey,
    isRowSelectionColumn,
    isCellEditable,
    isCellEditableByKey,
    rowSelectionColumn,
  } = columnService

  const rowHeightMetrics = createDataGridAppRowHeightMetrics({
    totalRows: () => totalSelectableRows.value,
    resolveBaseRowHeight: () => options.normalizedBaseRowHeight.value,
    resolveRowHeightOverride: rowIndex => options.runtime.api.view.getRowHeightOverride(rowIndex),
    resolveRowHeightVersion: () => options.runtime.api.view.getRowHeightVersion(),
    hasRowHeightOverrides: () => options.runtime.api.view.getRowHeightVersion() > 0,
    resolveRowHeightOverridesSnapshot: () => options.runtime.api.view.getRowHeightOverridesSnapshot?.() ?? null,
    resolveLastRowHeightMutation: () => options.runtime.api.view.getLastRowHeightMutation?.() ?? null,
  })
  const resolveHeightForRowSpan = (rowCount: number): number => {
    const normalizedRowCount = Math.max(0, Math.trunc(rowCount))
    if (normalizedRowCount <= 0) {
      return 0
    }
    const totalResolvedHeight = rowHeightMetrics.resolveTotalHeight()
    if (normalizedRowCount <= totalBodyRows.value) {
      return rowHeightMetrics.resolveRowOffset(normalizedRowCount)
    }
    return totalResolvedHeight + ((normalizedRowCount - totalBodyRows.value) * options.normalizedBaseRowHeight.value)
  }
  const autoHeightBodyHeight = computed<number | null>(() => {
    if (options.layoutMode.value !== "auto-height") {
      return null
    }
    let resolvedHeight = rowHeightMetrics.resolveTotalHeight()
    if (options.minRows.value !== null) {
      resolvedHeight = Math.max(resolvedHeight, resolveHeightForRowSpan(options.minRows.value))
    }
    if (options.maxRows.value !== null) {
      resolvedHeight = Math.min(resolvedHeight, resolveHeightForRowSpan(options.maxRows.value))
    }
    return Math.max(0, Math.trunc(resolvedHeight))
  })
  const stageStyle = computed<CSSProperties>(() => {
    if (options.layoutMode.value !== "auto-height") {
      return {}
    }
    return {
      height: "auto",
    }
  })
  const bodyShellStyle = computed<CSSProperties>(() => {
    if (options.layoutMode.value !== "auto-height") {
      return {}
    }
    const resolvedHeight = autoHeightBodyHeight.value ?? 0
    return {
      height: `${resolvedHeight}px`,
      maxHeight: `${resolvedHeight}px`,
    }
  })

  let isEditingCellForSelection: (
    row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
    columnKey: string,
  ) => boolean = () => false

  const {
    headerViewportRef,
    bodyViewportRef,
    displayRows,
    displayRowsRevision,
    renderedViewportRange,
    pinnedBottomRows,
    renderedColumns,
    viewportRowStart,
    viewportRowEnd,
    viewportColumnStart,
    topSpacerHeight,
    bottomSpacerHeight,
    leftColumnSpacerWidth,
    rightColumnSpacerWidth,
    gridContentStyle,
    mainTrackStyle,
    indexColumnStyle,
    columnStyle: _viewportColumnStyle,
    handleViewportScroll,
    syncRenderedRowsInRange,
    syncViewportFromDom,
    scheduleViewportSync,
    cancelScheduledViewportSync,
  } = useDataGridAppViewport<TRow>({
    runtime: placeholderRows.visualRuntime,
    mode: options.mode,
    rowRenderMode: options.rowRenderMode,
    rowVirtualizationEnabled: computed(() => options.virtualization.value.rows),
    columnVirtualizationEnabled: computed(() => options.virtualization.value.columns),
    totalRows: totalSelectableRows,
    visibleColumns: centerColumns,
    sizingColumns: orderedVisibleColumns,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    resolveColumnWidth,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    indexColumnWidth: 0,
    flexFillOffsetWidth: effectiveIndexColumnWidth.value,
    rowOverscan: computed(() => options.virtualization.value.rowOverscan),
    columnOverscan: computed(() => options.virtualization.value.columnOverscan),
    measureVisibleRowHeights: () => measureVisibleRowHeights(),
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowOffset: rowHeightMetrics.resolveRowOffset,
    resolveRowIndexAtOffset: rowHeightMetrics.resolveRowIndexAtOffset,
    resolveTotalRowHeight: rowHeightMetrics.resolveTotalHeight,
  })

  const runtimeRowModelRevision = computed(() => {
    void options.rowVersion.value
    void options.runtime.rowPartition.value
    return options.runtimeRowModel?.getSnapshot?.().revision ?? options.runtime.api.rows.getSnapshot().revision ?? null
  })

  const handleCenterPaneDiagnostics = (payload: DataGridTableStageCenterPaneDiagnostics): void => {
    if ("renderedViewport" in payload && payload.renderedViewport) {
      latestRenderedBodyViewport.value = {
        startRow: Math.max(0, Math.trunc(payload.renderedViewport.start)),
        endRow: Math.max(Math.max(0, Math.trunc(payload.renderedViewport.start)), Math.trunc(payload.renderedViewport.end)),
      }
      options.reportFillPlumbingDetail?.("centerPaneStoredRenderedViewport", formatRenderedBodyViewport(latestRenderedBodyViewport.value))
    }
    if (typeof payload.debugJson === "string" && payload.debugJson.length > 0) {
      try {
        const parsed = JSON.parse(payload.debugJson) as {
          renderedViewport?: { start?: number | null; end?: number | null } | null
        }
        const start = parsed.renderedViewport?.start
        const end = parsed.renderedViewport?.end
        if (latestRenderedBodyViewport.value == null && Number.isFinite(start) && Number.isFinite(end)) {
          latestRenderedBodyViewport.value = {
            startRow: Math.max(0, Math.trunc(start as number)),
            endRow: Math.max(Math.max(0, Math.trunc(start as number)), Math.trunc(end as number)),
          }
          options.reportFillPlumbingDetail?.("centerPaneStoredRenderedViewport", formatRenderedBodyViewport(latestRenderedBodyViewport.value))
        }
      } catch {
        // Ignore malformed diagnostics payloads.
      }
    }
    options.reportCenterPaneDiagnostics?.(payload)
  }
  const resolveStageColumnStyle = (columnKey: string): Record<string, string> => {
    return _viewportColumnStyle(columnKey)
  }

  const selectableRuntime = placeholderRows.visualRuntime
  const resolveSelectableRowIndexById = selectableRuntime.resolveBodyRowIndexById
  const resolveSelectableRowAtIndex = (rowIndex: number): DataGridTableRow<TRow> | null => {
    if (!Number.isFinite(rowIndex)) {
      return null
    }
    const normalizedIndex = Math.max(0, Math.trunc(rowIndex))
    if (normalizedIndex < totalSelectableRows.value) {
      return selectableRuntime.getBodyRowAtIndex(normalizedIndex)
    }
    const pinnedBottomIndex = normalizedIndex - totalSelectableRows.value
    return options.runtime.rowPartition.value.pinnedBottomRows[pinnedBottomIndex] ?? null
  }

  const {
    rowStyle,
    isRowAutosizeProbe,
    measureVisibleRowHeights,
    startRowResize,
    autosizeRow,
    consumeRecentRowResizeInteraction,
    dispose: disposeRowSizing,
  } = useDataGridAppRowSizing<TRow>({
    mode: options.mode,
    rowHeightMode: options.rowHeightMode,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    viewportRowStart,
    bodyViewportRef,
    runtime: options.runtime as never,
    minRowHeight: MIN_ROW_HEIGHT,
    syncViewport: () => syncViewportFromDom(),
  })

  const selectionController = useDataGridAppCellSelection<TRow>({
    mode: options.mode,
    runtime: {
      api: selectableRuntime.api,
      getBodyRowAtIndex: resolveSelectableRowAtIndex,
    } as never,
    totalRows: totalInteractiveRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    resolveRowIndex: (rowOffset: number) => {
      const row = displayRows.value[rowOffset]
      return row && Number.isFinite(row.displayIndex)
        ? Math.max(0, Math.trunc(row.displayIndex))
        : viewportRowStart.value + rowOffset
    },
    selectionSnapshot: options.selectionSnapshot,
    selectionAnchor: options.selectionAnchor as never,
    isEditingCell: (row, columnKey): boolean => isEditingCellForSelection(row, columnKey),
  })

  const {
    normalizeRowId,
    normalizeCellCoord,
    resolveSelectionRange: resolveSelectionRangeForClipboard,
    resolveSelectionRanges,
    resolveCurrentCellCoord: resolveCurrentCellCoordForClipboard,
    applySelectionRange: applyClipboardSelectionRange,
    applyCellSelectionByCoord,
    setCellSelection,
    clearCellSelection,
    isCellSelected: isCommittedCellSelected,
  } = selectionController
  const isCommittedSelectionAnchorCell = selectionController.isSelectionAnchorCell ?? (() => false)
  const shouldHighlightCommittedSelectedCell = selectionController.shouldHighlightSelectedCell
    ?? ((rowOffset: number, columnIndex: number) => isCommittedCellSelected(rowOffset, columnIndex))
  const isCommittedCellOnSelectionEdge = selectionController.isCellOnSelectionEdge
    ?? (() => false)
  const selectionAnchorCell = computed(() => {
    const snapshot = options.selectionSnapshot.value
    if (!snapshot || snapshot.ranges.length === 0) {
      return null
    }
    const activeIndex = snapshot.activeRangeIndex ?? 0
    const anchor = snapshot.ranges[activeIndex]?.anchor ?? snapshot.ranges[0]?.anchor ?? null
    if (
      !anchor
      || typeof anchor.rowIndex !== "number"
      || typeof anchor.colIndex !== "number"
      || !Number.isFinite(anchor.rowIndex)
      || !Number.isFinite(anchor.colIndex)
    ) {
      return null
    }
    return {
      rowIndex: Math.trunc(anchor.rowIndex),
      columnIndex: Math.trunc(anchor.colIndex),
    }
  })

  const rowSelectionService = useDataGridTableStageRowSelection<TRow>({
    runtime: options.runtime,
    isPlaceholderRow: placeholderRows.isPlaceholderRow,
    rowSelectionColumn,
    orderedVisibleColumns,
    displayRows,
    rowSelectionSnapshot: rowSelectionSnapshotRef,
    applyRowSelectionMutation: mutator => {
      if (!options.runtime.api.rowSelection.hasSupport()) {
        return
      }
      mutator(options.runtime.api.rowSelection)
      syncRowSelectionSnapshotFromRuntime()
      flushRowSelectionSnapshotUpdates()
    },
    viewportRowStart,
    selectionAnchorCell,
    applySelectionRange: applyClipboardSelectionRange,
  })
  const {
    readRowSelectionCell,
    readRowSelectionDisplayCell,
    toggleRowCheckboxSelected,
  } = rowSelectionService

  const stageIndexColumnStyle = computed(() => {
    const width = `${effectiveIndexColumnWidth.value}px`
    return {
      ...indexColumnStyle.value,
      width,
      minWidth: width,
      maxWidth: width,
    }
  })

  const historyService = useDataGridTableStageHistory<TRow>({
    runtime: options.runtime,
    cloneRowData: options.cloneRowData,
    syncViewport: () => syncViewportFromDom(),
    enabled: options.historyEnabled?.value !== false,
    maxHistoryDepth: options.historyMaxDepth?.value,
    history: options.history,
  })
  const {
    captureHistorySnapshot,
    captureHistorySnapshotForRowIds,
    recordHistoryIntentTransaction,
    canUndoHistory,
    canRedoHistory,
    runHistoryAction: runIntentHistoryAction,
  } = historyService
  const lastServerFillOperation = ref<DataGridAppFillOperationRecord | null>(null)
  const lastServerFillState = ref<DataGridAppServerFillState>(null)
  const lastServerFillCustomOverlays = computed<readonly DataGridTableStageCustomOverlay[]>(() => {
    const operation = lastServerFillOperation.value
    if (!operation?.affectedRange) {
      return []
    }
    return [{
      key: "server-fill-affected-range",
      ranges: [operation.affectedRange],
      className: "grid-selection-overlay--server-fill",
      segmentClassName: "grid-selection-overlay__segment--server-fill",
      borderColor: "color-mix(in srgb, var(--datagrid-accent-strong) 72%, var(--datagrid-text-color) 28%)",
      backgroundColor: "color-mix(in srgb, var(--datagrid-accent-strong) 10%, transparent)",
      borderStyle: "solid",
      hideSingleCell: false,
      zIndex: 7,
    }]
  })

  const {
    rowIndexLabel,
    readCell,
    readDisplayCell,
    rowClass,
    toggleGroupRow,
  } = useDataGridAppRowPresentation<TRow>({
    mode: options.mode,
    runtime: options.runtime as never,
    viewportRowStart,
    firstColumnKey: options.firstColumnKey,
  })

  const cellIoService = useDataGridTableStageCellIo<TRow>({
    runtime: options.runtime,
    viewportRowStart,
    ensureEditableRowAtIndex: rowIndex => placeholderRows.ensureMaterializedRowAt(rowIndex, "toggle"),
    isRowSelectionColumnKey,
    isRowSelectionColumn,
    isCellEditableByKey,
    readRowSelectionCell,
    readRowSelectionDisplayCell,
    readCell,
    readDisplayCell,
    toggleRowCheckboxSelected,
    captureHistorySnapshot,
    captureHistorySnapshotForRowIds,
    recordHistoryIntentTransaction,
    syncViewport: () => syncViewportFromDom(),
  })
  const {
    readStageCell,
  } = cellIoService

  const isResolvedSurfaceCellEditable = (
    row: DataGridTableRow<TRow>,
    column: DataGridColumnSnapshot | null | undefined,
    fallback: () => boolean,
  ): boolean => {
    if (placeholderRows.isPlaceholderRow(row)) {
      return placeholderRows.isPlaceholderCellEditable(column)
    }
    return fallback()
  }

  const isSurfaceCellEditableByKey = (
    row: DataGridTableRow<TRow>,
    rowIndex: number,
    columnKey: string,
    columnIndex: number,
  ): boolean => {
    return isResolvedSurfaceCellEditable(
      row,
      orderedVisibleColumns.value[columnIndex],
      () => isCellEditableByKey(row, rowIndex, columnKey, columnIndex),
    )
  }

  const clipboard = useDataGridAppClipboard<TRow, unknown>({
    mode: options.mode,
    runtime: selectableRuntime as never,
    totalRows: totalSelectableRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    resolveSelectionRange: resolveSelectionRangeForClipboard,
    resolveSelectionRanges,
    resolveCurrentCellCoord: resolveCurrentCellCoordForClipboard,
    applySelectionRange: applyClipboardSelectionRange,
    clearCellSelection,
    captureRowsSnapshot: captureHistorySnapshot,
    captureRowsSnapshotForRowIds: captureHistorySnapshotForRowIds,
    recordEditTransaction: (beforeSnapshot, afterSnapshotOverride, label) => {
      recordHistoryIntentTransaction({
        intent: "edit",
        label: label ?? "Cell edit",
      }, beforeSnapshot, afterSnapshotOverride)
    },
    readCell: (row, columnKey) => readStageCell(row, columnKey),
    readClipboardCell: options.readClipboardCell
      ? (row, columnKey) => options.readClipboardCell?.(row, columnKey) ?? ""
      : undefined,
    isCellEditable: isSurfaceCellEditableByKey,
    syncViewport: () => syncViewportFromDom(),
    applyClipboardEdits: options.applyClipboardEdits,
    buildFillMatrixFromRange: options.buildFillMatrixFromRange,
    buildPasteSpecialMatrixFromRange: options.buildPasteSpecialMatrixFromRange,
    ensureEditableRowAtIndex: rowIndex => placeholderRows.ensureMaterializedRowAt(rowIndex, "paste"),
  })

  const {
    normalizeClipboardRange,
    applyClipboardEdits,
    rangesEqual,
    buildFillMatrixFromRange,
    clearPendingClipboardOperation,
    copySelectedCells,
    pasteSelectedCells,
    cutSelectedCells,
    isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge,
  } = clipboard

  const {
    ensureKeyboardActiveCellVisible,
    revealCellInComfortZone,
  } = useDataGridAppActiveCellViewport({
    bodyViewportRef,
    visibleColumns: orderedVisibleColumns,
    resolveColumnWidth,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowOffset: rowHeightMetrics.resolveRowOffset,
    indexColumnWidth: effectiveIndexColumnWidth.value,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    syncViewport: () => syncViewportFromDom(),
  })

  const {
    editingCell,
    editingCellValue,
    editingCellInitialFilter,
    editingCellOpenOnMount,
    isEditingCell,
    startInlineEdit,
    appendInlineEditTextInput,
    commitInlineEdit,
    cancelInlineEdit,
    handleEditorKeydown,
    handleEditorBlur,
  } = useDataGridAppInlineEditing<TRow, unknown>({
    mode: options.mode,
    bodyViewportRef,
    visibleColumns: orderedVisibleColumns,
    totalRows: totalSelectableRows,
    runtime: selectableRuntime as never,
    readCell: (row, columnKey) => readStageCell(row, columnKey),
    resolveRowIndexById: resolveSelectableRowIndexById,
    applyCellSelection: coord => {
      applyCellSelectionByCoord(coord, false)
    },
    ensureActiveCellVisible: (rowIndex, columnIndex) => {
      ensureKeyboardActiveCellVisible(rowIndex, columnIndex)
    },
    isCellEditable: isSurfaceCellEditableByKey,
    captureRowsSnapshot: captureHistorySnapshot,
    captureRowsSnapshotForRowIds: captureHistorySnapshotForRowIds,
    recordEditTransaction: (beforeSnapshot, afterSnapshotOverride, label) => {
      recordHistoryIntentTransaction({
        intent: "edit",
        label: label ?? "Cell edit",
      }, beforeSnapshot, afterSnapshotOverride)
    },
    ensureEditableRowAtIndex: rowIndex => placeholderRows.ensureMaterializedRowAt(rowIndex, "edit"),
    onCellEdit: options.onCellEdit,
  })

  isEditingCellForSelection = isEditingCell

  const editingCellRef = computed(() => editingCell.value)

  onMounted(() => {
    options.reportFillPlumbingState?.("runtime_diagnostics_alive", true)
    options.reportFillPlumbingDetail?.("runtime_diagnostics_alive", "yes")
  })

  function buildFillProjectionContext(): DataGridAppFillProjectionContext {
    const snapshot = options.runtime.api.rows.getSnapshot() as {
      sortModel?: readonly DataGridSortState[]
      filterModel?: DataGridFilterSnapshot | null
      groupBy?: DataGridGroupBySpec | null
      groupExpansion?: DataGridGroupExpansionSnapshot
      pagination?: DataGridPaginationSnapshot
    }
    return {
      sortModel: snapshot.sortModel ?? [],
      filterModel: snapshot.filterModel ?? null,
      groupBy: snapshot.groupBy ?? null,
      groupExpansion: snapshot.groupExpansion ?? { expandedByDefault: false, toggledGroupKeys: [] },
      treeData: null,
      pivot: null,
      pagination: snapshot.pagination ?? {
        enabled: false,
        pageSize: 0,
        currentPage: 0,
        pageCount: 0,
        totalRowCount: 0,
        startIndex: 0,
        endIndex: 0,
      },
    }
  }

  function formatRuntimeRowModelSnapshot(): string {
    const snapshot = options.runtimeRowModel?.getSnapshot?.()
    if (!snapshot) {
      return "none"
    }
    const viewport = snapshot.viewportRange
    return [
      `rowCount=${snapshot.rowCount}`,
      `loading=${snapshot.loading ? "yes" : "no"}`,
      `viewport=${viewport.start}..${viewport.end}`,
      `revision=${snapshot.revision ?? "none"}`,
    ].join(" ")
  }

  function readDebugRegion(row: DataGridRowNode<TRow> | null | undefined): string {
    if (!row || row.kind === "group") {
      return "none"
    }
    return String((row.row as Record<string, unknown>).region ?? (row.data as Record<string, unknown>).region ?? "none")
  }

  function formatDebugRow(row: DataGridRowNode<TRow> | null | undefined): string {
    if (!row) {
      return "none"
    }
    return `${String(row.rowId)}:${readDebugRegion(row)}`
  }

  function resolveRenderedBodyViewportRange(): DataGridCopyRange | null {
    const rows = displayRows.value
    if (rows.length === 0) {
      return null
    }
    const first = rows[0]
    const last = rows[rows.length - 1]
    const firstDisplayIndex = first && Number.isFinite(first.displayIndex)
      ? Math.max(0, Math.trunc(first.displayIndex))
      : null
    const lastDisplayIndex = last && Number.isFinite(last.displayIndex)
      ? Math.max(0, Math.trunc(last.displayIndex))
      : null
    const startRow = firstDisplayIndex != null
      ? firstDisplayIndex
      : viewportRowStart.value
    const endRow = lastDisplayIndex != null
      ? Math.max(startRow, lastDisplayIndex)
      : Math.max(startRow, startRow + rows.length - 1)
    return {
      startRow,
      endRow,
      startColumn: 0,
      endColumn: Math.max(0, options.visibleColumns.value.length - 1),
    }
  }

  function reportRendererViewportDiagnostics(reason: string): void {
    const sampleRowId = "srv-000025"
    const sampleVisibleIndex = selectableRuntime.resolveBodyRowIndexById(sampleRowId)
    const sampleRow = sampleVisibleIndex >= 0
      ? selectableRuntime.getBodyRowAtIndex(sampleVisibleIndex)
      : null
    const sampleValue = sampleRow && sampleRow.kind !== "group"
      ? String((sampleRow.row as Record<string, unknown>).region ?? "none")
      : "none"
    const firstVisibleRows = [
      selectableRuntime.getBodyRowAtIndex(0),
      selectableRuntime.getBodyRowAtIndex(1),
      selectableRuntime.getBodyRowAtIndex(2),
      selectableRuntime.getBodyRowAtIndex(3),
      selectableRuntime.getBodyRowAtIndex(4),
    ]
      .filter((row): row is DataGridRowNode<TRow> => row != null)
      .map(row => String(row.rowId))
      .join(", ")
    options.reportFillPlumbingDetail?.("runtime_viewport_range", `${viewportRowStart.value}..${viewportRowEnd.value}`)
    options.reportFillPlumbingDetail?.("runtime_rowModel_snapshot", formatRuntimeRowModelSnapshot())
    options.reportFillPlumbingDetail?.("runtime_visible_first5", firstVisibleRows || "none")
    options.reportFillPlumbingDetail?.("runtime_sample_row25_visible_index", sampleVisibleIndex >= 0 ? String(sampleVisibleIndex) : "none")
    options.reportFillPlumbingDetail?.("runtime_sample_row25_region", sampleValue)
    const sourceRow1BeforeSync = options.runtime.getBodyRowAtIndex(1)
    const sourceSyncRows = options.runtime.syncBodyRowsInRange({
      start: 0,
      end: Math.min(23, Math.max(0, options.runtime.rowPartition.value.bodyRowCount - 1)),
    })
    const sourceSyncRow1 = sourceSyncRows.find(row => Math.trunc(row.displayIndex) === 1) ?? sourceSyncRows[1] ?? null
    const sourceRow1AfterSync = options.runtime.getBodyRowAtIndex(1)
    const displayRow1 = displayRows.value[1] ?? null
    options.reportFillPlumbingDetail?.(
      "server_fill_row1_cache_status",
      sourceRow1BeforeSync != null && sourceSyncRow1 != null && sourceRow1BeforeSync === sourceSyncRow1
        ? "cache-hit"
        : "pulled-fresh",
    )
    options.reportFillPlumbingDetail?.("server_fill_row1_sync_value", formatDebugRow(sourceSyncRow1))
    options.reportFillPlumbingDetail?.("source_body_row1", formatDebugRow(sourceRow1AfterSync))
    options.reportFillPlumbingDetail?.("source_body_row1_identity", [
      `before=${formatDebugRow(sourceRow1BeforeSync)}`,
      `sameDisplay=${sourceRow1AfterSync != null && displayRow1 != null && sourceRow1AfterSync === displayRow1 ? "yes" : "no"}`,
      `sameSync=${sourceRow1AfterSync != null && sourceSyncRow1 != null && sourceRow1AfterSync === sourceSyncRow1 ? "yes" : "no"}`,
      `revision=${runtimeRowModelRevision.value ?? "none"}`,
    ].join(" "))
    options.reportFillPlumbingDetail?.("source_sync_row1", formatDebugRow(sourceSyncRow1))
    options.reportFillPlumbingState?.("runtime_redraw_happened", true)
    options.reportFillPlumbingDetail?.("runtime_redraw_reason", reason)
  }

  async function refreshVisibleViewportAfterServerFill(
    invalidationRange?: DataGridCopyRange | { start?: unknown; end?: unknown; startRow?: unknown; endRow?: unknown } | null,
  ): Promise<void> {
    const runtimeRowModel = options.runtimeRowModel as unknown as {
      invalidateRange?: (range: { start: number; end: number }) => void
      refresh?: () => Promise<void> | void
      getSnapshot?: () => { revision?: string | number | null } | null
    } | undefined
    const rowsApi = options.runtime.api.rows as unknown as {
      refresh?: () => Promise<void> | void
    }
    const latestRenderedViewportRange = latestRenderedBodyViewport.value
      ? {
          startRow: latestRenderedBodyViewport.value.startRow,
          endRow: latestRenderedBodyViewport.value.endRow,
          startColumn: 0,
          endColumn: Math.max(0, options.visibleColumns.value.length - 1),
        }
      : null
    const runtimeRenderedViewportRange = renderedViewportRange.value
      ? {
          startRow: renderedViewportRange.value.start,
          endRow: renderedViewportRange.value.end,
          startColumn: 0,
          endColumn: Math.max(0, options.visibleColumns.value.length - 1),
        }
      : null
    const displayRowsRenderedViewportRange = resolveRenderedBodyViewportRange()
    const selectedRenderedViewportRange = latestRenderedViewportRange
      ?? runtimeRenderedViewportRange
      ?? displayRowsRenderedViewportRange
      ?? {
        startRow: viewportRowStart.value,
        endRow: viewportRowEnd.value,
        startColumn: 0,
        endColumn: Math.max(0, options.visibleColumns.value.length - 1),
      }

    options.reportFillPlumbingDetail?.("server_fill_latest_rendered_viewport", formatRenderedBodyViewport(latestRenderedBodyViewport.value))
    options.reportFillPlumbingDetail?.("server_fill_runtime_rendered_viewport", formatRange(runtimeRenderedViewportRange))
    options.reportFillPlumbingDetail?.("server_fill_displayrows_rendered_viewport", formatRange(displayRowsRenderedViewportRange))
    options.reportFillPlumbingDetail?.("server_fill_selected_rendered_viewport", formatRange(selectedRenderedViewportRange))
    options.reportFillPlumbingDetail?.("server_fill_refresh_used_stored_rendered", latestRenderedViewportRange ? "yes" : "no")
    const normalizedInvalidationRange = normalizeViewportRangeLike(invalidationRange)
      ?? normalizeViewportRangeLike({
        startRow: selectedRenderedViewportRange.startRow,
        endRow: selectedRenderedViewportRange.endRow,
      })
    options.reportFillPlumbingDetail?.("server_fill_raw_invalidation", invalidationRange ? JSON.stringify(invalidationRange) : "none")
    options.reportFillPlumbingDetail?.("server_fill_invalidation_range", normalizedInvalidationRange ? `${normalizedInvalidationRange.start}..${normalizedInvalidationRange.end}` : "none")
    options.reportFillPlumbingDetail?.("server_fill_normalized_invalidation", normalizedInvalidationRange ? `${normalizedInvalidationRange.start}..${normalizedInvalidationRange.end}` : "none")
    options.reportFillPlumbingDetail?.("server_fill_sync_input_range", formatRange(selectedRenderedViewportRange))
    options.reportFillPlumbingDetail?.("server_fill_runtime_rowModel_invalidate_type", typeof runtimeRowModel?.invalidateRange === "function" ? "function" : typeof runtimeRowModel?.invalidateRange)

    if (selectedRenderedViewportRange) {
      options.runtime.setViewportRange?.({
        start: selectedRenderedViewportRange.startRow,
        end: selectedRenderedViewportRange.endRow,
      })
      options.reportFillPlumbingDetail?.("server_fill_rendered_viewport", formatRange(selectedRenderedViewportRange))
    }

    const sourceRow1BeforeInvalidate = options.runtime.getBodyRowAtIndex(1)

    let invalidationApplied = false
    if (normalizedInvalidationRange && typeof runtimeRowModel?.invalidateRange === "function") {
      runtimeRowModel.invalidateRange(normalizedInvalidationRange)
      invalidationApplied = true
    }
    const sourceRow1AfterInvalidate = options.runtime.getBodyRowAtIndex(1)
    options.reportFillPlumbingState?.("server_fill_invalidation_called", invalidationApplied)
    options.reportFillPlumbingDetail?.("server_fill_cache_row1_before_invalidation", sourceRow1BeforeInvalidate ? "yes" : "no")
    options.reportFillPlumbingDetail?.("server_fill_cache_row1_after_invalidation", sourceRow1AfterInvalidate ? "yes" : "no")
    options.reportFillPlumbingState?.("server_fill_invalidation_applied", invalidationApplied)
    if (typeof rowsApi.refresh === "function") {
      await rowsApi.refresh()
    }
    if (selectedRenderedViewportRange) {
      syncRenderedRowsInRange({
        start: selectedRenderedViewportRange.startRow,
        end: selectedRenderedViewportRange.endRow,
      })
    }
    else {
      syncViewportFromDom()
    }
    await nextTick()
    reportRendererViewportDiagnostics("server-fill-refresh")
  }

  function formatRenderedBodyViewport(
    viewport: DataGridTableStageRenderedBodyViewport | null | undefined,
  ): string {
    if (!viewport) {
      return "none"
    }
    return `${viewport.startRow}..${viewport.endRow}`
  }

  function formatRange(range: DataGridCopyRange | null | undefined): string {
    if (!range) {
      return "none"
    }
    return `${range.startRow}..${range.endRow}`
  }

  function normalizeViewportRangeLike(
    range: DataGridCopyRange | { start?: unknown; end?: unknown; startRow?: unknown; endRow?: unknown } | null | undefined,
  ): { start: number; end: number } | null {
    if (!range) {
      return null
    }
    const candidate = range as { start?: unknown; end?: unknown; startRow?: unknown; endRow?: unknown }
    const rawStart = Number.isFinite(candidate.startRow)
      ? candidate.startRow
      : candidate.start
    const rawEnd = Number.isFinite(candidate.endRow)
      ? candidate.endRow
      : candidate.end
    const start = Number(rawStart)
    const end = Number(rawEnd ?? rawStart)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return null
    }
    return {
      start: Math.max(0, Math.trunc(start)),
      end: Math.max(Math.max(0, Math.trunc(start)), Math.trunc(end)),
    }
  }

  function isVisibleViewportOverlap(range: DataGridCopyRange | null | undefined): boolean {
    if (!range) {
      return false
    }
    return range.endRow >= viewportRowStart.value && range.startRow <= viewportRowEnd.value
  }

  const canUndoStageHistory = (): boolean => {
    return canUndoHistory() || lastServerFillState.value === "committed"
  }

  const canRedoStageHistory = (): boolean => {
    return canRedoHistory() || lastServerFillState.value === "undone"
  }

  const delegatesServerFillHistoryToAdapter = (): boolean => {
    return typeof options.history?.recordServerFillTransaction === "function"
  }

  const runStageHistoryAction = (direction: "undo" | "redo"): Promise<string | null> => {
    if (lastServerFillOperation.value && (direction === "undo" || direction === "redo")) {
      const stateMatchesDirection = (
        (direction === "undo" && lastServerFillState.value === "committed")
        || (direction === "redo" && lastServerFillState.value === "undone")
      )
      if (stateMatchesDirection) {
        const operation = lastServerFillOperation.value
        const rowModel = options.runtimeRowModel?.dataSource
        const projection = buildFillProjectionContext()
        const handler = direction === "undo" ? rowModel?.undoFillOperation : rowModel?.redoFillOperation
        if (handler) {
          return Promise.resolve(handler({
            operationId: operation.operationId,
            revision: operation.revision,
            projection,
          })).then(async result => {
            const invalidationRange = result?.invalidation?.kind === "range" ? result.invalidation.range : operation.affectedRange ?? null
            options.reportFillPlumbingDetail?.("server_fill_affected_range", formatRange(invalidationRange))
            options.reportFillPlumbingDetail?.("server_fill_visible_overlap", isVisibleViewportOverlap(invalidationRange) ? "yes" : "no")
            await refreshVisibleViewportAfterServerFill(invalidationRange)
            lastServerFillState.value = direction === "undo" ? "undone" : "committed"
            return operation.operationId
          })
        }
      }
    }
    return runIntentHistoryAction(direction)
  }

  const applyStageRangeMove = async (
    baseRange: DataGridCopyRange,
    targetRange: DataGridCopyRange,
  ): Promise<boolean> => {
    const normalizedBaseRange = normalizeClipboardRange(baseRange)
    const normalizedTargetRange = normalizeClipboardRange(targetRange)
    if (!normalizedBaseRange || !normalizedTargetRange || rangesEqual(normalizedBaseRange, normalizedTargetRange)) {
      return false
    }

    const sourceMatrix = buildFillMatrixFromRange(normalizedBaseRange)
    const sourceRowCount = normalizedBaseRange.endRow - normalizedBaseRange.startRow + 1
    const sourceColumnCount = normalizedBaseRange.endColumn - normalizedBaseRange.startColumn + 1
    const targetRowHasNonEmptyValue = new Map<number, boolean>()

    for (let rowOffset = 0; rowOffset < sourceRowCount; rowOffset += 1) {
      let hasNonEmptyValue = false
      for (let columnOffset = 0; columnOffset < sourceColumnCount; columnOffset += 1) {
        if ((sourceMatrix[rowOffset]?.[columnOffset] ?? "").length > 0) {
          hasNonEmptyValue = true
          break
        }
      }
      targetRowHasNonEmptyValue.set(normalizedTargetRange.startRow + rowOffset, hasNonEmptyValue)
    }

    const beforeSnapshot = captureHistorySnapshot()
    const rowPatchDataById = new Map<string | number, Record<string, unknown>>()
    let blocked = 0
    let applied = 0

    const getRowPatch = (rowId: string | number): Record<string, unknown> => {
      const current = rowPatchDataById.get(rowId)
      if (current) {
        return current
      }
      const next: Record<string, unknown> = {}
      rowPatchDataById.set(rowId, next)
      return next
    }

    for (let rowIndex = normalizedBaseRange.startRow; rowIndex <= normalizedBaseRange.endRow; rowIndex += 1) {
      const sourceRow = selectableRuntime.getBodyRowAtIndex(rowIndex)
      if (!sourceRow || sourceRow.kind === "group" || sourceRow.rowId == null || placeholderRows.isPlaceholderRow(sourceRow)) {
        continue
      }
      for (let columnIndex = normalizedBaseRange.startColumn; columnIndex <= normalizedBaseRange.endColumn; columnIndex += 1) {
        const columnKey = orderedVisibleColumns.value[columnIndex]?.key
        if (!columnKey || isRowSelectionColumnKey(columnKey)) {
          continue
        }
        getRowPatch(sourceRow.rowId)[columnKey] = ""
      }
    }

    for (let rowIndex = normalizedTargetRange.startRow; rowIndex <= normalizedTargetRange.endRow; rowIndex += 1) {
      let targetRow = selectableRuntime.getBodyRowAtIndex(rowIndex)
      if (placeholderRows.isPlaceholderRow(targetRow) && targetRowHasNonEmptyValue.get(rowIndex) === true) {
        targetRow = placeholderRows.ensureMaterializedRowAt(rowIndex, "paste")
      }
      for (let columnIndex = normalizedTargetRange.startColumn; columnIndex <= normalizedTargetRange.endColumn; columnIndex += 1) {
        const columnKey = orderedVisibleColumns.value[columnIndex]?.key
        if (!columnKey || isRowSelectionColumnKey(columnKey)) {
          continue
        }
        const rowOffset = rowIndex - normalizedTargetRange.startRow
        const columnOffset = columnIndex - normalizedTargetRange.startColumn
        const nextValue = sourceMatrix[rowOffset]?.[columnOffset] ?? ""

        if (!targetRow || targetRow.kind === "group" || targetRow.rowId == null || placeholderRows.isPlaceholderRow(targetRow)) {
          blocked += 1
          continue
        }
        getRowPatch(targetRow.rowId)[columnKey] = nextValue
        applied += 1
      }
    }

    if (applied <= 0 || rowPatchDataById.size === 0) {
      return false
    }

    await options.runtime.api.rows.applyEdits(Array.from(rowPatchDataById.entries()).map(([rowId, data]) => ({
      rowId,
      data: data as Partial<TRow>,
    })))
    applyClipboardSelectionRange(normalizedTargetRange)
    recordHistoryIntentTransaction({
      intent: "move",
      label: blocked > 0 ? `Move ${applied} cells (blocked ${blocked})` : `Move ${applied} cells`,
      affectedRange: normalizedTargetRange,
    }, beforeSnapshot)
    syncViewportFromDom()
    return true
  }

  const interactionControllerOptions = {
    mode: options.mode,
    enableFillHandle: options.enableFillHandle,
    enableRangeMove: options.enableRangeMove,
    runtime: selectableRuntime as never,
    totalRows: totalSelectableRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    selectionSnapshot: options.selectionSnapshot,
    bodyViewportRef,
    indexColumnWidth: effectiveIndexColumnWidth.value,
    resolveColumnWidth,
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowIndexAtOffset: rowHeightMetrics.resolveRowIndexAtOffset,
    normalizeRowId,
    normalizeCellCoord,
    resolveSelectionRange: resolveSelectionRangeForClipboard,
    applySelectionRange: applyClipboardSelectionRange,
    applyCellSelectionByCoord,
    setCellSelection,
    clearCellSelection,
    readCell: (row: import("@affino/datagrid-vue").DataGridRowNode<TRow>, columnKey: string) => readStageCell(row, columnKey),
    isCellEditable: isSurfaceCellEditableByKey,
    cloneRowData: options.cloneRowData,
    resolveRowIndexById: resolveSelectableRowIndexById,
    isRowMaterializedAtIndex: (rowIndex: number) => {
      const row = selectableRuntime.getBodyRowAtIndex(rowIndex)
      return !!row && (row as { __placeholder?: boolean }).__placeholder !== true
    },
    resolveFillBoundary: (() => {
      const runtimeRowModel = options.runtimeRowModel
      const resolveFillBoundary = runtimeRowModel?.dataSource?.resolveFillBoundary
      options.reportFillPlumbingState?.("stage_runtime_rowmodel", typeof resolveFillBoundary === "function")
      if (typeof resolveFillBoundary !== "function") {
        return undefined
      }
      return async (request: DataGridAppResolveFillBoundaryRequest) => {
        const snapshot = options.runtime.api.rows.getSnapshot() as {
          sortModel?: readonly DataGridSortState[]
          filterModel?: DataGridFilterSnapshot | null
          groupBy?: DataGridGroupBySpec | null
          groupExpansion?: DataGridGroupExpansionSnapshot
          pagination?: DataGridPaginationSnapshot
        }
        return resolveFillBoundary({
          ...request,
          projection: {
            sortModel: snapshot.sortModel ?? [],
            filterModel: snapshot.filterModel ?? null,
            groupBy: snapshot.groupBy ?? null,
            groupExpansion: snapshot.groupExpansion ?? { expandedByDefault: false, toggledGroupKeys: [] },
            treeData: null,
            pivot: null,
            pagination: snapshot.pagination ?? {
              enabled: false,
              pageSize: 0,
              currentPage: 0,
              pageCount: 0,
              totalRowCount: 0,
              startIndex: 0,
              endIndex: 0,
            },
          },
        })
      }
    })(),
    runtimeRowModel: options.runtimeRowModel ?? null,
    reportFillWarning: options.reportFillWarning,
    reportCenterPaneDiagnostics: handleCenterPaneDiagnostics,
    reportFillPlumbingState: options.reportFillPlumbingState,
    reportFillPlumbingDetail: options.reportFillPlumbingDetail,
    ensureEditableRowAtIndex: rowIndex => placeholderRows.ensureMaterializedRowAt(rowIndex, "toggle"),
    captureRowsSnapshot: captureHistorySnapshot,
    captureRowsSnapshotForRowIds: captureHistorySnapshotForRowIds,
    recordIntentTransaction: (
      descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
      beforeSnapshot: unknown,
      afterSnapshotOverride?: unknown,
    ) => {
      lastServerFillOperation.value = null
      lastServerFillState.value = null
      recordHistoryIntentTransaction(descriptor, beforeSnapshot, afterSnapshotOverride)
    },
    recordServerFillTransaction: (descriptor: {
      intent: "fill"
      label: string
      affectedRange?: DataGridCopyRange | null
      operationId: string
      revision?: string | number | null
      mode: DataGridFillBehavior
    }) => {
      historyService.recordServerFillTransaction(descriptor)
      if (delegatesServerFillHistoryToAdapter()) {
        lastServerFillOperation.value = null
        lastServerFillState.value = null
        return
      }
      lastServerFillOperation.value = {
        operationId: descriptor.operationId,
        revision: descriptor.revision,
        affectedRange: descriptor.affectedRange ?? null,
        mode: descriptor.mode,
      }
      lastServerFillState.value = "committed"
    },
    clearPendingClipboardOperation,
    clearExternalPendingClipboardOperation: options.clearExternalPendingClipboardOperation,
    copySelectedCells,
    pasteSelectedCells,
    cutSelectedCells,
    normalizeClipboardRange,
    applyClipboardEdits,
    rangesEqual,
    buildFillMatrixFromRange,
    applyRangeMove: options.applyRangeMove ?? applyStageRangeMove,
    refreshServerFillViewport: refreshVisibleViewportAfterServerFill,
    syncViewport: () => syncViewportFromDom(),
    editingCell: editingCellRef,
    startInlineEdit,
    appendInlineEditTextInput,
    cancelInlineEdit,
    commitInlineEdit,
    canUndo: canUndoStageHistory,
    canRedo: canRedoStageHistory,
    runHistoryAction: runStageHistoryAction,
    ensureKeyboardActiveCellVisible,
    isContextMenuVisible: options.isContextMenuVisible,
    closeContextMenu: options.closeContextMenu,
    openContextMenuFromCurrentCell: options.openContextMenuFromCurrentCell,
    runRowIndexKeyboardAction: options.runRowIndexKeyboardAction,
  } as Parameters<typeof useDataGridAppInteractionController<TRow, unknown>>[0]

  const interactionController = (
    useDataGridAppInteractionController<TRow, unknown>(interactionControllerOptions)
  ) as StageInteractionControllerResult<TRow>

  const {
    isPointerSelectingCells,
    isFillDragging,
    fillPreviewRange,
    lastAppliedFill,
    isRangeMoving,
    selectionRange: interactionSelectionRange,
    rangeMovePreviewRange,
    stopPointerSelection,
    stopFillSelection,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    applyLastFillBehavior,
    handleCellMouseDown,
    handleCellKeydown,
    handleRowIndexKeydown,
    handleWindowMouseMove: handleInteractionWindowMouseMove,
    handleWindowMouseUp: handleInteractionWindowMouseUp,
    isCellInFillPreview,
    isFillHandleCell,
    clearSelectedCells,
    dispose: disposeInteractionController,
  } = interactionController

  const visualInteractionSelectionRange = computed(() => (
    isPointerSelectingCells.value
      ? interactionSelectionRange.value
      : null
  ))

  const viewportKeyboardService = useDataGridTableStageViewportKeyboard<TRow>({
    runtime: selectableRuntime,
    selectionSnapshot: options.selectionSnapshot,
    totalRows: totalSelectableRows,
    orderedVisibleColumns,
    viewportRowStart,
    applySelectionRange: applyClipboardSelectionRange,
    handleCellKeydown,
  })
  const {
    isColumnResizing,
    startResize,
    handleResizeDoubleClick,
    applyColumnResizeFromPointer,
    stopColumnResize,
    dispose: disposeHeaderResize,
  } = useDataGridAppHeaderResize<TRow>({
    visibleColumns: orderedVisibleColumns,
    rows: options.rows,
    persistColumnWidth: (columnKey, width) => {
      options.runtime.api.columns.setWidth(columnKey, width)
    },
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    minColumnWidth: MIN_COLUMN_WIDTH,
    autoSizeSampleLimit: AUTO_RESIZE_SAMPLE_LIMIT,
    autoSizeCharWidth: 7.2,
    autoSizeHorizontalPadding: 42,
    autoSizeMaxWidth: 640,
    isFillDragging: () => isFillDragging.value,
    stopFillSelection: () => {
      stopFillSelection(false)
    },
    isDragSelecting: () => isPointerSelectingCells.value,
    stopDragSelection: () => {
      stopPointerSelection()
    },
    readCellText: (row, columnKey) => {
      const value = (row as Record<string, unknown>)[columnKey]
      return value == null ? "" : String(value)
    },
  })


  const visualSelectionService = useDataGridTableStageVisualSelection({
    mode: options.mode,
    viewportRowStart,
    selectionAnchorCell,
    fillPreviewRange,
    isFillDragging,
    interactionSelectionRange: visualInteractionSelectionRange,
    resolveCommittedSelectionRange: resolveSelectionRangeForClipboard,
    resolveCommittedSelectionRanges: resolveSelectionRanges,
    isCommittedSelectionAnchorCell,
    isCommittedCellSelected,
    shouldHighlightCommittedSelectedCell,
    isCommittedCellOnSelectionEdge,
  })
  const { selectionRange, selectionRanges } = visualSelectionService

  const fillActionService = useDataGridTableStageFillAction({
    lastAppliedFill,
    selectionRange,
    isFillDragging,
  })

  const scrollSyncService = useDataGridTableStageScrollSync({
    bodyViewportRef,
    isColumnResizing,
    applyColumnResizeFromPointer,
    stopColumnResize,
    handleInteractionWindowMouseMove,
    handleInteractionWindowMouseUp,
    syncViewport: handleViewportScroll,
  })

  const stageServices = {
    columns: columnService,
    rowSelection: rowSelectionService,
    history: historyService,
    cellIo: cellIoService,
    viewportKeyboard: viewportKeyboardService,
    visualSelection: visualSelectionService,
    fillAction: fillActionService,
    scrollSync: scrollSyncService,
  } as const

  const {
    tableStageProps,
    tableStageContext,
  } = useDataGridTableStageBindings<TRow>({
    mode: options.mode,
    rowHeightMode: options.rowHeightMode,
    layoutMode: options.layoutMode,
    chromeSignature: options.chromeSignature,
    visibleColumns: orderedVisibleColumns,
    renderedColumns,
    displayRows,
    displayRowsRevision,
    runtimeRevision: runtimeRowModelRevision,
    pinnedBottomRows,
    sourceRows: options.sourceRows ?? options.rows,
    showRowIndex,
    rowHover: computed(() => options.rowHover?.value === true),
    stripedRows: computed(() => options.stripedRows?.value === true),
    columnFilterTextByKey: options.columnFilterTextByKey,
    gridContentStyle,
    mainTrackStyle,
    indexColumnStyle: stageIndexColumnStyle,
    stageStyle,
    bodyShellStyle,
    topSpacerHeight,
    bottomSpacerHeight,
    viewportRowStart,
    viewportRowEnd,
    virtualRowTotal: totalSelectableRows,
    baseRowHeight: options.normalizedBaseRowHeight,
    resolveRowHeight: rowHeightMetrics.resolveRowHeight,
    resolveRowOffset: rowHeightMetrics.resolveRowOffset,
    columnWindowStart: viewportColumnStart,
    leftColumnSpacerWidth,
    rightColumnSpacerWidth,
    editingCellValueRef: editingCellValue,
    editingCellInitialFilter,
    editingCellOpenOnMount,
    selectionRange,
    selectionRanges,
    selectionAnchorCell,
    totalRowCount: totalSelectableRows,
    fillPreviewRange,
    rangeMovePreviewRange,
    customOverlays: lastServerFillCustomOverlays,
    reportCenterPaneDiagnostics: handleCenterPaneDiagnostics,
    fillHandleEnabled: computed(() => options.enableFillHandle.value),
    rangeMoveEnabled: computed(() => options.enableRangeMove.value),
    isFillDragging,
    isRangeMoving,
    headerViewportRef,
    bodyViewportRef,
    columnStyle: resolveStageColumnStyle,
    reorderColumnsByHeader: options.reorderColumnsByHeader,
    toggleSortForColumn: options.toggleSortForColumn,
    handleHeaderColumnClick: options.handleHeaderColumnClick,
    sortIndicator: options.sortIndicator,
    setColumnFilterText: options.setColumnFilterText,
    columnMenuEnabled: options.columnMenuEnabled,
    columnMenuTrigger: options.columnMenuTrigger,
    columnMenuValueFilterEnabled: options.columnMenuValueFilterEnabled,
    columnMenuValueFilterRowLimit: options.columnMenuValueFilterRowLimit,
    columnMenuMaxFilterValues: options.columnMenuMaxFilterValues,
    resolveColumnMenuItems: options.resolveColumnMenuItems,
    resolveColumnMenuDisabledItems: options.resolveColumnMenuDisabledItems,
    resolveColumnMenuDisabledReasons: options.resolveColumnMenuDisabledReasons,
    resolveColumnMenuLabels: options.resolveColumnMenuLabels,
    resolveColumnMenuActionOptions: options.resolveColumnMenuActionOptions,
    resolveColumnMenuCustomItems: options.resolveColumnMenuCustomItems,
    isColumnFilterActive: options.isColumnFilterActive,
    isColumnGrouped: options.isColumnGrouped,
    resolveColumnGroupOrder: options.resolveColumnGroupOrder,
    resolveColumnMenuSortDirection: options.resolveColumnMenuSortDirection,
    resolveColumnMenuSelectedTokens: options.resolveColumnMenuSelectedTokens,
    resolveColumnMenuValueEntries: options.resolveColumnMenuValueEntries,
    applyColumnMenuSort: options.applyColumnMenuSort,
    applyColumnMenuPin: options.applyColumnMenuPin,
    applyColumnMenuGroupBy: options.applyColumnMenuGroupBy,
    applyColumnMenuFilter: options.applyColumnMenuFilter,
    clearColumnMenuFilter: options.clearColumnMenuFilter,
    handleHeaderWheel: stageServices.scrollSync.handleHeaderWheel,
    handleHeaderScroll: stageServices.scrollSync.handleHeaderScroll,
    handleViewportScroll,
    handleViewportKeydown: stageServices.viewportKeyboard.handleViewportKeydown,
    rowClass,
    isRowAutosizeProbe,
    rowStyle,
    isRowInPendingClipboardCut: options.isRowInPendingClipboardCut,
    isRowFocused: stageServices.rowSelection.isRowFocused,
    isRowCheckboxSelected: stageServices.rowSelection.isRowCheckboxSelected,
    allVisibleRowsSelected: stageServices.rowSelection.areAllVisibleRowsSelected,
    someVisibleRowsSelected: stageServices.rowSelection.areSomeVisibleRowsSelected,
    handleRowClick: stageServices.rowSelection.focusRow,
    handleRowIndexClick: stageServices.rowSelection.selectRowRange,
    handleRowIndexKeydown,
    reorderRowsByIndex: options.reorderRowsByIndex,
    handleToggleAllVisibleRows: stageServices.rowSelection.toggleVisibleRowsSelected,
    toggleGroupRow,
    rowIndexLabel,
    startResize,
    handleResizeDoubleClick,
    startRowResize,
    autosizeRow,
    consumeRecentRowResizeInteraction,
    isCellSelected: stageServices.visualSelection.isCellSelected,
    isSelectionAnchorCell: stageServices.visualSelection.isSelectionAnchorCell,
    shouldHighlightSelectedCell: stageServices.visualSelection.shouldHighlightSelectedCell,
    isCellOnSelectionEdge: stageServices.visualSelection.isCellOnSelectionEdge,
    isCellInFillPreview,
    isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge,
    isEditingCell,
    isCellEditable: (row, rowOffset, column, _columnIndex) => {
      return isResolvedSurfaceCellEditable(
        row,
        column,
        () => isCellEditable(row, viewportRowStart.value + rowOffset, column),
      )
    },
    handleCellMouseDown,
    handleCellClick: stageServices.cellIo.handleCellClick,
    handleCellKeydown,
    startInlineEdit,
    isFillHandleCell,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    fillActionAnchorCell: stageServices.fillAction.fillActionAnchorCell,
    fillActionBehavior: stageServices.fillAction.fillActionBehavior,
    applyFillActionBehavior: applyLastFillBehavior,
    handleEditorKeydown,
    handleEditorBlur,
    commitInlineEdit,
    cancelInlineEdit,
    readCell: stageServices.cellIo.readStageCell,
    readDisplayCell: stageServices.cellIo.readStageDisplayCell,
    cellClass: options.cellClass
      ? (row, rowOffset, column, columnIndex) => options.cellClass?.(
        row,
        viewportRowStart.value + rowOffset,
        column,
        columnIndex,
      )
      : undefined,
    cellStyle: options.cellStyle
      ? (row, rowOffset, column, columnIndex) => options.cellStyle?.(
        row,
        viewportRowStart.value + rowOffset,
        column,
        columnIndex,
      )
      : undefined,
  })

  useDataGridAppRuntimeSync({
    mode: options.mode,
    rows: options.rows,
    runtime: options.runtime as never,
    totalRows: totalSelectableRows,
    rowVersion: options.rowVersion,
    rowHeightMode: options.rowHeightMode,
    normalizedBaseRowHeight: options.normalizedBaseRowHeight,
    syncSelectionSnapshotFromRuntime: options.syncSelectionSnapshotFromRuntime,
    syncRowSelectionSnapshotFromRuntime,
    syncViewport: syncViewportFromDom,
    scheduleViewportSync,
    measureVisibleRowHeights,
    applyRowHeightSettings: options.applyRowHeightSettings,
  })

  useDataGridAppViewportLifecycle({
    bodyViewportRef,
    syncViewport: syncViewportFromDom,
    handleWindowMouseMove: stageServices.scrollSync.handleWindowMouseMove,
    handleWindowMouseUp: stageServices.scrollSync.handleWindowMouseUp,
    cancelScheduledViewportSync,
    onAfterMount: () => {
      options.syncSelectionSnapshotFromRuntime()
      syncRowSelectionSnapshotFromRuntime()
      void nextTick(() => {
        options.applyRowHeightSettings()
        syncViewportFromDom()
      })
    },
    dispose: [
      disposeRowSizing,
      disposeHeaderResize,
      disposeInteractionController,
      stageServices.history.disposeIntentHistory,
    ],
  })

  return {
    tableStageProps,
    tableStageContext,
    historyController: {
      canUndo: canUndoStageHistory,
      canRedo: canRedoStageHistory,
      runHistoryAction: runStageHistoryAction,
    },
    syncViewportFromDom,
    copySelectedCells,
    pasteSelectedCells,
    cutSelectedCells,
    clearSelectedCells,
    captureHistorySnapshot,
    captureHistorySnapshotForRowIds,
    recordHistoryIntentTransaction,
    revealCellInComfortZone,
  }
}
