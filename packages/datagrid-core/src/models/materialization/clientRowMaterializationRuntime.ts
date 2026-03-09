// Effective row materialization and read-path ownership. This runtime keeps the
// base rows plus computed overlay view coherent without forcing the main host to
// manage row reconstruction inline.
import type {
  DataGridRowId,
  DataGridRowNode,
} from "../rowModel.js"
import { buildRowIdPositionIndex } from "../clientRowRuntimeUtils.js"
import { createCompiledDataGridRowDataReader } from "../compute/clientRowComputedRegistryTokenResolverRuntime.js"

export interface CreateClientRowMaterializationRuntimeOptions<T> {
  getBaseSourceRows(): readonly DataGridRowNode<T>[]
  getSourceRowIndexById(): ReadonlyMap<DataGridRowId, number>
  setSourceRows(rows: readonly DataGridRowNode<T>[]): void
  setSourceRowIndexById(index: ReadonlyMap<DataGridRowId, number>): void
  clearSourceColumnValuesCache(): void
  invalidateSourceColumnValuesByRowIds(rowIds: readonly DataGridRowId[]): void
  materializeRow(rowNode: DataGridRowNode<T>): DataGridRowNode<T>
  readMaterializedFieldValue(
    row: DataGridRowNode<T>,
    field: string,
    readBaseValue: (rowNode: DataGridRowNode<T>) => unknown,
  ): unknown
}

export interface DataGridClientRowMaterializationRuntime<T> {
  refreshMaterializedSourceRows(changedRowIds?: readonly DataGridRowId[]): void
  materializeBaseRowAtIndex(rowIndex: number): DataGridRowNode<T> | undefined
  materializeOutputRow(rowNode: DataGridRowNode<T> | undefined): DataGridRowNode<T> | undefined
  materializeOutputRows(rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[]
  materializeOutputRowsInRange(
    rows: readonly DataGridRowNode<T>[],
    start: number,
    end: number,
  ): DataGridRowNode<T>[]
  readProjectionRowField(row: DataGridRowNode<T>, key: string, field?: string): unknown
}

export function createClientRowMaterializationRuntime<T>(
  options: CreateClientRowMaterializationRuntimeOptions<T>,
): DataGridClientRowMaterializationRuntime<T> {
  const projectionRowFieldReaderCache = new Map<string, (row: DataGridRowNode<T>) => unknown>()

  const refreshMaterializedSourceRows = (
    changedRowIds?: readonly DataGridRowId[],
  ): void => {
    if (!changedRowIds || changedRowIds.length === 0) {
      const baseSourceRows = options.getBaseSourceRows()
      options.setSourceRows(baseSourceRows)
      options.setSourceRowIndexById(buildRowIdPositionIndex(baseSourceRows))
      options.clearSourceColumnValuesCache()
      return
    }
    const sourceRowIndexById = options.getSourceRowIndexById()
    const invalidatedRowIds: DataGridRowId[] = []
    for (const rowId of changedRowIds) {
      const rowIndex = sourceRowIndexById.get(rowId)
      if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= options.getBaseSourceRows().length) {
        continue
      }
      invalidatedRowIds.push(rowId)
    }
    if (invalidatedRowIds.length > 0) {
      options.invalidateSourceColumnValuesByRowIds(invalidatedRowIds)
    }
  }

  const materializeBaseRowAtIndex = (rowIndex: number): DataGridRowNode<T> | undefined => {
    const baseSourceRows = options.getBaseSourceRows()
    if (rowIndex < 0 || rowIndex >= baseSourceRows.length) {
      return undefined
    }
    const baseRow = baseSourceRows[rowIndex]
    return baseRow ? options.materializeRow(baseRow) : undefined
  }

  const materializeOutputRow = (
    rowNode: DataGridRowNode<T> | undefined,
  ): DataGridRowNode<T> | undefined => {
    if (!rowNode || rowNode.kind !== "leaf") {
      return rowNode
    }
    return options.materializeRow(rowNode)
  }

  const materializeOutputRows = (rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] => {
    const materializedRows = new Array<DataGridRowNode<T>>(rows.length)
    for (let index = 0; index < rows.length; index += 1) {
      materializedRows[index] = materializeOutputRow(rows[index]) as DataGridRowNode<T>
    }
    return materializedRows
  }

  const materializeOutputRowsInRange = (
    rows: readonly DataGridRowNode<T>[],
    start: number,
    end: number,
  ): DataGridRowNode<T>[] => {
    if (end < start) {
      return []
    }
    const length = end - start + 1
    const materializedRows = new Array<DataGridRowNode<T>>(length)
    let outputIndex = 0
    for (let index = start; index <= end; index += 1) {
      materializedRows[outputIndex] = materializeOutputRow(rows[index]) as DataGridRowNode<T>
      outputIndex += 1
    }
    return materializedRows
  }

  const readProjectionRowField = (row: DataGridRowNode<T>, key: string, field?: string): unknown => {
    const resolvedField = field && field.trim().length > 0 ? field : key
    if (!resolvedField) {
      return undefined
    }
    let reader = projectionRowFieldReaderCache.get(resolvedField)
    if (!reader) {
      const readDataValue = createCompiledDataGridRowDataReader(resolvedField)
      reader = (rowNode: DataGridRowNode<T>): unknown => readDataValue(rowNode.data as unknown)
      projectionRowFieldReaderCache.set(resolvedField, reader)
    }
    return options.readMaterializedFieldValue(row, resolvedField, reader)
  }

  return {
    refreshMaterializedSourceRows,
    materializeBaseRowAtIndex,
    materializeOutputRow,
    materializeOutputRows,
    materializeOutputRowsInRange,
    readProjectionRowField,
  }
}
