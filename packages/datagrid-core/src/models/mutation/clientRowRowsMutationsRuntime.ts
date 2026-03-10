import type {
  DataGridProjectionInvalidationReason,
  DataGridRowId,
  DataGridRowNode,
  DataGridRowNodeInput,
} from "../rowModel.js"
import { findDuplicateRowIds } from "../clientRowModelHelpers.js"

export interface ClientRowRowsMutationsRuntimeContext<T> {
  ensureActive: () => void
  emit: () => void
  recomputeFromProjectionEntryStage: () => void
  applyComputedFields?: () => void
  setProjectionInvalidation: (reasons: readonly DataGridProjectionInvalidationReason[]) => void
  bumpRowRevision: () => void
  resetGroupByIncrementalAggregationState: () => void
  invalidateTreeProjectionCaches: () => void

  getSourceRows: () => readonly DataGridRowNode<T>[]
  setSourceRows: (rows: DataGridRowNode<T>[]) => void

  normalizeSourceRows: (inputRows: readonly DataGridRowNodeInput<T>[] | null | undefined) => DataGridRowNode<T>[]
  reindexSourceRows: (rows: readonly DataGridRowNode<T>[]) => DataGridRowNode<T>[]

  getRowVersionById: () => Map<DataGridRowId, number>
  setRowVersionById: (index: Map<DataGridRowId, number>) => void
  rebuildRowVersionIndex: (
    previous: Map<DataGridRowId, number>,
    rows: readonly DataGridRowNode<T>[],
  ) => Map<DataGridRowId, number>
  pruneSortCacheRows: (rows: readonly DataGridRowNode<T>[]) => void
}

export interface ClientRowRowsMutationsRuntimeReorderInput {
  fromIndex: number
  toIndex: number
  count?: number
}

export interface ClientRowRowsMutationsRuntime<T> {
  setRows: (nextRows: readonly DataGridRowNodeInput<T>[]) => void
  reorderRows: (input: ClientRowRowsMutationsRuntimeReorderInput) => boolean
  insertRowsAt: (index: number, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  insertRowsBefore: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  insertRowsAfter: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]) => boolean
}

export function createClientRowRowsMutationsRuntime<T>(
  context: ClientRowRowsMutationsRuntimeContext<T>,
): ClientRowRowsMutationsRuntime<T> {
  const commitSourceRows = (nextSourceRows: readonly DataGridRowNode<T>[]): void => {
    const duplicateRowIds = findDuplicateRowIds(nextSourceRows)
    if (duplicateRowIds.length > 0) {
      throw new Error(
        `[DataGridRows] Duplicate rowId detected (${duplicateRowIds.map(value => String(value)).join(", ")}).`,
      )
    }
    context.setRowVersionById(
      context.rebuildRowVersionIndex(context.getRowVersionById(), nextSourceRows),
    )
    context.setSourceRows(context.reindexSourceRows(nextSourceRows))
    context.applyComputedFields?.()
    context.pruneSortCacheRows(nextSourceRows)
    context.bumpRowRevision()
    context.resetGroupByIncrementalAggregationState()
    context.invalidateTreeProjectionCaches()
    context.setProjectionInvalidation(["rowsChanged"])
    context.recomputeFromProjectionEntryStage()
    context.emit()
  }

  const insertRowsAt = (index: number, rows: readonly DataGridRowNodeInput<T>[]): boolean => {
    context.ensureActive()
    const normalizedRows = context.normalizeSourceRows(rows ?? [])
    if (normalizedRows.length === 0) {
      return false
    }
    const sourceRows = context.getSourceRows()
    const nextRows = sourceRows.slice()
    const safeIndex = Number.isFinite(index)
      ? Math.max(0, Math.min(nextRows.length, Math.trunc(index)))
      : nextRows.length
    nextRows.splice(safeIndex, 0, ...normalizedRows)
    commitSourceRows(nextRows)
    return true
  }

  return {
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      context.ensureActive()
      const nextSourceRows = context.normalizeSourceRows(nextRows ?? [])
      commitSourceRows(nextSourceRows)
    },
    reorderRows(input: ClientRowRowsMutationsRuntimeReorderInput): boolean {
      context.ensureActive()
      const sourceRows = context.getSourceRows()
      const length = sourceRows.length
      if (length <= 1) {
        return false
      }
      if (!Number.isFinite(input.fromIndex) || !Number.isFinite(input.toIndex)) {
        return false
      }
      const fromIndex = Math.max(0, Math.min(length - 1, Math.trunc(input.fromIndex)))
      const count = Number.isFinite(input.count) ? Math.max(1, Math.trunc(input.count as number)) : 1
      const maxCount = Math.max(1, Math.min(count, length - fromIndex))
      const toIndexRaw = Math.max(0, Math.min(length, Math.trunc(input.toIndex)))
      const rows = sourceRows.slice()
      const moved = rows.splice(fromIndex, maxCount)
      if (moved.length === 0) {
        return false
      }
      const adjustedTarget = toIndexRaw > fromIndex ? Math.max(0, toIndexRaw - moved.length) : toIndexRaw
      rows.splice(adjustedTarget, 0, ...moved)
      commitSourceRows(rows)
      return true
    },
    insertRowsAt,
    insertRowsBefore(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]): boolean {
      context.ensureActive()
      const sourceRows = context.getSourceRows()
      const targetIndex = sourceRows.findIndex(row => row.rowId === rowId)
      if (targetIndex < 0) {
        return false
      }
      return insertRowsAt(targetIndex, rows)
    },
    insertRowsAfter(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]): boolean {
      context.ensureActive()
      const sourceRows = context.getSourceRows()
      const targetIndex = sourceRows.findIndex(row => row.rowId === rowId)
      if (targetIndex < 0) {
        return false
      }
      return insertRowsAt(targetIndex + 1, rows)
    },
  }
}
