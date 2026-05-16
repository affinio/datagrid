import type { Ref } from "vue"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "./dataGridTableStageBody.types"

export interface UseDataGridStageFocusRuntimeOptions {
  bodyShellRef: Readonly<Ref<HTMLElement | null>>
  bodyViewportEl: Readonly<Ref<HTMLElement | null>>
  leftPaneContentRef: Readonly<Ref<HTMLElement | null>>
  rightPaneContentRef: Readonly<Ref<HTMLElement | null>>
  leftBottomPaneContentRef: Readonly<Ref<HTMLElement | null>>
  rightBottomPaneContentRef: Readonly<Ref<HTMLElement | null>>
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  viewportRowStart: Readonly<Ref<number>>
  resolveAbsoluteRowIndex: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  isSelectionAnchorCellSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellEditableSafe: (row: DataGridTableStageBodyRow, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isBodyViewportScrolling?: Readonly<Ref<boolean>>
  runWhenBodyViewportScrollIdle?: (callback: () => void) => void
}

export interface UseDataGridStageFocusRuntimeResult {
  isVisibleCellEditableByAbsoluteCoord: (rowIndex: number, columnIndex: number) => boolean
  resolveVisibleCellElement: (rowIndex: number, columnIndex: number) => HTMLElement | null
  resolveVisibleRowElement: (rowIndex: number) => HTMLElement | null
  resolveRelativeCellRect: (cell: { rowIndex: number; columnIndex: number } | null) => {
    left: number
    right: number
    top: number
    bottom: number
  } | null
  focusVisibleAnchorCell: () => void
  restoreAnchorCellFocus: () => void
}

function resolveVisibleAnchorCellPosition(
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>,
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>,
  resolveAbsoluteRowIndex: (row: DataGridTableStageBodyRow, rowOffset: number) => number,
  isSelectionAnchorCellSafe: (rowOffset: number, columnIndex: number) => boolean,
): { rowIndex: number; columnIndex: number } | null {
  for (let rowOffset = 0; rowOffset < displayRows.value.length; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < visibleColumns.value.length; columnIndex += 1) {
      if (!isSelectionAnchorCellSafe(rowOffset, columnIndex)) {
        continue
      }
      return {
        rowIndex: resolveAbsoluteRowIndex(displayRows.value[rowOffset] as DataGridTableStageBodyRow, rowOffset),
        columnIndex,
      }
    }
  }
  return null
}

export function useDataGridStageFocusRuntime(
  options: UseDataGridStageFocusRuntimeOptions,
): UseDataGridStageFocusRuntimeResult {
  let pendingAnchorFocusRestore = false

  function resolveVisibleCellElement(rowIndex: number, columnIndex: number): HTMLElement | null {
    const selector = `.grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
    for (const root of [
      options.leftPaneContentRef.value,
      options.bodyViewportEl.value,
      options.rightPaneContentRef.value,
      options.leftBottomPaneContentRef.value,
      options.rightBottomPaneContentRef.value,
    ]) {
      const match = root?.querySelector<HTMLElement>(selector)
      if (match) {
        return match
      }
    }
    return null
  }

  function resolveVisibleRowElement(rowIndex: number): HTMLElement | null {
    const selector = `.grid-row[data-row-index="${rowIndex}"]`
    for (const root of [
      options.leftPaneContentRef.value,
      options.bodyViewportEl.value,
      options.rightPaneContentRef.value,
      options.leftBottomPaneContentRef.value,
      options.rightBottomPaneContentRef.value,
    ]) {
      const match = root?.querySelector<HTMLElement>(selector)
      if (match) {
        return match
      }
    }
    return null
  }

  function resolveRelativeCellRect(cell: { rowIndex: number; columnIndex: number } | null): {
    left: number
    right: number
    top: number
    bottom: number
  } | null {
    if (!cell) {
      return null
    }
    const cellElement = resolveVisibleCellElement(cell.rowIndex, cell.columnIndex)
    const shellRect = options.bodyShellRef.value?.getBoundingClientRect()
    if (!cellElement || !shellRect) {
      return null
    }
    const cellRect = cellElement.getBoundingClientRect()
    return {
      left: cellRect.left - shellRect.left,
      right: cellRect.right - shellRect.left,
      top: cellRect.top - shellRect.top,
      bottom: cellRect.bottom - shellRect.top,
    }
  }

  function isVisibleCellEditableByAbsoluteCoord(rowIndex: number, columnIndex: number): boolean {
    const rowOffset = rowIndex - options.viewportRowStart.value
    const row = options.displayRows.value[rowOffset]
    const column = options.visibleColumns.value[columnIndex]
    if (rowOffset < 0 || !row || !column) {
      return false
    }
    return options.isCellEditableSafe(row, rowOffset, column, columnIndex)
  }

  function focusVisibleAnchorCell(): void {
    const anchorCell = resolveVisibleAnchorCellPosition(
      options.displayRows,
      options.visibleColumns,
      options.resolveAbsoluteRowIndex,
      options.isSelectionAnchorCellSafe,
    )
    if (!anchorCell) {
      options.bodyViewportEl.value?.focus({ preventScroll: true })
      return
    }
    const cellElement = resolveVisibleCellElement(anchorCell.rowIndex, anchorCell.columnIndex)
    if (cellElement) {
      cellElement.focus({ preventScroll: true })
      return
    }
    options.bodyViewportEl.value?.focus({ preventScroll: true })
  }

  function restoreAnchorCellFocus(): void {
    if (options.isBodyViewportScrolling?.value && options.runWhenBodyViewportScrollIdle) {
      if (pendingAnchorFocusRestore) {
        return
      }
      pendingAnchorFocusRestore = true
      options.runWhenBodyViewportScrollIdle(() => {
        pendingAnchorFocusRestore = false
        focusVisibleAnchorCell()
      })
      return
    }
    focusVisibleAnchorCell()
  }

  return {
    isVisibleCellEditableByAbsoluteCoord,
    resolveVisibleCellElement,
    resolveVisibleRowElement,
    resolveRelativeCellRect,
    focusVisibleAnchorCell,
    restoreAnchorCellFocus,
  }
}
