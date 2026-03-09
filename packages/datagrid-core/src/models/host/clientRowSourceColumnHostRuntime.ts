import type { DataGridRowId } from "../rowModel.js"

export interface CreateClientRowSourceColumnHostRuntimeOptions {
  getBaseRowCount(): number
  getSourceRowIndexById(): ReadonlyMap<DataGridRowId, number>
  resetSourceRowsToBase(): void
  clearSourceColumnValuesCache(): void
  getSourceColumnValues(fieldInput: string): unknown[]
  invalidateSourceColumnValuesByRowIds(rowIds: readonly DataGridRowId[]): void
}

export interface DataGridClientRowSourceColumnHostRuntime {
  refreshMaterializedSourceRows(changedRowIds?: readonly DataGridRowId[]): void
  clear(): void
  getFieldValues(fieldInput: string): unknown[]
  invalidateByRowIds(rowIds: readonly DataGridRowId[]): void
}

export function createClientRowSourceColumnHostRuntime(
  options: CreateClientRowSourceColumnHostRuntimeOptions,
): DataGridClientRowSourceColumnHostRuntime {
  const refreshMaterializedSourceRows = (
    changedRowIds?: readonly DataGridRowId[],
  ): void => {
    if (!changedRowIds || changedRowIds.length === 0) {
      options.resetSourceRowsToBase()
      options.clearSourceColumnValuesCache()
      return
    }
    const sourceRowIndexById = options.getSourceRowIndexById()
    const baseRowCount = options.getBaseRowCount()
    const invalidatedRowIds: DataGridRowId[] = []
    for (const rowId of changedRowIds) {
      const rowIndex = sourceRowIndexById.get(rowId)
      if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= baseRowCount) {
        continue
      }
      invalidatedRowIds.push(rowId)
    }
    if (invalidatedRowIds.length > 0) {
      options.invalidateSourceColumnValuesByRowIds(invalidatedRowIds)
    }
  }

  return {
    refreshMaterializedSourceRows,
    clear: () => {
      options.clearSourceColumnValuesCache()
    },
    getFieldValues: (fieldInput: string) => options.getSourceColumnValues(fieldInput),
    invalidateByRowIds: (rowIds: readonly DataGridRowId[]) => {
      options.invalidateSourceColumnValuesByRowIds(rowIds)
    },
  }
}
