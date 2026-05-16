import { onScopeDispose, ref, watch, type Ref } from "vue"
import type {
  DataGridTableMode,
} from "./dataGridTableStage.types"
import type { DataGridOverlayRange } from "@affino/datagrid-vue"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageBodyRow,
} from "./dataGridTableStageBody.types"

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
  isCoarsePointer?: Readonly<Ref<boolean>>
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
      options.isCoarsePointer?.value === true
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
    options.fillActionMenuOpen.value = false
    const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    const cell = handle?.closest<HTMLElement>(".grid-cell")
    cell?.focus({ preventScroll: true })
    options.selection.value?.startFillHandleDrag(event)
  }

  function handleFillHandleDoubleClick(event: MouseEvent): void {
    options.fillActionMenuOpen.value = false
    const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    const cell = handle?.closest<HTMLElement>(".grid-cell")
    cell?.focus({ preventScroll: true })
    options.selection.value?.startFillHandleDoubleClick(event)
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
    resetGlobalFillDragCursor,
  }
}
