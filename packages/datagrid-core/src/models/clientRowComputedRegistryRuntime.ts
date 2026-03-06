import type {
  DataGridComputedDependencyToken,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaRuntimeError,
  DataGridFormulaValue,
  DataGridRowNode,
} from "./rowModel.js"
import type { DataGridProjectionPolicy } from "./projectionPolicy.js"
import { normalizeDataGridDependencyToken } from "./dependencyModel.js"
import {
  compileDataGridFormulaFieldDefinition,
  type DataGridCompiledFormulaField,
  type DataGridFormulaFunctionDefinition,
  type DataGridFormulaFunctionRegistry,
} from "./formulaEngine.js"
import {
  createDataGridFormulaExecutionPlan,
  type DataGridFormulaExecutionPlan,
  type DataGridFormulaExecutionDependencyDomain,
} from "./formulaExecutionPlan.js"

export type ComputedDependencyDomain = DataGridFormulaExecutionDependencyDomain

export interface DataGridResolvedComputedDependency {
  token: DataGridComputedDependencyToken
  domain: ComputedDependencyDomain
  value: string
}

export interface DataGridRegisteredComputedField<T> {
  name: string
  field: string
  deps: readonly DataGridResolvedComputedDependency[]
  compute: DataGridComputedFieldDefinition<T>["compute"]
  computeBatch?: DataGridCompiledFormulaField<T>["computeBatch"]
  computeBatchColumnar?: DataGridCompiledFormulaField<T>["computeBatchColumnar"]
}

export interface DataGridRegisteredFormulaField {
  name: string
  field: string
  formula: string
  deps: readonly DataGridComputedDependencyToken[]
}

type DataGridCompiledPathSegment = string | number

type DataGridComputedColumnReadContext<T> = {
  readFieldAtRow: (
    field: string,
    rowIndex: number,
    rowNode: DataGridRowNode<T>,
  ) => unknown
}

type DataGridComputedTokenReader<T> = (
  rowNode: DataGridRowNode<T>,
  rowIndex?: number,
  columnReadContext?: DataGridComputedColumnReadContext<T>,
) => unknown

export interface ClientRowComputedRegistryRuntimeContext<T> {
  projectionPolicy: DataGridProjectionPolicy
  initialFormulaFunctionRegistry?: DataGridFormulaFunctionRegistry
  onFormulaRuntimeError: (runtimeError: DataGridFormulaRuntimeError) => void
  onComputedPlanChanged: () => void
}

export interface ClientRowComputedRegistryRuntime<T> {
  clear: () => void
  hasComputedFields: () => boolean
  hasFormulaFields: () => boolean

  normalizeComputedName: (value: unknown) => string
  normalizeFormulaFunctionName: (value: unknown) => string
  normalizeComputedTargetField: (value: unknown, fallbackName: string) => string

  resolveInitialComputedRegistrationOrder: (
    definitions: readonly DataGridComputedFieldDefinition<T>[],
  ) => readonly DataGridComputedFieldDefinition<T>[]

  registerComputedFieldInternal: (definition: DataGridComputedFieldDefinition<T>) => void
  registerFormulaFieldInternal: (
    definition: DataGridFormulaFieldDefinition,
    options?: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
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
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
  ) => void
  unregisterFormulaFunction: (name: string) => boolean
  getFormulaFunctionNames: () => readonly string[]

  recompileRegisteredFormulaFields: () => void

  getComputedFields: () => readonly DataGridComputedFieldSnapshot[]
  getFormulaFields: () => readonly DataGridFormulaFieldSnapshot[]

  getComputedExecutionPlan: () => DataGridFormulaExecutionPlan
  getComputedOrder: () => readonly string[]
  getComputedEntryByIndex: () => readonly DataGridRegisteredComputedField<T>[]
  getComputedFieldReaderByIndex: () => readonly ((rowNode: DataGridRowNode<T>) => unknown)[]
  getComputedLevelIndexes: () => readonly (readonly number[])[]
  getComputedDependentsByIndex: () => readonly (readonly number[])[]
  getFormulaFieldsByName: () => ReadonlyMap<string, DataGridRegisteredFormulaField>

  resolveComputedRootIndexes: (changedFields: ReadonlySet<string>) => readonly number[]
  resolveComputedTokenValue: (
    rowNode: DataGridRowNode<T>,
    token: DataGridComputedDependencyToken,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ) => unknown
  resolveRowFieldReader: (fieldInput: string) => ((rowNode: DataGridRowNode<T>) => unknown)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function compileDataGridPathSegments(path: string): readonly DataGridCompiledPathSegment[] {
  if (!path.includes(".")) {
    return Object.freeze([]) as readonly DataGridCompiledPathSegment[]
  }
  return Object.freeze(
    path
      .split(".")
      .filter(segment => segment.length > 0)
      .map((segment) => {
        const parsedIndex = Number(segment)
        return Number.isInteger(parsedIndex) && parsedIndex >= 0
          ? parsedIndex
          : segment
      }),
  )
}

function createCompiledDataGridRowDataReader(
  field: string,
): (source: unknown) => unknown {
  const normalizedField = field.trim()
  if (normalizedField.length === 0) {
    return () => undefined
  }
  const compiledSegments = compileDataGridPathSegments(normalizedField)
  if (compiledSegments.length === 0) {
    return (source: unknown) => (
      isRecord(source)
        ? (source as Record<string, unknown>)[normalizedField]
        : undefined
    )
  }
  return (source: unknown) => {
    if (!isRecord(source)) {
      return undefined
    }
    const directValue = (source as Record<string, unknown>)[normalizedField]
    if (typeof directValue !== "undefined") {
      return directValue
    }
    let current: unknown = source
    for (const segment of compiledSegments) {
      if (typeof segment === "number") {
        if (!Array.isArray(current) || segment >= current.length) {
          return undefined
        }
        current = current[segment]
        continue
      }
      if (!isRecord(current) || !(segment in current)) {
        return undefined
      }
      current = (current as Record<string, unknown>)[segment]
    }
    return current
  }
}

export function createClientRowComputedRegistryRuntime<T>(
  context: ClientRowComputedRegistryRuntimeContext<T>,
): ClientRowComputedRegistryRuntime<T> {
  const computedFieldsByName = new Map<string, DataGridRegisteredComputedField<T>>()
  const computedFieldNameByTargetField = new Map<string, string>()
  const formulaFieldsByName = new Map<string, DataGridRegisteredFormulaField>()
  const formulaFunctionRegistry = new Map<
    string,
    DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown)
  >()
  let computedExecutionPlan: DataGridFormulaExecutionPlan = createDataGridFormulaExecutionPlan([])
  const computedAffectedPlanCache = new Map<string, readonly number[]>()
  const rowFieldReaderCache = new Map<string, (rowNode: DataGridRowNode<T>) => unknown>()
  const computedTokenReaderCache = new Map<string, DataGridComputedTokenReader<T>>()
  let computedOrder: readonly string[] = []
  let computedEntryByIndex: readonly DataGridRegisteredComputedField<T>[] = []
  let computedFieldReaderByIndex: readonly ((rowNode: DataGridRowNode<T>) => unknown)[] = []
  let computedLevelIndexes: readonly (readonly number[])[] = []
  let computedDependentsByIndex: readonly (readonly number[])[] = []

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

  const resolveFormulaFunctionRegistrySnapshot = (): DataGridFormulaFunctionRegistry | undefined => {
    if (formulaFunctionRegistry.size === 0) {
      return undefined
    }
    const registry: Record<
      string,
      DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown)
    > = {}
    for (const [name, definition] of formulaFunctionRegistry) {
      registry[name] = definition
    }
    return registry
  }

  if (context.initialFormulaFunctionRegistry) {
    for (const [name, definition] of Object.entries(context.initialFormulaFunctionRegistry)) {
      formulaFunctionRegistry.set(normalizeFormulaFunctionName(name), definition)
    }
  }

  const normalizeComputedTargetField = (
    value: unknown,
    fallbackName: string,
  ): string => {
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

  const resolveComputedDependency = (
    value: DataGridComputedDependencyToken,
  ): DataGridResolvedComputedDependency => {
    const normalizedToken = normalizeDataGridDependencyToken(String(value), "field")
    if (normalizedToken.startsWith("computed:")) {
      return {
        token: normalizedToken,
        domain: "computed",
        value: normalizedToken.slice("computed:".length),
      }
    }
    if (normalizedToken.startsWith("meta:")) {
      return {
        token: normalizedToken,
        domain: "meta",
        value: normalizedToken.slice("meta:".length),
      }
    }
    return {
      token: normalizedToken,
      domain: "field",
      value: normalizedToken.slice("field:".length),
    }
  }

  const resolveRowFieldReader = (
    fieldInput: string,
  ): ((rowNode: DataGridRowNode<T>) => unknown) => {
    const field = fieldInput.trim()
    if (field.length === 0) {
      return () => undefined
    }
    const cachedReader = rowFieldReaderCache.get(field)
    if (cachedReader) {
      return cachedReader
    }
    const readDataValue = createCompiledDataGridRowDataReader(field)
    const nextReader = (rowNode: DataGridRowNode<T>): unknown => {
      return readDataValue(rowNode.data as unknown)
    }
    rowFieldReaderCache.set(field, nextReader)
    return nextReader
  }

  const rebuildComputedOrder = (): void => {
    computedExecutionPlan = createDataGridFormulaExecutionPlan(
      Array.from(computedFieldsByName.values()).map((entry) => ({
        name: entry.name,
        field: entry.field,
        deps: entry.deps.map(dep => ({
          domain: dep.domain,
          value: dep.value,
        })),
      })),
    )
    computedOrder = [...computedExecutionPlan.order]
    const nextOrderIndexByName = new Map<string, number>()
    for (let index = 0; index < computedOrder.length; index += 1) {
      const name = computedOrder[index]
      if (typeof name === "string") {
        nextOrderIndexByName.set(name, index)
      }
    }
    computedLevelIndexes = Object.freeze(
      computedExecutionPlan.levels.map((level) => Object.freeze(
        level
          .map(name => nextOrderIndexByName.get(name))
          .filter((index): index is number => typeof index === "number"),
      )),
    )
    computedDependentsByIndex = Object.freeze(
      computedOrder.map((name) => {
        const node = computedExecutionPlan.nodes.get(name)
        if (!node) {
          return Object.freeze([]) as readonly number[]
        }
        return Object.freeze(
          node.dependents
            .map(dependentName => nextOrderIndexByName.get(dependentName))
            .filter((index): index is number => typeof index === "number"),
        ) as readonly number[]
      }),
    )
    computedEntryByIndex = Object.freeze(
      computedOrder.map((name) => {
        const entry = computedFieldsByName.get(name)
        if (!entry) {
          throw new Error(`[DataGridComputed] Missing runtime entry for computed field '${name}'.`)
        }
        return entry
      }),
    )
    computedFieldReaderByIndex = Object.freeze(
      computedEntryByIndex.map(entry => resolveRowFieldReader(entry.field)),
    )
    computedAffectedPlanCache.clear()
    computedTokenReaderCache.clear()
    context.onComputedPlanChanged()
  }

  const registerComputedFieldInternal = (
    definition: DataGridComputedFieldDefinition<T>,
  ): void => {
    const name = normalizeComputedName(definition.name)
    if (computedFieldsByName.has(name)) {
      throw new Error(`[DataGridComputed] Computed field '${name}' is already registered.`)
    }
    if (typeof definition.compute !== "function") {
      throw new Error(`[DataGridComputed] Computed field '${name}' must provide a compute function.`)
    }

    const targetField = normalizeComputedTargetField(definition.field, name)
    const existingFieldOwner = computedFieldNameByTargetField.get(targetField)
    if (existingFieldOwner) {
      throw new Error(
        `[DataGridComputed] Target field '${targetField}' is already owned by computed field '${existingFieldOwner}'.`,
      )
    }

    const rawDeps = Array.isArray(definition.deps) ? definition.deps : []
    const deps = rawDeps.map(resolveComputedDependency)
    for (const dependency of deps) {
      if (dependency.domain !== "computed") {
        continue
      }
      if (dependency.value === name) {
        throw new Error(`[DataGridComputed] Computed field '${name}' cannot depend on itself.`)
      }
      if (!computedFieldsByName.has(dependency.value)) {
        throw new Error(
          `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
        )
      }
    }

    const entry: DataGridRegisteredComputedField<T> = {
      name,
      field: targetField,
      deps,
      compute: definition.compute,
    }
    computedFieldsByName.set(name, entry)
    computedFieldNameByTargetField.set(targetField, name)
    try {
      rebuildComputedOrder()
    } catch (error) {
      computedFieldsByName.delete(name)
      computedFieldNameByTargetField.delete(targetField)
      throw error
    }

    for (const dependency of deps) {
      if (dependency.domain === "meta") {
        continue
      }
      const sourceField = dependency.domain === "computed"
        ? computedFieldsByName.get(dependency.value)?.field
        : dependency.value
      if (!sourceField || sourceField.length === 0) {
        continue
      }
      context.projectionPolicy.dependencyGraph.registerDependency(
        sourceField,
        targetField,
        { kind: dependency.domain === "field" ? "structural" : "computed" },
      )
    }
  }

  const compileFormulaFieldDefinition = (
    definition: DataGridFormulaFieldDefinition,
    options: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    } = {},
  ): DataGridCompiledFormulaField<T> => {
    return compileDataGridFormulaFieldDefinition<T>(definition, {
      resolveDependencyToken: (identifier) => {
        const normalizedIdentifier = identifier.trim()
        const knownByTargetField = (
          computedFieldNameByTargetField.get(normalizedIdentifier)
          ?? options.knownComputedNameByField?.get(normalizedIdentifier)
        )
        if (knownByTargetField) {
          return `computed:${knownByTargetField}`
        }
        if (
          computedFieldsByName.has(normalizedIdentifier)
          || formulaFieldsByName.has(normalizedIdentifier)
          || options.knownComputedNames?.has(normalizedIdentifier) === true
        ) {
          return `computed:${normalizedIdentifier}`
        }
        return `field:${normalizedIdentifier}`
      },
      onRuntimeError: context.onFormulaRuntimeError,
      functionRegistry: resolveFormulaFunctionRegistrySnapshot(),
    })
  }

  const compileRegisteredFormulaFields = (): Map<string, DataGridCompiledFormulaField<T>> => {
    if (formulaFieldsByName.size === 0) {
      return new Map<string, DataGridCompiledFormulaField<T>>()
    }
    const knownFormulaNames = new Set<string>()
    const knownFormulaNameByField = new Map<string, string>()
    for (const entry of formulaFieldsByName.values()) {
      knownFormulaNames.add(entry.name)
      knownFormulaNameByField.set(entry.field, entry.name)
    }
    const compiledByName = new Map<string, DataGridCompiledFormulaField<T>>()
    for (const entry of formulaFieldsByName.values()) {
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
    const previousComputedFieldsByName = new Map(computedFieldsByName)
    const previousFormulaFieldsByName = new Map(formulaFieldsByName)
    const previousComputedExecutionPlan = computedExecutionPlan
    const previousComputedOrder = computedOrder
    const previousComputedEntryByIndex = computedEntryByIndex
    const previousComputedFieldReaderByIndex = computedFieldReaderByIndex
    const previousComputedLevelIndexes = computedLevelIndexes
    const previousComputedDependentsByIndex = computedDependentsByIndex
    const previousComputedAffectedPlanCache = new Map(computedAffectedPlanCache)

    try {
      for (const [formulaName, compiled] of compiledByName) {
        const computed = computedFieldsByName.get(formulaName)
        if (!computed) {
          throw new Error(
            `[DataGridFormula] Missing computed field '${formulaName}' while applying compiled formulas.`,
          )
        }
        const resolvedDeps = compiled.deps.map(resolveComputedDependency)
        computedFieldsByName.set(formulaName, {
          ...computed,
          field: compiled.field,
          deps: resolvedDeps,
          compute: compiled.compute,
          computeBatch: compiled.computeBatch,
          computeBatchColumnar: compiled.computeBatchColumnar,
        })
        formulaFieldsByName.set(formulaName, {
          name: compiled.name,
          field: compiled.field,
          formula: compiled.formula,
          deps: compiled.deps,
        })
      }
      rebuildComputedOrder()
    } catch (error) {
      computedFieldsByName.clear()
      for (const [name, entry] of previousComputedFieldsByName) {
        computedFieldsByName.set(name, entry)
      }
      formulaFieldsByName.clear()
      for (const [name, entry] of previousFormulaFieldsByName) {
        formulaFieldsByName.set(name, entry)
      }
      computedExecutionPlan = previousComputedExecutionPlan
      computedOrder = previousComputedOrder
      computedEntryByIndex = previousComputedEntryByIndex
      computedFieldReaderByIndex = previousComputedFieldReaderByIndex
      computedLevelIndexes = previousComputedLevelIndexes
      computedDependentsByIndex = previousComputedDependentsByIndex
      computedAffectedPlanCache.clear()
      for (const [key, value] of previousComputedAffectedPlanCache) {
        computedAffectedPlanCache.set(key, value)
      }
      computedTokenReaderCache.clear()
      throw error
    }
  }

  const registerFormulaFieldInternal = (
    definition: DataGridFormulaFieldDefinition,
    options: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    } = {},
  ): void => {
    const compiled = compileFormulaFieldDefinition(definition, options)
    if (formulaFieldsByName.has(compiled.name)) {
      throw new Error(`[DataGridFormula] Formula field '${compiled.name}' is already registered.`)
    }
    registerComputedFieldInternal({
      name: compiled.name,
      field: compiled.field,
      deps: compiled.deps,
      compute: compiled.compute,
    })
    const registeredComputedField = computedFieldsByName.get(compiled.name)
    if (registeredComputedField) {
      computedFieldsByName.set(compiled.name, {
        ...registeredComputedField,
        computeBatch: compiled.computeBatch,
        computeBatchColumnar: compiled.computeBatchColumnar,
      })
    }
    formulaFieldsByName.set(compiled.name, {
      name: compiled.name,
      field: compiled.field,
      formula: compiled.formula,
      deps: compiled.deps,
    })
  }

  const resolveComputedRootIndexes = (
    changedFields: ReadonlySet<string>,
  ): readonly number[] => {
    if (computedOrder.length === 0 || changedFields.size === 0) {
      return []
    }

    const normalizedChangedFields = Array.from(changedFields)
      .map(field => field.trim())
      .filter(field => field.length > 0)
      .sort((left, right) => left.localeCompare(right))
    if (normalizedChangedFields.length === 0) {
      return []
    }

    const cacheKey = normalizedChangedFields.join("|")
    const cachedPlan = computedAffectedPlanCache.get(cacheKey)
    if (cachedPlan) {
      return cachedPlan
    }

    const affectedNames = computedExecutionPlan.directByFields(
      new Set<string>(normalizedChangedFields),
    )
    const orderedPlan = computedOrder
      .map((name, index) => (affectedNames.has(name) ? index : -1))
      .filter(index => index >= 0)
    computedAffectedPlanCache.set(cacheKey, orderedPlan)
    return orderedPlan
  }

  const resolveComputedTokenValue = (
    rowNode: DataGridRowNode<T>,
    token: DataGridComputedDependencyToken,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ): unknown => {
    if (typeof token !== "string") {
      return undefined
    }
    const tokenInput = token.trim()
    if (tokenInput.length === 0) {
      return undefined
    }
    let reader = computedTokenReaderCache.get(tokenInput)
    if (!reader) {
      if (!tokenInput.includes(":")) {
        const computedDependency = computedFieldsByName.get(tokenInput)
        if (computedDependency) {
          const readComputedField = resolveRowFieldReader(computedDependency.field)
          const dependencyField = computedDependency.field
          reader = (
            nextRowNode: DataGridRowNode<T>,
            nextRowIndex?: number,
            nextColumnReadContext?: DataGridComputedColumnReadContext<T>,
          ) => {
            if (
              nextColumnReadContext
              && typeof nextRowIndex === "number"
              && nextRowIndex >= 0
            ) {
              return nextColumnReadContext.readFieldAtRow(dependencyField, nextRowIndex, nextRowNode)
            }
            return readComputedField(nextRowNode)
          }
        } else {
          const readField = resolveRowFieldReader(tokenInput)
          const field = tokenInput
          reader = (
            nextRowNode: DataGridRowNode<T>,
            nextRowIndex?: number,
            nextColumnReadContext?: DataGridComputedColumnReadContext<T>,
          ) => {
            if (
              nextColumnReadContext
              && typeof nextRowIndex === "number"
              && nextRowIndex >= 0
            ) {
              return nextColumnReadContext.readFieldAtRow(field, nextRowIndex, nextRowNode)
            }
            return readField(nextRowNode)
          }
        }
      } else {
        const dependency = resolveComputedDependency(tokenInput)
        if (dependency.domain === "meta") {
          reader = () => undefined
        } else if (dependency.domain === "computed") {
          const computedDependency = computedFieldsByName.get(dependency.value)
          if (!computedDependency) {
            reader = () => undefined
          } else {
            const readComputedField = resolveRowFieldReader(computedDependency.field)
            const dependencyField = computedDependency.field
            reader = (
              nextRowNode: DataGridRowNode<T>,
              nextRowIndex?: number,
              nextColumnReadContext?: DataGridComputedColumnReadContext<T>,
            ) => {
              if (
                nextColumnReadContext
                && typeof nextRowIndex === "number"
                && nextRowIndex >= 0
              ) {
                return nextColumnReadContext.readFieldAtRow(dependencyField, nextRowIndex, nextRowNode)
              }
              return readComputedField(nextRowNode)
            }
          }
        } else {
          const readField = resolveRowFieldReader(dependency.value)
          const field = dependency.value
          reader = (
            nextRowNode: DataGridRowNode<T>,
            nextRowIndex?: number,
            nextColumnReadContext?: DataGridComputedColumnReadContext<T>,
          ) => {
            if (
              nextColumnReadContext
              && typeof nextRowIndex === "number"
              && nextRowIndex >= 0
            ) {
              return nextColumnReadContext.readFieldAtRow(field, nextRowIndex, nextRowNode)
            }
            return readField(nextRowNode)
          }
        }
      }
      computedTokenReaderCache.set(tokenInput, reader)
    }
    return reader(rowNode, rowIndex, columnReadContext)
  }

  const getComputedFields = (): readonly DataGridComputedFieldSnapshot[] => {
    return computedOrder
      .map((name): DataGridComputedFieldSnapshot | null => {
        if (formulaFieldsByName.has(name)) {
          return null
        }
        const computed = computedFieldsByName.get(name)
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
    return Array.from(formulaFieldsByName.values()).map((formula) => ({
      name: formula.name,
      field: formula.field,
      formula: formula.formula,
      deps: [...formula.deps],
    }))
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
    const ordered: DataGridComputedFieldDefinition<T>[] = []
    const states = new Map<string, 0 | 1 | 2>()
    const visit = (name: string): void => {
      const state = states.get(name) ?? 0
      if (state === 2) {
        return
      }
      if (state === 1) {
        throw new Error(`[DataGridComputed] Cycle detected at computed field '${name}'.`)
      }
      const definition = byName.get(name)
      if (!definition) {
        throw new Error(`[DataGridComputed] Missing initial computed field '${name}'.`)
      }
      states.set(name, 1)
      for (const rawDependency of Array.isArray(definition.deps) ? definition.deps : []) {
        const dependency = resolveComputedDependency(rawDependency)
        if (dependency.domain !== "computed") {
          continue
        }
        if (byName.has(dependency.value)) {
          visit(dependency.value)
          continue
        }
        if (!computedFieldsByName.has(dependency.value)) {
          throw new Error(
            `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
          )
        }
      }
      states.set(name, 2)
      ordered.push(definition)
    }
    for (const name of byName.keys()) {
      visit(name)
    }
    return ordered
  }

  const recompileRegisteredFormulaFields = (): void => {
    const compiledByName = compileRegisteredFormulaFields()
    applyCompiledFormulaFields(compiledByName)
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

    const previousRegistry = new Map(formulaFunctionRegistry)
    formulaFunctionRegistry.set(normalizedName, definition)
    try {
      recompileRegisteredFormulaFields()
    } catch (error) {
      formulaFunctionRegistry.clear()
      for (const [entryName, entryDefinition] of previousRegistry) {
        formulaFunctionRegistry.set(entryName, entryDefinition)
      }
      throw error
    }
  }

  const unregisterFormulaFunction = (name: string): boolean => {
    const normalizedName = normalizeFormulaFunctionName(name)
    if (!formulaFunctionRegistry.has(normalizedName)) {
      return false
    }
    const previousRegistry = new Map(formulaFunctionRegistry)
    formulaFunctionRegistry.delete(normalizedName)
    try {
      recompileRegisteredFormulaFields()
    } catch (error) {
      formulaFunctionRegistry.clear()
      for (const [entryName, entryDefinition] of previousRegistry) {
        formulaFunctionRegistry.set(entryName, entryDefinition)
      }
      throw error
    }
    return true
  }

  const getFormulaFunctionNames = (): readonly string[] => {
    return Array.from(formulaFunctionRegistry.keys())
      .sort((left, right) => left.localeCompare(right))
  }

  const clear = (): void => {
    computedFieldsByName.clear()
    computedFieldNameByTargetField.clear()
    formulaFieldsByName.clear()
    formulaFunctionRegistry.clear()
    computedExecutionPlan = createDataGridFormulaExecutionPlan([])
    computedAffectedPlanCache.clear()
    rowFieldReaderCache.clear()
    computedTokenReaderCache.clear()
    computedOrder = []
    computedEntryByIndex = []
    computedFieldReaderByIndex = []
    computedLevelIndexes = []
    computedDependentsByIndex = []
    context.onComputedPlanChanged()
  }

  return {
    clear,
    hasComputedFields: () => computedOrder.length > 0,
    hasFormulaFields: () => formulaFieldsByName.size > 0,

    normalizeComputedName,
    normalizeFormulaFunctionName,
    normalizeComputedTargetField,

    resolveInitialComputedRegistrationOrder,

    registerComputedFieldInternal,
    registerFormulaFieldInternal,

    compileFormulaFieldDefinition,

    registerFormulaFunction,
    unregisterFormulaFunction,
    getFormulaFunctionNames,

    recompileRegisteredFormulaFields,

    getComputedFields,
    getFormulaFields,

    getComputedExecutionPlan: () => computedExecutionPlan,
    getComputedOrder: () => computedOrder,
    getComputedEntryByIndex: () => computedEntryByIndex,
    getComputedFieldReaderByIndex: () => computedFieldReaderByIndex,
    getComputedLevelIndexes: () => computedLevelIndexes,
    getComputedDependentsByIndex: () => computedDependentsByIndex,
    getFormulaFieldsByName: () => formulaFieldsByName,

    resolveComputedRootIndexes,
    resolveComputedTokenValue,
    resolveRowFieldReader,
  }
}
