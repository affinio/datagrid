import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"

export interface CreateClientRowSourceStateRuntimeOptions<T> {
  baseSourceRows: DataGridRowNode<T>[]
  sourceRows: readonly DataGridRowNode<T>[]
  sourceRowIndexById: ReadonlyMap<DataGridRowId, number>
  buildSourceRowIndexById: (rows: readonly DataGridRowNode<T>[]) => ReadonlyMap<DataGridRowId, number>
}

export interface ClientRowSourceStateRuntime<T> {
  getBaseSourceRows(): DataGridRowNode<T>[]
  setBaseSourceRows(rows: DataGridRowNode<T>[]): void
  getSourceRows(): readonly DataGridRowNode<T>[]
  setSourceRows(rows: readonly DataGridRowNode<T>[]): void
  resetSourceRowsToBase(): void
  clearSourceRows(): void
  getSourceRowIndexById(): ReadonlyMap<DataGridRowId, number>
  setSourceRowIndexById(index: ReadonlyMap<DataGridRowId, number>): void
  rebuildSourceRowIndexByIdFromBase(): void
}

export function createClientRowSourceStateRuntime<T>(
  options: CreateClientRowSourceStateRuntimeOptions<T>,
): ClientRowSourceStateRuntime<T> {
  let baseSourceRows = options.baseSourceRows
  let sourceRows = options.sourceRows
  let sourceRowIndexById = options.sourceRowIndexById

  return {
    getBaseSourceRows() {
      return baseSourceRows
    },
    setBaseSourceRows(rows) {
      baseSourceRows = rows
    },
    getSourceRows() {
      return sourceRows
    },
    setSourceRows(rows) {
      sourceRows = rows
    },
    resetSourceRowsToBase() {
      sourceRows = baseSourceRows
      sourceRowIndexById = options.buildSourceRowIndexById(baseSourceRows)
    },
    clearSourceRows() {
      sourceRows = []
    },
    getSourceRowIndexById() {
      return sourceRowIndexById
    },
    setSourceRowIndexById(index) {
      sourceRowIndexById = index
    },
    rebuildSourceRowIndexByIdFromBase() {
      sourceRowIndexById = options.buildSourceRowIndexById(baseSourceRows)
    },
  }
}
