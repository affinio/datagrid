import type { DataGridClientProjectionComputeStageExecutor } from "./clientRowProjectionComputeStage.js"
import { DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR } from "./clientRowProjectionComputeStage.js"

export interface DataGridClientComputeModule<T> {
  id: string
  getProjectionComputeStageExecutor?: () => DataGridClientProjectionComputeStageExecutor<T> | null
}

export interface CreateClientRowComputeModuleHostOptions<T> {
  getModules: () => readonly DataGridClientComputeModule<T>[]
}

export interface DataGridClientComputeModuleHost<T> {
  getModules: () => readonly DataGridClientComputeModule<T>[]
  getProjectionComputeStageExecutor: () => DataGridClientProjectionComputeStageExecutor<T>
}

export function createClientRowComputeModuleHost<T>(
  options: CreateClientRowComputeModuleHostOptions<T>,
): DataGridClientComputeModuleHost<T> {
  const projectionComputeStageExecutor: DataGridClientProjectionComputeStageExecutor<T> = {
    execute(context) {
      let recomputed = false
      let refreshSourceById = false
      for (const module of options.getModules()) {
        const executor = module.getProjectionComputeStageExecutor?.()
        if (!executor) {
          continue
        }
        const result = executor.execute(context)
        if (typeof result === "boolean") {
          recomputed = recomputed || result
          continue
        }
        recomputed = recomputed || result.recomputed === true
        refreshSourceById = refreshSourceById || result.refreshSourceById === true
      }
      if (!recomputed && !refreshSourceById) {
        return DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR.execute(context)
      }
      return {
        recomputed,
        refreshSourceById,
      }
    },
  }

  return {
    getModules: options.getModules,
    getProjectionComputeStageExecutor: () => projectionComputeStageExecutor,
  }
}
