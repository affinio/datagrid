import { computed, nextTick, ref, type ComputedRef, type Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowNode,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import {
  resolveDataGridCellKeyboardAction,
  toggleDataGridCellValue,
} from "@affino/datagrid-core"
import {
  type DataGridFillBehavior,
  buildDataGridFillMatrix,
  canToggleDataGridFillBehavior,
  resolveDataGridDefaultFillBehavior,
} from "../composables/dataGridFillBehavior"
import {
  useDataGridAxisAutoScrollDelta,
  useDataGridCellNavigation,
  useDataGridCellPointerDownRouter,
  useDataGridDragPointerSelection,
  useDataGridFillHandleStart,
  useDataGridFillSelectionLifecycle,
  useDataGridHistoryActionRunner,
  useDataGridKeyboardCommandRouter,
  useDataGridPointerCellCoordResolver,
  useDataGridPointerAutoScroll,
  useDataGridPointerPreviewRouter,
  useDataGridRangeMoveLifecycle,
  useDataGridRangeMoveStart,
  useDataGridRangeMutationEngine,
  type DataGridCopyRange,
} from "../advanced"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import {
  useDataGridAppFill,
  type DataGridAppAppliedFillSession,
} from "./useDataGridAppFill"
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
type DataGridAppPinnedOrigin = "left" | "right" | "center"
type DataGridRowIndexKeyboardAction = "insert-row-above" | "copy-row" | "cut-row" | "paste-row" | "delete-selected-rows" | "open-row-menu"

const DRAG_SELECTION_POINTER_THRESHOLD_PX = 4

export interface UseDataGridAppInteractionControllerOptions<
  TRow extends Record<string, unknown>,
  TSnapshot,
> {
  mode: Ref<DataGridAppMode>
  enableFillHandle?: Ref<boolean>
  enableRangeMove?: Ref<boolean>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "getBodyRowAtIndex" | "resolveBodyRowIndexById">
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  viewportRowStart: Ref<number>
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  bodyViewportRef: Ref<HTMLElement | null>
  indexColumnWidth?: number
  resolveColumnWidth: (column: DataGridColumnSnapshot) => number
  resolveRowHeight: (rowIndex: number) => number
  resolveRowIndexAtOffset: (offset: number) => number
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
  handleToggleCellAction?: (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    columnIndex: number,
    column: DataGridColumnSnapshot,
  ) => boolean
  isCellEditable: (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    columnKey: string,
    columnIndex: number,
  ) => boolean
  cloneRowData: (row: TRow) => TRow
  resolveRowIndexById?: (rowId: string | number) => number
  captureRowsSnapshot: () => TSnapshot
  recordIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: TSnapshot,
  ) => void | Promise<void>
  clearPendingClipboardOperation: (clearSelection: boolean, clearBufferedClipboardPayload?: boolean) => boolean
  clearExternalPendingClipboardOperation?: () => boolean
  copySelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  cutSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  normalizeClipboardRange: (range: DataGridCopyRange) => DataGridCopyRange | null
  applyClipboardEdits: (
    range: DataGridCopyRange,
    matrix: string[][],
    options?: { recordHistory?: boolean },
  ) => number
  rangesEqual: (left: DataGridCopyRange | null, right: DataGridCopyRange | null) => boolean
  buildFillMatrixFromRange: (range: DataGridCopyRange) => string[][]
  applyRangeMove?: (baseRange: DataGridCopyRange, targetRange: DataGridCopyRange) => boolean
  syncViewport: () => void
  editingCell: Ref<{ rowId: string | number; columnKey: string } | null>
  startInlineEdit: (
    row: DataGridRowNode<TRow>,
    columnKey: string,
    options?: { draftValue?: string; openOnMount?: boolean },
  ) => void
  commitInlineEdit: (target?: "stay" | "next" | "previous") => void
  canUndo: () => boolean
  canRedo: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<unknown> | unknown
  ensureKeyboardActiveCellVisible: (rowIndex: number, columnIndex: number) => void
  isContextMenuVisible?: () => boolean
  closeContextMenu?: () => void
  openContextMenuFromCurrentCell?: () => void
  runRowIndexKeyboardAction?: (
    action: DataGridRowIndexKeyboardAction,
    rowId: string | number,
  ) => Promise<boolean> | boolean
}

export interface UseDataGridAppInteractionControllerResult<TRow> {
  isPointerSelectingCells: Ref<boolean>
  isFillDragging: Ref<boolean>
  fillPreviewRange: Ref<DataGridCopyRange | null>
  lastAppliedFill: Ref<DataGridAppAppliedFillSession | null>
  isRangeMoving: Ref<boolean>
  selectionRange: ComputedRef<DataGridCopyRange | null>
  rangeMovePreviewRange: Ref<DataGridCopyRange | null>
  stopPointerSelection: () => void
  stopFillSelection: (commit: boolean) => void
  startFillHandleDrag: (event: MouseEvent) => void
  startFillHandleDoubleClick: (event: MouseEvent) => void
  applyLastFillBehavior: (behavior: DataGridFillBehavior) => boolean
  handleCellMouseDown: (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number, columnIndex: number) => void
  handleCellKeydown: (event: KeyboardEvent, row: DataGridRowNode<TRow>, rowOffset: number, columnIndex: number) => void
  handleRowIndexKeydown: (event: KeyboardEvent, row: DataGridRowNode<TRow>, rowOffset: number) => void
  handleWindowMouseMove: (event: MouseEvent) => void
  handleWindowMouseUp: () => void
  isCellInFillPreview: (rowOffset: number, columnIndex: number) => boolean
  isFillHandleCell: (rowOffset: number, columnIndex: number) => boolean
  clearSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  dispose: () => void
}

export function useDataGridAppInteractionController<
  TRow extends Record<string, unknown>,
  TSnapshot,
>(
  options: UseDataGridAppInteractionControllerOptions<TRow, TSnapshot>,
): UseDataGridAppInteractionControllerResult<TRow> {
  const isContextMenuVisible = () => options.isContextMenuVisible?.() === true
  const closeContextMenu = () => {
    options.closeContextMenu?.()
  }
  const openContextMenuFromCurrentCell = () => {
    options.openContextMenuFromCurrentCell?.()
  }

  const getBodyRowAtIndex = (rowIndex: number): DataGridRowNode<TRow> | null => {
    const runtime = options.runtime as typeof options.runtime & {
      getBodyRowAtIndex?: (index: number) => DataGridRowNode<TRow> | null
    }
    return runtime.getBodyRowAtIndex?.(rowIndex) ?? options.runtime.api.rows.get(rowIndex) ?? null
  }
  const resolveBodyRowIndexById = (rowId: string | number): number => {
    const runtime = options.runtime as typeof options.runtime & {
      resolveBodyRowIndexById?: (value: string | number) => number
    }
    if (typeof runtime.resolveBodyRowIndexById === "function") {
      return runtime.resolveBodyRowIndexById(rowId)
    }
    if (typeof options.resolveRowIndexById === "function") {
      return options.resolveRowIndexById(rowId)
    }
    const count = options.runtime.api.rows.getCount()
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      if (options.runtime.api.rows.get(rowIndex)?.rowId === rowId) {
        return rowIndex
      }
    }
    return -1
  }
  const supportsCellSelectionMode = (): boolean => {
    return options.mode.value === "base" || options.mode.value === "tree" || options.mode.value === "worker"
  }
  const isFillHandleEnabled = computed(() => options.enableFillHandle?.value !== false)
  const isRangeMoveEnabled = computed(() => options.enableRangeMove?.value !== false)

  const isPointerSelectingCells = ref(false)
  const keyboardNavigationExtendsSelection = ref(false)
  const dragPointer = ref<DataGridAppPointer | null>(null)
  const lastDragCoord = ref<DataGridAppCellCoord | null>(null)
  const dragSelectionOriginPin = ref<DataGridAppPinnedOrigin | null>(null)
  const pendingDragSelection = ref(false)
  const pendingDragPointerStart = ref<DataGridAppPointer | null>(null)
  const pendingDragCoord = ref<DataGridAppCellCoord | null>(null)
  const isFillDragging = ref(false)
  const fillDragStartPointer = ref<DataGridAppPointer | null>(null)
  const fillPointer = ref<DataGridAppPointer | null>(null)
  const fillBaseRange = ref<DataGridCopyRange | null>(null)
  const fillPreviewRange = ref<DataGridCopyRange | null>(null)
  const activeFillBehavior = ref<DataGridFillBehavior | null>(null)
  const lastAppliedFill = ref<DataGridAppAppliedFillSession | null>(null)
  const activeRestartFillSession = ref<DataGridAppAppliedFillSession | null>(null)
  const fillOriginFocusCoord = ref<DataGridAppCellCoord | null>(null)
  const isRangeMoving = ref(false)
  const pendingRangeMove = ref(false)
  const pendingRangeMoveCoord = ref<DataGridAppCellCoord | null>(null)
  const pendingRangeMovePointerStart = ref<DataGridAppPointer | null>(null)
  const rangeMovePointer = ref<DataGridAppPointer | null>(null)
  const rangeMoveBaseRange = ref<DataGridCopyRange | null>(null)
  const rangeMoveOrigin = ref<DataGridAppCellCoord | null>(null)
  const rangeMovePreviewRange = ref<DataGridCopyRange | null>(null)

  const focusViewport = (): void => {
    options.bodyViewportRef.value?.focus({ preventScroll: true })
  }

  const restoreRowIndexFocus = (
    rowId: string | number,
    fallbackTarget: HTMLElement | null = null,
  ): void => {
    const applyFocus = (): void => {
      const rowIndexCell = options.bodyViewportRef.value
        ?.closest<HTMLElement>(".grid-body-shell")
        ?.querySelector<HTMLElement>(`.datagrid-stage__row-index-cell[data-row-id="${String(rowId)}"]`)
      const target = rowIndexCell ?? (fallbackTarget?.isConnected ? fallbackTarget : null)
      if (target) {
        target.focus({ preventScroll: true })
        return
      }
      focusViewport()
    }

    applyFocus()
    void nextTick(() => {
      applyFocus()
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          applyFocus()
        })
      }
    })
  }

  const isPrintableEditingKey = (event: KeyboardEvent): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false
    }
    return event.key.length === 1
  }

  const applyDirectCellEdit = (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    columnIndex: number,
    columnKey: string,
    nextValue: unknown,
    label: string,
  ): boolean => {
    if (row.kind === "group" || row.rowId == null) {
      return false
    }
    const beforeSnapshot = options.captureRowsSnapshot()
    options.runtime.api.rows.applyEdits([
      {
        rowId: row.rowId,
        data: {
          [columnKey]: nextValue,
        } as Partial<TRow>,
      },
    ])
    void options.recordIntentTransaction({
      intent: "edit",
      label,
      affectedRange: {
        startRow: rowIndex,
        endRow: rowIndex,
        startColumn: columnIndex,
        endColumn: columnIndex,
      },
    }, beforeSnapshot)
    options.syncViewport()
    restoreActiveCellFocus({
      rowIndex,
      columnIndex,
      rowId: row.rowId,
    })
    return true
  }

  const restoreActiveCellFocus = (preferredCoord: DataGridAppCellCoord | null = null): void => {
    const applyFocus = (): void => {
      if (preferredCoord) {
        options.ensureKeyboardActiveCellVisible(preferredCoord.rowIndex, preferredCoord.columnIndex)
        return
      }
      const activeCell = options.selectionSnapshot.value?.activeCell
      if (activeCell) {
        options.ensureKeyboardActiveCellVisible(activeCell.rowIndex, activeCell.colIndex)
        return
      }
      focusViewport()
    }

    applyFocus()
    void nextTick(() => {
      applyFocus()
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          applyFocus()
        })
      }
    })
  }

  const clearPendingDragSelection = (): void => {
    pendingDragSelection.value = false
    pendingDragPointerStart.value = null
    pendingDragCoord.value = null
  }

  const clearPendingRangeMove = (): void => {
    pendingRangeMove.value = false
    pendingRangeMoveCoord.value = null
    pendingRangeMovePointerStart.value = null
  }

  const selectionRange = computed(() => {
    if (isFillDragging.value && fillPreviewRange.value) {
      return fillPreviewRange.value
    }
    return options.resolveSelectionRange()
  })

  const stopPointerSelection = (): void => {
    isPointerSelectingCells.value = false
    dragPointer.value = null
    lastDragCoord.value = null
    dragSelectionOriginPin.value = null
    clearPendingDragSelection()
    clearPendingRangeMove()
  }

  const resolveColumnPin = (columnIndex: number): DataGridAppPinnedOrigin => {
    const pin = options.visibleColumns.value[columnIndex]?.pin
    if (pin === "left" || pin === "right") {
      return pin
    }
    return "center"
  }

  const shouldActivateDragSelection = (pointer: DataGridAppPointer): boolean => {
    const startPointer = pendingDragPointerStart.value
    if (!startPointer) {
      return false
    }
    const deltaX = Math.abs(pointer.clientX - startPointer.clientX)
    const deltaY = Math.abs(pointer.clientY - startPointer.clientY)
    return Math.max(deltaX, deltaY) >= DRAG_SELECTION_POINTER_THRESHOLD_PX
  }

  const shouldActivateRangeMove = (pointer: DataGridAppPointer): boolean => {
    const startPointer = pendingRangeMovePointerStart.value
    if (!startPointer) {
      return false
    }
    const deltaX = Math.abs(pointer.clientX - startPointer.clientX)
    const deltaY = Math.abs(pointer.clientY - startPointer.clientY)
    return Math.max(deltaX, deltaY) >= DRAG_SELECTION_POINTER_THRESHOLD_PX
  }

  const activatePendingDragSelection = (pointer: DataGridAppPointer): boolean => {
    if (!pendingDragSelection.value || !pendingDragCoord.value) {
      return false
    }
    isPointerSelectingCells.value = true
    dragPointer.value = pointer
    lastDragCoord.value = pendingDragCoord.value
    clearPendingDragSelection()
    return true
  }

  const activatePendingRangeMove = (pointer: DataGridAppPointer): boolean => {
    const coord = pendingRangeMoveCoord.value
    if (!isRangeMoveEnabled.value || !pendingRangeMove.value || !coord) {
      clearPendingRangeMove()
      return false
    }
    clearPendingRangeMove()
    return rangeMoveStart.startRangeMove(coord, pointer)
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
      const node = getBodyRowAtIndex(rowIndex)
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
      const rowIndex = resolveBodyRowIndexById(row.rowId)
      const node = rowIndex >= 0 ? getBodyRowAtIndex(rowIndex) : null
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
      applySelectionRangeWithActivePosition(range, activePosition)
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
    applyFillRange,
    isCellInFillPreview,
    isFillHandleCell,
  } = useDataGridAppFill({
    mode: options.mode,
    viewportRowStart: options.viewportRowStart,
    isFillDragging,
    fillBaseRange,
    fillPreviewRange,
    activeFillBehavior,
    resolveSelectionRange: options.resolveSelectionRange,
    rangesEqual: options.rangesEqual,
    buildFillMatrixFromRange: options.buildFillMatrixFromRange,
    applyClipboardEdits: options.applyClipboardEdits,
    isCellEditableAt: (rowIndex, columnIndex) => {
      const row = getBodyRowAtIndex(rowIndex)
      const columnKey = options.visibleColumns.value[columnIndex]?.key
      if (!row || !columnKey) {
        return false
      }
      return options.isCellEditable(row, rowIndex, columnKey, columnIndex)
    },
    setLastAppliedFillSession: session => {
      lastAppliedFill.value = session
      activeFillBehavior.value = session?.behavior ?? activeFillBehavior.value
    },
    syncViewport: options.syncViewport,
  })

  const applyCommittedFillRange = (
    baseRange: DataGridCopyRange,
    previewRange: DataGridCopyRange,
    behavior?: DataGridFillBehavior,
  ): boolean => {
    const resolveRemovedFillRange = (
      previousRange: DataGridCopyRange,
      nextRange: DataGridCopyRange,
    ): DataGridCopyRange | null => {
      if (options.rangesEqual(previousRange, nextRange)) {
        return null
      }
      const nextWithinPrevious = (
        nextRange.startRow >= previousRange.startRow
        && nextRange.endRow <= previousRange.endRow
        && nextRange.startColumn >= previousRange.startColumn
        && nextRange.endColumn <= previousRange.endColumn
      )
      if (!nextWithinPrevious) {
        return null
      }
      if (
        previousRange.startColumn === nextRange.startColumn
        && previousRange.endColumn === nextRange.endColumn
      ) {
        if (previousRange.startRow === nextRange.startRow && previousRange.endRow > nextRange.endRow) {
          return {
            startRow: nextRange.endRow + 1,
            endRow: previousRange.endRow,
            startColumn: previousRange.startColumn,
            endColumn: previousRange.endColumn,
          }
        }
        if (previousRange.endRow === nextRange.endRow && previousRange.startRow < nextRange.startRow) {
          return {
            startRow: previousRange.startRow,
            endRow: nextRange.startRow - 1,
            startColumn: previousRange.startColumn,
            endColumn: previousRange.endColumn,
          }
        }
      }
      if (
        previousRange.startRow === nextRange.startRow
        && previousRange.endRow === nextRange.endRow
      ) {
        if (previousRange.startColumn === nextRange.startColumn && previousRange.endColumn > nextRange.endColumn) {
          return {
            startRow: previousRange.startRow,
            endRow: previousRange.endRow,
            startColumn: nextRange.endColumn + 1,
            endColumn: previousRange.endColumn,
          }
        }
        if (previousRange.endColumn === nextRange.endColumn && previousRange.startColumn < nextRange.startColumn) {
          return {
            startRow: previousRange.startRow,
            endRow: previousRange.endRow,
            startColumn: previousRange.startColumn,
            endColumn: nextRange.startColumn - 1,
          }
        }
      }
      return null
    }

    const restartSession = activeRestartFillSession.value
    if (restartSession && options.rangesEqual(restartSession.baseRange, baseRange)) {
      const removedRange = resolveRemovedFillRange(restartSession.previewRange, previewRange)
      if (removedRange) {
        const beforeSnapshot = options.captureRowsSnapshot()
        const sourceMatrix = options.buildFillMatrixFromRange(baseRange)
        const resolvedBehavior = behavior
          ?? activeFillBehavior.value
          ?? restartSession.behavior
          ?? resolveDataGridDefaultFillBehavior({
            baseRange,
            previewRange,
            sourceMatrix,
          })

        options.applyClipboardEdits(removedRange, [["" ]], { recordHistory: false })

        if (options.rangesEqual(baseRange, previewRange)) {
          options.applySelectionRange(baseRange)
          lastAppliedFill.value = null
        } else {
          options.applyClipboardEdits(previewRange, buildDataGridFillMatrix({
            baseRange,
            previewRange,
            sourceMatrix,
            behavior: resolvedBehavior,
          }), { recordHistory: false })
          lastAppliedFill.value = {
            baseRange: { ...baseRange },
            previewRange: { ...previewRange },
            behavior: resolvedBehavior,
            allowBehaviorToggle: canToggleDataGridFillBehavior({
              baseRange,
              previewRange,
              sourceMatrix,
            }),
          }
        }

        options.syncViewport()
        void options.recordIntentTransaction({
          intent: "fill",
          label: "Fill cells",
          affectedRange: previewRange,
        }, beforeSnapshot)
        if (behavior) {
          activeFillBehavior.value = behavior
        }
        return true
      }
    }

    const applied = applyFillRange(baseRange, previewRange, behavior)
    if (applied && behavior) {
      activeFillBehavior.value = behavior
    }
    return applied
  }

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
      rowId: getBodyRowAtIndex(rowIndex)?.rowId ?? null,
    })
  }

  const pointerCellCoordResolver = useDataGridPointerCellCoordResolver<DataGridAppCellCoord>({
    resolveViewportElement: () => {
      const bodyViewport = options.bodyViewportRef.value
      const bodyShell = bodyViewport?.closest(".grid-body-shell")
      if (!(bodyViewport instanceof HTMLElement) || !(bodyShell instanceof HTMLElement)) {
        return bodyViewport
      }
      return {
        scrollTop: bodyViewport.scrollTop,
        scrollLeft: bodyViewport.scrollLeft,
        getBoundingClientRect: () => {
          const rect = bodyShell.getBoundingClientRect()
          const indexInset = Math.max(0, Math.min(options.indexColumnWidth ?? 0, rect.width))
          const width = Math.max(0, rect.width - indexInset)
          const left = rect.left + indexInset
          return {
            left,
            top: rect.top,
            width,
            height: rect.height,
            right: left + width,
            bottom: rect.bottom,
            x: left,
            y: rect.top,
            toJSON: () => ({}),
          }
        },
      } as unknown as HTMLElement
    },
    resolveColumnMetrics: () => {
      let currentOffset = 0
      return options.visibleColumns.value.map((column, columnIndex) => {
        const width = options.resolveColumnWidth(column)
        const start = currentOffset
        currentOffset += width
        return {
          columnIndex,
          start,
          end: currentOffset,
          width,
        }
      })
    },
    resolveColumns: () => options.visibleColumns.value,
    resolveVirtualWindow: () => ({
      rowTotal: options.totalRows.value,
      colTotal: options.visibleColumns.value.length,
    }),
    resolveHeaderHeight: () => 0,
    resolveRowHeight: () => options.resolveRowHeight(0),
    resolveRowIndexAtOffset: offset => options.resolveRowIndexAtOffset(offset),
    resolveNearestNavigableColumnIndex: columnIndex => {
      const lastColumnIndex = Math.max(0, options.visibleColumns.value.length - 1)
      return Math.max(0, Math.min(lastColumnIndex, columnIndex))
    },
    normalizeCellCoord: coord => options.normalizeCellCoord({
      ...coord,
      rowId: getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null,
    }),
  })

  const resolveCellCoordFromPointer = (clientX: number, clientY: number): DataGridAppCellCoord | null => {
    if (typeof document !== "undefined" && typeof document.elementFromPoint === "function") {
      const pointerTarget = document.elementFromPoint(clientX, clientY)
      const pointerCell = pointerTarget instanceof HTMLElement
        ? pointerTarget.closest<HTMLElement>(".grid-cell[data-row-index][data-column-index]")
        : null
      const domResolvedCoord = resolveCellCoordFromElement(pointerCell)
      if (domResolvedCoord) {
        return domResolvedCoord
      }
    }
    return pointerCellCoordResolver.resolveCellCoordFromPointer(clientX, clientY)
  }

  const resolveSelectionFocusCoord = (): DataGridAppCellCoord | null => {
    const snapshot = options.selectionSnapshot.value
    const activeRange = snapshot?.ranges[snapshot.activeRangeIndex ?? 0] ?? snapshot?.ranges[0] ?? null
    const focus = activeRange?.focus
    if (!focus) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex: focus.rowIndex,
      columnIndex: focus.colIndex,
      rowId: options.normalizeRowId(focus.rowId),
    })
  }

  const cellNavigation = useDataGridCellNavigation<DataGridAppCellCoord>({
    resolveCurrentCellCoord: () => {
      if (keyboardNavigationExtendsSelection.value) {
        const focusCoord = resolveSelectionFocusCoord()
        if (focusCoord) {
          return focusCoord
        }
      }
      const anchorCoord = resolveSelectionAnchorCoord()
      if (anchorCoord) {
        return anchorCoord
      }
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
    closeContextMenu,
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
    resolveFillDragStartPointer: () => fillDragStartPointer.value,
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
    buildExtendedRange: (baseRange, coord, fillAxis) => {
      const rowDistance = Math.abs(coord.rowIndex - baseRange.endRow)
      const columnDistance = Math.abs(coord.columnIndex - baseRange.endColumn)
      const resolvedFillAxis = fillAxis ?? (rowDistance >= columnDistance ? "vertical" : "horizontal")
      if (resolvedFillAxis === "vertical") {
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
    resolveAllowHorizontalAutoScroll: () => {
      if (!isPointerSelectingCells.value) {
        return true
      }
      return dragSelectionOriginPin.value === null || dragSelectionOriginPin.value === "center"
    },
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
    applyFillPreview: () => {
      const baseRange = fillBaseRange.value
      const previewRange = fillPreviewRange.value
      if (!baseRange || !previewRange) {
        return
      }
      applyCommittedFillRange(baseRange, previewRange)
    },
    setFillDragging: value => {
      isFillDragging.value = value
    },
    clearFillDragStartPointer: () => {
      fillDragStartPointer.value = null
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
    const preferredFocusCoord = fillOriginFocusCoord.value
    fillSelectionLifecycle.stopFillSelection(commit)
    activeRestartFillSession.value = null
    const restoredCoord = preferredFocusCoord
      ? restoreSelectionActiveCellToCoord(preferredFocusCoord)
      : null
    fillOriginFocusCoord.value = null
    restoreActiveCellFocus(restoredCoord ?? preferredFocusCoord)
  }

  const resolveSelectionAnchorCoord = (): DataGridAppCellCoord | null => {
    const snapshot = options.selectionSnapshot.value
    const activeRange = snapshot?.ranges[snapshot.activeRangeIndex ?? 0] ?? snapshot?.ranges[0] ?? null
    const anchor = activeRange?.anchor
    if (!anchor) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex: anchor.rowIndex,
      columnIndex: anchor.colIndex,
      rowId: options.normalizeRowId(anchor.rowId),
    })
  }

  const restoreSelectionActiveCellToAnchor = (): DataGridAppCellCoord | null => {
    const snapshot = options.selectionSnapshot.value
    const activeRangeIndex = snapshot?.activeRangeIndex ?? 0
    const activeRange = snapshot?.ranges[activeRangeIndex] ?? snapshot?.ranges[0] ?? null
    const anchor = activeRange?.anchor
    if (!snapshot || !anchor) {
      return null
    }
    const nextSnapshot = {
      ...snapshot,
      activeCell: {
        rowIndex: anchor.rowIndex,
        colIndex: anchor.colIndex,
        rowId: anchor.rowId ?? null,
      },
    }
    options.selectionSnapshot.value = nextSnapshot
    options.runtime.api.selection.setSnapshot(nextSnapshot)
    return options.normalizeCellCoord({
      rowIndex: anchor.rowIndex,
      columnIndex: anchor.colIndex,
      rowId: options.normalizeRowId(anchor.rowId),
    })
  }

  const restoreSelectionActiveCellToCoord = (
    coord: DataGridAppCellCoord | null,
  ): DataGridAppCellCoord | null => {
    const snapshot = options.selectionSnapshot.value
    const normalizedCoord = coord ? options.normalizeCellCoord(coord) : null
    if (!snapshot || !normalizedCoord) {
      return null
    }
    const nextSnapshot = {
      ...snapshot,
      activeCell: {
        rowIndex: normalizedCoord.rowIndex,
        colIndex: normalizedCoord.columnIndex,
        rowId: normalizedCoord.rowId ?? null,
      },
    }
    options.selectionSnapshot.value = nextSnapshot
    options.runtime.api.selection.setSnapshot(nextSnapshot)
    return normalizedCoord
  }

  const applySelectionRangeWithActivePosition = (
    range: DataGridCopyRange,
    activePosition: "start" | "end",
  ): void => {
    options.applySelectionRange(range)
    if (activePosition !== "start") {
      return
    }
    const snapshot = options.selectionSnapshot.value
    const activeRangeIndex = snapshot?.activeRangeIndex ?? 0
    const activeRange = snapshot?.ranges[activeRangeIndex] ?? snapshot?.ranges[0] ?? null
    const anchor = activeRange?.anchor
    if (!snapshot || !anchor) {
      return
    }
    const nextSnapshot = {
      ...snapshot,
      activeCell: {
        rowIndex: anchor.rowIndex,
        colIndex: anchor.colIndex,
        rowId: anchor.rowId ?? null,
      },
    }
    options.selectionSnapshot.value = nextSnapshot
    options.runtime.api.selection.setSnapshot(nextSnapshot)
  }

  const resolveFillOriginFocusCoord = (): DataGridAppCellCoord | null => {
    const anchorCoord = resolveSelectionAnchorCoord()
    if (anchorCoord) {
      return anchorCoord
    }
    const activeCell = options.selectionSnapshot.value?.activeCell
    if (activeCell) {
      return options.normalizeCellCoord({
        rowIndex: activeCell.rowIndex,
        columnIndex: activeCell.colIndex,
        rowId: options.normalizeRowId(activeCell.rowId),
      })
    }
    const range = options.resolveSelectionRange()
    if (!range) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex: range.startRow,
      columnIndex: range.startColumn,
      rowId: getBodyRowAtIndex(range.startRow)?.rowId ?? null,
    })
  }

  const resolveRestartableFillSession = (
    currentRange: DataGridCopyRange,
  ): DataGridAppAppliedFillSession | null => {
    const session = lastAppliedFill.value
    if (!session) {
      return null
    }
    return options.rangesEqual(currentRange, session.previewRange)
      ? session
      : null
  }

  const rangeMoveLifecycle = useDataGridRangeMoveLifecycle({
    applyRangeMove: () => {
      const baseRange = rangeMoveBaseRange.value
      const targetRange = rangeMovePreviewRange.value
      if (options.applyRangeMove && baseRange && targetRange) {
        return options.applyRangeMove(baseRange, targetRange)
      }
      return rangeMutationEngine.applyRangeMove()
    },
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
    closeContextMenu,
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
    resolveInitialFillBaseRange: currentRange => {
      return resolveRestartableFillSession(currentRange)?.baseRange ?? currentRange
    },
    resolveInitialFillPreviewRange: currentRange => {
      return resolveRestartableFillSession(currentRange)?.previewRange ?? currentRange
    },
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
    setFillDragStartPointer: pointer => {
      fillDragStartPointer.value = pointer
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
    closeContextMenu,
    canUndo: options.canUndo,
    canRedo: options.canRedo,
    runHistoryAction: direction => Promise.resolve(options.runHistoryAction(direction) as string | null),
    setLastAction: () => undefined,
  })

  const clearSelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
    if (!supportsCellSelectionMode()) {
      return false
    }
    const rawRange = options.resolveSelectionRange()
    const range = rawRange ? options.normalizeClipboardRange(rawRange) : null
    if (!range) {
      return false
    }
    const beforeSnapshot = options.captureRowsSnapshot()
    options.clearPendingClipboardOperation(false)
    const applied = options.applyClipboardEdits(range, [[""]], { recordHistory: false })
    if (applied <= 0) {
      return false
    }
    const clearedCellCount = (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1)
    options.applySelectionRange(range)
    options.syncViewport()
    void options.recordIntentTransaction({
      intent: "clear",
      label: `Clear ${clearedCellCount} cells`,
      affectedRange: range,
    }, beforeSnapshot)
    void trigger
    return true
  }

  const keyboardCommandRouter = useDataGridKeyboardCommandRouter({
    isRangeMoving: () => isRangeMoving.value,
    isContextMenuVisible,
    closeContextMenu,
    focusViewport,
    openContextMenuFromCurrentCell,
    selectAllCells: () => {
      if (!supportsCellSelectionMode()) {
        return
      }
      const lastRowIndex = options.totalRows.value - 1
      const lastColumnIndex = options.visibleColumns.value.length - 1
      if (lastRowIndex < 0 || lastColumnIndex < 0) {
        return
      }
      options.applySelectionRange({
        startRow: 0,
        endRow: lastRowIndex,
        startColumn: 0,
        endColumn: lastColumnIndex,
      })
      focusViewport()
    },
    runHistoryAction: direction => historyActionRunner.runHistoryAction(direction, "keyboard"),
    copySelection: options.copySelectedCells,
    pasteSelection: options.pasteSelectedCells,
    cutSelection: options.cutSelectedCells,
    clearCurrentSelection: clearSelectedCells,
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
    isRangeMoveModifierActive: event => isRangeMoveEnabled.value && event.button === 0 && !event.shiftKey,
    isEditorInteractionTarget: target => Boolean(target?.closest(".cell-editor-input")),
    hasInlineEditor: () => options.editingCell.value != null,
    commitInlineEdit: () => {
      if (!options.editingCell.value) {
        return false
      }
      options.commitInlineEdit("stay")
      return true
    },
    resolveCellCoord: (row, columnKey) => {
      if (row.rowId == null) {
        return null
      }
      const rowIndex = resolveBodyRowIndexById(row.rowId)
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
      if (!isRangeMoveEnabled.value) {
        return
      }
      const row = getBodyRowAtIndex(coord.rowIndex)
      const columnKey = options.visibleColumns.value[coord.columnIndex]?.key
      if (!row || !columnKey || !options.isCellEditable(row, coord.rowIndex, columnKey, coord.columnIndex)) {
        return
      }
      rangeMoveStart.startRangeMove(coord, pointer)
    },
    closeContextMenu,
    focusViewport,
    isFillDragging: () => isFillDragging.value,
    stopFillSelection: commit => {
      stopFillSelection(commit)
    },
    setDragSelecting: value => {
      pendingDragSelection.value = value
      if (!value) {
        clearPendingDragSelection()
      }
    },
    setLastDragCoord: coord => {
      pendingDragCoord.value = coord
    },
    setDragPointer: pointer => {
      pendingDragPointerStart.value = pointer
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
    if (options.mode.value !== "base" || !isFillHandleEnabled.value) {
      return
    }
    const baseRange = options.resolveSelectionRange()
    const anchorRow = baseRange ? getBodyRowAtIndex(baseRange.endRow) : null
    const anchorColumnKey = baseRange ? options.visibleColumns.value[baseRange.endColumn]?.key : null
    if (!baseRange || !anchorRow || !anchorColumnKey) {
      return
    }
    if (!options.isCellEditable(anchorRow, baseRange.endRow, anchorColumnKey, baseRange.endColumn)) {
      return
    }
    const originCoord = resolveFillOriginFocusCoord()
    const restartSession = resolveRestartableFillSession(baseRange)
    if (fillHandleStart.onSelectionHandleMouseDown(event)) {
      activeRestartFillSession.value = restartSession
      fillOriginFocusCoord.value = originCoord
    }
  }

  const isNonEmptyFillReferenceValue = (row: DataGridRowNode<TRow>, columnKey: string): boolean => {
    return options.readCell(row, columnKey).trim().length > 0
  }

  const resolveReferenceColumnExtentEndRow = (
    baseRange: DataGridCopyRange,
    columnIndex: number,
  ): number => {
    const columnKey = options.visibleColumns.value[columnIndex]?.key
    if (!columnKey) {
      return baseRange.endRow
    }

    for (let rowIndex = baseRange.startRow; rowIndex <= baseRange.endRow; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
      if (!row || row.rowId == null || row.kind === "group") {
        return baseRange.endRow
      }
      if (!isNonEmptyFillReferenceValue(row, columnKey)) {
        return baseRange.endRow
      }
    }

    let contiguousEndRow = baseRange.endRow
    for (let rowIndex = baseRange.endRow + 1; rowIndex < options.totalRows.value; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
      if (!row || row.rowId == null || row.kind === "group") {
        break
      }
      if (!isNonEmptyFillReferenceValue(row, columnKey)) {
        break
      }
      contiguousEndRow = rowIndex
    }

    return contiguousEndRow
  }

  const resolveBestNeighborFillEndRow = (baseRange: DataGridCopyRange): number => {
    const evaluateDirection = (startColumnIndex: number, step: -1 | 1): number => {
      let bestEndRow = baseRange.endRow
      let foundCandidate = false
      for (
        let columnIndex = startColumnIndex;
        columnIndex >= 0 && columnIndex < options.visibleColumns.value.length;
        columnIndex += step
      ) {
        const candidateEndRow = resolveReferenceColumnExtentEndRow(baseRange, columnIndex)
        if (candidateEndRow <= baseRange.endRow) {
          if (foundCandidate) {
            break
          }
          continue
        }
        foundCandidate = true
        bestEndRow = Math.max(bestEndRow, candidateEndRow)
      }
      return bestEndRow
    }

    const leftEndRow = evaluateDirection(baseRange.startColumn - 1, -1)
    if (leftEndRow > baseRange.endRow) {
      return leftEndRow
    }

    return evaluateDirection(baseRange.endColumn + 1, 1)
  }

  const startFillHandleDoubleClick = (event: MouseEvent): void => {
    if (options.mode.value !== "base" || !isFillHandleEnabled.value) {
      return
    }
    const baseRange = options.resolveSelectionRange()
    if (!baseRange) {
      return
    }
    const anchorRow = getBodyRowAtIndex(baseRange.endRow)
    const anchorColumnKey = options.visibleColumns.value[baseRange.endColumn]?.key
    if (!anchorRow || !anchorColumnKey) {
      return
    }
    if (!options.isCellEditable(anchorRow, baseRange.endRow, anchorColumnKey, baseRange.endColumn)) {
      return
    }
    const targetEndRow = resolveBestNeighborFillEndRow(baseRange)
    const previewRange = targetEndRow > baseRange.endRow
      ? options.normalizeClipboardRange({
        startRow: baseRange.startRow,
        endRow: targetEndRow,
        startColumn: baseRange.startColumn,
        endColumn: baseRange.endColumn,
      })
      : null
    if (!previewRange || options.rangesEqual(baseRange, previewRange)) {
      return
    }
    const sourceMatrix = options.buildFillMatrixFromRange(baseRange)
    const behavior = activeFillBehavior.value ?? resolveDataGridDefaultFillBehavior({
      baseRange,
      previewRange,
      sourceMatrix,
    })
    const preferredFocusCoord = resolveFillOriginFocusCoord()
    event.preventDefault()
    event.stopPropagation()
    if (applyCommittedFillRange(baseRange, previewRange, behavior)) {
      activeFillBehavior.value = behavior
      const restoredCoord = preferredFocusCoord
        ? restoreSelectionActiveCellToCoord(preferredFocusCoord)
        : null
      restoreActiveCellFocus(restoredCoord ?? preferredFocusCoord)
    }
  }

  const applyLastFillBehavior = (behavior: DataGridFillBehavior): boolean => {
    if (!isFillHandleEnabled.value) {
      return false
    }
    const session = lastAppliedFill.value
    if (!session) {
      return false
    }
    const preferredFocusCoord = resolveFillOriginFocusCoord()
    const applied = applyCommittedFillRange(session.baseRange, session.previewRange, behavior)
    if (applied) {
      activeFillBehavior.value = behavior
      const restoredCoord = preferredFocusCoord
        ? restoreSelectionActiveCellToCoord(preferredFocusCoord)
        : null
      restoreActiveCellFocus(restoredCoord ?? preferredFocusCoord)
    }
    return applied
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
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    const rowIndex = options.viewportRowStart.value + rowOffset
    const coord = options.normalizeCellCoord({
      rowIndex,
      columnIndex,
      rowId: row.rowId ?? null,
    })
    const currentRange = options.resolveSelectionRange()

    if (
      options.mode.value === "base"
      && isRangeMoveEnabled.value
      && event.button === 0
      && !event.shiftKey
      && coord
      && currentRange
      && isCoordInsideRange(coord, currentRange)
    ) {
      if (!options.isCellEditable(row, rowIndex, columnKey, columnIndex)) {
        return
      }
      event.preventDefault()
      focusViewport()
      pendingRangeMove.value = true
      pendingRangeMoveCoord.value = coord
      pendingRangeMovePointerStart.value = { clientX: event.clientX, clientY: event.clientY }
      target?.focus({ preventScroll: true })
      return
    }

    if (supportsCellSelectionMode()) {
      const handled = cellPointerDownRouter.dispatchCellPointerDown(row, columnKey, event)
      if (handled) {
        dragSelectionOriginPin.value = resolveColumnPin(columnIndex)
        target?.focus({ preventScroll: true })
        return
      }
    }

    if (event.button !== 0) {
      return
    }
    options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
    if (!supportsCellSelectionMode()) {
      return
    }
    pendingDragSelection.value = true
    pendingDragPointerStart.value = { clientX: event.clientX, clientY: event.clientY }
    dragSelectionOriginPin.value = resolveColumnPin(columnIndex)
    target?.focus({ preventScroll: true })
    pendingDragCoord.value = resolveCellCoordFromElement(target)
  }

  const handleCellKeydown = (
    event: KeyboardEvent,
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
  ): void => {
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (isFillDragging.value && event.key === "Escape") {
      event.preventDefault()
      stopFillSelection(false)
      return
    }
    if (!supportsCellSelectionMode()) {
      return
    }
    if (!isRangeMoving.value && event.key === "Escape") {
      const clearedCellClipboard = options.clearPendingClipboardOperation(true, true)
      const clearedExternalClipboard = options.clearExternalPendingClipboardOperation?.() === true
      if (clearedCellClipboard || clearedExternalClipboard) {
        event.preventDefault()
        return
      }
    }
    if (!options.selectionSnapshot.value?.activeCell) {
      options.setCellSelection(row, rowOffset, columnIndex, false)
    }
    if (keyboardCommandRouter.dispatchKeyboardCommands(event)) {
      return
    }
    if (
      row.kind === "group"
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && !event.shiftKey
    ) {
      const groupKey = row.groupMeta?.groupKey
      if (groupKey && (event.key === " " || event.key === "Spacebar") && row.state.expanded !== true) {
        event.preventDefault()
        event.stopPropagation()
        options.runtime.api.rows.expandGroup(groupKey)
        return
      }
      if (groupKey && (event.key === " " || event.key === "Spacebar") && row.state.expanded === true) {
        event.preventDefault()
        event.stopPropagation()
        options.runtime.api.rows.collapseGroup(groupKey)
        return
      }
    }
    const columnSnapshot = options.visibleColumns.value[columnIndex]
    const columnKey = columnSnapshot?.key
    const editable = Boolean(columnKey) && options.isCellEditable(row, rowIndex, columnKey as string, columnIndex)
    const printable = isPrintableEditingKey(event)
    const keyboardAction = columnSnapshot && columnKey
      ? resolveDataGridCellKeyboardAction({
        column: columnSnapshot.column,
        row: row.kind !== "group" ? row.data : undefined,
        editable,
        key: event.key,
        printable,
      })
      : "none"

    if (keyboardAction === "toggle" && columnSnapshot && columnKey) {
      event.preventDefault()
      options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
      if (options.handleToggleCellAction?.(row, rowIndex, columnIndex, columnSnapshot)) {
        return
      }
      applyDirectCellEdit(
        row,
        rowIndex,
        columnIndex,
        columnKey,
        toggleDataGridCellValue({
          column: columnSnapshot.column,
          row: row.kind !== "group" ? row.data : undefined,
        }),
        `Toggle ${columnKey}`,
      )
      return
    }
    if ((keyboardAction === "startEdit" || keyboardAction === "openSelect") && columnKey) {
      event.preventDefault()
      if (editable) {
        options.startInlineEdit(
          row,
          columnKey,
          printable || keyboardAction === "openSelect"
            ? {
              draftValue: printable ? event.key : undefined,
              openOnMount: true,
            }
            : undefined,
        )
      }
      return
    }
    keyboardNavigationExtendsSelection.value = event.shiftKey
    const navigationHandled = cellNavigation.dispatchNavigation(event)
    keyboardNavigationExtendsSelection.value = false
    if (navigationHandled) {
      return
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault()
      options.setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
    }
  }

  const handleRowIndexKeydown = (
    event: KeyboardEvent,
    row: DataGridRowNode<TRow>,
    rowOffset: number,
  ): void => {
    void rowOffset
    if (row.rowId == null || !options.runRowIndexKeyboardAction) {
      return
    }

    const isPrimaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey
    const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const opensContextMenu = event.key === "ContextMenu"
      || (event.key === "F10" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey)

    if (opensContextMenu) {
      event.preventDefault()
      event.stopPropagation()
      void options.runRowIndexKeyboardAction("open-row-menu", row.rowId)
      return
    }

    if (row.kind === "group") {
      return
    }

    let action: DataGridRowIndexKeyboardAction | null = null

    if (isPrimaryModifier && !event.shiftKey && normalizedKey === "c") {
      action = "copy-row"
    } else if (isPrimaryModifier && !event.shiftKey && normalizedKey === "x") {
      action = "cut-row"
    } else if (isPrimaryModifier && !event.shiftKey && normalizedKey === "v") {
      action = "paste-row"
    } else if (isPrimaryModifier && !event.shiftKey && normalizedKey === "i") {
      action = "insert-row-above"
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && (event.key === "Delete" || event.key === "Backspace")) {
      action = "delete-selected-rows"
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === "Insert") {
      action = "insert-row-above"
    }

    if (!action) {
      return
    }

    const fallbackTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    event.preventDefault()
    event.stopPropagation()
    void Promise.resolve(options.runRowIndexKeyboardAction(action, row.rowId)).then(handled => {
      if (handled) {
        restoreRowIndexFocus(row.rowId as string | number, fallbackTarget)
      }
    })
  }

  const handleWindowMouseMove = (event: MouseEvent): void => {
    const pointer = { clientX: event.clientX, clientY: event.clientY }
    if (pendingRangeMove.value && !isRangeMoving.value) {
      if (!isRangeMoveEnabled.value) {
        clearPendingRangeMove()
        return
      }
      if (!shouldActivateRangeMove(pointer)) {
        return
      }
      if (activatePendingRangeMove(pointer)) {
        rangeMovePointer.value = pointer
        pointerPreviewRouter.applyRangeMovePreviewFromPointer()
        return
      }
    }
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
    if (pendingDragSelection.value && !isPointerSelectingCells.value) {
      if (!shouldActivateDragSelection(pointer)) {
        return
      }
      activatePendingDragSelection(pointer)
    }
    if (!isPointerSelectingCells.value) {
      return
    }
    dragPointer.value = pointer
    pointerAutoScroll.startInteractionAutoScroll()
    dragPointerSelection.applyDragSelectionFromPointer()
  }

  const handleWindowMouseUp = (): void => {
    if (pendingRangeMove.value && !isRangeMoving.value) {
      const coord = pendingRangeMoveCoord.value
      clearPendingRangeMove()
      if (coord) {
        options.applyCellSelectionByCoord(coord, false)
      }
    }
    if (isRangeMoving.value) {
      rangeMoveLifecycle.stopRangeMove(true)
    }
    if (isFillDragging.value) {
      stopFillSelection(true)
    }
    if (isPointerSelectingCells.value) {
      const anchorCoord = restoreSelectionActiveCellToAnchor()
      restoreActiveCellFocus(anchorCoord)
    }
    stopPointerSelection()
    pointerAutoScroll.stopAutoScrollFrameIfIdle()
  }

  return {
    isPointerSelectingCells,
    isFillDragging,
    fillPreviewRange,
    lastAppliedFill,
    isRangeMoving,
    selectionRange,
    rangeMovePreviewRange,
    stopPointerSelection: () => {
      stopPointerSelection()
      pointerAutoScroll.stopAutoScrollFrameIfIdle()
    },
    stopFillSelection,
    startFillHandleDrag,
    startFillHandleDoubleClick,
    applyLastFillBehavior,
    handleCellMouseDown,
    handleCellKeydown,
    handleRowIndexKeydown,
    handleWindowMouseMove,
    handleWindowMouseUp,
    isCellInFillPreview,
    isFillHandleCell: (rowOffset: number, columnIndex: number) => {
      if (!isFillHandleEnabled.value) {
        return false
      }
      return isFillHandleCell(rowOffset, columnIndex)
    },
    clearSelectedCells,
    dispose: () => {
      pointerAutoScroll.dispose()
    },
  }
}
