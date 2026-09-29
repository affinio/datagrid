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
  reindexSourceRows: (rows: readonly DataGridRowNode<T>[], fromIndex?: number) => DataGridRowNode<T>[]

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
  batchMutations<TResult>(fn: () => TResult): TResult
  setRows: (nextRows: readonly DataGridRowNodeInput<T>[]) => void
  appendRows: (rows: readonly DataGridRowNodeInput<T>[]) => void
  prependRows: (rows: readonly DataGridRowNodeInput<T>[]) => void
  removeRows: (rowIds: readonly DataGridRowId[]) => boolean
  reorderRows: (input: ClientRowRowsMutationsRuntimeReorderInput) => boolean
  insertRowsAt: (index: number, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  insertRowsBefore: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  insertRowsAfter: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]) => boolean
}

export function createClientRowRowsMutationsRuntime<T>(
  context: ClientRowRowsMutationsRuntimeContext<T>,
): ClientRowRowsMutationsRuntime<T> {
  let mutationBatchDepth = 0
  let pendingMutation = false

  const finalizeMutation = (): void => {
    context.applyComputedFields?.()
    context.bumpRowRevision()
    context.resetGroupByIncrementalAggregationState()
    context.invalidateTreeProjectionCaches()
    context.setProjectionInvalidation(["rowsChanged"])
    context.recomputeFromProjectionEntryStage()
    context.emit()
  }

  const commitSourceRows = (
    nextSourceRows: readonly DataGridRowNode<T>[],
    reindexFromIndex = 0,
  ): void => {
    const duplicateRowIds = findDuplicateRowIds(nextSourceRows)
    if (duplicateRowIds.length > 0) {
      throw new Error(
        `[DataGridRows] Duplicate rowId detected (${duplicateRowIds.map(value => String(value)).join(", ")}).`,
      )
    }
    context.setRowVersionById(
      context.rebuildRowVersionIndex(context.getRowVersionById(), nextSourceRows),
    )
    context.setSourceRows(context.reindexSourceRows(nextSourceRows, reindexFromIndex))
    context.pruneSortCacheRows(nextSourceRows)
    if (mutationBatchDepth > 0) {
      pendingMutation = true
      return
    }
    finalizeMutation()
  }

  const insertRowsAt = (index: number, rows: readonly DataGridRowNodeInput<T>[]): boolean => {
    context.ensureActive()
    const normalizedRows = context.normalizeSourceRows(rows ?? [])
    if (normalizedRows.length === 0) {
      return false
    }
    const sourceRows = context.getSourceRows()
    const safeIndex = Number.isFinite(index)
      ? Math.max(0, Math.min(sourceRows.length, Math.trunc(index)))
      : sourceRows.length
    const nextRows = sourceRows.slice(0, safeIndex).concat(normalizedRows, sourceRows.slice(safeIndex))
    commitSourceRows(nextRows, safeIndex)
    return true
  }

  return {
    batchMutations<TResult>(fn: () => TResult): TResult {
      context.ensureActive()
      mutationBatchDepth += 1
      try {
        return fn()
      } finally {
        mutationBatchDepth = Math.max(0, mutationBatchDepth - 1)
        if (mutationBatchDepth === 0 && pendingMutation) {
          pendingMutation = false
          finalizeMutation()
        }
      }
    },
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      context.ensureActive()
      const nextSourceRows = context.normalizeSourceRows(nextRows ?? [])
      commitSourceRows(nextSourceRows)
    },
    appendRows(rows: readonly DataGridRowNodeInput<T>[]) {
      context.ensureActive()
      const normalizedRows = context.normalizeSourceRows(rows ?? [])
      if (normalizedRows.length === 0) {
        return
      }
      const sourceRows = context.getSourceRows()
      commitSourceRows(sourceRows.concat(normalizedRows), sourceRows.length)
    },
    prependRows(rows: readonly DataGridRowNodeInput<T>[]) {
      context.ensureActive()
      const normalizedRows = context.normalizeSourceRows(rows ?? [])
      if (normalizedRows.length === 0) {
        return
      }
      commitSourceRows(normalizedRows.concat(context.getSourceRows()))
    },
    removeRows(rowIds: readonly DataGridRowId[]): boolean {
      context.ensureActive()
      if (!Array.isArray(rowIds) || rowIds.length === 0) {
        return false
      }
      const ids = new Set(rowIds)
      const sourceRows = context.getSourceRows()
      const nextRows = sourceRows.filter(row => !ids.has(row.rowId))
      if (nextRows.length === sourceRows.length) {
        return false
      }
      const firstRemovedIndex = sourceRows.reduce((firstIndex, row, index) => (
        ids.has(row.rowId) ? Math.min(firstIndex, index) : firstIndex
      ), sourceRows.length)
      commitSourceRows(nextRows, firstRemovedIndex)
      return true
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
      const reorderedRows = rows.slice(0, adjustedTarget).concat(moved, rows.slice(adjustedTarget))
      commitSourceRows(reorderedRows)
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
