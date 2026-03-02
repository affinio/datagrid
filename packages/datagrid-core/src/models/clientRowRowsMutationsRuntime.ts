import type { DataGridRowId, DataGridRowNode, DataGridRowNodeInput } from "./rowModel.js"

export interface ClientRowRowsMutationsRuntimeContext<T> {
  ensureActive: () => void
  emit: () => void
  recomputeFromFilterStage: () => void
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
}

export function createClientRowRowsMutationsRuntime<T>(
  context: ClientRowRowsMutationsRuntimeContext<T>,
): ClientRowRowsMutationsRuntime<T> {
  return {
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      context.ensureActive()
      const nextSourceRows = context.normalizeSourceRows(nextRows ?? [])
      context.setRowVersionById(
        context.rebuildRowVersionIndex(context.getRowVersionById(), nextSourceRows),
      )
      context.setSourceRows(nextSourceRows)
      context.pruneSortCacheRows(nextSourceRows)
      context.bumpRowRevision()
      context.resetGroupByIncrementalAggregationState()
      context.invalidateTreeProjectionCaches()
      context.recomputeFromFilterStage()
      context.emit()
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
      context.setSourceRows(context.reindexSourceRows(rows))
      context.bumpRowRevision()
      context.invalidateTreeProjectionCaches()
      context.recomputeFromFilterStage()
      context.emit()
      return true
    },
  }
}
