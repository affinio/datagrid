import type { DataGridRowId } from "../models/rowModel.js"
import type { DataGridSpreadsheetCellAddress } from "./formulaEditorModel.js"
import {
  createCellAddress,
  makeCellKey,
  normalizeRowId,
} from "./spreadsheetCellRuntime.js"
import {
  normalizeColumnFormulaAlias,
  normalizeColumnKey,
  normalizeColumnTitle,
} from "./spreadsheetReferenceRuntime.js"
import { normalizeSpreadsheetStyle } from "./spreadsheetStyleRuntime.js"
import type {
  DataGridSpreadsheetColumnInput,
  DataGridSpreadsheetRowInput,
  DataGridSpreadsheetStyle,
} from "./sheetModel.js"

export interface SpreadsheetColumnState {
  key: string
  title: string
  formulaAlias: string
  style: DataGridSpreadsheetStyle | null
}

export interface SpreadsheetRowState {
  id: DataGridRowId
  rowIndex: number
  style: DataGridSpreadsheetStyle | null
  resolvedValues: unknown[]
}

export interface SpreadsheetSheetStateRuntime {
  columns: SpreadsheetColumnState[]
  rows: SpreadsheetRowState[]
  columnIndexByKey: Map<string, number>
  rowIndexById: Map<DataGridRowId, number>
  createResolvedValues(): unknown[]
  createRowState(
    rowInput: DataGridSpreadsheetRowInput | null | undefined,
    rowIndex: number,
    reservedRowIds?: Pick<ReadonlySet<DataGridRowId>, "has">,
  ): SpreadsheetRowState
  createResolvedRowData(row: SpreadsheetRowState): Record<string, unknown>
  getResolvedCellValue(row: SpreadsheetRowState | null | undefined, columnKey: string): unknown
  setResolvedCellValueOnRow(
    row: SpreadsheetRowState | null | undefined,
    columnKey: string,
    value: unknown,
  ): boolean
  rebuildRowIndexState(): void
  resolveCellKey(cell: DataGridSpreadsheetCellAddress): string
  resolveAddressFromCellKey(sheetId: string | null, cellKey: string): DataGridSpreadsheetCellAddress | null
  setNextSyntheticRowId(value: number): void
}

export function createSpreadsheetSheetStateRuntime(options: {
  columns: readonly DataGridSpreadsheetColumnInput[]
  rows?: readonly DataGridSpreadsheetRowInput[]
}): SpreadsheetSheetStateRuntime {
  const columns: SpreadsheetColumnState[] = []
  const columnIndexByKey = new Map<string, number>()
  for (const column of options.columns ?? []) {
    const key = normalizeColumnKey(column.key)
    const title = normalizeColumnTitle(column.title, key)
    if (columnIndexByKey.has(key)) {
      throw new Error(`[DataGridSpreadsheetSheet] duplicate column key '${key}'.`)
    }
    columnIndexByKey.set(key, columns.length)
    columns.push({
      key,
      title,
      formulaAlias: normalizeColumnFormulaAlias(column.formulaAlias, title),
      style: normalizeSpreadsheetStyle(column.style),
    })
  }
  if (columns.length === 0) {
    throw new Error("[DataGridSpreadsheetSheet] columns must be non-empty.")
  }

  const createResolvedValues = (): unknown[] => Array.from({ length: columns.length }, () => null)
  const rows: SpreadsheetRowState[] = []
  const rowIndexById = new Map<DataGridRowId, number>()
  for (let rowIndex = 0; rowIndex < (options.rows?.length ?? 0); rowIndex += 1) {
    const rowInput = options.rows?.[rowIndex] ?? {}
    const rowId = normalizeRowId(rowInput.id, rowIndex)
    if (rowIndexById.has(rowId)) {
      throw new Error(`[DataGridSpreadsheetSheet] duplicate row id '${String(rowId)}'.`)
    }
    rowIndexById.set(rowId, rowIndex)
    rows.push({
      id: rowId,
      rowIndex,
      style: normalizeSpreadsheetStyle(rowInput.style),
      resolvedValues: createResolvedValues(),
    })
  }
  let nextSyntheticRowId = rows.length + 1

  function createUniqueRowId(
    rowInput: DataGridSpreadsheetRowInput | null | undefined,
    reservedRowIds: Pick<ReadonlySet<DataGridRowId>, "has"> = rowIndexById,
  ): DataGridRowId {
    if (typeof rowInput?.id === "string" || typeof rowInput?.id === "number") {
      if (reservedRowIds.has(rowInput.id)) {
        throw new Error(`[DataGridSpreadsheetSheet] duplicate row id '${String(rowInput.id)}'.`)
      }
      return rowInput.id
    }
    while (reservedRowIds.has(`row-${nextSyntheticRowId}`) || reservedRowIds.has(nextSyntheticRowId)) {
      nextSyntheticRowId += 1
    }
    const rowId = `row-${nextSyntheticRowId}`
    nextSyntheticRowId += 1
    return rowId
  }

  return {
    columns,
    rows,
    columnIndexByKey,
    rowIndexById,
    createResolvedValues,
    createRowState(rowInput, rowIndex, reservedRowIds = rowIndexById) {
      const rowId = createUniqueRowId(rowInput, reservedRowIds)
      return {
        id: rowId,
        rowIndex,
        style: normalizeSpreadsheetStyle(rowInput?.style),
        resolvedValues: createResolvedValues(),
      }
    },
    createResolvedRowData(row) {
      const resolvedData = Object.create(null) as Record<string, unknown>
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const column = columns[columnIndex]
        if (!column) {
          continue
        }
        resolvedData[column.key] = row.resolvedValues[columnIndex] ?? null
      }
      return resolvedData
    },
    getResolvedCellValue(row, columnKey) {
      if (!row) {
        return null
      }
      const columnIndex = columnIndexByKey.get(columnKey)
      if (typeof columnIndex !== "number") {
        return null
      }
      return row.resolvedValues[columnIndex] ?? null
    },
    setResolvedCellValueOnRow(row, columnKey, value) {
      if (!row) {
        return false
      }
      const columnIndex = columnIndexByKey.get(columnKey)
      if (typeof columnIndex !== "number") {
        return false
      }
      const previousValue = row.resolvedValues[columnIndex]
      if (Object.is(previousValue, value)) {
        return false
      }
      row.resolvedValues[columnIndex] = value
      return true
    },
    rebuildRowIndexState() {
      rowIndexById.clear()
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]
        if (!row) {
          continue
        }
        row.rowIndex = rowIndex
        rowIndexById.set(row.id, rowIndex)
      }
    },
    resolveCellKey(cell) {
      const rowIndex = Math.trunc(cell.rowIndex)
      const columnKey = normalizeColumnKey(cell.columnKey)
      if (!Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= rows.length) {
        throw new Error(`[DataGridSpreadsheetSheet] rowIndex '${String(cell.rowIndex)}' is out of bounds.`)
      }
      if (!columnIndexByKey.has(columnKey)) {
        throw new Error(`[DataGridSpreadsheetSheet] unknown column '${columnKey}'.`)
      }
      return makeCellKey(rowIndex, columnKey)
    },
    resolveAddressFromCellKey(sheetId, cellKey) {
      const separatorIndex = cellKey.indexOf("\u001f")
      if (separatorIndex < 0) {
        return null
      }
      const rowIndex = Number(cellKey.slice(0, separatorIndex))
      const row = rows[rowIndex]
      if (!row) {
        return null
      }
      const columnKey = cellKey.slice(separatorIndex + 1)
      return createCellAddress(sheetId, row, columnKey)
    },
    setNextSyntheticRowId(value) {
      nextSyntheticRowId = value
    },
  }
}
