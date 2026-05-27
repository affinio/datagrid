import { onScopeDispose, ref, watch, type Ref } from "vue"
import type {
  DataGridTableMode,
} from "./dataGridTableStage.types"
import type { DataGridOverlayRange } from "@affino/datagrid-vue"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageBodyRow,
} from "./dataGridTableStageBody.types"
import {
  shouldPrioritizeNativeScrollForMouseDown,
  shouldPrioritizeNativeScrollForMouseEvent,
  type DataGridInteractionModeInput,
} from "./dataGridMouseEventGuards"
import { recordDataGridPerfSampleIfEnabled } from "../perf/dataGridPerfTrace"

export interface UseDataGridStagePointerInteractionsOptions {
  mode: Readonly<Ref<DataGridTableMode>>
  selection: Readonly<Ref<{
    isFillDragging: boolean
    rangeMoveEnabled: boolean
    startFillHandleDrag: (event: MouseEvent) => void
    startFillHandleDoubleClick: (event: MouseEvent) => void
  } | null>>
  selectionRange: Readonly<Ref<DataGridOverlayRange | null>>
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  viewportRowStart: Readonly<Ref<number>>
  fillActionMenuOpen: Ref<boolean>
  interactionModeInput?: Readonly<Ref<DataGridInteractionModeInput>>
  suppressHoverInteractions?: Readonly<Ref<boolean>>
  isCellSelectedSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellEditableSafe: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isCellOnSelectionEdgeSafe: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
}

export interface UseDataGridStagePointerInteractionsResult {
  clearRangeMoveHandleHover: () => void
  isRangeMoveHandleHoverCell: (rowOffset: number, columnIndex: number) => boolean
  handleCellMouseMove: (event: MouseEvent, rowOffset: number, columnIndex: number) => void
  handleFillHandleMouseDown: (event: MouseEvent) => void
  handleFillHandleDoubleClick: (event: MouseEvent) => void
  handleFillHandleTouchStart: (event: TouchEvent) => void
  handleFillHandleTouchMove: (event: TouchEvent) => void
  handleFillHandleTouchEnd: (event: TouchEvent) => void
  resetGlobalFillDragCursor: () => void
}

const RANGE_MOVE_HANDLE_HOVER_EDGE_PX = 6
const GLOBAL_FILL_DRAG_CURSOR_CLASS = "datagrid-fill-drag-cursor"

export function useDataGridStagePointerInteractions(
  options: UseDataGridStagePointerInteractionsOptions,
): UseDataGridStagePointerInteractionsResult {
  const hoveredRangeMoveHandleCell = ref<{ rowIndex: number; columnIndex: number } | null>(null)
  const restoreBodyCursor = ref<string | null>(null)
  const restoreDocumentCursor = ref<string | null>(null)
  let activeFillHandleTouchId: number | null = null

  function recordPreventDefault(eventType: string, reason: string): void {
    recordDataGridPerfSampleIfEnabled({
      scope: "interactionPreventDefault",
      totalMs: 0,
      owner: "fill",
      eventType,
      reason,
    })
  }

  function syncGlobalFillDragCursor(active: boolean): void {
    if (typeof document === "undefined") {
      return
    }
    const body = document.body
    const root = document.documentElement
    if (!body || !root) {
      return
    }
    if (active) {
      if (restoreBodyCursor.value == null) {
        restoreBodyCursor.value = body.style.cursor
      }
      if (restoreDocumentCursor.value == null) {
        restoreDocumentCursor.value = root.style.cursor
      }
      root.classList.add(GLOBAL_FILL_DRAG_CURSOR_CLASS)
      body.classList.add(GLOBAL_FILL_DRAG_CURSOR_CLASS)
      root.style.setProperty("cursor", "crosshair", "important")
      body.style.setProperty("cursor", "crosshair", "important")
      return
    }
    root.classList.remove(GLOBAL_FILL_DRAG_CURSOR_CLASS)
    body.classList.remove(GLOBAL_FILL_DRAG_CURSOR_CLASS)
    if (restoreDocumentCursor.value != null) {
      if (restoreDocumentCursor.value) {
        root.style.setProperty("cursor", restoreDocumentCursor.value)
      }
      else {
        root.style.removeProperty("cursor")
      }
      restoreDocumentCursor.value = null
    }
    if (restoreBodyCursor.value != null) {
      if (restoreBodyCursor.value) {
        body.style.setProperty("cursor", restoreBodyCursor.value)
      }
      else {
        body.style.removeProperty("cursor")
      }
      restoreBodyCursor.value = null
    }
  }

  function clearRangeMoveHandleHover(): void {
    if (hoveredRangeMoveHandleCell.value == null) {
      return
    }
    hoveredRangeMoveHandleCell.value = null
  }

  function isNearRangeMoveSelectionEdge(
    event: MouseEvent,
    rowOffset: number,
    columnIndex: number,
  ): boolean {
    if (options.mode.value !== "base" || options.selection.value?.isFillDragging || !options.selectionRange.value) {
      return false
    }
    if (!options.isCellSelectedSafe(rowOffset, columnIndex)) {
      return false
    }
    const row = options.displayRows.value[rowOffset]
    const column = options.visibleColumns.value[columnIndex]
    if (!row || !column || !options.isCellEditableSafe(row, rowOffset, column, columnIndex)) {
      return false
    }
    const cell = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    if (!cell) {
      return false
    }
    const rect = cell.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return false
    }
    const edgeThreshold = Math.max(
      1,
      Math.min(
        RANGE_MOVE_HANDLE_HOVER_EDGE_PX,
        Math.floor(rect.width / 2),
        Math.floor(rect.height / 2),
      ),
    )
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    return (
      (offsetY <= edgeThreshold && options.isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "top"))
      || (rect.height - offsetY <= edgeThreshold && options.isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "bottom"))
      || (offsetX <= edgeThreshold && options.isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "left"))
      || (rect.width - offsetX <= edgeThreshold && options.isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "right"))
    )
  }

  function handleCellMouseMove(event: MouseEvent, rowOffset: number, columnIndex: number): void {
    if (
      options.suppressHoverInteractions?.value === true
      || options.selection.value?.isFillDragging
      || options.selection.value?.rangeMoveEnabled !== true
    ) {
      clearRangeMoveHandleHover()
      return
    }
    if (isNearRangeMoveSelectionEdge(event, rowOffset, columnIndex)) {
      hoveredRangeMoveHandleCell.value = {
        rowIndex: options.viewportRowStart.value + rowOffset,
        columnIndex,
      }
      return
    }
    clearRangeMoveHandleHover()
  }

  function handleFillHandleMouseDown(event: MouseEvent): void {
    if (shouldPrioritizeNativeScrollForMouseDown(event, options.interactionModeInput?.value)) {
      return
    }
    event.preventDefault()
    recordPreventDefault("mousedown", "fill-handle")
    options.fillActionMenuOpen.value = false
    const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    const cell = handle?.closest<HTMLElement>(".grid-cell")
    cell?.focus({ preventScroll: true })
    options.selection.value?.startFillHandleDrag(event)
  }

  function handleFillHandleDoubleClick(event: MouseEvent): void {
    if (shouldPrioritizeNativeScrollForMouseEvent(event, options.interactionModeInput?.value)) {
      return
    }
    event.preventDefault()
    recordPreventDefault("dblclick", "fill-handle")
    options.fillActionMenuOpen.value = false
    const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    const cell = handle?.closest<HTMLElement>(".grid-cell")
    cell?.focus({ preventScroll: true })
    options.selection.value?.startFillHandleDoubleClick(event)
  }

  function readTouch(touches: TouchList, identifier: number): Touch | null {
    const indexedTouches = touches as TouchList & { [index: number]: Touch | undefined }
    for (let index = 0; index < touches.length; index += 1) {
      const touch = typeof touches.item === "function" ? touches.item(index) : indexedTouches[index]
      if (touch?.identifier === identifier) {
        return touch
      }
    }
    return null
  }

  function readFirstTouch(touches: TouchList): Touch | null {
    const indexedTouches = touches as TouchList & { [index: number]: Touch | undefined }
    return (typeof touches.item === "function" ? touches.item(0) : indexedTouches[0]) ?? null
  }

  function createFillHandleMouseEvent(type: "mousedown" | "mousemove" | "mouseup", touch: Touch): MouseEvent {
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: touch.clientX,
      clientY: touch.clientY,
    })
  }

  function handleFillHandleTouchStart(event: TouchEvent): void {
    const touch = event.touches.length === 1 ? readFirstTouch(event.touches) : null
    if (!touch) {
      activeFillHandleTouchId = null
      return
    }
    options.fillActionMenuOpen.value = false
    activeFillHandleTouchId = touch.identifier
    const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    const cell = handle?.closest<HTMLElement>(".grid-cell")
    cell?.focus({ preventScroll: true })
    options.selection.value?.startFillHandleDrag(createFillHandleMouseEvent("mousedown", touch))
  }

  function handleFillHandleTouchMove(event: TouchEvent): void {
    if (activeFillHandleTouchId == null || typeof window === "undefined") {
      return
    }
    const touch = readTouch(event.touches, activeFillHandleTouchId)
    if (!touch) {
      return
    }
    window.dispatchEvent(createFillHandleMouseEvent("mousemove", touch))
  }

  function handleFillHandleTouchEnd(event: TouchEvent): void {
    if (activeFillHandleTouchId == null || typeof window === "undefined") {
      activeFillHandleTouchId = null
      return
    }
    const touch = readTouch(event.changedTouches, activeFillHandleTouchId)
    activeFillHandleTouchId = null
    if (!touch) {
      return
    }
    window.dispatchEvent(createFillHandleMouseEvent("mouseup", touch))
  }

  function isRangeMoveHandleHoverCell(rowOffset: number, columnIndex: number): boolean {
    return (
      hoveredRangeMoveHandleCell.value?.rowIndex === rowOffset + options.viewportRowStart.value
      && hoveredRangeMoveHandleCell.value?.columnIndex === columnIndex
    )
  }

  watch(
    () => options.selection.value?.isFillDragging === true,
    active => {
      syncGlobalFillDragCursor(active)
      if (active) {
        clearRangeMoveHandleHover()
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    syncGlobalFillDragCursor(false)
  })

  function resetGlobalFillDragCursor(): void {
    syncGlobalFillDragCursor(false)
  }

  return {
    clearRangeMoveHandleHover,
    isRangeMoveHandleHoverCell,
    handleCellMouseMove,
    handleFillHandleMouseDown,
    handleFillHandleDoubleClick,
    handleFillHandleTouchStart,
    handleFillHandleTouchMove,
    handleFillHandleTouchEnd,
    resetGlobalFillDragCursor,
  }
}
