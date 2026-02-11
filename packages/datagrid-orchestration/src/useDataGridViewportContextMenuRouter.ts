import type {
  DataGridContextMenuZone,
  OpenDataGridContextMenuInput,
} from "./dataGridContextMenuContracts"

export interface DataGridViewportContextMenuCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridViewportContextMenuRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridViewportContextMenuRouterOptions<
  TCoord extends DataGridViewportContextMenuCoord = DataGridViewportContextMenuCoord,
  TRange extends DataGridViewportContextMenuRange = DataGridViewportContextMenuRange,
> {
  isInteractionBlocked: () => boolean
  isRangeMoveModifierActive: (event: MouseEvent) => boolean
  resolveSelectionRange: () => TRange | null
  resolveCellCoordFromDataset: (rowId: string, columnKey: string) => TCoord | null
  applyCellSelection: (coord: TCoord, extend: boolean, fallbackAnchor?: TCoord, ensureVisible?: boolean) => void
  resolveActiveCellCoord: () => TCoord | null
  setActiveCellCoord: (coord: TCoord) => void
  cellCoordsEqual: (a: TCoord | null, b: TCoord | null) => boolean
  isMultiCellSelection: (range: TRange | null) => boolean
  isCoordInsideRange: (coord: TCoord, range: TRange) => boolean
  openContextMenu: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void
  closeContextMenu: () => void
  isColumnContextEnabled?: (columnKey: string) => boolean
}

export interface UseDataGridViewportContextMenuRouterResult {
  dispatchViewportContextMenu: (event: MouseEvent) => boolean
}

function isContextEnabled<
  TCoord extends DataGridViewportContextMenuCoord,
  TRange extends DataGridViewportContextMenuRange,
>(
  columnKey: string,
  options: UseDataGridViewportContextMenuRouterOptions<TCoord, TRange>,
): boolean {
  return options.isColumnContextEnabled?.(columnKey) ?? columnKey !== "select"
}

export function useDataGridViewportContextMenuRouter<
  TCoord extends DataGridViewportContextMenuCoord = DataGridViewportContextMenuCoord,
  TRange extends DataGridViewportContextMenuRange = DataGridViewportContextMenuRange,
>(
  options: UseDataGridViewportContextMenuRouterOptions<TCoord, TRange>,
): UseDataGridViewportContextMenuRouterResult {
  function dispatchViewportContextMenu(event: MouseEvent): boolean {
    if (options.isInteractionBlocked()) {
      event.preventDefault()
      return true
    }

    const currentRange = options.resolveSelectionRange()
    if (options.isRangeMoveModifierActive(event) && currentRange) {
      event.preventDefault()
      return true
    }

    const targetNode = event.target as HTMLElement | null
    if (!targetNode) {
      return false
    }

    const headerCell = targetNode.closest(".datagrid-stage__cell--header[data-column-key]") as HTMLElement | null
    if (headerCell) {
      const columnKey = headerCell.dataset.columnKey ?? ""
      if (columnKey && isContextEnabled(columnKey, options)) {
        event.preventDefault()
        options.openContextMenu(event.clientX, event.clientY, { zone: "header", columnKey })
        return true
      }
      return false
    }

    const cell = targetNode.closest(".datagrid-stage__cell[data-row-id][data-column-key]") as HTMLElement | null
    if (cell) {
      const rowId = cell.dataset.rowId ?? ""
      const columnKey = cell.dataset.columnKey ?? ""
      if (columnKey && isContextEnabled(columnKey, options)) {
        let coord = null as TCoord | null
        const rowIndex = cell.dataset.rowIndex
        const columnIndex = cell.dataset.columnIndex
        if (rowIndex !== undefined && columnIndex !== undefined) {
          const parsedRow = Number(rowIndex)
          const parsedColumn = Number(columnIndex)
          if (Number.isFinite(parsedRow) && Number.isFinite(parsedColumn)) {
            coord = { rowIndex: parsedRow, columnIndex: parsedColumn } as TCoord
          }
        }
        if (!coord) {
          coord = options.resolveCellCoordFromDataset(rowId, columnKey)
        }
        if (coord) {
          if (!currentRange || !options.isCoordInsideRange(coord, currentRange)) {
            options.applyCellSelection(coord, false, coord, false)
          } else if (!options.cellCoordsEqual(options.resolveActiveCellCoord(), coord)) {
            options.setActiveCellCoord(coord)
          }

          const nextRange = options.resolveSelectionRange()
          const zone: DataGridContextMenuZone = options.isMultiCellSelection(nextRange) &&
            !!nextRange &&
            options.isCoordInsideRange(coord, nextRange)
            ? "range"
            : "cell"

          event.preventDefault()
          options.openContextMenu(event.clientX, event.clientY, { zone, columnKey, rowId })
          return true
        }
      }
    }

    event.preventDefault()
    options.closeContextMenu()
    return true
  }

  return {
    dispatchViewportContextMenu,
  }
}
