import type { DataGridClientProjectionComputeStageExecutor } from "../projection/clientRowProjectionComputeStage.js"
import { DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR } from "../projection/clientRowProjectionComputeStage.js"

export interface DataGridClientComputeModule<T> {
  id: string
  getProjectionComputeStageExecutor?: () => DataGridClientProjectionComputeStageExecutor<T> | null
}

export interface CreateClientRowComputeModuleHostOptions<T> {
  getModules: () => readonly DataGridClientComputeModule<T>[]
}

export interface DataGridClientComputeModuleHost<T> {
  getModules: () => readonly DataGridClientComputeModule<T>[]
  getModule: <TModule extends DataGridClientComputeModule<T> = DataGridClientComputeModule<T>>(
    moduleId: string,
  ) => TModule | null
  registerModule: (module: DataGridClientComputeModule<T>) => void
  unregisterModule: (moduleId: string) => boolean
  getProjectionComputeStageExecutor: () => DataGridClientProjectionComputeStageExecutor<T>
}

export function createClientRowComputeModuleHost<T>(
  options: CreateClientRowComputeModuleHostOptions<T>,
): DataGridClientComputeModuleHost<T> {
  let registeredModules: readonly DataGridClientComputeModule<T>[] | null = null
  const resolveModules = (): readonly DataGridClientComputeModule<T>[] => (
    registeredModules ?? options.getModules()
  )

  const projectionComputeStageExecutor: DataGridClientProjectionComputeStageExecutor<T> = {
    execute(context) {
      let recomputed = false
      let refreshSourceById = false
      for (const module of resolveModules()) {
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
    getModules: resolveModules,
    getModule<TModule extends DataGridClientComputeModule<T> = DataGridClientComputeModule<T>>(
      moduleId: string,
    ): TModule | null {
      for (const module of resolveModules()) {
        if (module.id === moduleId) {
          return module as TModule
        }
      }
      return null
    },
    registerModule(module) {
      const modules = resolveModules()
      const existingIndex = modules.findIndex(candidate => candidate.id === module.id)
      if (existingIndex < 0) {
        registeredModules = [...modules, module]
        return
      }
      const nextModules = modules.slice()
      nextModules[existingIndex] = module
      registeredModules = nextModules
    },
    unregisterModule(moduleId) {
      const modules = resolveModules()
      const nextModules = modules.filter(module => module.id !== moduleId)
      if (nextModules.length === modules.length) {
        return false
      }
      registeredModules = nextModules
      return true
    },
    getProjectionComputeStageExecutor: () => projectionComputeStageExecutor,
  }
}
