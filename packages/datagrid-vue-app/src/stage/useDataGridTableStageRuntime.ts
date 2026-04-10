import { computed, nextTick, ref, type ComputedRef, type CSSProperties, type Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowSelectionSnapshot,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import {
  createDataGridAppRowHeightMetrics,
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
  DataGridTableRow,
  DataGridTableStageCellClass,
  DataGridTableStageProps,
} from "./dataGridTableStage.types"

const DEFAULT_COLUMN_WIDTH = 140
const INDEX_COLUMN_WIDTH = 72
const MIN_COLUMN_WIDTH = 80
const MIN_ROW_HEIGHT = 24
const AUTO_RESIZE_SAMPLE_LIMIT = 400

export type { DataGridTableStageHistoryAdapter } from "./useDataGridTableStageHistory"

type DataGridTableStageBodyRuntime<TRow extends Record<string, unknown>> = {
  api: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["api"]
  syncBodyRowsInRange: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["syncBodyRowsInRange"]
  setViewportRange: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["setViewportRange"]
  setRows?: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["setRows"]
  rowPartition: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["rowPartition"]
  virtualWindow: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["virtualWindow"]
  columnSnapshot: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["columnSnapshot"]
  setVirtualWindowRange?: (range: { start: number; end: number }) => void
} & {
  getBodyRowAtIndex: (rowIndex: number) => import("@affino/datagrid-vue").DataGridRowNode<TRow> | null
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
  toggleSortForColumn: (columnKey: string, additive?: boolean) => void
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
  applyColumnMenuSort?: (columnKey: string, direction: "asc" | "desc" | null) => void
  applyColumnMenuPin?: (columnKey: string, pin: import("@affino/datagrid-vue").DataGridColumnPin) => void
  applyColumnMenuGroupBy?: (columnKey: string, grouped: boolean) => void
  applyColumnMenuFilter?: (columnKey: string, tokens: readonly string[]) => void
  clearColumnMenuFilter?: (columnKey: string) => void
  applyRowHeightSettings: () => void
  cloneRowData: (row: TRow) => TRow
  readClipboardCell?: (row: import("@affino/datagrid-core").DataGridRowNode<TRow>, columnKey: string) => string
  applyClipboardEdits?: (
    range: DataGridCopyRange,
    matrix: string[][],
    options?: { recordHistory?: boolean },
  ) => number
  buildFillMatrixFromRange?: (range: DataGridCopyRange) => string[][]
  applyRangeMove?: (baseRange: DataGridCopyRange, targetRange: DataGridCopyRange) => boolean
  isCellEditable?: DataGridCellEditablePredicate<TRow>
  history?: DataGridTableStageHistoryAdapter
  historyEnabled?: Ref<boolean>
  historyMaxDepth?: Ref<number | undefined>
  historyShortcuts?: Ref<false | "grid" | "window">
  isContextMenuVisible?: () => boolean
  closeContextMenu?: () => void
  openContextMenuFromCurrentCell?: () => void
  clearExternalPendingClipboardOperation?: () => boolean
  runRowIndexKeyboardAction?: (
    action: "insert-row-above" | "copy-row" | "cut-row" | "paste-row" | "delete-selected-rows" | "open-row-menu",
    rowId: string | number,
  ) => Promise<boolean> | boolean
  cellClass?: (
    row: DataGridTableRow<TRow>,
    rowIndex: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ) => DataGridTableStageCellClass | null | undefined
}

export interface UseDataGridTableStageRuntimeResult<TRow extends Record<string, unknown>> {
  tableStageProps: ComputedRef<DataGridTableStageProps<TRow>>
  tableStageContext: DataGridTableStageContext<TRow>
  historyController: DataGridHistoryController
  syncViewportFromDom: () => void
  copySelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
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
    pinnedBottomRows,
    renderedColumns,
    viewportRowStart,
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
  const resolveStageColumnStyle = (columnKey: string): Record<string, string> => {
    return _viewportColumnStyle(columnKey)
  }

  const selectableRuntime = placeholderRows.visualRuntime
  const resolveSelectableRowIndexById = selectableRuntime.resolveBodyRowIndexById

  const {
    rowStyle,
    isRowAutosizeProbe,
    measureVisibleRowHeights,
    startRowResize,
    autosizeRow,
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
    runtime: selectableRuntime as never,
    totalRows: totalSelectableRows,
    visibleColumns: orderedVisibleColumns,
    viewportRowStart,
    selectionSnapshot: options.selectionSnapshot,
    selectionAnchor: options.selectionAnchor as never,
    isEditingCell: (row, columnKey): boolean => isEditingCellForSelection(row, columnKey),
  })

  const {
    normalizeRowId,
    normalizeCellCoord,
    resolveSelectionRange: resolveSelectionRangeForClipboard,
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
    runHistoryAction,
  } = historyService

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
    resolveCurrentCellCoord: resolveCurrentCellCoordForClipboard,
    applySelectionRange: applyClipboardSelectionRange,
    clearCellSelection,
    captureRowsSnapshot: captureHistorySnapshot,
    captureRowsSnapshotForRowIds: captureHistorySnapshotForRowIds,
    recordEditTransaction: beforeSnapshot => {
      recordHistoryIntentTransaction({
        intent: "edit",
        label: "Cell edit",
      }, beforeSnapshot)
    },
    readCell: (row, columnKey) => readStageCell(row, columnKey),
    readClipboardCell: options.readClipboardCell
      ? (row, columnKey) => options.readClipboardCell?.(row, columnKey) ?? ""
      : undefined,
    isCellEditable: isSurfaceCellEditableByKey,
    syncViewport: () => syncViewportFromDom(),
    applyClipboardEdits: options.applyClipboardEdits,
    buildFillMatrixFromRange: options.buildFillMatrixFromRange,
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
    recordEditTransaction: beforeSnapshot => {
      recordHistoryIntentTransaction({
        intent: "edit",
        label: "Cell edit",
      }, beforeSnapshot)
    },
    ensureEditableRowAtIndex: rowIndex => placeholderRows.ensureMaterializedRowAt(rowIndex, "edit"),
  })

  isEditingCellForSelection = isEditingCell

  const editingCellRef = computed(() => editingCell.value)

  const applyStageRangeMove = (
    baseRange: DataGridCopyRange,
    targetRange: DataGridCopyRange,
  ): boolean => {
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

    options.runtime.api.rows.applyEdits(Array.from(rowPatchDataById.entries()).map(([rowId, data]) => ({
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
    ensureEditableRowAtIndex: rowIndex => placeholderRows.ensureMaterializedRowAt(rowIndex, "toggle"),
    captureRowsSnapshot: captureHistorySnapshot,
    captureRowsSnapshotForRowIds: captureHistorySnapshotForRowIds,
    recordIntentTransaction: (descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null }, beforeSnapshot: unknown) => {
      recordHistoryIntentTransaction(descriptor, beforeSnapshot)
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
    syncViewport: () => syncViewportFromDom(),
    editingCell: editingCellRef,
    startInlineEdit,
    appendInlineEditTextInput,
    cancelInlineEdit,
    commitInlineEdit,
    canUndo: () => (options.historyShortcuts?.value ?? "grid") === "grid" && canUndoHistory(),
    canRedo: () => (options.historyShortcuts?.value ?? "grid") === "grid" && canRedoHistory(),
    runHistoryAction: direction => (
      (options.historyShortcuts?.value ?? "grid") === "grid"
        ? runHistoryAction(direction)
        : Promise.resolve(null)
    ),
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
    interactionSelectionRange,
    resolveCommittedSelectionRange: resolveSelectionRangeForClipboard,
    isCommittedSelectionAnchorCell,
    isCommittedCellSelected,
    shouldHighlightCommittedSelectedCell,
    isCommittedCellOnSelectionEdge,
  })
  const { selectionRange } = visualSelectionService

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
    columnWindowStart: viewportColumnStart,
    leftColumnSpacerWidth,
    rightColumnSpacerWidth,
    editingCellValueRef: editingCellValue,
    editingCellInitialFilter,
    editingCellOpenOnMount,
    selectionRange,
    selectionAnchorCell,
    fillPreviewRange,
    rangeMovePreviewRange,
    fillHandleEnabled: computed(() => options.enableFillHandle.value),
    rangeMoveEnabled: computed(() => options.enableRangeMove.value),
    isFillDragging,
    isRangeMoving,
    headerViewportRef,
    bodyViewportRef,
    columnStyle: resolveStageColumnStyle,
    toggleSortForColumn: options.toggleSortForColumn,
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
    handleToggleAllVisibleRows: stageServices.rowSelection.toggleVisibleRowsSelected,
    toggleGroupRow,
    rowIndexLabel,
    startResize,
    handleResizeDoubleClick,
    startRowResize,
    autosizeRow,
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
      canUndo: canUndoHistory,
      canRedo: canRedoHistory,
      runHistoryAction,
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
