import type {
  DataGridComputedFieldDefinition,
  DataGridFormulaCyclePolicy,
  DataGridFormulaFieldDefinition,
  DataGridFormulaValue,
} from "../rowModel.js"
import type { DataGridProjectionPolicy } from "../projection/projectionPolicy.js"
import {
  createDataGridFormulaExecutionPlan,
} from "@affino/datagrid-formula-engine"
import type {
  DataGridCompiledFormulaField,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
} from "../formula/formulaEngine.js"
import type {
  ClientRowComputedRegistryRuntimeState,
  DataGridResolvedComputedDependency,
} from "./clientRowComputedRegistryRuntime.js"

export function createComputedRegistryRegistrationRuntime<T>(options: {
  state: ClientRowComputedRegistryRuntimeState<T>
  projectionPolicy: DataGridProjectionPolicy
  formulaCyclePolicy: DataGridFormulaCyclePolicy
  initialFormulaFunctionRegistry?: DataGridFormulaFunctionRegistry
  onComputedPlanChanged: () => void
  resolveComputedDependency: (value: string) => DataGridResolvedComputedDependency
  rebuildComputedOrder: () => void
  compileFormulaFieldDefinition: (
    definition: DataGridFormulaFieldDefinition,
    options?: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    },
  ) => DataGridCompiledFormulaField<T>
  recompileRegisteredFormulaFields: () => void
  clearFormulaCompileArtifactCache: () => void
}) {
  const {
    state,
    projectionPolicy,
    formulaCyclePolicy,
    initialFormulaFunctionRegistry,
    onComputedPlanChanged,
    resolveComputedDependency,
    rebuildComputedOrder,
    compileFormulaFieldDefinition,
    recompileRegisteredFormulaFields,
    clearFormulaCompileArtifactCache,
  } = options

  const normalizeComputedName = (value: unknown): string => {
    if (typeof value !== "string") {
      throw new Error("[DataGridComputed] Computed field name must be a string.")
    }
    const normalized = value.trim()
    if (normalized.length === 0) {
      throw new Error("[DataGridComputed] Computed field name must be non-empty.")
    }
    return normalized
  }

  const normalizeFormulaFunctionName = (value: unknown): string => {
    if (typeof value !== "string") {
      throw new Error("[DataGridFormula] Formula function name must be a string.")
    }
    const normalized = value.trim().toUpperCase()
    if (normalized.length === 0) {
      throw new Error("[DataGridFormula] Formula function name must be non-empty.")
    }
    return normalized
  }

  const normalizeComputedTargetField = (value: unknown, fallbackName: string): string => {
    const rawValue = typeof value === "string" && value.trim().length > 0
      ? value
      : fallbackName
    const normalized = rawValue.trim()
    if (normalized.length === 0) {
      throw new Error("[DataGridComputed] Computed field target must be non-empty.")
    }
    if (normalized.includes(".")) {
      throw new Error(
        `[DataGridComputed] Nested target path '${normalized}' is not supported yet. Use a top-level field.`,
      )
    }
    return normalized
  }

  if (initialFormulaFunctionRegistry) {
    for (const [name, definition] of Object.entries(initialFormulaFunctionRegistry)) {
      state.formulaFunctionRegistry.set(normalizeFormulaFunctionName(name), definition)
    }
  }

  const registerComputedFieldInternal = (
    definition: DataGridComputedFieldDefinition<T>,
    registerOptions: {
      knownComputedNames?: ReadonlySet<string>
      deferRebuild?: boolean
    } = {},
  ): void => {
    const name = normalizeComputedName(definition.name)
    if (state.computedFieldsByName.has(name)) {
      throw new Error(`[DataGridComputed] Computed field '${name}' is already registered.`)
    }
    if (typeof definition.compute !== "function") {
      throw new Error(`[DataGridComputed] Computed field '${name}' must provide a compute function.`)
    }

    const targetField = normalizeComputedTargetField(definition.field, name)
    const existingFieldOwner = state.computedFieldNameByTargetField.get(targetField)
    if (existingFieldOwner) {
      throw new Error(
        `[DataGridComputed] Target field '${targetField}' is already owned by computed field '${existingFieldOwner}'.`,
      )
    }

    const deps = (Array.isArray(definition.deps) ? definition.deps : []).map(resolveComputedDependency)
    for (const dependency of deps) {
      if (dependency.domain !== "computed") {
        continue
      }
      if (dependency.value === name && formulaCyclePolicy !== "iterative") {
        throw new Error(`[DataGridComputed] Computed field '${name}' cannot depend on itself.`)
      }
      if (
        !state.computedFieldsByName.has(dependency.value)
        && registerOptions.knownComputedNames?.has(dependency.value) !== true
      ) {
        throw new Error(
          `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
        )
      }
    }

    state.computedFieldsByName.set(name, {
      name,
      field: targetField,
      deps,
      compute: definition.compute,
    })
    state.computedFieldNameByTargetField.set(targetField, name)
    try {
      if (registerOptions.deferRebuild !== true) {
        rebuildComputedOrder()
      }
    } catch (error) {
      state.computedFieldsByName.delete(name)
      state.computedFieldNameByTargetField.delete(targetField)
      throw error
    }

    for (const dependency of deps) {
      if (dependency.domain === "meta") {
        continue
      }
      if (
        dependency.domain === "computed"
        && dependency.value === name
        && dependency.rowDomain.kind !== "current"
      ) {
        continue
      }
      const sourceField = dependency.domain === "computed"
        ? state.computedFieldsByName.get(dependency.value)?.field
        : dependency.value
      if (!sourceField || sourceField.length === 0) {
        continue
      }
      projectionPolicy.dependencyGraph.registerDependency(
        sourceField,
        targetField,
        { kind: dependency.domain === "field" ? "structural" : "computed" },
      )
    }
  }

  const registerFormulaFieldInternal = (
    definition: DataGridFormulaFieldDefinition,
    registerOptions: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
      deferRebuild?: boolean
    } = {},
  ): void => {
    const compiled = compileFormulaFieldDefinition(definition, registerOptions)
    if (state.formulaFieldsByName.has(compiled.name)) {
      throw new Error(`[DataGridFormula] Formula field '${compiled.name}' is already registered.`)
    }
    registerComputedFieldInternal(
      {
        name: compiled.name,
        field: compiled.field,
        deps: compiled.deps,
        compute: compiled.compute,
      },
      {
        knownComputedNames: registerOptions.knownComputedNames,
        deferRebuild: registerOptions.deferRebuild,
      },
    )
    const registeredComputedField = state.computedFieldsByName.get(compiled.name)
    if (registeredComputedField) {
      state.computedFieldsByName.set(compiled.name, {
        ...registeredComputedField,
        batchExecutionMode: compiled.batchExecutionMode,
        computeBatch: compiled.computeBatch,
        computeBatchColumnar: compiled.computeBatchColumnar,
      })
    }
    state.formulaFieldsByName.set(compiled.name, {
      name: compiled.name,
      field: compiled.field,
      formula: compiled.formula,
      deps: compiled.deps,
      contextKeys: compiled.contextKeys,
    })
  }

  const resolveInitialComputedRegistrationOrder = (
    definitions: readonly DataGridComputedFieldDefinition<T>[],
  ): readonly DataGridComputedFieldDefinition<T>[] => {
    if (definitions.length === 0) {
      return []
    }
    const byName = new Map<string, DataGridComputedFieldDefinition<T>>()
    for (const definition of definitions) {
      const name = normalizeComputedName(definition.name)
      if (byName.has(name)) {
        throw new Error(`[DataGridComputed] Duplicate computed field '${name}' in initialComputedFields.`)
      }
      byName.set(name, definition)
    }
    const localNames = new Set(byName.keys())
    const plan = createDataGridFormulaExecutionPlan(
      definitions.map((definition) => {
        const name = normalizeComputedName(definition.name)
        return {
          name,
          field: normalizeComputedTargetField(definition.field, name),
          deps: (Array.isArray(definition.deps) ? definition.deps : [])
            .map(resolveComputedDependency)
            .filter((dependency) => {
              if (dependency.domain !== "computed") {
                return true
              }
              if (localNames.has(dependency.value)) {
                return true
              }
              if (!state.computedFieldsByName.has(dependency.value)) {
                throw new Error(
                  `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
                )
              }
              return false
            })
            .map(dependency => ({
              domain: dependency.domain,
              value: dependency.value,
            })),
        }
      }),
      {
        cyclePolicy: formulaCyclePolicy,
      },
    )
    return plan.order
      .map(name => byName.get(name))
      .filter((definition): definition is DataGridComputedFieldDefinition<T> => definition != null)
  }

  const registerFormulaFunction = (
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
  ): void => {
    const normalizedName = normalizeFormulaFunctionName(name)
    if (
      typeof definition !== "function"
      && (
        typeof definition !== "object"
        || definition === null
        || typeof definition.compute !== "function"
      )
    ) {
      throw new Error(
        `[DataGridFormula] Formula function '${normalizedName}' must be a function or an object with compute(args).`,
      )
    }

    const previousRegistry = new Map(state.formulaFunctionRegistry)
    state.formulaFunctionRegistry.set(normalizedName, definition)
    clearFormulaCompileArtifactCache()
    try {
      recompileRegisteredFormulaFields()
    } catch (error) {
      state.formulaFunctionRegistry.clear()
      for (const [entryName, entryDefinition] of previousRegistry) {
        state.formulaFunctionRegistry.set(entryName, entryDefinition)
      }
      clearFormulaCompileArtifactCache()
      throw error
    }
  }

  const unregisterFormulaFunction = (name: string): boolean => {
    const normalizedName = normalizeFormulaFunctionName(name)
    if (!state.formulaFunctionRegistry.has(normalizedName)) {
      return false
    }
    const previousRegistry = new Map(state.formulaFunctionRegistry)
    state.formulaFunctionRegistry.delete(normalizedName)
    clearFormulaCompileArtifactCache()
    try {
      recompileRegisteredFormulaFields()
    } catch (error) {
      state.formulaFunctionRegistry.clear()
      for (const [entryName, entryDefinition] of previousRegistry) {
        state.formulaFunctionRegistry.set(entryName, entryDefinition)
      }
      clearFormulaCompileArtifactCache()
      throw error
    }
    return true
  }

  const getFormulaFunctionNames = (): readonly string[] => {
    return Array.from(state.formulaFunctionRegistry.keys())
      .sort((left, right) => left.localeCompare(right))
  }

  const clear = (): void => {
    state.computedFieldsByName.clear()
    state.computedFieldNameByTargetField.clear()
    state.formulaFieldsByName.clear()
    state.formulaFunctionRegistry.clear()
    clearFormulaCompileArtifactCache()
    state.formulaCompileCacheHits = 0
    state.formulaCompileCacheMisses = 0
    state.computedExecutionPlan = createDataGridFormulaExecutionPlan([], {
      cyclePolicy: formulaCyclePolicy,
    })
    state.computedAffectedPlanCache.clear()
    state.computedDirectFieldPlanCache.clear()
    state.computedAffectedContextPlanCache.clear()
    state.computedDirectContextPlanCache.clear()
    state.rowFieldReaderCache.clear()
    state.computedTokenReaderCache.clear()
    state.computedOrder = []
    state.computedEntryByIndex = []
    state.computedFieldReaderByIndex = []
    state.computedLevelIndexes = []
    state.computedDependentsByIndex = []
    onComputedPlanChanged()
  }

  return {
    clear,
    normalizeComputedName,
    normalizeFormulaFunctionName,
    normalizeComputedTargetField,
    resolveInitialComputedRegistrationOrder,
    registerComputedFieldInternal,
    registerFormulaFieldInternal,
    registerFormulaFunction,
    unregisterFormulaFunction,
    getFormulaFunctionNames,
  }
}
