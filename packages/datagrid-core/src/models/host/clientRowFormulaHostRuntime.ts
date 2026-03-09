import { createClientRowFormulaComputeModule } from "../compute/clientRowFormulaComputeModule.js"
import type {
  CreateClientRowFormulaComputeModuleOptions,
  DataGridClientFormulaComputeModule,
} from "../compute/clientRowFormulaComputeModule.js"
import type { DataGridClientComputeModuleHost } from "../compute/clientRowComputeModule.js"

export interface CreateClientRowFormulaHostRuntimeOptions<T>
  extends CreateClientRowFormulaComputeModuleOptions<T> {
  computeModuleHost: DataGridClientComputeModuleHost<T>
}

export interface ClientRowFormulaHostRuntime<T> {
  resolveModule(): DataGridClientFormulaComputeModule<T>
  dispose(): void
}

export function createClientRowFormulaHostRuntime<T>(
  options: CreateClientRowFormulaHostRuntimeOptions<T>,
): ClientRowFormulaHostRuntime<T> {
  const formulaComputeModule = createClientRowFormulaComputeModule<T>(options)
  options.computeModuleHost.registerModule(formulaComputeModule)

  return {
    resolveModule() {
      const module = options.computeModuleHost.getModule<DataGridClientFormulaComputeModule<T>>("formula")
      if (!module) {
        throw new Error("[clientRowModel] Formula compute module is not registered")
      }
      return module
    },
    dispose() {
      options.computeModuleHost.unregisterModule("formula")
    },
  }
}
