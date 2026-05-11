import { computed, ref, watch, type CSSProperties, type Ref } from "vue"
import type { DataGridOverlayRange } from "@affino/datagrid-vue"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageBodyRow,
} from "./dataGridTableStageBody.types"

export interface UseDataGridStageFillActionOptions {
  selection: Readonly<Ref<{
    fillActionAnchorCell?: { rowIndex: number; columnIndex: number } | null
    fillPreviewRange: DataGridOverlayRange | null
    isFillDragging: boolean
  } | null>>
  selectionRange: Readonly<Ref<DataGridOverlayRange | null>>
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  renderedColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  bodyViewportEl: Readonly<Ref<HTMLElement | null>>
  bodyShellRef: Readonly<Ref<HTMLElement | null>>
  bodyViewportClientHeight: Readonly<Ref<number>>
  bodyViewportTopOffset: Readonly<Ref<number>>
  bodyViewportScrollLeft: Readonly<Ref<number>>
  leftPaneWidth: Readonly<Ref<number>>
  rightPaneWidth: Readonly<Ref<number>>
  effectiveBodyViewportWidth: Readonly<Ref<number>>
  indexColumnWidthPx: Readonly<Ref<number>>
  pinnedLeftColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  pinnedRightColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  resolveColumnWidth: (column: DataGridTableStageBodyColumn) => number
  resolveViewportRowStart: () => number
  resolveVisibleCellElement: (rowIndex: number, columnIndex: number) => HTMLElement | null
  resolveVisibleRowElement: (rowIndex: number) => HTMLElement | null
  resolveRelativeCellRect: (anchorCell: { rowIndex: number; columnIndex: number }) => {
    left: number
    right: number
    top: number
    bottom: number
  } | null
  isVisibleCellEditableByAbsoluteCoord: (rowIndex: number, columnIndex: number) => boolean
  restoreAnchorCellFocus: () => void
}

export interface UseDataGridStageFillActionResult {
  fillActionMenuOpen: Ref<boolean>
  floatingFillActionStyle: Readonly<Ref<CSSProperties | null>>
  focusFillActionAnchorCell: () => void
  toggleFloatingFillActionMenu: (event: MouseEvent) => void
  handleFillActionSelection: () => void
}

const FILL_ACTION_ROOT_SELECTOR = ".grid-fill-action"
const FILL_ACTION_TRIGGER_SIZE_PX = 14
const FILL_ACTION_VIEWPORT_MARGIN_PX = 8
const FILL_ACTION_HANDLE_CLEARANCE_PX = 10

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

export function useDataGridStageFillAction(
  options: UseDataGridStageFillActionOptions,
): UseDataGridStageFillActionResult {
  const fillActionMenuOpen = ref(false)

  function resolveVisibleFillActionAnchorCell(): { rowIndex: number; columnIndex: number } | null {
    const anchorCell = options.selection.value?.fillActionAnchorCell
    if (!anchorCell) {
      return null
    }

    const visibleRowStart = options.resolveViewportRowStart()
    const visibleRowEnd = options.resolveViewportRowStart() + Math.max(0, options.displayRows.value.length - 1)
    const range = options.selectionRange.value
    const selectionRowStart = range ? Math.min(range.startRow, range.endRow) : anchorCell.rowIndex
    const selectionRowEnd = range ? Math.max(range.startRow, range.endRow) : anchorCell.rowIndex
    const selectionColumnStart = range ? Math.min(range.startColumn, range.endColumn) : anchorCell.columnIndex
    const selectionColumnEnd = range ? Math.max(range.startColumn, range.endColumn) : anchorCell.columnIndex
    const clampedRowStart = Math.max(selectionRowStart, visibleRowStart)
    const clampedRowEnd = Math.min(selectionRowEnd, visibleRowEnd)
    const rowIndex = clampedRowStart <= clampedRowEnd
      ? clamp(anchorCell.rowIndex, clampedRowStart, clampedRowEnd)
      : anchorCell.rowIndex

    const visibleCenterColumnKeys = new Set((options.renderedColumns.value ?? []).map(column => column.key))
    const visibleColumnIndexes = options.visibleColumns.value
      .map((column, columnIndex) => ({ column, columnIndex }))
      .filter(({ column, columnIndex }) => {
        if (columnIndex < selectionColumnStart || columnIndex > selectionColumnEnd) {
          return false
        }
        return column.pin === "left"
          || column.pin === "right"
          || visibleCenterColumnKeys.has(column.key)
      })
      .map(({ columnIndex }) => columnIndex)

    const columnIndex = visibleColumnIndexes.length > 0
      ? clamp(
          anchorCell.columnIndex,
          visibleColumnIndexes[0] ?? anchorCell.columnIndex,
          visibleColumnIndexes[visibleColumnIndexes.length - 1] ?? anchorCell.columnIndex,
        )
      : anchorCell.columnIndex

    if (!options.isVisibleCellEditableByAbsoluteCoord(rowIndex, columnIndex)) {
      return null
    }

    return {
      rowIndex,
      columnIndex,
    }
  }

  function resolveFloatingFillActionLeft(): number | null {
    const anchorCell = resolveVisibleFillActionAnchorCell()
    if (!anchorCell) {
      return null
    }
    const relativeCellRect = options.resolveRelativeCellRect(anchorCell)
    if (relativeCellRect) {
      return clamp(
        relativeCellRect.right - FILL_ACTION_TRIGGER_SIZE_PX,
        FILL_ACTION_VIEWPORT_MARGIN_PX,
        options.leftPaneWidth.value + options.effectiveBodyViewportWidth.value + options.rightPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX,
      )
    }
    const column = options.visibleColumns.value[anchorCell.columnIndex]
    if (!column) {
      return null
    }

    if (column.pin === "left") {
      let cellRight = options.indexColumnWidthPx.value
      for (const pinnedColumn of options.pinnedLeftColumns.value) {
        cellRight += options.resolveColumnWidth(pinnedColumn)
        if (pinnedColumn.key === column.key) {
          break
        }
      }
      return clamp(
        cellRight - FILL_ACTION_TRIGGER_SIZE_PX,
        FILL_ACTION_VIEWPORT_MARGIN_PX,
        Math.max(FILL_ACTION_VIEWPORT_MARGIN_PX, options.leftPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX),
      )
    }

    if (column.pin === "right") {
      let cellRight = options.leftPaneWidth.value + options.effectiveBodyViewportWidth.value
      for (const pinnedColumn of options.pinnedRightColumns.value) {
        cellRight += options.resolveColumnWidth(pinnedColumn)
        if (pinnedColumn.key === column.key) {
          break
        }
      }
      const rightPaneStart = options.leftPaneWidth.value + options.effectiveBodyViewportWidth.value
      return clamp(
        cellRight - FILL_ACTION_TRIGGER_SIZE_PX,
        rightPaneStart + FILL_ACTION_VIEWPORT_MARGIN_PX,
        Math.max(
          rightPaneStart + FILL_ACTION_VIEWPORT_MARGIN_PX,
          rightPaneStart + options.rightPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX,
        ),
      )
    }

    let cellRight = options.leftPaneWidth.value - options.bodyViewportScrollLeft.value
    for (const centerColumn of options.visibleColumns.value.filter(column => column.pin !== "left" && column.pin !== "right")) {
      cellRight += options.resolveColumnWidth(centerColumn)
      if (centerColumn.key === column.key) {
        break
      }
    }
    const viewportLeft = options.leftPaneWidth.value + FILL_ACTION_VIEWPORT_MARGIN_PX
    const viewportRight = options.leftPaneWidth.value + options.effectiveBodyViewportWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX
    return clamp(cellRight - FILL_ACTION_TRIGGER_SIZE_PX, viewportLeft, viewportRight)
  }

  function resolveFloatingFillActionTop(): number | null {
    const viewportTop = options.bodyViewportTopOffset.value + FILL_ACTION_VIEWPORT_MARGIN_PX
    const viewportBottom = options.bodyViewportTopOffset.value + Math.max(
      0,
      options.bodyViewportClientHeight.value
        - FILL_ACTION_TRIGGER_SIZE_PX
        - FILL_ACTION_VIEWPORT_MARGIN_PX
        - FILL_ACTION_HANDLE_CLEARANCE_PX,
    )
    const anchorCell = options.selection.value?.fillActionAnchorCell
    const targetCell = resolveVisibleFillActionAnchorCell()
    if (!targetCell) {
      return null
    }
    if (anchorCell && anchorCell.rowIndex !== targetCell.rowIndex) {
      return viewportBottom
    }
    const relativeCellRect = options.resolveRelativeCellRect(targetCell)
    if (relativeCellRect) {
      return clamp(
        relativeCellRect.bottom - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_HANDLE_CLEARANCE_PX,
        viewportTop,
        viewportBottom,
      )
    }
    const shellRect = options.bodyShellRef.value?.getBoundingClientRect()
    const rowElement = options.resolveVisibleRowElement(targetCell.rowIndex)
    if (!shellRect || !rowElement) {
      return viewportBottom
    }
    const rowRect = rowElement.getBoundingClientRect()
    const rowBottom = rowRect.bottom - shellRect.top - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_HANDLE_CLEARANCE_PX
    return clamp(rowBottom, viewportTop, viewportBottom)
  }

  const floatingFillActionStyle = computed<CSSProperties | null>(() => {
    if (!options.selection.value?.fillActionAnchorCell) {
      return null
    }
    const left = resolveFloatingFillActionLeft()
    const top = resolveFloatingFillActionTop()
    if (left == null || top == null) {
      return null
    }
    return {
      left: `${left}px`,
      top: `${top}px`,
    }
  })

  function focusFillActionAnchorCell(): void {
    const anchorCell = options.selection.value?.fillActionAnchorCell
    if (!anchorCell) {
      options.bodyViewportEl.value?.focus({ preventScroll: true })
      return
    }
    const cellElement = options.resolveVisibleCellElement(anchorCell.rowIndex, anchorCell.columnIndex)
    if (cellElement) {
      cellElement.focus({ preventScroll: true })
      return
    }
    options.bodyViewportEl.value?.focus({ preventScroll: true })
  }

  function toggleFloatingFillActionMenu(event: MouseEvent): void {
    if (!floatingFillActionStyle.value) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    focusFillActionAnchorCell()
    fillActionMenuOpen.value = !fillActionMenuOpen.value
  }

  function handleFillActionSelection(): void {
    fillActionMenuOpen.value = false
    focusFillActionAnchorCell()
  }

  watch(
    () => options.selection.value?.fillPreviewRange,
    (nextRange, previousRange) => {
      if (previousRange && !nextRange) {
        options.restoreAnchorCellFocus()
      }
    },
  )

  watch(
    () => options.selection.value?.fillActionAnchorCell
      ? `${options.selection.value.fillActionAnchorCell.rowIndex}:${options.selection.value.fillActionAnchorCell.columnIndex}`
      : "",
    () => {
      fillActionMenuOpen.value = false
    },
  )

  watch(fillActionMenuOpen, (open, _previous, onCleanup) => {
    if (!open || typeof window === "undefined") {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest(FILL_ACTION_ROOT_SELECTOR)) {
        return
      }
      fillActionMenuOpen.value = false
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        fillActionMenuOpen.value = false
        focusFillActionAnchorCell()
      }
    }

    window.addEventListener("mousedown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeydown)
    onCleanup(() => {
      window.removeEventListener("mousedown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeydown)
    })
  })

  return {
    fillActionMenuOpen,
    floatingFillActionStyle,
    focusFillActionAnchorCell,
    toggleFloatingFillActionMenu,
    handleFillActionSelection,
  }
}
