export interface DataGridNavigationCellCoord {
  rowIndex: number
  columnIndex: number
}

export interface UseDataGridCellNavigationOptions<
  TCoord extends DataGridNavigationCellCoord = DataGridNavigationCellCoord,
> {
  resolveCurrentCellCoord: () => TCoord | null
  resolveTabTarget: (current: TCoord, backwards: boolean) => TCoord | null
  normalizeCellCoord: (coord: TCoord) => TCoord | null
  getAdjacentNavigableColumnIndex: (columnIndex: number, direction: 1 | -1) => number
  getFirstNavigableColumnIndex: () => number
  getLastNavigableColumnIndex: () => number
  getLastRowIndex: () => number
  resolveStepRows: () => number
  closeContextMenu: () => void
  clearCellSelection: () => void
  setLastAction: (message: string) => void
  applyCellSelection: (nextCoord: TCoord, extend: boolean, fallbackAnchor?: TCoord) => void
}

export interface UseDataGridCellNavigationResult {
  dispatchNavigation: (event: KeyboardEvent) => boolean
}

function prevent(event: KeyboardEvent) {
  event.preventDefault()
}

function resolveNavigationKey(event: KeyboardEvent): string {
  if (event.code === "ArrowUp" || event.code === "ArrowDown" || event.code === "ArrowLeft" || event.code === "ArrowRight") {
    return event.code
  }
  // Some environments report ArrowUp/ArrowDown combos as PageUp/PageDown while
  // preserving Arrow* code. Prefer the physical key in that case.
  if (event.key === "PageDown" && event.code === "ArrowDown") {
    return "ArrowDown"
  }
  if (event.key === "PageUp" && event.code === "ArrowUp") {
    return "ArrowUp"
  }
  // Playwright/WebKit on macOS can occasionally emit Shift+Arrow as PageUp/PageDown
  // without Arrow* codes. Preserve expected single-row extension semantics.
  if (event.key === "PageDown" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return "ArrowDown"
  }
  if (event.key === "PageUp" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return "ArrowUp"
  }
  return event.key
}

export function useDataGridCellNavigation<
  TCoord extends DataGridNavigationCellCoord = DataGridNavigationCellCoord,
>(
  options: UseDataGridCellNavigationOptions<TCoord>,
): UseDataGridCellNavigationResult {
  function dispatchNavigation(event: KeyboardEvent): boolean {
    const current = options.resolveCurrentCellCoord()
    if (!current) {
      return false
    }

    let target: TCoord = { ...current }
    let extend = event.shiftKey
    const stepRows = Math.max(1, options.resolveStepRows())
    const key = resolveNavigationKey(event)

    switch (key) {
      case "ArrowUp":
        target.rowIndex -= 1
        break
      case "ArrowDown":
        target.rowIndex += 1
        break
      case "ArrowLeft":
        target.columnIndex = options.getAdjacentNavigableColumnIndex(current.columnIndex, -1)
        break
      case "ArrowRight":
        target.columnIndex = options.getAdjacentNavigableColumnIndex(current.columnIndex, 1)
        break
      case "PageUp":
        target.rowIndex -= stepRows
        break
      case "PageDown":
        target.rowIndex += stepRows
        break
      case "Home":
        if (event.ctrlKey || event.metaKey) {
          target = {
            rowIndex: 0,
            columnIndex: options.getFirstNavigableColumnIndex(),
          } as TCoord
        } else {
          target.columnIndex = options.getFirstNavigableColumnIndex()
        }
        break
      case "End":
        if (event.ctrlKey || event.metaKey) {
          target = {
            rowIndex: options.getLastRowIndex(),
            columnIndex: options.getLastNavigableColumnIndex(),
          } as TCoord
        } else {
          target.columnIndex = options.getLastNavigableColumnIndex()
        }
        break
      case "Tab":
        {
          const nextTab = options.resolveTabTarget(current, event.shiftKey)
          if (!nextTab) {
            return true
          }
          target = nextTab
        }
        extend = false
        break
      case "Enter":
        target.rowIndex += event.shiftKey ? -1 : 1
        extend = false
        break
      case "Escape":
        prevent(event)
        options.closeContextMenu()
        options.clearCellSelection()
        options.setLastAction("Cleared cell selection")
        return true
      default:
        return false
    }

    const normalized = options.normalizeCellCoord(target)
    if (!normalized) {
      return true
    }
    prevent(event)
    options.applyCellSelection(normalized, extend, current)
    return true
  }

  return {
    dispatchNavigation,
  }
}
