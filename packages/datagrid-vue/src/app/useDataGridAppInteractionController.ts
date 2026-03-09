import { nextTick, ref, type Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowNode,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import {
  useDataGridAxisAutoScrollDelta,
  useDataGridCellNavigation,
  useDataGridCellPointerDownRouter,
  useDataGridDragPointerSelection,
  useDataGridFillHandleStart,
  useDataGridFillSelectionLifecycle,
  useDataGridHistoryActionRunner,
  useDataGridKeyboardCommandRouter,
  useDataGridPointerAutoScroll,
  useDataGridPointerPreviewRouter,
  useDataGridRangeMoveLifecycle,
  useDataGridRangeMoveStart,
  useDataGridRangeMutationEngine,
  type DataGridCopyRange,
} from "../advanced"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import { useDataGridAppFill } from "./useDataGridAppFill"
import type {
  DataGridAppCellCoord,
  DataGridAppSelectionAnchorLike,
} from "./useDataGridAppCellSelection"
import type { DataGridAppMode } from "./useDataGridAppControls"

interface DataGridAppPointer {
  clientX: number
  clientY: number
}

type DataGridAppRowWithId<TRow> = TRow & { rowId: string | number }

export interface UseDataGridAppInteractionControllerOptions<
  TRow extends Record<string, unknown>,
  TSnapshot,
> {
  mode: Ref<DataGridAppMode>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api">
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  viewportRowStart: Ref<number>
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  bodyViewportRef: Ref<HTMLElement | null>
  normalizeRowId: (value: unknown) => string | number | null
  normalizeCellCoord: (coord: DataGridAppCellCoord) => DataGridAppCellCoord | null
  resolveSelectionRange: () => DataGridCopyRange | null
  applySelectionRange: (range: DataGridCopyRange) => void
  applyCellSelectionByCoord: (
    coord: DataGridAppCellCoord,
    extend: boolean,
    fallbackAnchor?: DataGridAppSelectionAnchorLike,
  ) => void
  setCellSelection: (
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
    extend: boolean,
  ) => void
  clearCellSelection: () => void
  readCell: (row: DataGridRowNode<TRow>, columnKey: string) => string
  cloneRowData: (row: TRow) => TRow
  resolveRowIndexById: (rowId: string | number) => number
  captureRowsSnapshot: () => TSnapshot
  recordIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: TSnapshot,
  ) => void | Promise<void>
  clearPendingClipboardOperation: (clearSelection: boolean, clearBufferedClipboardPayload?: boolean) => boolean
  copySelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  cutSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  normalizeClipboardRange: (range: DataGridCopyRange) => DataGridCopyRange | null
  applyClipboardEdits: (range: DataGridCopyRange, matrix: string[][]) => number
  rangesEqual: (left: DataGridCopyRange | null, right: DataGridCopyRange | null) => boolean
  buildFillMatrixFromRange: (range: DataGridCopyRange) => string[][]
  syncViewport: () => void
  editingCell: Ref<{ rowId: string | number; columnKey: string } | null>
  startInlineEdit: (row: DataGridRowNode<TRow>, columnKey: string) => void
  commitInlineEdit: (moveToNextRow?: boolean) => void
  canUndo: () => boolean
  canRedo: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<unknown> | unknown
  ensureKeyboardActiveCellVisible: (rowIndex: number, columnIndex: number) => void
}

export interface UseDataGridAppInteractionControllerResult<TRow> {
  isPointerSelectingCells: Ref<boolean>
  isFillDragging: Ref<boolean>
  stopPointerSelection: () => void
  stopFillSelection: (commit: boolean) => void
  startFillHandleDrag: (event: MouseEvent) => void
  handleCellMouseDown: (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number, columnIndex: number) => void
  handleCellKeydown: (event: KeyboardEvent, row: DataGridRowNode<TRow>, rowOffset: number, columnIndex: number) => void
  handleWindowMouseMove: (event: MouseEvent) => void
  handleWindowMouseUp: () => void
  isCellInFillPreview: (rowOffset: number, columnIndex: number) => boolean
  isFillHandleCell: (rowOffset: number, columnIndex: number) => boolean
  dispose: () => void
}

export function useDataGridAppInteractionController<
  TRow extends Record<string, unknown>,
  TSnapshot,
>(
  options: UseDataGridAppInteractionControllerOptions<TRow, TSnapshot>,
): UseDataGridAppInteractionControllerResult<TRow> {
  const isPointerSelectingCells = ref(false)
  const dragPointer = ref<DataGridAppPointer | null>(null)
  const lastDragCoord = ref<DataGridAppCellCoord | null>(null)
  const isFillDragging = ref(false)
  const fillPointer = ref<DataGridAppPointer | null>(null)
  const fillBaseRange = ref<DataGridCopyRange | null>(null)
  const fillPreviewRange = ref<DataGridCopyRange | null>(null)
  const isRangeMoving = ref(false)
  const rangeMovePointer = ref<DataGridAppPointer | null>(null)
  const rangeMoveBaseRange = ref<DataGridCopyRange | null>(null)
  const rangeMoveOrigin = ref<DataGridAppCellCoord | null>(null)
  const rangeMovePreviewRange = ref<DataGridCopyRange | null>(null)

  const focusViewport = (): void => {
    options.bodyViewportRef.value?.focus({ preventScroll: true })
  }

  const restoreActiveCellFocus = (): void => {
    const activeCell = options.selectionSnapshot.value?.activeCell
    if (!activeCell) {
      focusViewport()
      return
    }
    options.ensureKeyboardActiveCellVisible(activeCell.rowIndex, activeCell.colIndex)
  }

  const stopPointerSelection = (): void => {
    isPointerSelectingCells.value = false
    dragPointer.value = null
    lastDragCoord.value = null
  }

  const isCoordInsideRange = (coord: DataGridAppCellCoord, range: DataGridCopyRange): boolean => {
    return (
      coord.rowIndex >= range.startRow
      && coord.rowIndex <= range.endRow
      && coord.columnIndex >= range.startColumn
      && coord.columnIndex <= range.endColumn
    )
  }

  const resolveBaseDataRows = (): Array<DataGridAppRowWithId<TRow>> => {
    const count = options.runtime.api.rows.getCount()
    const result: Array<DataGridAppRowWithId<TRow>> = []
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      const node = options.runtime.api.rows.get(rowIndex)
      if (!node || node.rowId == null || node.kind === "group") {
        continue
      }
      result.push({
        ...options.cloneRowData(node.data as TRow),
        rowId: node.rowId,
      })
    }
    return result
  }

  const rangeMutationEngine = useDataGridRangeMutationEngine<
    DataGridAppRowWithId<TRow>,
    { rowId: string },
    TSnapshot,
    DataGridCopyRange
  >({
    resolveRangeMoveBaseRange: () => rangeMoveBaseRange.value,
    resolveRangeMovePreviewRange: () => rangeMovePreviewRange.value,
    resolveFillBaseRange: () => fillBaseRange.value,
    resolveFillPreviewRange: () => fillPreviewRange.value,
    areRangesEqual: options.rangesEqual,
    captureBeforeSnapshot: options.captureRowsSnapshot,
    resolveSourceRows: resolveBaseDataRows,
    resolveSourceRowId: row => String(row.rowId),
    applySourceRows: nextRows => {
      options.runtime.api.rows.setData(nextRows.map((row, index) => ({
        rowId: row.rowId,
        originalIndex: index,
        row: options.cloneRowData(row),
      })))
      options.syncViewport()
    },
    resolveDisplayedRows: () => resolveBaseDataRows().map(row => ({ rowId: String(row.rowId) })),
    resolveDisplayedRowId: row => row.rowId,
    resolveColumnKeyAtIndex: columnIndex => options.visibleColumns.value[columnIndex]?.key ?? null,
    resolveDisplayedCellValue: (row, columnKey) => {
      const rowIndex = options.resolveRowIndexById(row.rowId)
      const node = rowIndex >= 0 ? options.runtime.api.rows.get(rowIndex) : null
      if (!node || node.kind === "group") {
        return ""
      }
      return (node.data as Record<string, unknown>)[columnKey]
    },
    resolveSourceCellValue: (row, columnKey) => row[columnKey],
    normalizeClipboardValue: value => String(value ?? ""),
    isEditableColumn: () => true,
    applyValueForMove: (row, columnKey, value) => {
      ;(row as Record<string, unknown>)[columnKey] = value
      return true
    },
    clearValueForMove: (row, columnKey) => {
      ;(row as Record<string, unknown>)[columnKey] = ""
      return true
    },
    applyEditedValue: (row, columnKey, draft) => {
      ;(row as Record<string, unknown>)[columnKey] = draft
    },
    recomputeDerived: () => undefined,
    isCellWithinRange: (rowIndex, columnIndex, range) => {
      return isCoordInsideRange({ rowIndex, columnIndex, rowId: null }, range)
    },
    setSelectionFromRange: (range, activePosition) => {
      options.applySelectionRange(range)
      if (activePosition !== "start") {
        return
      }
      const normalized = options.normalizeClipboardRange(range)
      if (!normalized) {
        return
      }
      options.applyCellSelectionByCoord({
        rowIndex: normalized.startRow,
        columnIndex: normalized.startColumn,
        rowId: options.runtime.api.rows.get(normalized.startRow)?.rowId ?? null,
      }, false)
    },
    recordIntent: (descriptor, beforeSnapshot) => {
      void options.recordIntentTransaction({
        intent: descriptor.intent,
        label: descriptor.label,
        affectedRange: descriptor.affectedRange ?? null,
      }, beforeSnapshot)
    },
    setLastAction: () => undefined,
  })

  const {
    applyFillPreview,
    isCellInFillPreview,
    isFillHandleCell,
  } = useDataGridAppFill({
    mode: options.mode,
    viewportRowStart: options.viewportRowStart,
    fillBaseRange,
    fillPreviewRange,
    resolveSelectionRange: options.resolveSelectionRange,
    rangesEqual: options.rangesEqual,
    buildFillMatrixFromRange: options.buildFillMatrixFromRange,
    applyClipboardEdits: options.applyClipboardEdits,
    syncViewport: options.syncViewport,
  })

  const resolveCellCoordFromElement = (element: HTMLElement | null): DataGridAppCellCoord | null => {
    if (!element) {
      return null
    }
    const rowIndex = Number.parseInt(element.dataset.rowIndex ?? "", 10)
    const columnIndex = Number.parseInt(element.dataset.columnIndex ?? "", 10)
    if (!Number.isFinite(rowIndex) || !Number.isFinite(columnIndex)) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex,
      columnIndex,
      rowId: options.runtime.api.rows.get(rowIndex)?.rowId ?? null,
    })
  }

  const resolveCellCoordFromPointer = (clientX: number, clientY: number): DataGridAppCellCoord | null => {
    const target = document.elementFromPoint(clientX, clientY)
    const cell = target instanceof HTMLElement
      ? target.closest(".grid-cell[data-row-index][data-column-index]") as HTMLElement | null
      : null
    return resolveCellCoordFromElement(cell)
  }

  const cellNavigation = useDataGridCellNavigation<DataGridAppCellCoord>({
    resolveCurrentCellCoord: () => {
      const activeCell = options.selectionSnapshot.value?.activeCell
      if (!activeCell) {
        return null
      }
      return options.normalizeCellCoord({
        rowIndex: activeCell.rowIndex,
        columnIndex: activeCell.colIndex,
        rowId: options.normalizeRowId(activeCell.rowId),
      })
    },
    resolveTabTarget: (current, backwards) => {
      const lastRow = Math.max(0, options.totalRows.value - 1)
      const lastColumn = Math.max(0, options.visibleColumns.value.length - 1)
      if (backwards) {
        if (current.columnIndex > 0) {
          return { ...current, columnIndex: current.columnIndex - 1 }
        }
        if (current.rowIndex <= 0) {
          return current
        }
        return { ...current, rowIndex: current.rowIndex - 1, columnIndex: lastColumn }
      }
      if (current.columnIndex < lastColumn) {
        return { ...current, columnIndex: current.columnIndex + 1 }
      }
      if (current.rowIndex >= lastRow) {
        return current
      }
      return { ...current, rowIndex: current.rowIndex + 1, columnIndex: 0 }
    },
    normalizeCellCoord: coord => options.normalizeCellCoord(coord),
    getAdjacentNavigableColumnIndex: (columnIndex, direction) => {
      const lastColumn = Math.max(0, options.visibleColumns.value.length - 1)
      return Math.max(0, Math.min(lastColumn, columnIndex + direction))
    },
    getFirstNavigableColumnIndex: () => 0,
    getLastNavigableColumnIndex: () => Math.max(0, options.visibleColumns.value.length - 1),
    getLastRowIndex: () => Math.max(0, options.totalRows.value - 1),
    resolveStepRows: () => 20,
    closeContextMenu: () => undefined,
    clearCellSelection: () => {
      options.clearCellSelection()
    },
    setLastAction: () => undefined,
    applyCellSelection: (nextCoord, extend, fallbackAnchor) => {
      options.applyCellSelectionByCoord(nextCoord, extend, fallbackAnchor)
    },
    onNavigationApplied: nextCoord => {
      void nextTick(() => {
        options.ensureKeyboardActiveCellVisible(nextCoord.rowIndex, nextCoord.columnIndex)
      })
    },
  })

  const dragPointerSelection = useDataGridDragPointerSelection<DataGridAppCellCoord>({
    isDragSelecting: () => isPointerSelectingCells.value,
    resolveDragPointer: () => dragPointer.value,
    resolveCellCoordFromPointer,
    resolveLastDragCoord: () => lastDragCoord.value,
    setLastDragCoord: coord => {
      lastDragCoord.value = coord
    },
    cellCoordsEqual: (left, right) => (
      left?.rowIndex === right?.rowIndex
      && left?.columnIndex === right?.columnIndex
    ),
    applyCellSelection: (coord, extend, fallbackAnchor) => {
      options.applyCellSelectionByCoord(coord, extend, fallbackAnchor)
    },
  })

  const pointerPreviewRouter = useDataGridPointerPreviewRouter<DataGridAppCellCoord, DataGridCopyRange>({
    isFillDragging: () => isFillDragging.value,
    resolveFillPointer: () => fillPointer.value,
    resolveFillBaseRange: () => fillBaseRange.value,
    resolveFillPreviewRange: () => fillPreviewRange.value,
    setFillPreviewRange: range => {
      fillPreviewRange.value = options.normalizeClipboardRange(range)
    },
    isRangeMoving: () => isRangeMoving.value,
    resolveRangeMovePointer: () => rangeMovePointer.value,
    resolveRangeMoveBaseRange: () => rangeMoveBaseRange.value,
    resolveRangeMoveOrigin: () => rangeMoveOrigin.value,
    resolveRangeMovePreviewRange: () => rangeMovePreviewRange.value,
    setRangeMovePreviewRange: range => {
      rangeMovePreviewRange.value = options.normalizeClipboardRange(range)
    },
    resolveCellCoordFromPointer,
    buildExtendedRange: (baseRange, coord) => {
      const rowDistance = Math.abs(coord.rowIndex - baseRange.endRow)
      const columnDistance = Math.abs(coord.columnIndex - baseRange.endColumn)
      if (rowDistance >= columnDistance) {
        return options.normalizeClipboardRange({
          startRow: Math.min(baseRange.startRow, coord.rowIndex),
          endRow: Math.max(baseRange.endRow, coord.rowIndex),
          startColumn: baseRange.startColumn,
          endColumn: baseRange.endColumn,
        })
      }
      return options.normalizeClipboardRange({
        startRow: baseRange.startRow,
        endRow: baseRange.endRow,
        startColumn: Math.min(baseRange.startColumn, coord.columnIndex),
        endColumn: Math.max(baseRange.endColumn, coord.columnIndex),
      })
    },
    normalizeSelectionRange: range => options.normalizeClipboardRange(range),
    rangesEqual: options.rangesEqual,
  })

  const axisAutoScroll = useDataGridAxisAutoScrollDelta({
    edgePx: 28,
    maxStepPx: 22,
  })

  const pointerAutoScroll = useDataGridPointerAutoScroll({
    resolveInteractionState: () => ({
      isDragSelecting: options.mode.value === "base" && isPointerSelectingCells.value,
      isFillDragging: options.mode.value === "base" && isFillDragging.value,
      isRangeMoving: options.mode.value === "base" && isRangeMoving.value,
    }),
    resolveRangeMovePointer: () => rangeMovePointer.value,
    resolveFillPointer: () => fillPointer.value,
    resolveDragPointer: () => dragPointer.value,
    resolveViewportElement: () => options.bodyViewportRef.value,
    resolveHeaderHeight: () => 0,
    resolveAxisAutoScrollDelta: axisAutoScroll.resolveAxisAutoScrollDelta,
    setScrollPosition: () => {
      options.syncViewport()
    },
    applyRangeMovePreviewFromPointer: () => {
      pointerPreviewRouter.applyRangeMovePreviewFromPointer()
    },
    applyFillPreviewFromPointer: () => {
      pointerPreviewRouter.applyFillPreviewFromPointer()
    },
    applyDragSelectionFromPointer: () => {
      dragPointerSelection.applyDragSelectionFromPointer()
    },
  })

  const fillSelectionLifecycle = useDataGridFillSelectionLifecycle<DataGridCopyRange>({
    applyFillPreview,
    setFillDragging: value => {
      isFillDragging.value = value
    },
    clearFillPointer: () => {
      fillPointer.value = null
    },
    clearFillBaseRange: () => {
      fillBaseRange.value = null
    },
    clearFillPreviewRange: () => {
      fillPreviewRange.value = null
    },
    stopAutoScrollFrameIfIdle: () => {
      pointerAutoScroll.stopAutoScrollFrameIfIdle()
    },
    resolveFillPreviewRange: () => fillPreviewRange.value,
  })

  const stopFillSelection = (commit: boolean): void => {
    fillSelectionLifecycle.stopFillSelection(commit)
    void nextTick(() => {
      restoreActiveCellFocus()
    })
  }

  const rangeMoveLifecycle = useDataGridRangeMoveLifecycle({
    applyRangeMove: () => rangeMutationEngine.applyRangeMove(),
    setRangeMoving: value => {
      isRangeMoving.value = value
    },
    clearRangeMovePointer: () => {
      rangeMovePointer.value = null
    },
    clearRangeMoveBaseRange: () => {
      rangeMoveBaseRange.value = null
    },
    clearRangeMoveOrigin: () => {
      rangeMoveOrigin.value = null
    },
    clearRangeMovePreviewRange: () => {
      rangeMovePreviewRange.value = null
    },
    stopAutoScrollFrameIfIdle: () => {
      pointerAutoScroll.stopAutoScrollFrameIfIdle()
    },
  })

  const rangeMoveStart = useDataGridRangeMoveStart<DataGridAppCellCoord, DataGridCopyRange>({
    resolveSelectionRange: options.resolveSelectionRange,
    isCoordInsideRange,
    closeContextMenu: () => undefined,
    focusViewport,
    stopDragSelection: () => {
      stopPointerSelection()
    },
    stopFillSelection: applyPreview => {
      stopFillSelection(applyPreview)
    },
    setRangeMoving: value => {
      isRangeMoving.value = value
    },
    setRangeMovePointer: pointer => {
      rangeMovePointer.value = pointer
    },
    setRangeMoveBaseRange: range => {
      rangeMoveBaseRange.value = options.normalizeClipboardRange(range)
    },
    setRangeMoveOrigin: coord => {
      rangeMoveOrigin.value = options.normalizeCellCoord(coord)
    },
    setRangeMovePreviewRange: range => {
      rangeMovePreviewRange.value = options.normalizeClipboardRange(range)
    },
    startInteractionAutoScroll: () => {
      pointerAutoScroll.startInteractionAutoScroll()
    },
    setLastAction: () => undefined,
  })

  const fillHandleStart = useDataGridFillHandleStart<DataGridCopyRange>({
    resolveSelectionRange: options.resolveSelectionRange,
    focusViewport,
    stopRangeMove: commit => {
      rangeMoveLifecycle.stopRangeMove(commit)
    },
    setDragSelecting: value => {
      isPointerSelectingCells.value = value
    },
    setDragPointer: pointer => {
      dragPointer.value = pointer
    },
    setFillDragging: value => {
      isFillDragging.value = value
    },
    setFillBaseRange: range => {
      fillBaseRange.value = range ? options.normalizeClipboardRange(range) : null
    },
    setFillPreviewRange: range => {
      fillPreviewRange.value = range ? options.normalizeClipboardRange(range) : null
    },
    setFillPointer: pointer => {
      fillPointer.value = pointer
    },
    startInteractionAutoScroll: () => {
      pointerAutoScroll.startInteractionAutoScroll()
    },
    setLastAction: () => undefined,
  })

  const historyActionRunner = useDataGridHistoryActionRunner({
    hasInlineEditor: () => options.editingCell.value != null,
    commitInlineEdit: () => {
      options.commitInlineEdit()
    },
    closeContextMenu: () => undefined,
    canUndo: options.canUndo,
    canRedo: options.canRedo,
    runHistoryAction: direction => Promise.resolve(options.runHistoryAction(direction) as string | null),
    setLastAction: () => undefined,
  })

  const keyboardCommandRouter = useDataGridKeyboardCommandRouter({
    isRangeMoving: () => isRangeMoving.value,
    isContextMenuVisible: () => false,
    closeContextMenu: () => undefined,
    focusViewport,
    openContextMenuFromCurrentCell: () => undefined,
    runHistoryAction: direction => historyActionRunner.runHistoryAction(direction, "keyboard"),
    copySelection: options.copySelectedCells,
    pasteSelection: options.pasteSelectedCells,
    cutSelection: options.cutSelectedCells,
    stopRangeMove: commit => {
      rangeMoveLifecycle.stopRangeMove(commit)
    },
    setLastAction: () => undefined,
  })

  const cellPointerDownRouter = useDataGridCellPointerDownRouter<
    DataGridRowNode<TRow>,
    DataGridAppCellCoord,
    DataGridCopyRange
  >({
    isSelectionColumn: () => false,
    isRangeMoveModifierActive: event => event.button === 0 && !event.shiftKey,
    isEditorInteractionTarget: target => Boolean(target?.closest(".cell-editor-input")),
    hasInlineEditor: () => options.editingCell.value != null,
    commitInlineEdit: () => {
      if (!options.editingCell.value) {
        return false
      }
      options.commitInlineEdit(false)
      return true
    },
    resolveCellCoord: (row, columnKey) => {
      if (row.rowId == null) {
        return null
      }
      const rowIndex = options.resolveRowIndexById(row.rowId)
      if (rowIndex < 0) {
        return null
      }
      const columnIndex = options.visibleColumns.value.findIndex(column => column.key === columnKey)
      if (columnIndex < 0) {
        return null
      }
      return options.normalizeCellCoord({
        rowIndex,
        columnIndex,
        rowId: row.rowId,
      })
    },
    resolveSelectionRange: options.resolveSelectionRange,
    isCoordInsideRange,
    startRangeMove: (coord, pointer) => {
      rangeMoveStart.startRangeMove(coord, pointer)
    },
    closeContextMenu: () => undefined,
    focusViewport,
    isFillDragging: () => isFillDragging.value,
    stopFillSelection: commit => {
      stopFillSelection(commit)
    },
    setDragSelecting: value => {
      isPointerSelectingCells.value = value
    },
    setLastDragCoord: coord => {
      lastDragCoord.value = coord
    },
    setDragPointer: pointer => {
      dragPointer.value = pointer
    },
    applyCellSelection: (coord, extend, fallbackAnchor) => {
      options.applyCellSelectionByCoord(coord, extend, fallbackAnchor)
    },
    startInteractionAutoScroll: () => {
      pointerAutoScroll.startInteractionAutoScroll()
    },
    setLastAction: () => undefined,
  })

  const startFillHandleDrag = (event: MouseEvent): void => {
    if (options.mode.value !== "base") {
      return
    }
    fillHandleStart.onSelectionHandleMouseDown(event)
  }

  const handleCellMouseDown = (
    event: MouseEvent,
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
  ): void => {
    const columnKey = options.visibleColumns.value[columnIndex]?.key
    if (!columnKey) {
      return
    }

    if (options.mode.value === "base") {
      const handled = cellPointerDownRouter.dispatchCellPointerDown(row, columnKey, event)
      if (handled) {
        const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
        target?.focus({ preventScroll: true })
        return
      }
    }

    if (event.button !== 0) {
      return
    }
    options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
    if (options.mode.value !== "base") {
      return
    }
    isPointerSelectingCells.value = true
    dragPointer.value = { clientX: event.clientX, clientY: event.clientY }
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    target?.focus({ preventScroll: true })
    lastDragCoord.value = resolveCellCoordFromElement(target)
    pointerAutoScroll.startInteractionAutoScroll()
  }

  const handleCellKeydown = (
    event: KeyboardEvent,
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
  ): void => {
    if (isFillDragging.value && event.key === "Escape") {
      event.preventDefault()
      stopFillSelection(false)
      return
    }
    if (options.mode.value !== "base") {
      return
    }
    if (!isRangeMoving.value && event.key === "Escape" && options.clearPendingClipboardOperation(true, true)) {
      event.preventDefault()
      return
    }
    if (!options.selectionSnapshot.value?.activeCell) {
      options.setCellSelection(row, rowOffset, columnIndex, false)
    }
    if (keyboardCommandRouter.dispatchKeyboardCommands(event)) {
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const columnKey = options.visibleColumns.value[columnIndex]?.key
      if (columnKey) {
        options.startInlineEdit(row, columnKey)
      }
      return
    }
    if (cellNavigation.dispatchNavigation(event)) {
      return
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault()
      options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
    }
    if (event.key === "F2") {
      event.preventDefault()
      const columnKey = options.visibleColumns.value[columnIndex]?.key
      if (columnKey) {
        options.startInlineEdit(row, columnKey)
      }
    }
  }

  const handleWindowMouseMove = (event: MouseEvent): void => {
    if (isRangeMoving.value) {
      rangeMovePointer.value = { clientX: event.clientX, clientY: event.clientY }
      pointerPreviewRouter.applyRangeMovePreviewFromPointer()
      return
    }
    if (isFillDragging.value) {
      fillPointer.value = { clientX: event.clientX, clientY: event.clientY }
      pointerPreviewRouter.applyFillPreviewFromPointer()
      return
    }
    if (!isPointerSelectingCells.value) {
      return
    }
    dragPointer.value = { clientX: event.clientX, clientY: event.clientY }
    dragPointerSelection.applyDragSelectionFromPointer()
  }

  const handleWindowMouseUp = (): void => {
    if (isRangeMoving.value) {
      rangeMoveLifecycle.stopRangeMove(true)
    }
    if (isFillDragging.value) {
      stopFillSelection(true)
    }
    stopPointerSelection()
    pointerAutoScroll.stopAutoScrollFrameIfIdle()
  }

  return {
    isPointerSelectingCells,
    isFillDragging,
    stopPointerSelection: () => {
      stopPointerSelection()
      pointerAutoScroll.stopAutoScrollFrameIfIdle()
    },
    stopFillSelection,
    startFillHandleDrag,
    handleCellMouseDown,
    handleCellKeydown,
    handleWindowMouseMove,
    handleWindowMouseUp,
    isCellInFillPreview,
    isFillHandleCell,
    dispose: () => {
      pointerAutoScroll.dispose()
    },
  }
}
