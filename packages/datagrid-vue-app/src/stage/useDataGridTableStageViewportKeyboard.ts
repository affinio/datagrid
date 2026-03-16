import type { ComputedRef, Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-vue"

export interface UseDataGridTableStageViewportKeyboardOptions<TRow extends Record<string, unknown>> {
  runtime: Pick<import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>, "api">
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  totalRows: Ref<number>
  orderedVisibleColumns: ComputedRef<readonly DataGridColumnSnapshot[]>
  viewportRowStart: Ref<number>
  applySelectionRange: (range: {
    startRow: number
    endRow: number
    startColumn: number
    endColumn: number
  }) => void
  handleCellKeydown: (
    event: KeyboardEvent,
    row: import("@affino/datagrid-vue").DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
  ) => void
}

export interface UseDataGridTableStageViewportKeyboardResult {
  handleViewportKeydown: (event: KeyboardEvent) => void
}

export function useDataGridTableStageViewportKeyboard<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStageViewportKeyboardOptions<TRow>,
): UseDataGridTableStageViewportKeyboardResult {
  const isViewportOwnedKeyboardEvent = (event: KeyboardEvent): boolean => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false
    }
    return (
      event.key.startsWith("Arrow")
      || event.key === "Home"
      || event.key === "End"
      || event.key === "PageUp"
      || event.key === "PageDown"
      || event.key === "Tab"
      || event.key === "Enter"
      || event.key === " "
      || event.key === "Spacebar"
      || event.key === "F2"
      || event.key === "Escape"
      || event.key.length === 1
    )
  }

  const isViewportSelectAllKeyboardEvent = (event: KeyboardEvent): boolean => {
    return (event.ctrlKey || event.metaKey)
      && !event.altKey
      && !event.shiftKey
      && event.key.toLowerCase() === "a"
  }

  const selectAllVisibleCells = (): void => {
    const lastRowIndex = options.totalRows.value - 1
    const lastColumnIndex = options.orderedVisibleColumns.value.length - 1
    if (lastRowIndex < 0 || lastColumnIndex < 0) {
      return
    }
    options.applySelectionRange({
      startRow: 0,
      endRow: lastRowIndex,
      startColumn: 0,
      endColumn: lastColumnIndex,
    })
  }

  const handleViewportKeydown = (event: KeyboardEvent): void => {
    if (isViewportOwnedKeyboardEvent(event) || isViewportSelectAllKeyboardEvent(event)) {
      event.preventDefault()
    }
    const activeCell = options.selectionSnapshot.value?.activeCell
    if (!activeCell) {
      if (isViewportSelectAllKeyboardEvent(event)) {
        selectAllVisibleCells()
      }
      return
    }
    const row = options.runtime.api.rows.get(activeCell.rowIndex)
    if (!row) {
      return
    }
    options.handleCellKeydown(
      event,
      row,
      activeCell.rowIndex - options.viewportRowStart.value,
      activeCell.colIndex,
    )
  }

  return {
    handleViewportKeydown,
  }
}