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
import { isTouchGeneratedMouseEvent } from "./dataGridMouseEventGuards"

export interface UseDataGridStageRowIndexOptions {
  rows: Readonly<Ref<DataGridTableStageRowsSection<Record<string, unknown>>>>
  layout: Readonly<Ref<DataGridTableStageLayoutSection>>
  viewportRowStart: Readonly<Ref<number>>
  selectionRange: Readonly<Ref<DataGridOverlayRange | null>>
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
  handleRowIndexKeydownSafe: (event: KeyboardEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragStart: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDragOver: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  handleRowIndexDrop: (event: DragEvent, row: DataGridTableStageBodyRow, rowOffset: number) => void
  clearRowIndexDragState: () => void
}

const DEFAULT_INDEX_COLUMN_WIDTH = 72

function resolveInlineRowStateFill(
  isHoveredRow: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean,
  isStripedRow: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean,
  row: DataGridTableStageBodyRow,
  rowOffset: number,
  options: { fullBleed?: boolean } = {},
): CSSProperties | null {
  let overlayColor: string | null = null
  if (isHoveredRow(row, rowOffset)) {
    overlayColor = "var(--datagrid-row-band-hover-bg)"
  } else if (isStripedRow(row, rowOffset)) {
    overlayColor = "var(--datagrid-row-band-striped-bg)"
  }
  if (!overlayColor) {
    return null
  }
  if (options.fullBleed === true) {
    return {
      backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor})`,
      backgroundSize: "100% calc(100% - var(--datagrid-row-divider-size))",
      backgroundPosition: "top left",
      backgroundRepeat: "no-repeat",
    }
  }
  return {
    backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor})`,
    backgroundSize: "calc(100% - var(--datagrid-column-divider-size)) calc(100% - var(--datagrid-row-divider-size))",
    backgroundPosition: "top left",
    backgroundRepeat: "no-repeat",
  }
}

function parsePixelValue(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : fallback
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
    const width = parsePixelValue(
      options.layout.value.indexColumnStyle.width ?? options.layout.value.indexColumnStyle.minWidth,
      DEFAULT_INDEX_COLUMN_WIDTH,
    )
    return width > 0 ? width : DEFAULT_INDEX_COLUMN_WIDTH
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
    if (options.rows.value.consumeRecentRowResizeInteraction?.() === true) {
      return
    }
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    target?.focus({ preventScroll: true })
    options.rows.value.handleRowIndexClick?.(row, rowOffset, event.shiftKey)
  }

  function handleRowIndexKeydownSafe(event: KeyboardEvent, row: DataGridTableStageBodyRow, rowOffset: number): void {
    options.rows.value.handleRowIndexKeydown?.(event, row, rowOffset)
  }

  function rowIndexTabIndex(row: DataGridTableStageBodyRow): number {
    return typeof options.rows.value.isRowFocused === "function" && options.rows.value.isRowFocused(row) ? 0 : -1
  }

  function isFullRowSelectionIndex(rowIndex: number): boolean {
    const range = options.selectionRange.value
    const lastColumnIndex = options.visibleColumns.value.length - 1
    if (!range || lastColumnIndex < 0) {
      return false
    }
    return rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && range.startColumn === 0
      && range.endColumn >= lastColumnIndex
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
    if (!isRowIndexDraggable(row) || isTouchGeneratedMouseEvent(event)) {
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
    const rowStateFill = resolveInlineRowStateFill(
      options.isHoveredRow,
      options.isStripedRow,
      row,
      rowOffset,
      { fullBleed: true },
    )
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
    handleRowIndexKeydownSafe,
    handleRowIndexDragStart,
    handleRowIndexDragOver,
    handleRowIndexDrop,
    clearRowIndexDragState,
  }
}
