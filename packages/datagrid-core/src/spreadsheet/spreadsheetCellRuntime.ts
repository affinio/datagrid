import type { DataGridRowId } from "../models/rowModel.js"
import type { parseDataGridFormulaIdentifier } from "../models/formula/formulaEngine.js"
import type { DataGridSpreadsheetCellAddress } from "./formulaEditorModel.js"

export interface SpreadsheetCellAddressRowSource {
  id: DataGridRowId
  rowIndex: number
}

export function formatSpreadsheetCellPreviewValue(value: unknown): string {
  if (value == null || value === "") {
    return ""
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : ""
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE"
  }
  if (typeof value === "bigint") {
    return String(value)
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : ""
  }
  return String(value)
}

export function normalizeCellRawInput(value: unknown): string {
  if (value == null) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }
  return String(value)
}

export function parsePlainCellDisplayValue(rawInput: string): unknown {
  const trimmed = rawInput.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true"
  }
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return rawInput
}

export function normalizeRowId(value: unknown, fallbackRowIndex: number): DataGridRowId {
  if (typeof value === "string" || typeof value === "number") {
    return value
  }
  return fallbackRowIndex + 1
}

export function makeCellKey(rowIndex: number, columnKey: string): string {
  return `${rowIndex}\u001f${columnKey}`
}

export function cloneCellAddress(address: DataGridSpreadsheetCellAddress): DataGridSpreadsheetCellAddress {
  return {
    sheetId: address.sheetId ?? null,
    rowId: address.rowId ?? null,
    rowIndex: address.rowIndex,
    columnKey: address.columnKey,
  }
}

export function resolveFormulaTargetRowIndexes(
  rowSelector: ReturnType<typeof parseDataGridFormulaIdentifier>["rowSelector"],
  currentRowIndex: number,
  rowCount: number,
): readonly number[] {
  const targetIndexes: number[] = []
  const pushRowIndex = (rowIndex: number): void => {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rowCount) {
      return
    }
    targetIndexes.push(rowIndex)
  }

  if (rowSelector.kind === "current") {
    pushRowIndex(currentRowIndex)
    return Object.freeze(targetIndexes)
  }
  if (rowSelector.kind === "absolute") {
    pushRowIndex(rowSelector.rowIndex)
    return Object.freeze(targetIndexes)
  }
  if (rowSelector.kind === "absolute-window") {
    for (let rowIndex = rowSelector.startRowIndex; rowIndex <= rowSelector.endRowIndex; rowIndex += 1) {
      pushRowIndex(rowIndex)
    }
    return Object.freeze(targetIndexes)
  }
  if (rowSelector.kind === "relative") {
    pushRowIndex(currentRowIndex + rowSelector.offset)
    return Object.freeze(targetIndexes)
  }
  const step = rowSelector.startOffset <= rowSelector.endOffset ? 1 : -1
  for (
    let offset = rowSelector.startOffset;
    step > 0 ? offset <= rowSelector.endOffset : offset >= rowSelector.endOffset;
    offset += step
  ) {
    pushRowIndex(currentRowIndex + offset)
  }
  return Object.freeze(targetIndexes)
}

export function createCellAddress(
  sheetId: string | null,
  row: SpreadsheetCellAddressRowSource,
  columnKey: string,
): DataGridSpreadsheetCellAddress {
  return {
    sheetId,
    rowId: row.id,
    rowIndex: row.rowIndex,
    columnKey,
  }
}

export function compareCellAddresses(
  left: DataGridSpreadsheetCellAddress,
  right: DataGridSpreadsheetCellAddress,
): number {
  if (left.rowIndex !== right.rowIndex) {
    return left.rowIndex - right.rowIndex
  }
  return left.columnKey.localeCompare(right.columnKey)
}
