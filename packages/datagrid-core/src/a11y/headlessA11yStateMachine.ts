import type { DataGridRowId } from "../models/rowModel"

export type DataGridA11yKeyCommandKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "Tab"
  | "Enter"
  | "Escape"

export interface DataGridA11yKeyboardCommand {
  key: DataGridA11yKeyCommandKey
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  pageSize?: number
}

export interface DataGridA11yFocusCell {
  rowIndex: number
  colIndex: number
  rowId?: DataGridRowId
  columnKey?: string
}

export interface DataGridA11ySnapshot {
  rowCount: number
  colCount: number
  gridFocused: boolean
  focusCell: DataGridA11yFocusCell | null
  activeDescendantId: string | null
}

export interface DataGridA11yGridAriaState {
  role: "grid"
  tabIndex: number
  ariaRowCount: number
  ariaColCount: number
  ariaActiveDescendant: string | null
  ariaMultiselectable: boolean
}

export interface DataGridA11yCellAriaState {
  id: string
  role: "gridcell"
  tabIndex: number
  ariaRowIndex: number
  ariaColIndex: number
  ariaSelected: boolean
}

export type DataGridA11yStateListener = (snapshot: DataGridA11ySnapshot) => void

export interface CreateDataGridA11yStateMachineOptions {
  rowCount: number
  colCount: number
  idPrefix?: string
  initialGridFocused?: boolean
  initialFocusCell?: DataGridA11yFocusCell | null
  resolveCellId?: (cell: DataGridA11yFocusCell) => string
}

export interface DataGridA11yStateMachine {
  snapshot(): DataGridA11ySnapshot
  setDimensions(rowCount: number, colCount: number): DataGridA11ySnapshot
  setFocusCell(cell: DataGridA11yFocusCell | null): DataGridA11ySnapshot
  focusGrid(focused: boolean): DataGridA11ySnapshot
  dispatchKeyboard(command: DataGridA11yKeyboardCommand): DataGridA11ySnapshot
  getGridAria(): DataGridA11yGridAriaState
  getCellAria(cell: DataGridA11yFocusCell): DataGridA11yCellAriaState
  subscribe(listener: DataGridA11yStateListener): () => void
}

interface DataGridA11yDimensions {
  rowCount: number
  colCount: number
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.trunc(value))
}

function normalizeDimensions(rowCount: number, colCount: number): DataGridA11yDimensions {
  return {
    rowCount: normalizeCount(rowCount),
    colCount: normalizeCount(colCount),
  }
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function normalizeFocusCell(
  cell: DataGridA11yFocusCell | null | undefined,
  dimensions: DataGridA11yDimensions,
): DataGridA11yFocusCell | null {
  if (!cell) return null
  if (dimensions.rowCount < 1 || dimensions.colCount < 1) return null

  const maxRow = dimensions.rowCount - 1
  const maxCol = dimensions.colCount - 1

  return {
    rowIndex: clamp(Math.trunc(cell.rowIndex), 0, maxRow),
    colIndex: clamp(Math.trunc(cell.colIndex), 0, maxCol),
    rowId: cell.rowId,
    columnKey: cell.columnKey,
  }
}

function isSameFocusCell(
  left: DataGridA11yFocusCell | null,
  right: DataGridA11yFocusCell | null,
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return (
    left.rowIndex === right.rowIndex &&
    left.colIndex === right.colIndex &&
    left.rowId === right.rowId &&
    left.columnKey === right.columnKey
  )
}

function isSameSnapshot(left: DataGridA11ySnapshot, right: DataGridA11ySnapshot): boolean {
  return (
    left.rowCount === right.rowCount &&
    left.colCount === right.colCount &&
    left.gridFocused === right.gridFocused &&
    left.activeDescendantId === right.activeDescendantId &&
    isSameFocusCell(left.focusCell, right.focusCell)
  )
}

function canUseGridDimensions(dimensions: DataGridA11yDimensions): boolean {
  return dimensions.rowCount > 0 && dimensions.colCount > 0
}

function moveToFirstCell(dimensions: DataGridA11yDimensions): DataGridA11yFocusCell | null {
  if (!canUseGridDimensions(dimensions)) return null
  return {
    rowIndex: 0,
    colIndex: 0,
  }
}

export function createDataGridA11yStateMachine(
  options: CreateDataGridA11yStateMachineOptions,
): DataGridA11yStateMachine {
  const idPrefix = typeof options.idPrefix === "string" && options.idPrefix.length > 0
    ? options.idPrefix
    : "datagrid"
  const resolveCellId = options.resolveCellId ?? ((cell: DataGridA11yFocusCell) => {
    return `${idPrefix}-cell-r${cell.rowIndex}-c${cell.colIndex}`
  })

  let dimensions = normalizeDimensions(options.rowCount, options.colCount)
  let gridFocused = Boolean(options.initialGridFocused)
  let focusCell = normalizeFocusCell(options.initialFocusCell, dimensions)
  const listeners = new Set<DataGridA11yStateListener>()

  if (gridFocused && !focusCell) {
    focusCell = moveToFirstCell(dimensions)
  }

  function buildSnapshot(): DataGridA11ySnapshot {
    const currentFocus = focusCell ? { ...focusCell } : null
    const activeDescendantId = gridFocused && currentFocus ? resolveCellId(currentFocus) : null
    return {
      rowCount: dimensions.rowCount,
      colCount: dimensions.colCount,
      gridFocused,
      focusCell: currentFocus,
      activeDescendantId,
    }
  }

  function emitIfChanged(previous: DataGridA11ySnapshot): DataGridA11ySnapshot {
    const next = buildSnapshot()
    if (isSameSnapshot(previous, next)) {
      return next
    }
    for (const listener of listeners) {
      listener(next)
    }
    return next
  }

  function setDimensions(rowCount: number, colCount: number): DataGridA11ySnapshot {
    const previous = buildSnapshot()
    dimensions = normalizeDimensions(rowCount, colCount)
    focusCell = normalizeFocusCell(focusCell, dimensions)
    if (gridFocused && !focusCell) {
      focusCell = moveToFirstCell(dimensions)
    }
    if (!canUseGridDimensions(dimensions)) {
      focusCell = null
      gridFocused = false
    }
    return emitIfChanged(previous)
  }

  function setFocusCell(cell: DataGridA11yFocusCell | null): DataGridA11ySnapshot {
    const previous = buildSnapshot()
    focusCell = normalizeFocusCell(cell, dimensions)
    if (gridFocused && !focusCell) {
      focusCell = moveToFirstCell(dimensions)
    }
    return emitIfChanged(previous)
  }

  function focusGrid(focused: boolean): DataGridA11ySnapshot {
    const previous = buildSnapshot()
    const canFocus = focused && canUseGridDimensions(dimensions)
    gridFocused = canFocus
    if (gridFocused && !focusCell) {
      focusCell = moveToFirstCell(dimensions)
    }
    return emitIfChanged(previous)
  }

  function dispatchKeyboard(command: DataGridA11yKeyboardCommand): DataGridA11ySnapshot {
    const previous = buildSnapshot()
    if (!canUseGridDimensions(dimensions)) {
      return previous
    }

    if (!gridFocused) {
      gridFocused = true
      if (!focusCell) {
        focusCell = moveToFirstCell(dimensions)
      }
    }

    if (!focusCell) {
      focusCell = moveToFirstCell(dimensions)
    }
    if (!focusCell) {
      return emitIfChanged(previous)
    }

    const rowMax = Math.max(0, dimensions.rowCount - 1)
    const colMax = Math.max(0, dimensions.colCount - 1)
    const next: DataGridA11yFocusCell = { ...focusCell }
    const pageStep = Math.max(1, Math.trunc(command.pageSize ?? 10))

    switch (command.key) {
      case "ArrowUp":
        next.rowIndex = clamp(next.rowIndex - 1, 0, rowMax)
        break
      case "ArrowDown":
        next.rowIndex = clamp(next.rowIndex + 1, 0, rowMax)
        break
      case "ArrowLeft":
        next.colIndex = clamp(next.colIndex - 1, 0, colMax)
        break
      case "ArrowRight":
        next.colIndex = clamp(next.colIndex + 1, 0, colMax)
        break
      case "Home":
        if (command.ctrlKey || command.metaKey) {
          next.rowIndex = 0
        } else {
          next.colIndex = 0
        }
        break
      case "End":
        if (command.ctrlKey || command.metaKey) {
          next.rowIndex = rowMax
        } else {
          next.colIndex = colMax
        }
        break
      case "PageUp":
        next.rowIndex = clamp(next.rowIndex - pageStep, 0, rowMax)
        break
      case "PageDown":
        next.rowIndex = clamp(next.rowIndex + pageStep, 0, rowMax)
        break
      case "Tab": {
        const delta = command.shiftKey ? -1 : 1
        const linearIndex = next.rowIndex * dimensions.colCount + next.colIndex + delta
        const clampedLinearIndex = clamp(linearIndex, 0, rowMax * dimensions.colCount + colMax)
        next.rowIndex = Math.trunc(clampedLinearIndex / dimensions.colCount)
        next.colIndex = clampedLinearIndex % dimensions.colCount
        break
      }
      case "Escape":
        gridFocused = false
        return emitIfChanged(previous)
      case "Enter":
      default:
        return emitIfChanged(previous)
    }

    focusCell = next
    return emitIfChanged(previous)
  }

  function getGridAria(): DataGridA11yGridAriaState {
    const snapshot = buildSnapshot()
    return {
      role: "grid",
      tabIndex: 0,
      ariaRowCount: snapshot.rowCount,
      ariaColCount: snapshot.colCount,
      ariaActiveDescendant: snapshot.activeDescendantId,
      ariaMultiselectable: true,
    }
  }

  function getCellAria(cell: DataGridA11yFocusCell): DataGridA11yCellAriaState {
    const normalized = normalizeFocusCell(cell, dimensions) ?? {
      rowIndex: Math.max(0, Math.trunc(cell.rowIndex)),
      colIndex: Math.max(0, Math.trunc(cell.colIndex)),
      rowId: cell.rowId,
      columnKey: cell.columnKey,
    }
    const active = Boolean(
      gridFocused &&
      focusCell &&
      focusCell.rowIndex === normalized.rowIndex &&
      focusCell.colIndex === normalized.colIndex,
    )

    return {
      id: resolveCellId(normalized),
      role: "gridcell",
      tabIndex: active ? 0 : -1,
      ariaRowIndex: normalized.rowIndex + 1,
      ariaColIndex: normalized.colIndex + 1,
      ariaSelected: active,
    }
  }

  function subscribe(listener: DataGridA11yStateListener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    snapshot: buildSnapshot,
    setDimensions,
    setFocusCell,
    focusGrid,
    dispatchKeyboard,
    getGridAria,
    getCellAria,
    subscribe,
  }
}
