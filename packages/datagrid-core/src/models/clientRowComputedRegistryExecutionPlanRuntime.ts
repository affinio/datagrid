import {
  createDataGridFormulaExecutionPlan,
} from "@affino/datagrid-formula-engine"
import type {
  ClientRowComputedRegistryRuntimeState,
  DataGridComputedTokenReader,
  DataGridResolvedComputedDependency,
} from "./clientRowComputedRegistryRuntime.js"
import type {
  DataGridFormulaCyclePolicy,
  DataGridRowNode,
} from "./rowModel.js"

function toOrderedIndexes(
  computedOrder: readonly string[],
  affectedNames: ReadonlySet<string>,
): readonly number[] {
  return computedOrder
    .map((name, index) => (affectedNames.has(name) ? index : -1))
    .filter(index => index >= 0)
}

export function createComputedRegistryExecutionPlanRuntime<T>(options: {
  state: ClientRowComputedRegistryRuntimeState<T>
  formulaCyclePolicy: DataGridFormulaCyclePolicy
  onComputedPlanChanged: () => void
  resolveRowFieldReader: (fieldInput: string) => ((rowNode: DataGridRowNode<T>) => unknown)
  createDependencyReader: (dependency: DataGridResolvedComputedDependency) => DataGridComputedTokenReader<T>
}) {
  const {
    state,
    formulaCyclePolicy,
    onComputedPlanChanged,
    resolveRowFieldReader,
    createDependencyReader,
  } = options

  const rebuildComputedOrder = (): void => {
    for (const [name, entry] of state.computedFieldsByName) {
      const dependencyReaders = Object.freeze(entry.deps.map(createDependencyReader))
      const dependencyReaderByToken = new Map(entry.deps.map((dependency, index) => [
        dependency.token,
        dependencyReaders[index] ?? (() => undefined),
      ]))
      state.computedFieldsByName.set(name, {
        ...entry,
        dependencyReaders,
        dependencyReaderByToken,
      })
    }

    state.computedExecutionPlan = createDataGridFormulaExecutionPlan(
      Array.from(state.computedFieldsByName.values()).map(entry => ({
        name: entry.name,
        field: entry.field,
        deps: entry.deps.map(dep => ({
          domain: dep.domain,
          value: dep.value,
        })),
      })),
      {
        cyclePolicy: formulaCyclePolicy,
      },
    )
    state.computedOrder = [...state.computedExecutionPlan.order]

    const orderIndexByName = new Map<string, number>()
    for (let index = 0; index < state.computedOrder.length; index += 1) {
      const name = state.computedOrder[index]
      if (typeof name === "string") {
        orderIndexByName.set(name, index)
      }
    }

    state.computedLevelIndexes = Object.freeze(
      state.computedExecutionPlan.levels.map(level => Object.freeze(
        level
          .map(name => orderIndexByName.get(name))
          .filter((index): index is number => typeof index === "number"),
      )),
    )
    state.computedDependentsByIndex = Object.freeze(
      state.computedOrder.map((name) => {
        const node = state.computedExecutionPlan.nodes.get(name)
        if (!node) {
          return Object.freeze([]) as readonly number[]
        }
        return Object.freeze(
          node.dependents
            .map(dependentName => orderIndexByName.get(dependentName))
            .filter((index): index is number => typeof index === "number"),
        ) as readonly number[]
      }),
    )
    state.computedEntryByIndex = Object.freeze(
      state.computedOrder.map((name) => {
        const entry = state.computedFieldsByName.get(name)
        if (!entry) {
          throw new Error(`[DataGridComputed] Missing runtime entry for computed field '${name}'.`)
        }
        return entry
      }),
    )
    state.computedFieldReaderByIndex = Object.freeze(
      state.computedEntryByIndex.map(entry => resolveRowFieldReader(entry.field)),
    )
    state.computedAffectedPlanCache.clear()
    state.computedDirectFieldPlanCache.clear()
    state.computedAffectedContextPlanCache.clear()
    state.computedDirectContextPlanCache.clear()
    state.computedTokenReaderCache.clear()
    onComputedPlanChanged()
  }

  const resolveComputedRootIndexes = (changedFields: ReadonlySet<string>): readonly number[] => {
    if (state.computedOrder.length === 0 || changedFields.size === 0) {
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
    const cachedPlan = state.computedAffectedPlanCache.get(cacheKey)
    if (cachedPlan) {
      return cachedPlan
    }

    const affectedNames = state.computedExecutionPlan.directByFields(new Set<string>(normalizedChangedFields))
    const orderedPlan = toOrderedIndexes(state.computedOrder, affectedNames)
    state.computedAffectedPlanCache.set(cacheKey, orderedPlan)
    return orderedPlan
  }

  const resolveComputedRootIndexesForField = (changedField: string): readonly number[] => {
    const normalizedChangedField = changedField.trim()
    if (normalizedChangedField.length === 0 || state.computedOrder.length === 0) {
      return []
    }
    const cachedPlan = state.computedDirectFieldPlanCache.get(normalizedChangedField)
    if (cachedPlan) {
      return cachedPlan
    }
    const affectedNames = state.computedExecutionPlan.directByFields(new Set<string>([normalizedChangedField]))
    const orderedPlan = toOrderedIndexes(state.computedOrder, affectedNames)
    state.computedDirectFieldPlanCache.set(normalizedChangedField, orderedPlan)
    return orderedPlan
  }

  const resolveComputedRootIndexesForContext = (contextKey: string): readonly number[] => {
    const normalizedContextKey = contextKey.trim()
    if (
      normalizedContextKey.length === 0
      || state.computedOrder.length === 0
      || state.formulaFieldsByName.size === 0
    ) {
      return []
    }
    const cachedPlan = state.computedDirectContextPlanCache.get(normalizedContextKey)
    if (cachedPlan) {
      return cachedPlan
    }
    const affectedNames = new Set<string>()
    for (const formulaField of state.formulaFieldsByName.values()) {
      if (formulaField.contextKeys.includes(normalizedContextKey)) {
        affectedNames.add(formulaField.name)
      }
    }
    const orderedPlan = toOrderedIndexes(state.computedOrder, affectedNames)
    state.computedDirectContextPlanCache.set(normalizedContextKey, orderedPlan)
    return orderedPlan
  }

  const resolveComputedRootIndexesForContextKeys = (
    contextKeys: ReadonlySet<string>,
  ): readonly number[] => {
    if (state.computedOrder.length === 0 || contextKeys.size === 0) {
      return []
    }
    const normalizedContextKeys = Array.from(contextKeys)
      .map(key => key.trim())
      .filter(key => key.length > 0)
      .sort((left, right) => left.localeCompare(right))
    if (normalizedContextKeys.length === 0) {
      return []
    }
    const cacheKey = normalizedContextKeys.join("|")
    const cachedPlan = state.computedAffectedContextPlanCache.get(cacheKey)
    if (cachedPlan) {
      return cachedPlan
    }
    const orderedIndexes = new Set<number>()
    for (const contextKey of normalizedContextKeys) {
      const indexes = resolveComputedRootIndexesForContext(contextKey)
      for (const index of indexes) {
        orderedIndexes.add(index)
      }
    }
    const orderedPlan = state.computedOrder
      .map((_, index) => (orderedIndexes.has(index) ? index : -1))
      .filter(index => index >= 0)
    state.computedAffectedContextPlanCache.set(cacheKey, orderedPlan)
    return orderedPlan
  }

  return {
    rebuildComputedOrder,
    rebuildComputedPlan: rebuildComputedOrder,
    resolveComputedRootIndexes,
    resolveComputedRootIndexesForField,
    resolveComputedRootIndexesForContext,
    resolveComputedRootIndexesForContextKeys,
  }
}
