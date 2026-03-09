import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"

export interface DataGridClientProjectionComputeStageExecutionContext<TRow = unknown> {
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<TRow>>
  shouldRecompute: boolean
}

export interface DataGridClientProjectionComputeStageExecutionResult {
  recomputed: boolean
  refreshSourceById?: boolean
}

export interface DataGridClientProjectionComputeStageExecutor<TRow = unknown> {
  execute: (
    context: DataGridClientProjectionComputeStageExecutionContext<TRow>,
  ) => DataGridClientProjectionComputeStageExecutionResult | boolean
}

export const DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR: DataGridClientProjectionComputeStageExecutor<unknown> = {
  execute(context) {
    return {
      recomputed: context.shouldRecompute,
    }
  },
}

export function runDataGridClientProjectionComputeStageExecutor<TRow>(
  executor: DataGridClientProjectionComputeStageExecutor<TRow>,
  context: DataGridClientProjectionComputeStageExecutionContext<TRow>,
): DataGridClientProjectionComputeStageExecutionResult {
  const executionResult = executor.execute(context)
  if (typeof executionResult === "boolean") {
    return {
      recomputed: executionResult,
      refreshSourceById: false,
    }
  }
  return {
    recomputed: executionResult.recomputed === true,
    refreshSourceById: executionResult.refreshSourceById === true,
  }
}
