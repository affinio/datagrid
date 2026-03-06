import { describe, expect, it, vi } from "vitest"
import {
  DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR,
  runDataGridClientProjectionComputeStageExecutor,
  type DataGridClientProjectionComputeStageExecutor,
} from "../clientRowProjectionComputeStage"

describe("clientRowProjectionComputeStage", () => {
  it("uses default noop executor and preserves shouldRecompute flag", () => {
    const sourceById = new Map()
    expect(runDataGridClientProjectionComputeStageExecutor(
      DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR,
      { sourceById, shouldRecompute: true },
    )).toEqual({
      recomputed: true,
      refreshSourceById: false,
    })
    expect(runDataGridClientProjectionComputeStageExecutor(
      DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR,
      { sourceById, shouldRecompute: false },
    )).toEqual({
      recomputed: false,
      refreshSourceById: false,
    })
  })

  it("supports boolean-return executors", () => {
    const execute = vi.fn(() => true)
    const executor: DataGridClientProjectionComputeStageExecutor<unknown> = {
      execute,
    }
    const sourceById = new Map()
    expect(runDataGridClientProjectionComputeStageExecutor(executor, {
      sourceById,
      shouldRecompute: true,
    })).toEqual({
      recomputed: true,
      refreshSourceById: false,
    })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("normalizes structured result shape", () => {
    const execute = vi.fn(() => ({
      recomputed: true,
      refreshSourceById: true,
    }))
    const executor: DataGridClientProjectionComputeStageExecutor<unknown> = {
      execute,
    }
    const sourceById = new Map()
    expect(runDataGridClientProjectionComputeStageExecutor(executor, {
      sourceById,
      shouldRecompute: true,
    })).toEqual({
      recomputed: true,
      refreshSourceById: true,
    })
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
