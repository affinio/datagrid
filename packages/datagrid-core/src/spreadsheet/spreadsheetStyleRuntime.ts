import type {
  DataGridSpreadsheetColumnSnapshot,
  DataGridSpreadsheetFormulaTableBinding,
  DataGridSpreadsheetSheetState,
  DataGridSpreadsheetSheetStateRow,
  DataGridSpreadsheetStyle,
} from "./sheetModel.js"

export function normalizeSpreadsheetStyle(
  style: DataGridSpreadsheetStyle | null | undefined,
): DataGridSpreadsheetStyle | null {
  if (style == null) {
    return null
  }
  if (typeof style !== "object" || Array.isArray(style)) {
    throw new Error("[DataGridSpreadsheetSheet] style must be an object or null.")
  }
  const normalizedEntries = Object.entries(style)
    .filter(([key]) => String(key).length > 0)
    .map(([key, value]) => [String(key), value] as const)
  if (normalizedEntries.length === 0) {
    return null
  }
  return Object.freeze(Object.fromEntries(normalizedEntries))
}

export function areSpreadsheetStylesEqual(
  left: DataGridSpreadsheetStyle | null,
  right: DataGridSpreadsheetStyle | null,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false
    }
    if (!Object.is(left[key], right[key])) {
      return false
    }
  }
  return true
}

export function areSpreadsheetColumnSnapshotsEqual(
  left: readonly DataGridSpreadsheetColumnSnapshot[],
  right: readonly DataGridSpreadsheetColumnSnapshot[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftColumn = left[index]
    const rightColumn = right[index]
    if (
      !leftColumn
      || !rightColumn
      || leftColumn.key !== rightColumn.key
      || leftColumn.title !== rightColumn.title
      || leftColumn.formulaAlias !== rightColumn.formulaAlias
      || !areSpreadsheetStylesEqual(leftColumn.style, rightColumn.style)
    ) {
      return false
    }
  }
  return true
}

export function areSpreadsheetFormulaTableBindingsEqual(
  left: readonly DataGridSpreadsheetFormulaTableBinding[],
  right: readonly DataGridSpreadsheetFormulaTableBinding[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftBinding = left[index]
    const rightBinding = right[index]
    if (
      !leftBinding
      || !rightBinding
      || leftBinding.name !== rightBinding.name
      || leftBinding.source !== rightBinding.source
    ) {
      return false
    }
  }
  return true
}

export function areSpreadsheetSheetStateRowsEqual(
  left: readonly DataGridSpreadsheetSheetStateRow[],
  right: readonly DataGridSpreadsheetSheetStateRow[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let rowIndex = 0; rowIndex < left.length; rowIndex += 1) {
    const leftRow = left[rowIndex]
    const rightRow = right[rowIndex]
    if (
      !leftRow
      || !rightRow
      || leftRow.id !== rightRow.id
      || !areSpreadsheetStylesEqual(leftRow.style, rightRow.style)
      || leftRow.cells.length !== rightRow.cells.length
    ) {
      return false
    }
    for (let cellIndex = 0; cellIndex < leftRow.cells.length; cellIndex += 1) {
      const leftCell = leftRow.cells[cellIndex]
      const rightCell = rightRow.cells[cellIndex]
      if (
        !leftCell
        || !rightCell
        || leftCell.columnKey !== rightCell.columnKey
        || leftCell.rawInput !== rightCell.rawInput
        || !areSpreadsheetStylesEqual(leftCell.style, rightCell.style)
      ) {
        return false
      }
    }
  }
  return true
}

export function areSpreadsheetSheetStatesEquivalent(
  left: DataGridSpreadsheetSheetState,
  right: DataGridSpreadsheetSheetState,
): boolean {
  return areSpreadsheetColumnSnapshotsEqual(left.columns, right.columns)
    && areSpreadsheetSheetStateRowsEqual(left.rows, right.rows)
    && areSpreadsheetStylesEqual(left.sheetStyle, right.sheetStyle)
    && areSpreadsheetFormulaTableBindingsEqual(left.formulaTables, right.formulaTables)
}

export function mergeSpreadsheetStyles(
  sheetStyle: DataGridSpreadsheetStyle | null,
  columnStyle: DataGridSpreadsheetStyle | null,
  rowStyle: DataGridSpreadsheetStyle | null,
  cellStyle: DataGridSpreadsheetStyle | null,
): DataGridSpreadsheetStyle | null {
  const merged = {
    ...(sheetStyle ?? {}),
    ...(columnStyle ?? {}),
    ...(rowStyle ?? {}),
    ...(cellStyle ?? {}),
  }
  return normalizeSpreadsheetStyle(merged)
}
