import { createClientRowComputedBootstrapRuntime } from "../compute/clientRowComputedBootstrap.js"
import type { DataGridComputedFieldDefinition, DataGridComputedFieldSnapshot, DataGridFormulaFieldDefinition, DataGridFormulaFieldSnapshot, DataGridProjectionFormulaDiagnostics, DataGridFormulaComputeStageDiagnostics, DataGridRowId } from "../rowModel.js"
import type { ClientRowComputedRegistryRuntime } from "../compute/clientRowComputedRegistryRuntime.js"
import type { ApplyComputedFieldsToSourceRowsResult } from "../compute/clientRowComputedExecutionRuntime.js"

export interface CreateClientRowComputedFieldHostRuntimeOptions<T> {
  computedRegistry: ClientRowComputedRegistryRuntime<T>
  initialComputedFields?: readonly DataGridComputedFieldDefinition<T>[]
  initialFormulaFields?: readonly DataGridFormulaFieldDefinition[]
  commitFormulaDiagnostics: (diagnostics: DataGridProjectionFormulaDiagnostics) => void
  commitFormulaComputeStageDiagnostics: (diagnostics: DataGridFormulaComputeStageDiagnostics) => void
  applyComputedFieldsToSourceRows: () => ApplyComputedFieldsToSourceRowsResult<T>
  bumpRowVersions: (rowIds: readonly DataGridRowId[]) => void
}

export interface ClientRowComputedFieldHostRuntime<T> {
  registerComputedFieldInternal: (
    definition: DataGridComputedFieldDefinition<T>,
    options?: {
      knownComputedNames?: ReadonlySet<string>
      deferRebuild?: boolean
    },
  ) => void
  registerFormulaFieldInternal: (
    definition: DataGridFormulaFieldDefinition,
    options?: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
      deferRebuild?: boolean
    },
  ) => void
  getComputedFieldSnapshots: () => readonly DataGridComputedFieldSnapshot[]
  getFormulaFieldSnapshots: () => readonly DataGridFormulaFieldSnapshot[]
  getFormulaFieldsByName: () => ReadonlyMap<string, ReturnType<ClientRowComputedRegistryRuntime<T>["getFormulaFieldsByName"]> extends ReadonlyMap<string, infer V> ? V : never>
  bootstrapInitialComputedAndFormulaFields: () => void
}

export function createClientRowComputedFieldHostRuntime<T>(
  options: CreateClientRowComputedFieldHostRuntimeOptions<T>,
): ClientRowComputedFieldHostRuntime<T> {
  const registerComputedFieldInternal: ClientRowComputedFieldHostRuntime<T>["registerComputedFieldInternal"] = (
    definition,
    internalOptions,
  ) => {
    options.computedRegistry.registerComputedFieldInternal(definition, internalOptions)
  }

  const registerFormulaFieldInternal: ClientRowComputedFieldHostRuntime<T>["registerFormulaFieldInternal"] = (
    definition,
    runtimeOptions = {},
  ) => {
    options.computedRegistry.registerFormulaFieldInternal(definition, runtimeOptions)
  }

  const bootstrapRuntime = createClientRowComputedBootstrapRuntime<T>({
    initialComputedFields: options.initialComputedFields,
    initialFormulaFields: options.initialFormulaFields,
    normalizeComputedName: options.computedRegistry.normalizeComputedName,
    normalizeComputedTargetField: options.computedRegistry.normalizeComputedTargetField,
    resolveInitialComputedRegistrationOrder: options.computedRegistry.resolveInitialComputedRegistrationOrder,
    registerComputedFieldInternal,
    compileFormulaFieldDefinition: options.computedRegistry.compileFormulaFieldDefinition,
    registerFormulaFieldInternal,
    rebuildComputedPlan: options.computedRegistry.rebuildComputedPlan,
    applyComputedFieldsToSourceRows: options.applyComputedFieldsToSourceRows,
    commitFormulaDiagnostics: options.commitFormulaDiagnostics,
    commitFormulaComputeStageDiagnostics: options.commitFormulaComputeStageDiagnostics,
    bumpRowVersions: options.bumpRowVersions,
  })

  return {
    registerComputedFieldInternal,
    registerFormulaFieldInternal,
    getComputedFieldSnapshots: options.computedRegistry.getComputedFields,
    getFormulaFieldSnapshots: options.computedRegistry.getFormulaFields,
    getFormulaFieldsByName: options.computedRegistry.getFormulaFieldsByName,
    bootstrapInitialComputedAndFormulaFields() {
      bootstrapRuntime.bootstrapInitialComputedAndFormulaFields()
    },
  }
}
