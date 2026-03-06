import { parseFormulaReferenceSegments } from "./formulaEngine/core.js"

export type DataGridFormulaExecutionCyclePolicy = "error" | "iterative"

export type DataGridFormulaExecutionDependencyDomain = "field" | "computed" | "meta"

export interface DataGridFormulaExecutionDependency {
  domain: DataGridFormulaExecutionDependencyDomain
  value: string
}

export interface DataGridFormulaExecutionPlanNode {
  name: string
  field: string
  deps: readonly DataGridFormulaExecutionDependency[]
}

export interface DataGridFormulaExecutionPlanNodeSnapshot {
  name: string
  field: string
  level: number
  fieldDeps: readonly string[]
  computedDeps: readonly string[]
  dependents: readonly string[]
  iterative?: boolean
  cycleGroup?: readonly string[]
}

export interface DataGridFormulaExecutionPlan {
  order: readonly string[]
  levels: readonly (readonly string[])[]
  nodes: ReadonlyMap<string, DataGridFormulaExecutionPlanNodeSnapshot>
  iterativeGroups: readonly (readonly string[])[]
  directByFields: (changedFields: ReadonlySet<string>) => ReadonlySet<string>
  affectedByFields: (changedFields: ReadonlySet<string>) => ReadonlySet<string>
  affectedByComputed: (changedComputed: ReadonlySet<string>) => ReadonlySet<string>
}

export interface DataGridFormulaExecutionPlanSnapshot {
  order: readonly string[]
  levels: readonly (readonly string[])[]
  nodes: readonly DataGridFormulaExecutionPlanNodeSnapshot[]
  iterativeGroups?: readonly (readonly string[] )[]
}

export interface CreateDataGridFormulaExecutionPlanOptions {
  cyclePolicy?: DataGridFormulaExecutionCyclePolicy
}

function normalizeName(value: string, label: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`[DataGridFormulaExecutionPlan] ${label} must be non-empty.`)
  }
  return normalized
}

function normalizeDependency(dependency: DataGridFormulaExecutionDependency): DataGridFormulaExecutionDependency {
  return {
    domain: dependency.domain,
    value: normalizeName(dependency.value, "Dependency name"),
  }
}

function splitFieldPathSegments(field: string): readonly string[] {
  return parseFormulaReferenceSegments(field)
    .map(segment => String(segment).trim())
    .filter(segment => segment.length > 0)
}

function collectFieldPathAncestors(field: string): readonly string[] {
  const segments = splitFieldPathSegments(field)
  if (segments.length === 0) {
    return []
  }
  const ancestors: string[] = []
  for (let index = 0; index < segments.length; index += 1) {
    ancestors.push(segments.slice(0, index + 1).join("."))
  }
  return ancestors
}

function mergeValueSetIntoMap(
  target: Map<string, Set<string>>,
  key: string,
  values: ReadonlySet<string>,
): void {
  if (values.size === 0) {
    return
  }
  const bucket = target.get(key) ?? new Set<string>()
  for (const value of values) {
    bucket.add(value)
  }
  target.set(key, bucket)
}

function addMapValues(
  target: Set<string>,
  source: ReadonlyMap<string, ReadonlySet<string>>,
  key: string,
): void {
  const values = source.get(key)
  if (!values || values.size === 0) {
    return
  }
  for (const value of values) {
    target.add(value)
  }
}

export function createDataGridFormulaExecutionPlan(
  input: readonly DataGridFormulaExecutionPlanNode[],
  options: CreateDataGridFormulaExecutionPlanOptions = {},
): DataGridFormulaExecutionPlan {
  const cyclePolicy: DataGridFormulaExecutionCyclePolicy = options.cyclePolicy === "iterative"
    ? "iterative"
    : "error"
  const nodeByName = new Map<string, DataGridFormulaExecutionPlanNode>()
  const nodeIndexByName = new Map<string, number>()
  for (const rawNode of input) {
    const name = normalizeName(rawNode.name, "Node name")
    const field = normalizeName(rawNode.field, `Field for node '${name}'`)
    if (nodeByName.has(name)) {
      throw new Error(`[DataGridFormulaExecutionPlan] Duplicate node '${name}'.`)
    }
    const deps = Array.isArray(rawNode.deps)
      ? rawNode.deps.map(normalizeDependency)
      : []
    nodeByName.set(name, { name, field, deps })
    nodeIndexByName.set(name, nodeIndexByName.size)
  }

  const adjacency = new Map<string, string[]>()
  for (const [name, node] of nodeByName) {
    const deps: string[] = []
    for (const dependency of node.deps) {
      if (dependency.domain !== "computed") {
        continue
      }
      if (!nodeByName.has(dependency.value)) {
        throw new Error(
          `[DataGridFormulaExecutionPlan] Missing computed dependency '${dependency.value}' for '${name}'.`,
        )
      }
      deps.push(dependency.value)
    }
    adjacency.set(name, deps)
  }

  const indexByName = new Map<string, number>()
  const lowLinkByName = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: string[][] = []
  let indexCounter = 0

  const strongConnect = (name: string): void => {
    indexByName.set(name, indexCounter)
    lowLinkByName.set(name, indexCounter)
    indexCounter += 1
    stack.push(name)
    onStack.add(name)

    const deps = adjacency.get(name) ?? []
    for (const dependencyName of deps) {
      if (!indexByName.has(dependencyName)) {
        strongConnect(dependencyName)
        lowLinkByName.set(
          name,
          Math.min(lowLinkByName.get(name) ?? 0, lowLinkByName.get(dependencyName) ?? 0),
        )
        continue
      }
      if (onStack.has(dependencyName)) {
        lowLinkByName.set(
          name,
          Math.min(lowLinkByName.get(name) ?? 0, indexByName.get(dependencyName) ?? 0),
        )
      }
    }

    if ((lowLinkByName.get(name) ?? -1) !== (indexByName.get(name) ?? -2)) {
      return
    }

    const component: string[] = []
    while (stack.length > 0) {
      const entry = stack.pop()
      if (!entry) {
        break
      }
      onStack.delete(entry)
      component.push(entry)
      if (entry === name) {
        break
      }
    }
    component.sort((left, right) => (nodeIndexByName.get(left) ?? 0) - (nodeIndexByName.get(right) ?? 0))
    components.push(component)
  }

  for (const name of nodeByName.keys()) {
    if (!indexByName.has(name)) {
      strongConnect(name)
    }
  }

  const componentIndexByName = new Map<string, number>()
  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    for (const name of components[componentIndex] ?? []) {
      componentIndexByName.set(name, componentIndex)
    }
  }

  const isIterativeComponent = (component: readonly string[]): boolean => {
    if (component.length > 1) {
      return true
    }
    const name = component[0]
    if (!name) {
      return false
    }
    return (adjacency.get(name) ?? []).includes(name)
  }

  const iterativeGroups = components
    .filter(component => isIterativeComponent(component))
    .map(component => Object.freeze([...component]) as readonly string[])

  if (cyclePolicy === "error" && iterativeGroups.length > 0) {
    throw new Error(`[DataGridFormulaExecutionPlan] Cycle detected at '${iterativeGroups[0]?.[0] ?? "unknown"}'.`)
  }

  const componentDeps = new Map<number, Set<number>>()
  const componentDependents = new Map<number, Set<number>>()
  const indegreeByComponent = new Uint32Array(components.length)

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const component = components[componentIndex] ?? []
    const deps = componentDeps.get(componentIndex) ?? new Set<number>()
    for (const name of component) {
      for (const dependencyName of adjacency.get(name) ?? []) {
        const dependencyComponentIndex = componentIndexByName.get(dependencyName)
        if (typeof dependencyComponentIndex !== "number" || dependencyComponentIndex === componentIndex) {
          continue
        }
        if (!deps.has(dependencyComponentIndex)) {
          deps.add(dependencyComponentIndex)
          indegreeByComponent[componentIndex] = (indegreeByComponent[componentIndex] ?? 0) + 1
        }
        const dependents = componentDependents.get(dependencyComponentIndex) ?? new Set<number>()
        dependents.add(componentIndex)
        componentDependents.set(dependencyComponentIndex, dependents)
      }
    }
    componentDeps.set(componentIndex, deps)
  }

  const availableComponents: number[] = []
  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    if ((indegreeByComponent[componentIndex] ?? 0) === 0) {
      availableComponents.push(componentIndex)
    }
  }
  availableComponents.sort((left, right) => {
    const leftOrder = Math.min(...(components[left] ?? []).map(name => nodeIndexByName.get(name) ?? Number.MAX_SAFE_INTEGER))
    const rightOrder = Math.min(...(components[right] ?? []).map(name => nodeIndexByName.get(name) ?? Number.MAX_SAFE_INTEGER))
    return leftOrder - rightOrder
  })

  const componentOrder: number[] = []
  const componentLevelByIndex = new Map<number, number>()
  while (availableComponents.length > 0) {
    const componentIndex = availableComponents.shift()
    if (typeof componentIndex !== "number") {
      continue
    }
    componentOrder.push(componentIndex)
    const deps = componentDeps.get(componentIndex) ?? new Set<number>()
    let level = 0
    for (const dependencyComponentIndex of deps) {
      level = Math.max(level, (componentLevelByIndex.get(dependencyComponentIndex) ?? 0) + 1)
    }
    componentLevelByIndex.set(componentIndex, level)
    for (const dependentComponentIndex of componentDependents.get(componentIndex) ?? []) {
      indegreeByComponent[dependentComponentIndex] = (indegreeByComponent[dependentComponentIndex] ?? 0) - 1
      if (indegreeByComponent[dependentComponentIndex] === 0) {
        availableComponents.push(dependentComponentIndex)
        availableComponents.sort((left, right) => {
          const leftOrder = Math.min(...(components[left] ?? []).map(name => nodeIndexByName.get(name) ?? Number.MAX_SAFE_INTEGER))
          const rightOrder = Math.min(...(components[right] ?? []).map(name => nodeIndexByName.get(name) ?? Number.MAX_SAFE_INTEGER))
          return leftOrder - rightOrder
        })
      }
    }
  }

  const order = componentOrder.flatMap(componentIndex => components[componentIndex] ?? [])

  const levelByName = new Map<string, number>()
  for (const name of order) {
    const node = nodeByName.get(name)
    if (!node) {
      continue
    }
    const componentIndex = componentIndexByName.get(name)
    let level = typeof componentIndex === "number"
      ? (componentLevelByIndex.get(componentIndex) ?? 0)
      : 0
    levelByName.set(name, level)
  }

  const levelBuckets = new Map<number, string[]>()
  const orderIndexByName = new Map<string, number>()
  for (const name of order) {
    orderIndexByName.set(name, orderIndexByName.size)
    const level = levelByName.get(name) ?? 0
    const bucket = levelBuckets.get(level) ?? []
    bucket.push(name)
    levelBuckets.set(level, bucket)
  }
  const levels = Array.from(levelBuckets.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, names]) => Object.freeze([...names]) as readonly string[])

  const nodes = new Map<string, DataGridFormulaExecutionPlanNodeSnapshot>()
  const dependentsByField = new Map<string, Set<string>>()
  const dependentsByComputed = new Map<string, Set<string>>()
  const fieldDepsByName = new Map<string, readonly string[]>()
  const computedDepsByName = new Map<string, readonly string[]>()

  for (const name of order) {
    const node = nodeByName.get(name)
    if (!node) {
      continue
    }
    const fieldDeps = new Set<string>()
    const computedDeps = new Set<string>()
    for (const dependency of node.deps) {
      if (dependency.domain === "meta") {
        continue
      }
      if (dependency.domain === "field") {
        fieldDeps.add(dependency.value)
        continue
      }
      const dependencyNode = nodeByName.get(dependency.value)
      if (!dependencyNode) {
        continue
      }
      computedDeps.add(dependency.value)
      fieldDeps.add(dependencyNode.field)
      const computedDependents = dependentsByComputed.get(dependency.value) ?? new Set<string>()
      computedDependents.add(name)
      dependentsByComputed.set(dependency.value, computedDependents)
    }
    for (const field of fieldDeps) {
      const fieldDependents = dependentsByField.get(field) ?? new Set<string>()
      fieldDependents.add(name)
      dependentsByField.set(field, fieldDependents)
    }
    const orderedFieldDeps = Array.from(fieldDeps)
    const sortedComputedDeps = Array.from(computedDeps)
      .sort((left, right) => {
        const leftIndex = orderIndexByName.get(left) ?? Number.MAX_SAFE_INTEGER
        const rightIndex = orderIndexByName.get(right) ?? Number.MAX_SAFE_INTEGER
        return leftIndex - rightIndex
      })
    fieldDepsByName.set(name, Object.freeze(orderedFieldDeps))
    computedDepsByName.set(name, Object.freeze(sortedComputedDeps))
  }

  for (const name of order) {
    const node = nodeByName.get(name)
    if (!node) {
      continue
    }
    const componentIndex = componentIndexByName.get(name)
    const cycleGroup = typeof componentIndex === "number" && isIterativeComponent(components[componentIndex] ?? [])
      ? Object.freeze([...(components[componentIndex] ?? [])])
      : null
    const sortedDependents = Array.from(dependentsByComputed.get(name) ?? [])
      .sort((left, right) => {
        const leftIndex = orderIndexByName.get(left) ?? Number.MAX_SAFE_INTEGER
        const rightIndex = orderIndexByName.get(right) ?? Number.MAX_SAFE_INTEGER
        return leftIndex - rightIndex
      })
    nodes.set(name, Object.freeze({
      name,
      field: node.field,
      level: levelByName.get(name) ?? 0,
      fieldDeps: fieldDepsByName.get(name) ?? Object.freeze([]),
      computedDeps: computedDepsByName.get(name) ?? Object.freeze([]),
      dependents: Object.freeze(sortedDependents),
      ...(cycleGroup
        ? {
          iterative: true,
          cycleGroup,
        }
        : {}),
    }))
  }

  const affectedByComputedClosure = new Map<string, ReadonlySet<string>>()
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const name = order[index]
    if (!name) {
      continue
    }
    const closure = new Set<string>([name])
    const dependents = dependentsByComputed.get(name)
    if (dependents && dependents.size > 0) {
      for (const dependentName of dependents) {
        const dependentClosure = affectedByComputedClosure.get(dependentName)
        if (!dependentClosure) {
          closure.add(dependentName)
          continue
        }
        for (const computedName of dependentClosure) {
          closure.add(computedName)
        }
      }
    }
    affectedByComputedClosure.set(name, closure)
  }

  const affectedByFieldClosure = new Map<string, ReadonlySet<string>>()
  for (const [field, directDependents] of dependentsByField) {
    const closure = new Set<string>()
    for (const dependentName of directDependents) {
      const dependentClosure = affectedByComputedClosure.get(dependentName)
      if (!dependentClosure) {
        closure.add(dependentName)
        continue
      }
      for (const computedName of dependentClosure) {
        closure.add(computedName)
      }
    }
    affectedByFieldClosure.set(field, closure)
  }

  const directByFieldPrefixClosure = new Map<string, Set<string>>()
  for (const [field, directDependents] of dependentsByField) {
    const ancestors = collectFieldPathAncestors(field)
    if (ancestors.length === 0) {
      continue
    }
    for (const ancestor of ancestors) {
      mergeValueSetIntoMap(directByFieldPrefixClosure, ancestor, directDependents)
    }
  }

  const affectedByFieldPrefixClosure = new Map<string, Set<string>>()
  for (const [field, closure] of affectedByFieldClosure) {
    const ancestors = collectFieldPathAncestors(field)
    if (ancestors.length === 0) {
      continue
    }
    for (const ancestor of ancestors) {
      mergeValueSetIntoMap(affectedByFieldPrefixClosure, ancestor, closure)
    }
  }

  const directByFields = (changedFields: ReadonlySet<string>): ReadonlySet<string> => {
    const affectedNames = new Set<string>()
    for (const rawField of changedFields) {
      const field = rawField.trim()
      if (field.length === 0) {
        continue
      }
      addMapValues(affectedNames, directByFieldPrefixClosure, field)
      const ancestors = collectFieldPathAncestors(field)
      for (const ancestor of ancestors) {
        const directDependents = dependentsByField.get(ancestor)
        if (!directDependents || directDependents.size === 0) {
          continue
        }
        for (const dependentName of directDependents) {
          affectedNames.add(dependentName)
        }
      }
    }
    return affectedNames
  }

  const affectedByFields = (changedFields: ReadonlySet<string>): ReadonlySet<string> => {
    const affectedNames = new Set<string>()
    for (const rawField of changedFields) {
      const field = rawField.trim()
      if (field.length === 0) {
        continue
      }
      addMapValues(affectedNames, affectedByFieldPrefixClosure, field)
      const ancestors = collectFieldPathAncestors(field)
      for (const ancestor of ancestors) {
        addMapValues(affectedNames, affectedByFieldClosure, ancestor)
      }
    }
    return affectedNames
  }

  const affectedByComputed = (changedComputed: ReadonlySet<string>): ReadonlySet<string> => {
    const affectedNames = new Set<string>()
    for (const rawComputed of changedComputed) {
      const computed = rawComputed.trim()
      if (computed.length === 0) {
        continue
      }
      const affectedByComputedValue = affectedByComputedClosure.get(computed)
      if (!affectedByComputedValue) {
        continue
      }
      for (const name of affectedByComputedValue) {
        affectedNames.add(name)
      }
    }
    return affectedNames
  }

  return {
    order: Object.freeze([...order]),
    levels: Object.freeze([...levels]),
    nodes,
    iterativeGroups: Object.freeze(iterativeGroups.map(group => Object.freeze([...group]) as readonly string[])),
    directByFields,
    affectedByFields,
    affectedByComputed,
  }
}

export function snapshotDataGridFormulaExecutionPlan(
  plan: DataGridFormulaExecutionPlan,
): DataGridFormulaExecutionPlanSnapshot {
  const order = Object.freeze([...plan.order])
  const levels = Object.freeze(
    plan.levels.map(level => Object.freeze([...level]) as readonly string[]),
  ) as readonly (readonly string[])[]
  const nodes = Object.freeze(
    order.reduce<DataGridFormulaExecutionPlanNodeSnapshot[]>((accumulator, name) => {
      const node = plan.nodes.get(name)
      if (!node) {
        return accumulator
      }
      accumulator.push({
        name: node.name,
        field: node.field,
        level: node.level,
        fieldDeps: Object.freeze([...node.fieldDeps]),
        computedDeps: Object.freeze([...node.computedDeps]),
        dependents: Object.freeze([...node.dependents]),
        ...(node.iterative ? { iterative: true } : {}),
        ...(node.cycleGroup ? { cycleGroup: Object.freeze([...node.cycleGroup]) } : {}),
      })
      return accumulator
    }, []),
  )
  return {
    order,
    levels,
    nodes,
    ...(plan.iterativeGroups.length > 0
      ? {
        iterativeGroups: Object.freeze(
          plan.iterativeGroups.map(group => Object.freeze([...group]) as readonly string[]),
        ),
      }
      : {}),
  }
}
