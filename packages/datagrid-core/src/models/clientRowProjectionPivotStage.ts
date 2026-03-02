import { preservePivotProjectionRowIdentity } from "./clientRowPivotProjectionUtils.js"
import type { DataGridPivotColumn, DataGridPivotSpec, DataGridRowNode } from "./rowModel.js"
import type { DataGridPivotIncrementalPatchRow, DataGridPivotRuntime } from "./pivotRuntime.js"

export interface RunPivotProjectionStageParams<T> {
  pivotModel: DataGridPivotSpec | null
  shouldRecompute: boolean
  previousPivotedRowsProjection: readonly DataGridRowNode<T>[]
  previousPivotColumns: readonly DataGridPivotColumn[]
  groupedRowsProjection: readonly DataGridRowNode<T>[]
  pendingValuePatchRows: readonly DataGridPivotIncrementalPatchRow<T>[] | null
  pivotRuntime: DataGridPivotRuntime<T>
  normalizeFieldValue: (value: unknown) => string
  expansionSnapshot: Parameters<DataGridPivotRuntime<T>["projectRows"]>[0]["expansionSnapshot"]
}

export interface RunPivotProjectionStageResult<T> {
  pivotedRowsProjection: DataGridRowNode<T>[]
  pivotColumns: DataGridPivotColumn[]
  recomputed: boolean
}

export function runPivotProjectionStage<T>(
  params: RunPivotProjectionStageParams<T>,
): RunPivotProjectionStageResult<T> {
  if (!params.pivotModel) {
    const shouldRecomputePivot = params.shouldRecompute || params.previousPivotedRowsProjection.length === 0
    return {
      pivotedRowsProjection: params.groupedRowsProjection as DataGridRowNode<T>[],
      pivotColumns: [],
      recomputed: shouldRecomputePivot,
    }
  }

  const shouldRecomputePivot = params.shouldRecompute || params.previousPivotedRowsProjection.length === 0
  if (!shouldRecomputePivot) {
    return {
      pivotedRowsProjection: params.previousPivotedRowsProjection as DataGridRowNode<T>[],
      pivotColumns: params.previousPivotColumns as DataGridPivotColumn[],
      recomputed: false,
    }
  }

  if (params.pendingValuePatchRows && params.previousPivotedRowsProjection.length > 0) {
    const patchedProjection = params.pivotRuntime.applyValueOnlyPatch({
      projectedRows: params.previousPivotedRowsProjection,
      pivotModel: params.pivotModel,
      changedRows: params.pendingValuePatchRows,
    })
    if (patchedProjection) {
      return {
        pivotedRowsProjection: preservePivotProjectionRowIdentity(
          params.previousPivotedRowsProjection,
          patchedProjection.rows,
        ),
        pivotColumns: params.pivotRuntime.normalizeColumns(patchedProjection.columns),
        recomputed: true,
      }
    }
  }

  const pivotProjection = params.pivotRuntime.projectRows({
    inputRows: params.groupedRowsProjection,
    pivotModel: params.pivotModel,
    normalizeFieldValue: params.normalizeFieldValue,
    expansionSnapshot: params.expansionSnapshot,
  })
  return {
    pivotedRowsProjection: preservePivotProjectionRowIdentity(
      params.previousPivotedRowsProjection,
      pivotProjection.rows,
    ),
    pivotColumns: params.pivotRuntime.normalizeColumns(pivotProjection.columns),
    recomputed: true,
  }
}
