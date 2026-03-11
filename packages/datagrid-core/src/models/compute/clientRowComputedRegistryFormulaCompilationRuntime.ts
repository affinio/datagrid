import type {
  DataGridComputedDependencyToken,
  DataGridFormulaFieldDefinition,
} from "../rowModel.js"
import {
  isDataGridFormulaMetaField,
  serializeDataGridComputedDependencyToken,
} from "../rowModel.js"
import {
  analyzeDataGridFormulaFieldDefinition,
  bindCompiledFormulaArtifactToFieldDefinition,
  compileDataGridFormulaFieldArtifact,
  parseDataGridFormulaIdentifier,
  type DataGridCompiledFormulaField,
  type DataGridFormulaFunctionRegistry,
} from "../formula/formulaEngine.js"
import type {
  ClientRowComputedRegistryRuntimeContext,
  ClientRowComputedRegistryRuntimeState,
  DataGridResolvedComputedDependency,
} from "./clientRowComputedRegistryRuntime.js"

type CompileFormulaFieldOptions = {
  knownComputedNames?: ReadonlySet<string>
  knownComputedNameByField?: ReadonlyMap<string, string>
}

export function createComputedRegistryFormulaCompilationRuntime<T>(options: {
  state: ClientRowComputedRegistryRuntimeState<T>
  context: ClientRowComputedRegistryRuntimeContext<T>
  resolveComputedDependency: (value: DataGridComputedDependencyToken) => DataGridResolvedComputedDependency
  rebuildComputedOrder: () => void
}) {
  const {
    state,
    context,
    resolveComputedDependency,
    rebuildComputedOrder,
  } = options

  const resolveFormulaFunctionRegistrySnapshot = (): DataGridFormulaFunctionRegistry | undefined => {
    if (state.formulaFunctionRegistry.size === 0) {
      return undefined
    }
    const registry: Record<string, DataGridFormulaFunctionRegistry[string]> = {}
    for (const [name, definition] of state.formulaFunctionRegistry) {
      registry[name] = definition
    }
    return registry as DataGridFormulaFunctionRegistry
  }

  const resolveDependencyToken = (
    identifier: string,
    compileOptions: CompileFormulaFieldOptions,
  ): DataGridComputedDependencyToken => {
    const parsedIdentifier = parseDataGridFormulaIdentifier(identifier)
    const normalizedIdentifier = parsedIdentifier.referenceName.trim()
    const serializeToken = (domain: "field" | "computed" | "meta", name: string): DataGridComputedDependencyToken => {
      return serializeDataGridComputedDependencyToken({
        domain,
        name,
        rowDomain: parsedIdentifier.rowSelector,
      })
    }
    if (normalizedIdentifier.startsWith("meta.")) {
      const metaField = normalizedIdentifier.slice("meta.".length).trim()
      if (isDataGridFormulaMetaField(metaField)) {
        return serializeToken("meta", metaField)
      }
    }
    const knownByTargetField = (
      state.computedFieldNameByTargetField.get(normalizedIdentifier)
      ?? compileOptions.knownComputedNameByField?.get(normalizedIdentifier)
    )
    if (knownByTargetField) {
      return serializeToken("computed", knownByTargetField)
    }
    if (
      state.computedFieldsByName.has(normalizedIdentifier)
      || state.formulaFieldsByName.has(normalizedIdentifier)
      || compileOptions.knownComputedNames?.has(normalizedIdentifier) === true
    ) {
      return serializeToken("computed", normalizedIdentifier)
    }
    return serializeToken("field", normalizedIdentifier)
  }

  const createCompileCacheStructuralKey = (
    expressionHash: string,
    deps: readonly DataGridComputedDependencyToken[],
  ): string => {
    return `${expressionHash}::${deps.join("\u001f")}`
  }

  const clearFormulaCompileArtifactCache = (): void => {
    state.formulaCompiledArtifactByExactKey.clear()
    state.formulaCompiledArtifactByStructuralKey.clear()
  }

  const compileFormulaFieldDefinition = (
    definition: DataGridFormulaFieldDefinition,
    compileOptions: CompileFormulaFieldOptions = {},
  ): DataGridCompiledFormulaField<T> => {
    const compileEngineOptions = {
      resolveDependencyToken: (identifier: string) => resolveDependencyToken(identifier, compileOptions),
      onRuntimeError: context.onFormulaRuntimeError,
      functionRegistry: resolveFormulaFunctionRegistrySnapshot(),
      referenceParserOptions: context.formulaReferenceParserOptions,
    }
    const analysis = analyzeDataGridFormulaFieldDefinition(definition, compileEngineOptions)
    const exactKey = analysis.formula
    const structuralKey = createCompileCacheStructuralKey(analysis.expressionHash, analysis.deps)
    const cachedArtifact = state.formulaCompiledArtifactByExactKey.get(exactKey)
      ?? state.formulaCompiledArtifactByStructuralKey.get(structuralKey)

    if (cachedArtifact) {
      state.formulaCompileCacheHits += 1
      state.formulaCompiledArtifactByExactKey.set(exactKey, cachedArtifact)
      return bindCompiledFormulaArtifactToFieldDefinition(cachedArtifact, definition, {
        onRuntimeError: context.onFormulaRuntimeError,
      })
    }

    state.formulaCompileCacheMisses += 1
    const artifact = compileDataGridFormulaFieldArtifact<T>(definition, compileEngineOptions)
    state.formulaCompiledArtifactByExactKey.set(exactKey, artifact)
    state.formulaCompiledArtifactByStructuralKey.set(structuralKey, artifact)
    return bindCompiledFormulaArtifactToFieldDefinition(artifact, definition, {
      onRuntimeError: context.onFormulaRuntimeError,
    })
  }

  const compileRegisteredFormulaFields = (): Map<string, DataGridCompiledFormulaField<T>> => {
    if (state.formulaFieldsByName.size === 0) {
      return new Map<string, DataGridCompiledFormulaField<T>>()
    }
    const knownFormulaNames = new Set<string>()
    const knownFormulaNameByField = new Map<string, string>()
    for (const entry of state.formulaFieldsByName.values()) {
      knownFormulaNames.add(entry.name)
      knownFormulaNameByField.set(entry.field, entry.name)
    }
    const compiledByName = new Map<string, DataGridCompiledFormulaField<T>>()
    for (const entry of state.formulaFieldsByName.values()) {
      const compiled = compileFormulaFieldDefinition(
        {
          name: entry.name,
          field: entry.field,
          formula: entry.formula,
        },
        {
          knownComputedNames: knownFormulaNames,
          knownComputedNameByField: knownFormulaNameByField,
        },
      )
      if (compiled.name !== entry.name) {
        throw new Error(
          `[DataGridFormula] Formula field '${entry.name}' compiled with unexpected name '${compiled.name}'.`,
        )
      }
      if (compiled.field !== entry.field) {
        throw new Error(
          `[DataGridFormula] Formula field '${entry.name}' target changed from '${entry.field}' to '${compiled.field}'.`,
        )
      }
      compiledByName.set(entry.name, compiled)
    }
    return compiledByName
  }

  const applyCompiledFormulaFields = (
    compiledByName: ReadonlyMap<string, DataGridCompiledFormulaField<T>>,
  ): void => {
    const previousComputedFieldsByName = new Map(state.computedFieldsByName)
    const previousFormulaFieldsByName = new Map(state.formulaFieldsByName)
    const previousComputedExecutionPlan = state.computedExecutionPlan
    const previousComputedOrder = state.computedOrder
    const previousComputedEntryByIndex = state.computedEntryByIndex
    const previousComputedFieldReaderByIndex = state.computedFieldReaderByIndex
    const previousComputedLevelIndexes = state.computedLevelIndexes
    const previousComputedDependentsByIndex = state.computedDependentsByIndex
    const previousComputedAffectedPlanCache = new Map(state.computedAffectedPlanCache)
    const previousComputedDirectFieldPlanCache = new Map(state.computedDirectFieldPlanCache)
    const previousComputedAffectedContextPlanCache = new Map(state.computedAffectedContextPlanCache)
    const previousComputedDirectContextPlanCache = new Map(state.computedDirectContextPlanCache)

    try {
      for (const [formulaName, compiled] of compiledByName) {
        const computed = state.computedFieldsByName.get(formulaName)
        if (!computed) {
          throw new Error(
            `[DataGridFormula] Missing computed field '${formulaName}' while applying compiled formulas.`,
          )
        }
        const resolvedDeps = compiled.deps.map(resolveComputedDependency)
        state.computedFieldsByName.set(formulaName, {
          ...computed,
          field: compiled.field,
          deps: resolvedDeps,
          compute: compiled.compute,
          batchExecutionMode: compiled.batchExecutionMode,
          computeBatch: compiled.computeBatch,
          computeBatchColumnar: compiled.computeBatchColumnar,
        })
        state.formulaFieldsByName.set(formulaName, {
          name: compiled.name,
          field: compiled.field,
          formula: compiled.formula,
          deps: compiled.deps,
          contextKeys: compiled.contextKeys,
        })
      }
      rebuildComputedOrder()
    } catch (error) {
      state.computedFieldsByName.clear()
      for (const [name, entry] of previousComputedFieldsByName) {
        state.computedFieldsByName.set(name, entry)
      }
      state.formulaFieldsByName.clear()
      for (const [name, entry] of previousFormulaFieldsByName) {
        state.formulaFieldsByName.set(name, entry)
      }
      state.computedExecutionPlan = previousComputedExecutionPlan
      state.computedOrder = previousComputedOrder
      state.computedEntryByIndex = previousComputedEntryByIndex
      state.computedFieldReaderByIndex = previousComputedFieldReaderByIndex
      state.computedLevelIndexes = previousComputedLevelIndexes
      state.computedDependentsByIndex = previousComputedDependentsByIndex
      state.computedAffectedPlanCache.clear()
      for (const [key, value] of previousComputedAffectedPlanCache) {
        state.computedAffectedPlanCache.set(key, value)
      }
      state.computedDirectFieldPlanCache.clear()
      for (const [key, value] of previousComputedDirectFieldPlanCache) {
        state.computedDirectFieldPlanCache.set(key, value)
      }
      state.computedAffectedContextPlanCache.clear()
      for (const [key, value] of previousComputedAffectedContextPlanCache) {
        state.computedAffectedContextPlanCache.set(key, value)
      }
      state.computedDirectContextPlanCache.clear()
      for (const [key, value] of previousComputedDirectContextPlanCache) {
        state.computedDirectContextPlanCache.set(key, value)
      }
      state.computedTokenReaderCache.clear()
      throw error
    }
  }

  const recompileRegisteredFormulaFields = (): void => {
    applyCompiledFormulaFields(compileRegisteredFormulaFields())
  }

  return {
    compileFormulaFieldDefinition,
    compileRegisteredFormulaFields,
    applyCompiledFormulaFields,
    recompileRegisteredFormulaFields,
    clearFormulaCompileArtifactCache,
  }
}
