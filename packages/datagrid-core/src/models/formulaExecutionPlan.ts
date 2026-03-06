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
}

export interface DataGridFormulaExecutionPlan {
  order: readonly string[]
  levels: readonly (readonly string[])[]
  nodes: ReadonlyMap<string, DataGridFormulaExecutionPlanNodeSnapshot>
  directByFields: (changedFields: ReadonlySet<string>) => ReadonlySet<string>
  affectedByFields: (changedFields: ReadonlySet<string>) => ReadonlySet<string>
  affectedByComputed: (changedComputed: ReadonlySet<string>) => ReadonlySet<string>
}

export interface DataGridFormulaExecutionPlanSnapshot {
  order: readonly string[]
  levels: readonly (readonly string[])[]
  nodes: readonly DataGridFormulaExecutionPlanNodeSnapshot[]
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

export function createDataGridFormulaExecutionPlan(
  input: readonly DataGridFormulaExecutionPlanNode[],
): DataGridFormulaExecutionPlan {
  const nodeByName = new Map<string, DataGridFormulaExecutionPlanNode>()
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
  }

  const order: string[] = []
  const visitStateByName = new Map<string, 0 | 1 | 2>()
  const visitNode = (name: string): void => {
    const visitState = visitStateByName.get(name) ?? 0
    if (visitState === 2) {
      return
    }
    if (visitState === 1) {
      throw new Error(`[DataGridFormulaExecutionPlan] Cycle detected at '${name}'.`)
    }

    const node = nodeByName.get(name)
    if (!node) {
      throw new Error(`[DataGridFormulaExecutionPlan] Missing node '${name}'.`)
    }

    visitStateByName.set(name, 1)
    for (const dependency of node.deps) {
      if (dependency.domain !== "computed") {
        continue
      }
      if (!nodeByName.has(dependency.value)) {
        throw new Error(
          `[DataGridFormulaExecutionPlan] Missing computed dependency '${dependency.value}' for '${name}'.`,
        )
      }
      visitNode(dependency.value)
    }
    visitStateByName.set(name, 2)
    order.push(name)
  }

  for (const name of nodeByName.keys()) {
    visitNode(name)
  }

  const levelByName = new Map<string, number>()
  for (const name of order) {
    const node = nodeByName.get(name)
    if (!node) {
      continue
    }
    let level = 0
    for (const dependency of node.deps) {
      if (dependency.domain !== "computed") {
        continue
      }
      const dependencyLevel = levelByName.get(dependency.value) ?? 0
      level = Math.max(level, dependencyLevel + 1)
    }
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
    const sortedDependents = Array.from(dependentsByComputed.get(name) ?? [])
      .sort((left, right) => {
        const leftIndex = orderIndexByName.get(left) ?? Number.MAX_SAFE_INTEGER
        const rightIndex = orderIndexByName.get(right) ?? Number.MAX_SAFE_INTEGER
        return leftIndex - rightIndex
      })
    nodes.set(name, {
      name,
      field: node.field,
      level: levelByName.get(name) ?? 0,
      fieldDeps: fieldDepsByName.get(name) ?? Object.freeze([]),
      computedDeps: computedDepsByName.get(name) ?? Object.freeze([]),
      dependents: Object.freeze(sortedDependents),
    })
  }

  const affectedByFieldClosureCache = new Map<string, ReadonlySet<string>>()
  const affectedByComputedClosureCache = new Map<string, ReadonlySet<string>>()

  const resolveAffectedByField = (field: string): ReadonlySet<string> => {
    const normalizedField = field.trim()
    if (normalizedField.length === 0) {
      return new Set<string>()
    }
    const cached = affectedByFieldClosureCache.get(normalizedField)
    if (cached) {
      return cached
    }
    const affectedNames = new Set<string>()
    const fieldQueue = [normalizedField]
    const visitedFields = new Set<string>()

    while (fieldQueue.length > 0) {
      const field = fieldQueue.shift()
      if (!field || visitedFields.has(field)) {
        continue
      }
      visitedFields.add(field)
      const dependents = dependentsByField.get(field)
      if (!dependents || dependents.size === 0) {
        continue
      }
      for (const dependentName of dependents) {
        if (affectedNames.has(dependentName)) {
          continue
        }
        affectedNames.add(dependentName)
        const dependentField = nodeByName.get(dependentName)?.field
        if (dependentField) {
          fieldQueue.push(dependentField)
        }
      }
    }
    const frozen = Object.freeze(Array.from(affectedNames))
    const asSet = new Set<string>(frozen)
    affectedByFieldClosureCache.set(normalizedField, asSet)
    return asSet
  }

  const resolveAffectedByComputed = (computed: string): ReadonlySet<string> => {
    const normalizedComputed = computed.trim()
    if (normalizedComputed.length === 0) {
      return new Set<string>()
    }
    const cached = affectedByComputedClosureCache.get(normalizedComputed)
    if (cached) {
      return cached
    }
    const affectedNames = new Set<string>()
    const computedQueue = [normalizedComputed]
    while (computedQueue.length > 0) {
      const computedName = computedQueue.shift()
      if (!computedName || affectedNames.has(computedName) || !nodeByName.has(computedName)) {
        continue
      }
      affectedNames.add(computedName)
      const dependents = dependentsByComputed.get(computedName)
      if (!dependents || dependents.size === 0) {
        continue
      }
      for (const dependentName of dependents) {
        computedQueue.push(dependentName)
      }
    }
    const frozen = Object.freeze(Array.from(affectedNames))
    const asSet = new Set<string>(frozen)
    affectedByComputedClosureCache.set(normalizedComputed, asSet)
    return asSet
  }

  const directByFields = (changedFields: ReadonlySet<string>): ReadonlySet<string> => {
    const affectedNames = new Set<string>()
    for (const rawField of changedFields) {
      const field = rawField.trim()
      if (field.length === 0) {
        continue
      }
      const directDependents = dependentsByField.get(field)
      if (!directDependents || directDependents.size === 0) {
        continue
      }
      for (const dependentName of directDependents) {
        affectedNames.add(dependentName)
      }
    }
    return affectedNames
  }

  const affectedByFields = (changedFields: ReadonlySet<string>): ReadonlySet<string> => {
    const affectedNames = new Set<string>()
    for (const field of changedFields) {
      const affectedByField = resolveAffectedByField(field)
      for (const name of affectedByField) {
        affectedNames.add(name)
      }
    }
    return affectedNames
  }

  const affectedByComputed = (changedComputed: ReadonlySet<string>): ReadonlySet<string> => {
    const affectedNames = new Set<string>()
    for (const computed of changedComputed) {
      const affectedByComputedValue = resolveAffectedByComputed(computed)
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
    order
      .map((name) => {
        const node = plan.nodes.get(name)
        if (!node) {
          return null
        }
        return {
          name: node.name,
          field: node.field,
          level: node.level,
          fieldDeps: Object.freeze([...node.fieldDeps]),
          computedDeps: Object.freeze([...node.computedDeps]),
          dependents: Object.freeze([...node.dependents]),
        } satisfies DataGridFormulaExecutionPlanNodeSnapshot
      })
      .filter((node): node is DataGridFormulaExecutionPlanNodeSnapshot => node !== null),
  )
  return {
    order,
    levels,
    nodes,
  }
}
