import { computed, type CSSProperties, type Ref, ref } from "vue"
import type { DataGridOverlayRange } from "@affino/datagrid-vue"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageBodyRow,
} from "./dataGridTableStageBody.types"
import type {
  DataGridTableStageLayoutSection,
  DataGridTableStageRowsSection,
} from "./dataGridTableStage.types"
import { shouldPrioritizeNativeScrollForMouseDown } from "./dataGridMouseEventGuards"
import { DATA_GRID_STAGE_ROW_INDEX_HEADER_ID } from "./dataGridTableStageA11y"
import { resolveDataGridIndexColumnWidth } from "../config/dataGridIndexColumn"

export interface UseDataGridStageRowIndexOptions {
  rows: Readonly<Ref<DataGridTableStageRowsSection<Record<string, unknown>>>>
  layout: Readonly<Ref<DataGridTableStageLayoutSection>>
  totalRowCount?: Readonly<Ref<number>>
  viewportRowStart: Readonly<Ref<number>>
  selectionRange: Readonly<Ref<DataGridOverlayRange | null>>
  selectionRanges?: Readonly<Ref<readonly DataGridOverlayRange[]>>
  focusedBodyRowIndex?: Readonly<Ref<number | null>>
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  isHoveredRow: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean
  isStripedRow: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean
  resolveAbsoluteRowIndex: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  resolveInlineRowStateFill: (
    row: DataGridTableStageBodyRow,
    rowOffset: number,
    options?: { fullBleed?: boolean },
  ) => CSSProperties | null
  isDataGridPlaceholderSurfaceRow: (row: DataGridTableStageBodyRow) => boolean
  navigateFromRowIndex?: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean
  navigateRowIndex?: (row: DataGridTableStageBodyRow, rowOffset: number, direction: -1 | 1, extend: boolean, additive: boolean) => boolean
}

export interface UseDataGridStageRowIndexResult {
  showRowIndex: Readonly<Ref<boolean>>
  indexColumnWidthPx: Readonly<Ref<number>>
  resolvedRowIndexColumnStyle: Readonly<Ref<CSSProperties>>
  rowIndexCellClasses: (row: DataGridTableStageBodyRow, rowOffset: number) => Record<string, boolean>
  rowIndexCellStyle: (row: DataGridTableStageBodyRow, rowOffset: number) => CSSProperties
  rowIndexTabIndex: (row: DataGridTableStageBodyRow) => number
  isFullRowSelectionSafe: (rowOffset: number, row?: DataGridTableStageBodyRow) => boolean
  isRowIndexDraggable: (row: DataGridTableStageBodyRow) => boolean
  handleRowClickSafe: (row: DataGridTableStageBodyRow) => void
  handleRowIndexClickSafe: (row: DataGridTableStageBodyRow, rowOffset: number, event: MouseEvent) => void
  handleRowIndexPointerDownSafe: (event: PointerEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexKeydownSafe: (event: KeyboardEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragStart: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragOver: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDrop: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  clearRowIndexDragState: () => void
}

export function useDataGridStageRowIndex(
  options: UseDataGridStageRowIndexOptions,
): UseDataGridStageRowIndexResult {
  const draggedRowIndexRowId = ref<string | null>(null)
  const dragOverRowIndexRowId = ref<string | null>(null)
  const dragOverRowIndexPlacement = ref<"before" | "after" | null>(null)

  const showRowIndex = computed(() => options.rows.value.showRowIndex !== false)
  const indexColumnWidthPx = computed(() => {
    if (!showRowIndex.value) {
      return 0
    }
    return resolveDataGridIndexColumnWidth(
      options.layout.value.indexColumnStyle,
      options.totalRowCount?.value ?? options.rows.value.displayRows?.length ?? 0,
    )
  })

  const resolvedRowIndexColumnStyle = computed<CSSProperties>(() => {
    const width = `${indexColumnWidthPx.value}px`
    return {
      ...options.layout.value.indexColumnStyle,
      width,
      minWidth: width,
      maxWidth: width,
    }
  })

  function handleRowClickSafe(row: DataGridTableStageBodyRow): void {
    options.rows.value.handleRowClick?.(row)
  }

  function handleRowIndexClickSafe(row: DataGridTableStageBodyRow, rowOffset: number, event: MouseEvent): void {
    if (options.rows.value.consumeRowSelectionClick?.() === true) {
      event.preventDefault()
      return
    }
    if (options.rows.value.consumeRecentRowResizeInteraction?.() === true) {
      return
    }
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    target?.focus({ preventScroll: true })
    if (event.ctrlKey || event.metaKey) {
      options.rows.value.handleRowIndexClick?.(row, rowOffset, event.shiftKey, true)
    } else {
      options.rows.value.handleRowIndexClick?.(row, rowOffset, event.shiftKey)
    }
  }

  function handleRowIndexPointerDownSafe(
    event: PointerEvent,
    row: DataGridTableStageBodyRow,
    rowOffset: number,
  ): void {
    if (
      options.rows.value.rowHeaderAction === "none"
      || event.pointerType === "touch"
      || event.button !== 0
      || row.kind === "group"
      || options.isDataGridPlaceholderSurfaceRow(row)
      || isRowIndexDraggable(row)
      || (event.target instanceof HTMLElement && event.target.closest(".row-resize-handle"))
    ) {
      return
    }
    options.rows.value.handleRowIndexPointerDown?.(row, rowOffset, event)
  }

  function handleRowIndexKeydownSafe(event: KeyboardEvent, row: DataGridTableStageBodyRow, rowOffset: number): void {
    if (
      (event.key === " " || event.key === "Spacebar")
      && event.target === event.currentTarget
      && options.rows.value.rowHeaderAction === "select-records"
    ) {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        options.rows.value.handleRowIndexClick?.(row, rowOffset, event.shiftKey, true)
      } else {
        options.rows.value.handleRowIndexClick?.(row, rowOffset, event.shiftKey)
      }
      return
    }
    if (
      (event.key === "ArrowUp" || event.key === "ArrowDown")
      && !event.altKey
      && (!event.ctrlKey && !event.metaKey
        || (event.shiftKey && options.rows.value.rowHeaderAction === "select-records"))
      && event.target === event.currentTarget
    ) {
      if (options.navigateRowIndex?.(row, rowOffset, event.key === "ArrowUp" ? -1 : 1, event.shiftKey, event.ctrlKey || event.metaKey) === true) {
        event.preventDefault()
        return
      }
      if (event.shiftKey || event.key === "ArrowDown") {
        event.preventDefault()
        return
      }
    }
    if (
      event.key === "ArrowRight"
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && !event.shiftKey
      && event.target === event.currentTarget
      && options.navigateFromRowIndex?.(row, rowOffset) === true
    ) {
      event.preventDefault()
      return
    }
    if (
      event.key === "ArrowUp"
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && !event.shiftKey
      && event.target === event.currentTarget
      && options.resolveAbsoluteRowIndex(row, rowOffset) === 0
    ) {
      const stageRoot = (event.currentTarget as HTMLElement).closest(".grid-stage")
      const header = stageRoot?.querySelector<HTMLElement>(`#${DATA_GRID_STAGE_ROW_INDEX_HEADER_ID}`)
      if (header) {
        event.preventDefault()
        header.focus({ preventScroll: true })
        return
      }
    }
    options.rows.value.handleRowIndexKeydown?.(event, row, rowOffset)
  }

  function rowIndexTabIndex(row: DataGridTableStageBodyRow): number {
    return typeof options.rows.value.isRowFocused === "function" && options.rows.value.isRowFocused(row) ? 0 : -1
  }

  function isFullRowSelectionIndex(rowIndex: number): boolean {
    const dataColumnIndexes = options.visibleColumns.value
      .map((column, index) => column.column.meta?.rowSelection === true ? -1 : index)
      .filter(index => index >= 0)
    if (dataColumnIndexes.length === 0) {
      return false
    }
    const firstColumnIndex = dataColumnIndexes[0]!
    const lastColumnIndex = dataColumnIndexes[dataColumnIndexes.length - 1]!
    const ranges = options.selectionRanges?.value
      ?? (options.selectionRange.value ? [options.selectionRange.value] : [])
    return ranges.some(range => (
      rowIndex >= Math.min(range.startRow, range.endRow)
      && rowIndex <= Math.max(range.startRow, range.endRow)
      && Math.min(range.startColumn, range.endColumn) <= firstColumnIndex
      && Math.max(range.startColumn, range.endColumn) >= lastColumnIndex
    ))
  }

  function isFullRowSelectionSafe(rowOffset: number, row?: DataGridTableStageBodyRow): boolean {
    const rowIndex = row ? options.resolveAbsoluteRowIndex(row, rowOffset) : options.viewportRowStart.value + rowOffset
    return isFullRowSelectionIndex(rowIndex)
  }

  function isRowIndexDraggable(row: DataGridTableStageBodyRow): boolean {
    return typeof options.rows.value.reorderRowsByIndex === "function"
      && row.kind !== "group"
      && row.rowId != null
      && row.state.pinned === "none"
      && !options.isDataGridPlaceholderSurfaceRow(row)
  }

  function resolveRowIndexDropPlacement(event: DragEvent): "before" | "after" {
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    const rect = target?.getBoundingClientRect()
    if (!rect || rect.height <= 0) {
      return "after"
    }
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after"
  }

  function clearRowIndexDragState(): void {
    draggedRowIndexRowId.value = null
    dragOverRowIndexRowId.value = null
    dragOverRowIndexPlacement.value = null
  }

  function handleRowIndexDragStart(event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number): void {
    if (!isRowIndexDraggable(row) || shouldPrioritizeNativeScrollForMouseDown(event)) {
      clearRowIndexDragState()
      return
    }
    draggedRowIndexRowId.value = String(row.rowId)
    dragOverRowIndexRowId.value = null
    dragOverRowIndexPlacement.value = null
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.dropEffect = "move"
      event.dataTransfer.setData("text/plain", `${String(row.rowId)}:${options.resolveAbsoluteRowIndex(row, rowOffset)}`)
    }
  }

  function handleRowIndexDragOver(event: DragEvent, row: DataGridTableStageBodyRow, _rowOffset: number): void {
    if (!draggedRowIndexRowId.value || !isRowIndexDraggable(row)) {
      dragOverRowIndexRowId.value = null
      dragOverRowIndexPlacement.value = null
      return
    }
    const targetRowId = String(row.rowId)
    if (draggedRowIndexRowId.value === targetRowId) {
      dragOverRowIndexRowId.value = null
      dragOverRowIndexPlacement.value = null
      return
    }
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move"
    }
    dragOverRowIndexRowId.value = targetRowId
    dragOverRowIndexPlacement.value = resolveRowIndexDropPlacement(event)
  }

  function handleRowIndexDrop(event: DragEvent, row: DataGridTableStageBodyRow, _rowOffset: number): void {
    if (!draggedRowIndexRowId.value || !isRowIndexDraggable(row)) {
      clearRowIndexDragState()
      return
    }
    const targetRowId = String(row.rowId)
    if (draggedRowIndexRowId.value === targetRowId) {
      clearRowIndexDragState()
      return
    }
    event.preventDefault()
    options.rows.value.reorderRowsByIndex?.({
      sourceRowId: draggedRowIndexRowId.value,
      targetRowId,
      placement: resolveRowIndexDropPlacement(event),
    })
    clearRowIndexDragState()
  }

  function rowIndexCellStyle(row: DataGridTableStageBodyRow, rowOffset: number): CSSProperties {
    const rowStateFill = options.resolveInlineRowStateFill(row, rowOffset, { fullBleed: true })
    if (!rowStateFill) {
      return resolvedRowIndexColumnStyle.value
    }
    return {
      ...resolvedRowIndexColumnStyle.value,
      ...rowStateFill,
    }
  }

  function rowIndexCellClasses(row: DataGridTableStageBodyRow, rowOffset: number): Record<string, boolean> {
    const rowIndex = options.resolveAbsoluteRowIndex(row, rowOffset)
    const rowId = row.rowId == null ? null : String(row.rowId)
    const classes: Record<string, boolean> = {
      "grid-cell--focus-axis": options.focusedBodyRowIndex?.value === rowIndex,
      "grid-cell--index-reorder-source": rowId != null && draggedRowIndexRowId.value === rowId,
      "grid-cell--index-drop-before": rowId != null && dragOverRowIndexRowId.value === rowId && dragOverRowIndexPlacement.value === "before",
      "grid-cell--index-drop-after": rowId != null && dragOverRowIndexRowId.value === rowId && dragOverRowIndexPlacement.value === "after",
    }
    if (!isFullRowSelectionIndex(rowIndex)) {
      return classes
    }
    const previousSelected = isFullRowSelectionIndex(rowIndex - 1)
    const nextSelected = isFullRowSelectionIndex(rowIndex + 1)
    return {
      ...classes,
      "grid-cell--index-selected": true,
      "grid-cell--index-selected-single": !previousSelected && !nextSelected,
      "grid-cell--index-selected-top": !previousSelected && nextSelected,
      "grid-cell--index-selected-middle": previousSelected && nextSelected,
      "grid-cell--index-selected-bottom": previousSelected && !nextSelected,
    }
  }

  return {
    showRowIndex,
    indexColumnWidthPx,
    resolvedRowIndexColumnStyle,
    rowIndexCellClasses,
    rowIndexCellStyle,
    rowIndexTabIndex,
    isFullRowSelectionSafe,
    isRowIndexDraggable,
    handleRowClickSafe,
    handleRowIndexClickSafe,
    handleRowIndexPointerDownSafe,
    handleRowIndexKeydownSafe,
    handleRowIndexDragStart,
    handleRowIndexDragOver,
    handleRowIndexDrop,
    clearRowIndexDragState,
  }
}
