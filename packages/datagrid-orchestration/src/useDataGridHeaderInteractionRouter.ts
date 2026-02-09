export interface UseDataGridHeaderInteractionRouterOptions {
  isSortableColumn: (columnKey: string) => boolean
  applySortFromHeader: (columnKey: string, append: boolean) => void
  openHeaderContextMenu: (x: number, y: number, columnKey: string) => void
  contextMenuBlockedColumnKey?: string
}

export interface UseDataGridHeaderInteractionRouterResult {
  onHeaderCellClick: (columnKey: string, event: MouseEvent) => void
  onHeaderCellKeyDown: (columnKey: string, event: KeyboardEvent) => void
}

export function useDataGridHeaderInteractionRouter(
  options: UseDataGridHeaderInteractionRouterOptions,
): UseDataGridHeaderInteractionRouterResult {
  const contextMenuBlockedColumnKey = options.contextMenuBlockedColumnKey ?? "select"

  function onHeaderCellClick(columnKey: string, event: MouseEvent): void {
    if (!options.isSortableColumn(columnKey)) {
      return
    }
    options.applySortFromHeader(columnKey, event.shiftKey)
  }

  function onHeaderCellKeyDown(columnKey: string, event: KeyboardEvent): void {
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      if (columnKey === contextMenuBlockedColumnKey) {
        return
      }
      event.preventDefault()
      const target = event.currentTarget as HTMLElement | null
      const rect = target?.getBoundingClientRect()
      const x = rect ? rect.left + Math.min(rect.width - 8, Math.max(8, rect.width * 0.5)) : 24
      const y = rect ? rect.bottom - 6 : 24
      options.openHeaderContextMenu(x, y, columnKey)
      return
    }

    if (!options.isSortableColumn(columnKey)) {
      return
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }
    event.preventDefault()
    options.applySortFromHeader(columnKey, event.shiftKey)
  }

  return {
    onHeaderCellClick,
    onHeaderCellKeyDown,
  }
}
