import type {
  DataGridComputedDependencyToken,
  DataGridFormulaReferenceRowDomain,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridFormulaCyclePolicy,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridProjectionFormulaDiagnostics,
  DataGridFormulaRuntimeError,
  DataGridFormulaValue,
  DataGridRowNode,
} from "../rowModel.js"
import type { DataGridProjectionPolicy } from "../projection/projectionPolicy.js"
import type {
  DataGridCompiledFormulaArtifact,
  DataGridCompiledFormulaField,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
} from "../formula/formulaEngine.js"
import {
  createDataGridFormulaExecutionPlan,
  type DataGridFormulaExecutionDependencyDomain,
  type DataGridFormulaExecutionPlan,
} from "@affino/datagrid-formula-engine"
import { createComputedRegistryExecutionPlanRuntime } from "./clientRowComputedRegistryExecutionPlanRuntime.js"
import { createComputedRegistryFormulaCompilationRuntime } from "./clientRowComputedRegistryFormulaCompilationRuntime.js"
import { createComputedRegistryRegistrationRuntime } from "./clientRowComputedRegistryRegistrationRuntime.js"
import { createComputedRegistryTokenResolverRuntime } from "./clientRowComputedRegistryTokenResolverRuntime.js"

export type ComputedDependencyDomain = DataGridFormulaExecutionDependencyDomain

export interface DataGridResolvedComputedDependency {
  token: DataGridComputedDependencyToken
  domain: ComputedDependencyDomain
  value: string
  rowDomain: DataGridFormulaReferenceRowDomain
}

export interface DataGridRegisteredComputedField<T> {
  name: string
  field: string
  deps: readonly DataGridResolvedComputedDependency[]
  compute: DataGridComputedFieldDefinition<T>["compute"]
  batchExecutionMode?: DataGridCompiledFormulaField<T>["batchExecutionMode"]
  computeBatch?: DataGridCompiledFormulaField<T>["computeBatch"]
  computeBatchColumnar?: DataGridCompiledFormulaField<T>["computeBatchColumnar"]
  dependencyReaders?: readonly DataGridComputedTokenReader<T>[]
  dependencyReaderByToken?: ReadonlyMap<DataGridComputedDependencyToken, DataGridComputedTokenReader<T>>
}

export interface DataGridRegisteredFormulaField {
  name: string
  field: string
  formula: string
  deps: readonly DataGridComputedDependencyToken[]
  contextKeys: readonly string[]
}

export type DataGridComputedColumnReadContext<T> = {
  readFieldAtRow: (
    field: string,
    rowIndex: number,
    rowNode: DataGridRowNode<T>,
  ) => unknown
}

export type DataGridComputedTokenReader<T> = (
  rowNode: DataGridRowNode<T>,
  rowIndex?: number,
  columnReadContext?: DataGridComputedColumnReadContext<T>,
) => unknown

export interface ClientRowComputedRegistryRuntimeContext<T> {
  projectionPolicy: DataGridProjectionPolicy
  initialFormulaFunctionRegistry?: DataGridFormulaFunctionRegistry
  formulaCyclePolicy?: DataGridFormulaCyclePolicy
  resolveRowFieldValue?: (
    rowNode: DataGridRowNode<T>,
    field: string,
    readBaseValue: (rowNode: DataGridRowNode<T>) => unknown,
  ) => unknown
  onFormulaRuntimeError: (runtimeError: DataGridFormulaRuntimeError) => void
  onComputedPlanChanged: () => void
}

export interface ClientRowComputedRegistryRuntimeState<T> {
  computedFieldsByName: Map<string, DataGridRegisteredComputedField<T>>
  computedFieldNameByTargetField: Map<string, string>
  formulaFieldsByName: Map<string, DataGridRegisteredFormulaField>
  formulaFunctionRegistry: Map<
    string,
    DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: import("../rowModel.js").DataGridComputedFieldComputeContext<unknown>) => unknown)
  >
  formulaTablesByName: Map<string, readonly unknown[]>
  formulaCompiledArtifactByExactKey: Map<string, DataGridCompiledFormulaArtifact<T>>
  formulaCompiledArtifactByStructuralKey: Map<string, DataGridCompiledFormulaArtifact<T>>
  formulaCompileCacheHits: number
  formulaCompileCacheMisses: number
  computedExecutionPlan: DataGridFormulaExecutionPlan
  computedAffectedPlanCache: Map<string, readonly number[]>
  computedDirectFieldPlanCache: Map<string, readonly number[]>
  computedAffectedContextPlanCache: Map<string, readonly number[]>
  computedDirectContextPlanCache: Map<string, readonly number[]>
  rowFieldReaderCache: Map<string, (rowNode: DataGridRowNode<T>) => unknown>
  computedTokenReaderCache: Map<string, DataGridComputedTokenReader<T>>
  computedOrder: readonly string[]
  computedEntryByIndex: readonly DataGridRegisteredComputedField<T>[]
  computedFieldReaderByIndex: readonly ((rowNode: DataGridRowNode<T>) => unknown)[]
  computedLevelIndexes: readonly (readonly number[])[]
  computedDependentsByIndex: readonly (readonly number[])[]
}

export interface ClientRowComputedRegistryRuntime<T> {
  clear: () => void
  hasComputedFields: () => boolean
  hasFormulaFields: () => boolean

  normalizeComputedName: (value: unknown) => string
  normalizeFormulaFunctionName: (value: unknown) => string
  normalizeComputedTargetField: (value: unknown, fallbackName: string) => string
  createDependencyReader: (dependency: DataGridResolvedComputedDependency) => DataGridComputedTokenReader<T>

  resolveInitialComputedRegistrationOrder: (
    definitions: readonly DataGridComputedFieldDefinition<T>[],
  ) => readonly DataGridComputedFieldDefinition<T>[]

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

  compileFormulaFieldDefinition: (
    definition: DataGridFormulaFieldDefinition,
    options?: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    },
  ) => DataGridCompiledFormulaField<T>

  registerFormulaFunction: (
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: import("../rowModel.js").DataGridComputedFieldComputeContext<unknown>) => unknown),
  ) => void
  unregisterFormulaFunction: (name: string) => boolean
  getFormulaFunctionNames: () => readonly string[]
  setFormulaTable: (name: string, rows: readonly unknown[]) => void
  removeFormulaTable: (name: string) => boolean
  getFormulaTableNames: () => readonly string[]
  getFormulaContextValue: (key: string) => unknown

  recompileRegisteredFormulaFields: () => void
  rebuildComputedPlan: () => void

  getComputedFields: () => readonly DataGridComputedFieldSnapshot[]
  getFormulaFields: () => readonly DataGridFormulaFieldSnapshot[]

  getComputedExecutionPlan: () => DataGridFormulaExecutionPlan
  getComputedOrder: () => readonly string[]
  getComputedEntryByIndex: () => readonly DataGridRegisteredComputedField<T>[]
  getComputedFieldReaderByIndex: () => readonly ((rowNode: DataGridRowNode<T>) => unknown)[]
  getComputedLevelIndexes: () => readonly (readonly number[])[]
  getComputedDependentsByIndex: () => readonly (readonly number[])[]
  getFormulaFieldsByName: () => ReadonlyMap<string, DataGridRegisteredFormulaField>
  getFormulaCompileCacheDiagnostics: () => NonNullable<DataGridProjectionFormulaDiagnostics["compileCache"]>

  resolveComputedRootIndexes: (changedFields: ReadonlySet<string>) => readonly number[]
  resolveComputedRootIndexesForField: (changedField: string) => readonly number[]
  resolveComputedRootIndexesForContext: (contextKey: string) => readonly number[]
  resolveComputedRootIndexesForContextKeys: (contextKeys: ReadonlySet<string>) => readonly number[]
  resolveComputedTokenValue: (
    rowNode: DataGridRowNode<T>,
    token: DataGridComputedDependencyToken,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ) => unknown
  resolveRowFieldReader: (fieldInput: string) => ((rowNode: DataGridRowNode<T>) => unknown)
}

export function createClientRowComputedRegistryRuntime<T>(
  context: ClientRowComputedRegistryRuntimeContext<T>,
): ClientRowComputedRegistryRuntime<T> {
  const formulaCyclePolicy: DataGridFormulaCyclePolicy = context.formulaCyclePolicy === "iterative"
    ? "iterative"
    : "error"

  const state: ClientRowComputedRegistryRuntimeState<T> = {
    computedFieldsByName: new Map<string, DataGridRegisteredComputedField<T>>(),
    computedFieldNameByTargetField: new Map<string, string>(),
    formulaFieldsByName: new Map<string, DataGridRegisteredFormulaField>(),
    formulaFunctionRegistry: new Map(),
    formulaTablesByName: new Map<string, readonly unknown[]>(),
    formulaCompiledArtifactByExactKey: new Map<string, DataGridCompiledFormulaArtifact<T>>(),
    formulaCompiledArtifactByStructuralKey: new Map<string, DataGridCompiledFormulaArtifact<T>>(),
    formulaCompileCacheHits: 0,
    formulaCompileCacheMisses: 0,
    computedExecutionPlan: createDataGridFormulaExecutionPlan([], {
      cyclePolicy: formulaCyclePolicy,
    }),
    computedAffectedPlanCache: new Map<string, readonly number[]>(),
    computedDirectFieldPlanCache: new Map<string, readonly number[]>(),
    computedAffectedContextPlanCache: new Map<string, readonly number[]>(),
    computedDirectContextPlanCache: new Map<string, readonly number[]>(),
    rowFieldReaderCache: new Map<string, (rowNode: DataGridRowNode<T>) => unknown>(),
    computedTokenReaderCache: new Map<string, DataGridComputedTokenReader<T>>(),
    computedOrder: [],
    computedEntryByIndex: [],
    computedFieldReaderByIndex: [],
    computedLevelIndexes: [],
    computedDependentsByIndex: [],
  }

  const tokenResolverRuntime = createComputedRegistryTokenResolverRuntime({
    state,
    resolveRowFieldValue: context.resolveRowFieldValue,
  })
  const executionPlanRuntime = createComputedRegistryExecutionPlanRuntime({
    state,
    formulaCyclePolicy,
    onComputedPlanChanged: context.onComputedPlanChanged,
    resolveRowFieldReader: tokenResolverRuntime.resolveRowFieldReader,
    createDependencyReader: tokenResolverRuntime.createDependencyReader,
  })
  const formulaCompilationRuntime = createComputedRegistryFormulaCompilationRuntime({
    state,
    context,
    resolveComputedDependency: tokenResolverRuntime.resolveComputedDependency,
    rebuildComputedOrder: executionPlanRuntime.rebuildComputedOrder,
  })
  const registrationRuntime = createComputedRegistryRegistrationRuntime({
    state,
    projectionPolicy: context.projectionPolicy,
    formulaCyclePolicy,
    initialFormulaFunctionRegistry: context.initialFormulaFunctionRegistry,
    onComputedPlanChanged: context.onComputedPlanChanged,
    resolveComputedDependency: tokenResolverRuntime.resolveComputedDependency,
    rebuildComputedOrder: executionPlanRuntime.rebuildComputedOrder,
    compileFormulaFieldDefinition: formulaCompilationRuntime.compileFormulaFieldDefinition,
    recompileRegisteredFormulaFields: formulaCompilationRuntime.recompileRegisteredFormulaFields,
    clearFormulaCompileArtifactCache: formulaCompilationRuntime.clearFormulaCompileArtifactCache,
  })

  const getComputedFields = (): readonly DataGridComputedFieldSnapshot[] => {
    return state.computedOrder
      .map((name): DataGridComputedFieldSnapshot | null => {
        if (state.formulaFieldsByName.has(name)) {
          return null
        }
        const computed = state.computedFieldsByName.get(name)
        if (!computed) {
          return null
        }
        return {
          name: computed.name,
          field: computed.field,
          deps: computed.deps.map(dep => dep.token),
        }
      })
      .filter((entry): entry is DataGridComputedFieldSnapshot => entry !== null)
  }

  const getFormulaFields = (): readonly DataGridFormulaFieldSnapshot[] => {
    return Array.from(state.formulaFieldsByName.values()).map(formula => ({
      name: formula.name,
      field: formula.field,
      formula: formula.formula,
      deps: [...formula.deps],
      contextKeys: [...formula.contextKeys],
    }))
  }

  const normalizeFormulaTableName = (value: unknown): string => String(value ?? "").trim().toLowerCase()

  const setFormulaTable = (name: string, rows: readonly unknown[]): void => {
    const normalizedName = normalizeFormulaTableName(name)
    if (normalizedName.length === 0) {
      throw new Error("[DataGridFormula] Formula table name must be non-empty.")
    }
    state.formulaTablesByName.set(normalizedName, Object.freeze([...rows]))
  }

  const removeFormulaTable = (name: string): boolean => {
    const normalizedName = normalizeFormulaTableName(name)
    if (normalizedName.length === 0) {
      return false
    }
    return state.formulaTablesByName.delete(normalizedName)
  }

  const getFormulaTableNames = (): readonly string[] => {
    return Array.from(state.formulaTablesByName.keys())
      .sort((left, right) => left.localeCompare(right))
  }

  const getFormulaContextValue = (key: string): unknown => {
    const normalizedKey = String(key ?? "").trim().toLowerCase()
    if (!normalizedKey.startsWith("table:")) {
      return undefined
    }
    return state.formulaTablesByName.get(normalizedKey.slice("table:".length))
  }

  return {
    clear: registrationRuntime.clear,
    hasComputedFields: () => state.computedOrder.length > 0,
    hasFormulaFields: () => state.formulaFieldsByName.size > 0,

    normalizeComputedName: registrationRuntime.normalizeComputedName,
    normalizeFormulaFunctionName: registrationRuntime.normalizeFormulaFunctionName,
    normalizeComputedTargetField: registrationRuntime.normalizeComputedTargetField,

    resolveInitialComputedRegistrationOrder: registrationRuntime.resolveInitialComputedRegistrationOrder,

    registerComputedFieldInternal: registrationRuntime.registerComputedFieldInternal,
    registerFormulaFieldInternal: registrationRuntime.registerFormulaFieldInternal,

    compileFormulaFieldDefinition: formulaCompilationRuntime.compileFormulaFieldDefinition,

    registerFormulaFunction: registrationRuntime.registerFormulaFunction,
    unregisterFormulaFunction: registrationRuntime.unregisterFormulaFunction,
    getFormulaFunctionNames: registrationRuntime.getFormulaFunctionNames,
    setFormulaTable,
    removeFormulaTable,
    getFormulaTableNames,
    getFormulaContextValue,

    recompileRegisteredFormulaFields: formulaCompilationRuntime.recompileRegisteredFormulaFields,
    rebuildComputedPlan: executionPlanRuntime.rebuildComputedPlan,

    getComputedFields,
    getFormulaFields,

    getComputedExecutionPlan: () => state.computedExecutionPlan,
    getComputedOrder: () => state.computedOrder,
    getComputedEntryByIndex: () => state.computedEntryByIndex,
    getComputedFieldReaderByIndex: () => state.computedFieldReaderByIndex,
    getComputedLevelIndexes: () => state.computedLevelIndexes,
    getComputedDependentsByIndex: () => state.computedDependentsByIndex,
    getFormulaFieldsByName: () => state.formulaFieldsByName,
    getFormulaCompileCacheDiagnostics: () => ({
      hits: state.formulaCompileCacheHits,
      misses: state.formulaCompileCacheMisses,
      size: state.formulaCompiledArtifactByStructuralKey.size,
    }),

    resolveComputedRootIndexes: executionPlanRuntime.resolveComputedRootIndexes,
    resolveComputedRootIndexesForField: executionPlanRuntime.resolveComputedRootIndexesForField,
    resolveComputedRootIndexesForContext: executionPlanRuntime.resolveComputedRootIndexesForContext,
    resolveComputedRootIndexesForContextKeys: executionPlanRuntime.resolveComputedRootIndexesForContextKeys,
    resolveComputedTokenValue: tokenResolverRuntime.resolveComputedTokenValue,
    resolveRowFieldReader: tokenResolverRuntime.resolveRowFieldReader,
    createDependencyReader: tokenResolverRuntime.createDependencyReader,
  }
}
