import { makeCellKey } from "./spreadsheetCellRuntime.js"
import type { DataGridSpreadsheetStyle } from "./sheetModel.js"

export interface SpreadsheetCellStoreRuntimeOptions {
  rawInputByRowIndex: Array<Map<string, string>>
  cellStyleByRowIndex: Array<Map<string, DataGridSpreadsheetStyle>>
}

export interface SpreadsheetCellStoreRuntime {
  getRawInput(rowIndex: number, columnKey: string): string | undefined
  hasRawInput(rowIndex: number, columnKey: string): boolean
  setRawInput(rowIndex: number, columnKey: string, rawInput: string): void
  deleteRawInput(rowIndex: number, columnKey: string): void
  iterateRawInputs(): IterableIterator<[string, string]>
  getCellStyle(rowIndex: number, columnKey: string): DataGridSpreadsheetStyle | undefined
  setCellStyle(rowIndex: number, columnKey: string, style: DataGridSpreadsheetStyle): void
  deleteCellStyle(rowIndex: number, columnKey: string): void
}

export function createSpreadsheetCellStoreRuntime(
  options: SpreadsheetCellStoreRuntimeOptions,
): SpreadsheetCellStoreRuntime {
  const { rawInputByRowIndex, cellStyleByRowIndex } = options

  return {
    getRawInput(rowIndex, columnKey) {
      return rawInputByRowIndex[rowIndex]?.get(columnKey)
    },
    hasRawInput(rowIndex, columnKey) {
      return rawInputByRowIndex[rowIndex]?.has(columnKey) ?? false
    },
    setRawInput(rowIndex, columnKey, rawInput) {
      let rowInputs = rawInputByRowIndex[rowIndex]
      if (!rowInputs) {
        rowInputs = new Map()
        rawInputByRowIndex[rowIndex] = rowInputs
      }
      rowInputs.set(columnKey, rawInput)
    },
    deleteRawInput(rowIndex, columnKey) {
      rawInputByRowIndex[rowIndex]?.delete(columnKey)
    },
    iterateRawInputs() {
      return (function* (): IterableIterator<[string, string]> {
        for (let rowIndex = 0; rowIndex < rawInputByRowIndex.length; rowIndex += 1) {
          const rowInputs = rawInputByRowIndex[rowIndex]
          if (!rowInputs) {
            continue
          }
          for (const [columnKey, rawInput] of rowInputs.entries()) {
            yield [makeCellKey(rowIndex, columnKey), rawInput]
          }
        }
      })()
    },
    getCellStyle(rowIndex, columnKey) {
      return cellStyleByRowIndex[rowIndex]?.get(columnKey)
    },
    setCellStyle(rowIndex, columnKey, style) {
      let rowStyles = cellStyleByRowIndex[rowIndex]
      if (!rowStyles) {
        rowStyles = new Map()
        cellStyleByRowIndex[rowIndex] = rowStyles
      }
      rowStyles.set(columnKey, style)
    },
    deleteCellStyle(rowIndex, columnKey) {
      cellStyleByRowIndex[rowIndex]?.delete(columnKey)
    },
  }
}
