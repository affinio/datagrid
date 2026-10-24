import {
  invokeDataGridCellInteraction,
  resolveDataGridCellKeyboardAction,
  type DataGridApi,
  type DataGridColumnModel,
} from "@affino/datagrid-core"
import { useDataGridCellNavigation } from "@affino/datagrid-orchestration"
import type { DataGridDomCellCoord } from "./cellSelectionController.js"

export function createDomCellNavigationController<TRow>(options: {
  api: DataGridApi<TRow>
  columnModel: DataGridColumnModel
  setCellSelection: (point: DataGridDomCellCoord, anchor: DataGridDomCellCoord, origin: string) => void
  toggleGroup: (groupKey: string) => void
  tryStartInlineEdit: (event: KeyboardEvent) => boolean
  isCellToggle: (rowIndex: number, columnIndex: number) => boolean
  toggleCell: (rowIndex: number, columnIndex: number) => boolean
  revealCell: (rowIndex: number, columnIndex: number) => void
}) {
  let extendsSelection = false
  let lastToggledGroupKey: string | null = null
  const getRowCount = (): number => options.api.rows.getCount()
  const getColumnCount = (): number => options.columnModel.getSnapshot().visibleColumns.length
  const navigation = useDataGridCellNavigation({
    resolveCurrentCellCoord: () => {
      const snapshot = options.api.selection.getSnapshot()
      const activeRange = snapshot?.ranges[snapshot.activeRangeIndex] ?? snapshot?.ranges[0]
      const point = extendsSelection
        ? activeRange?.focus ?? snapshot?.activeCell
        : activeRange?.anchor ?? snapshot?.activeCell
      if (point) return { rowIndex: point.rowIndex, columnIndex: point.colIndex, rowId: point.rowId ?? null }
      const firstRow = options.api.rows.get(0)
      return firstRow ? { rowIndex: 0, columnIndex: 0, rowId: firstRow.rowId } : null
    },
    resolveTabTarget: (current, backwards) => {
      const lastRow = Math.max(0, getRowCount() - 1)
      const lastColumn = Math.max(0, getColumnCount() - 1)
      if (backwards) {
        if (current.columnIndex > 0) return { ...current, columnIndex: current.columnIndex - 1 }
        if (current.rowIndex <= 0) return current
        return { ...current, rowIndex: current.rowIndex - 1, columnIndex: lastColumn }
      }
      if (current.columnIndex < lastColumn) return { ...current, columnIndex: current.columnIndex + 1 }
      if (current.rowIndex >= lastRow) return current
      return { ...current, rowIndex: current.rowIndex + 1, columnIndex: 0 }
    },
    normalizeCellCoord: coord => {
      const rowCount = getRowCount()
      const columnCount = getColumnCount()
      if (rowCount <= 0 || columnCount <= 0) return null
      const rowIndex = Math.max(0, Math.min(rowCount - 1, Math.trunc(coord.rowIndex)))
      const columnIndex = Math.max(0, Math.min(columnCount - 1, Math.trunc(coord.columnIndex)))
      const row = options.api.rows.get(rowIndex)
      return row ? { rowIndex, columnIndex, rowId: row.rowId } : null
    },
    getAdjacentNavigableColumnIndex: (columnIndex, direction) => (
      Math.max(0, Math.min(getColumnCount() - 1, columnIndex + direction))
    ),
    getFirstNavigableColumnIndex: () => 0,
    getLastNavigableColumnIndex: () => Math.max(0, getColumnCount() - 1),
    getLastRowIndex: () => Math.max(0, getRowCount() - 1),
    resolveStepRows: () => 20,
    closeContextMenu: () => undefined,
    clearCellSelection: () => options.api.selection.clear({ origin: "datagrid-dom-keyboard-escape" }),
    setLastAction: () => undefined,
    resolveDirectionalJumpTarget,
    applyCellSelection: (next, extend, fallbackAnchor) => {
      const snapshot = options.api.selection.getSnapshot()
      const activeRange = snapshot?.ranges[snapshot.activeRangeIndex ?? 0]
      const rangeAnchor = activeRange?.anchor
      const anchor = extend && rangeAnchor
        ? { rowIndex: rangeAnchor.rowIndex, colIndex: rangeAnchor.colIndex, rowId: rangeAnchor.rowId }
        : extend
          ? fallbackAnchor
            ? { rowIndex: fallbackAnchor.rowIndex, colIndex: fallbackAnchor.columnIndex, rowId: fallbackAnchor.rowId }
            : { rowIndex: next.rowIndex, colIndex: next.columnIndex, rowId: next.rowId }
          : { rowIndex: next.rowIndex, colIndex: next.columnIndex, rowId: next.rowId }
      options.setCellSelection(
        { rowIndex: next.rowIndex, colIndex: next.columnIndex, rowId: next.rowId },
        anchor,
        "datagrid-dom-keyboard-navigation",
      )
    },
    onNavigationApplied: next => options.revealCell(next.rowIndex, next.columnIndex),
  })

  function resolveDirectionalJumpTarget(
    current: { rowIndex: number; columnIndex: number },
    direction: "up" | "down" | "left" | "right",
  ) {
    const isCurrentCellNonEmpty = (rowIndex: number, columnIndex: number): boolean | null => {
      const row = options.api.rows.get(rowIndex)
      const column = options.columnModel.getSnapshot().visibleColumns[columnIndex]
      if (!row || row.kind !== "leaf" || !column) return null
      const value = options.api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "display" })
      return value.status === "available" ? value.displayValue.trim().length > 0 : null
    }
    const initialValue = isCurrentCellNonEmpty(current.rowIndex, current.columnIndex)
    if (initialValue == null) return undefined
    const delta = direction === "up" ? [-1, 0] : direction === "down" ? [1, 0] : direction === "left" ? [0, -1] : [0, 1]
    let target = { ...current }
    while (true) {
      const rowIndex = target.rowIndex + delta[0]!
      const columnIndex = target.columnIndex + delta[1]!
      if (rowIndex < 0 || rowIndex >= getRowCount() || columnIndex < 0 || columnIndex >= getColumnCount()) break
      const candidateValue = isCurrentCellNonEmpty(rowIndex, columnIndex)
      if (candidateValue == null || candidateValue !== initialValue) break
      target = { rowIndex, columnIndex }
    }
    return { ...target, rowId: options.api.rows.get(target.rowIndex)?.rowId ?? null }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if ((event.target as Element | null)?.closest?.("[data-column-resize-handle], [data-fill-handle], [data-fill-action]")) return
    if ((event.target as Element | null)?.closest?.(".affino-grid-dom__editor")) return
    if ((event.target as Element | null)?.closest?.("[data-row-selection-toggle], [data-row-selection-select-all]")) return
    const spaceKey = isSpaceKey(event)
    if (!spaceKey) lastToggledGroupKey = null
    if (spaceKey && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.target as Element | null
      const disclosure = target?.closest?.<HTMLButtonElement>("[data-group-toggle]")
      if (disclosure) {
        lastToggledGroupKey = disclosure.dataset.groupToggle ?? null
        event.preventDefault()
        disclosure.click()
        return
      }
      const selectedRowIndex = options.api.selection.getSnapshot()?.activeCell?.rowIndex
      const cellRowIndex = target?.closest?.<HTMLElement>(".affino-grid-dom__cell[data-row-index]")?.dataset.rowIndex
      const rowIndex = cellRowIndex == null ? selectedRowIndex : Number(cellRowIndex)
      const row = rowIndex == null ? null : options.api.rows.get(rowIndex)
      const groupKey = row?.kind === "group" && row.groupMeta
        ? row.groupMeta.groupKey
        : rowIndex == null ? lastToggledGroupKey : null
      const groupExists = groupKey != null && hasGroupKey(groupKey)
      if (groupKey && groupExists) {
        event.preventDefault()
        lastToggledGroupKey = groupKey
        options.toggleGroup(groupKey)
        return
      }
    }
    if ((event.target as Element | null)?.closest?.("[data-group-toggle]") && event.key === "Enter") return
    if (event.isComposing || event.key === "Process" || event.keyCode === 229) return
    if ((event.key === "Enter" || spaceKey) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.target as Element | null
      const cell = target?.closest?.<HTMLElement>(".affino-grid-dom__cell[data-row-index][data-column-index]")
      const activeCell = options.api.selection.getSnapshot()?.activeCell
      const rowIndex = cell ? Number(cell.dataset.rowIndex) : activeCell?.rowIndex
      const columnIndex = cell ? Number(cell.dataset.columnIndex) : activeCell?.colIndex
      if (rowIndex != null && columnIndex != null && invokeCellKeyboardAction(rowIndex, columnIndex, event)) return
    }
    if (spaceKey && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.target as Element | null
      const cell = target?.closest?.<HTMLElement>(".affino-grid-dom__cell[data-row-index][data-column-index]")
      const activeCell = options.api.selection.getSnapshot()?.activeCell
      const rowIndex = cell ? Number(cell.dataset.rowIndex) : activeCell?.rowIndex
      const columnIndex = cell ? Number(cell.dataset.columnIndex) : activeCell?.colIndex
      if (rowIndex != null && columnIndex != null && options.isCellToggle(rowIndex, columnIndex)) {
        event.preventDefault()
        event.stopPropagation()
        options.toggleCell(rowIndex, columnIndex)
        return
      }
    }
    if (!options.api.selection.hasSupport() || options.tryStartInlineEdit(event)) return
    extendsSelection = event.shiftKey
    try {
      navigation.dispatchNavigation(event)
    } finally {
      extendsSelection = false
    }
  }

  return { onKeyDown }

  function invokeCellKeyboardAction(rowIndex: number, columnIndex: number, event: KeyboardEvent): boolean {
    const row = options.api.rows.get(rowIndex)
    const column = options.columnModel.getSnapshot().visibleColumns[columnIndex]
    if (!row || row.kind !== "leaf" || !column) return false
    const editable = column.column.capabilities?.editable !== false
    const action = resolveDataGridCellKeyboardAction({
      column: column.column,
      row: row.data,
      rowId: row.rowId,
      editable,
      key: event.key,
      printable: false,
    })
    if (action !== "invoke") return false
    const resolved = options.api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "display" })
    event.preventDefault()
    event.stopPropagation()
    invokeDataGridCellInteraction({
      column: column.column,
      row: row.data,
      rowId: row.rowId,
      value: resolved.status === "available" ? resolved.computedValue : undefined,
      editable,
      trigger: event.key === "Enter" ? "keyboard-enter" : "keyboard-space",
    })
    return true
  }

  function hasGroupKey(groupKey: string): boolean {
    for (let index = 0; index < getRowCount(); index += 1) {
      const row = options.api.rows.get(index)
      if (row?.kind === "group" && row.groupMeta?.groupKey === groupKey) return true
    }
    return false
  }
}

function isSpaceKey(event: KeyboardEvent): boolean {
  return event.key === " " || event.code === "Space"
}
