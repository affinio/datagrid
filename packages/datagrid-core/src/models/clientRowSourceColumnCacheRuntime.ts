import type {
  DataGridRowId,
  DataGridRowNode,
} from "./rowModel.js"

const DATAGRID_FORMULA_COLUMN_CACHE_NO_LIMIT = Number.POSITIVE_INFINITY

export interface ClientRowSourceColumnCacheRuntimeContext<T> {
  getSourceRows: () => readonly DataGridRowNode<T>[]
  getSourceRowIndexById: () => ReadonlyMap<DataGridRowId, number>
  maxColumns?: number | null
  setCacheSize: (size: number) => void
  incrementCacheEvictions: () => void
}

export interface ClientRowSourceColumnCacheRuntime {
  clear: () => void
  getFieldValues: (fieldInput: string) => unknown[]
  invalidateByRowIds: (rowIds: readonly DataGridRowId[]) => void
}

export function createClientRowSourceColumnCacheRuntime<T>(
  context: ClientRowSourceColumnCacheRuntimeContext<T>,
): ClientRowSourceColumnCacheRuntime {
  const sourceColumnValuesByField = new Map<string, unknown[]>()
  const sourceColumnCacheAccessTickByField = new Map<string, number>()
  const maxColumns = typeof context.maxColumns === "number"
    ? context.maxColumns
    : DATAGRID_FORMULA_COLUMN_CACHE_NO_LIMIT
  let sourceColumnCacheAccessTick = 0

  const clear = (): void => {
    sourceColumnValuesByField.clear()
    sourceColumnCacheAccessTickByField.clear()
    sourceColumnCacheAccessTick = 0
    context.setCacheSize(0)
  }

  const touchField = (field: string): void => {
    sourceColumnCacheAccessTick += 1
    sourceColumnCacheAccessTickByField.set(field, sourceColumnCacheAccessTick)
  }

  const evictLeastRecentlyUsedField = (): boolean => {
    if (sourceColumnValuesByField.size === 0) {
      return false
    }
    let evictionField: string | null = null
    let evictionTick = Number.POSITIVE_INFINITY
    for (const [field, tick] of sourceColumnCacheAccessTickByField) {
      if (!sourceColumnValuesByField.has(field)) {
        continue
      }
      if (tick < evictionTick) {
        evictionTick = tick
        evictionField = field
      }
    }
    if (!evictionField) {
      const firstField = sourceColumnValuesByField.keys().next().value
      if (typeof firstField !== "string") {
        return false
      }
      evictionField = firstField
    }
    sourceColumnValuesByField.delete(evictionField)
    sourceColumnCacheAccessTickByField.delete(evictionField)
    context.incrementCacheEvictions()
    context.setCacheSize(sourceColumnValuesByField.size)
    return true
  }

  const getFieldValues = (fieldInput: string): unknown[] => {
    const field = fieldInput.trim()
    if (field.length === 0) {
      return []
    }
    let values = sourceColumnValuesByField.get(field)
    if (!values) {
      if (Number.isFinite(maxColumns)) {
        while (sourceColumnValuesByField.size >= maxColumns) {
          if (!evictLeastRecentlyUsedField()) {
            break
          }
        }
      }
      values = []
      sourceColumnValuesByField.set(field, values)
      context.setCacheSize(sourceColumnValuesByField.size)
    }
    touchField(field)
    return values
  }

  const invalidateByRowIds = (rowIds: readonly DataGridRowId[]): void => {
    if (sourceColumnValuesByField.size === 0 || rowIds.length === 0) {
      return
    }
    const sourceRowIndexById = context.getSourceRowIndexById()
    const rowIndexes: number[] = []
    for (const rowId of rowIds) {
      const rowIndex = sourceRowIndexById.get(rowId)
      if (typeof rowIndex !== "number" || rowIndex < 0) {
        continue
      }
      rowIndexes.push(rowIndex)
    }
    if (rowIndexes.length === 0) {
      return
    }
    if (rowIndexes.length >= Math.max(1, Math.trunc(context.getSourceRows().length / 2))) {
      clear()
      return
    }
    for (const values of sourceColumnValuesByField.values()) {
      for (const rowIndex of rowIndexes) {
        delete values[rowIndex]
      }
    }
  }

  return {
    clear,
    getFieldValues,
    invalidateByRowIds,
  }
}
