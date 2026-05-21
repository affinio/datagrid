import type {
  DataGridRowId,
  DataGridRowNode,
  DataGridRowNodeInput,
} from "../rowModel.js"

export interface CreateClientRowRowsFacadeRuntimeOptions<T> {
  getBaseSourceRows: () => readonly DataGridRowNode<T>[]
  setRows: (nextRows: readonly DataGridRowNodeInput<T>[]) => void
  insertRowsAt: (index: number, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  insertRowsBefore: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  insertRowsAfter: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]) => boolean
}

export interface ClientRowRowsFacadeRuntime<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  replaceRows(rows: readonly DataGridRowNodeInput<T>[]): void
  appendRows(rows: readonly DataGridRowNodeInput<T>[]): void
  prependRows(rows: readonly DataGridRowNodeInput<T>[]): void
  insertRowsAt(index: number, rows: readonly DataGridRowNodeInput<T>[]): boolean
  insertRowsBefore(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]): boolean
  insertRowsAfter(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]): boolean
}

export function createClientRowRowsFacadeRuntime<T>(
  options: CreateClientRowRowsFacadeRuntimeOptions<T>,
): ClientRowRowsFacadeRuntime<T> {
  const setRows = (nextRows: readonly DataGridRowNodeInput<T>[]): void => {
    options.setRows(nextRows)
  }

  return {
    setRows,
    replaceRows: setRows,
    appendRows(nextRows) {
      if (nextRows.length === 0) {
        return
      }
      options.setRows([...options.getBaseSourceRows(), ...nextRows])
    },
    prependRows(nextRows) {
      if (nextRows.length === 0) {
        return
      }
      options.setRows([...nextRows, ...options.getBaseSourceRows()])
    },
    insertRowsAt: options.insertRowsAt,
    insertRowsBefore: options.insertRowsBefore,
    insertRowsAfter: options.insertRowsAfter,
  }
}
