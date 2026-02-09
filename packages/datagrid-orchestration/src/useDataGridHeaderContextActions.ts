import type { DataGridContextMenuActionId } from "./dataGridContextMenuContracts"

export interface UseDataGridHeaderContextActionsOptions {
  isSortableColumn: (columnKey: string) => boolean
  applyExplicitSort: (columnKey: string, direction: "asc" | "desc" | null) => void
  openColumnFilter: (columnKey: string) => void
  estimateColumnAutoWidth: (columnKey: string) => number
  setColumnWidth: (columnKey: string, width: number) => void
  closeContextMenu: () => void
  setLastAction: (message: string) => void
}

export interface UseDataGridHeaderContextActionsResult {
  runHeaderContextAction: (action: DataGridContextMenuActionId, columnKey: string) => boolean
}

export function useDataGridHeaderContextActions(
  options: UseDataGridHeaderContextActionsOptions,
): UseDataGridHeaderContextActionsResult {
  function runHeaderContextAction(action: DataGridContextMenuActionId, columnKey: string): boolean {
    if (!options.isSortableColumn(columnKey) && action !== "auto-size") {
      return false
    }

    if (action === "sort-asc") {
      options.applyExplicitSort(columnKey, "asc")
      options.setLastAction(`Sorted ${columnKey} asc`)
      options.closeContextMenu()
      return true
    }
    if (action === "sort-desc") {
      options.applyExplicitSort(columnKey, "desc")
      options.setLastAction(`Sorted ${columnKey} desc`)
      options.closeContextMenu()
      return true
    }
    if (action === "sort-clear") {
      options.applyExplicitSort(columnKey, null)
      options.setLastAction(`Sort cleared for ${columnKey}`)
      options.closeContextMenu()
      return true
    }
    if (action === "filter") {
      options.openColumnFilter(columnKey)
      options.closeContextMenu()
      return true
    }
    if (action === "auto-size") {
      const nextWidth = options.estimateColumnAutoWidth(columnKey)
      options.setColumnWidth(columnKey, nextWidth)
      options.setLastAction(`Auto-sized ${columnKey} to ${nextWidth}px`)
      options.closeContextMenu()
      return true
    }

    return false
  }

  return {
    runHeaderContextAction,
  }
}
