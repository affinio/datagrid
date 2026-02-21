function normalizeFieldPath(field: string): string {
  return field.trim()
}

function splitFieldPath(field: string): readonly string[] {
  if (field.length === 0) {
    return []
  }
  return field.split(".").filter(Boolean)
}

function fieldPathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}.`) ||
    right.startsWith(`${left}.`)
  )
}

interface StructuralSourceTrieNode {
  children: Map<string, StructuralSourceTrieNode>
  terminalSources: Set<string>
  subtreeSources: Set<string>
}

function createStructuralSourceTrieNode(): StructuralSourceTrieNode {
  return {
    children: new Map<string, StructuralSourceTrieNode>(),
    terminalSources: new Set<string>(),
    subtreeSources: new Set<string>(),
  }
}

export type DataGridDependencyKind = "structural" | "computed"
export type DataGridDependencyCyclePolicy = "throw" | "allow"

export interface DataGridFieldDependency {
  sourceField: string
  dependentField: string
  kind?: DataGridDependencyKind
}

export interface DataGridRegisterDependencyOptions {
  kind?: DataGridDependencyKind
}

export interface CreateDataGridDependencyGraphOptions {
  cyclePolicy?: DataGridDependencyCyclePolicy
}

export interface DataGridDependencyGraph {
  registerDependency: (
    sourceField: string,
    dependentField: string,
    options?: DataGridRegisterDependencyOptions,
  ) => void
  getAffectedFields: (changedFields: ReadonlySet<string>) => ReadonlySet<string>
  affectsAny: (
    changedFields: ReadonlySet<string>,
    dependencyFields: ReadonlySet<string>,
  ) => boolean
}

export function createDataGridDependencyGraph(
  initialDependencies: readonly DataGridFieldDependency[] = [],
  options: CreateDataGridDependencyGraphOptions = {},
): DataGridDependencyGraph {
  const cyclePolicy = options.cyclePolicy ?? "throw"
  const structuralDependentsBySource = new Map<string, Set<string>>()
  const computedDependentsBySource = new Map<string, Set<string>>()
  const outgoingEdgesBySource = new Map<string, Set<string>>()
  const structuralSourceTrieRoot = createStructuralSourceTrieNode()

  const addMapEdge = (
    targetMap: Map<string, Set<string>>,
    sourceField: string,
    dependentField: string,
  ): boolean => {
    const existing = targetMap.get(sourceField)
    if (existing) {
      if (existing.has(dependentField)) {
        return false
      }
      existing.add(dependentField)
      return true
    }
    targetMap.set(sourceField, new Set<string>([dependentField]))
    return true
  }

  const addOutgoingEdge = (
    sourceField: string,
    dependentField: string,
  ): void => {
    const existing = outgoingEdgesBySource.get(sourceField)
    if (existing) {
      existing.add(dependentField)
      return
    }
    outgoingEdgesBySource.set(sourceField, new Set<string>([dependentField]))
  }

  const hasOutgoingPath = (
    fromField: string,
    toField: string,
  ): boolean => {
    if (fromField === toField) {
      return true
    }
    const visited = new Set<string>()
    const stack: string[] = [fromField]
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || visited.has(current)) {
        continue
      }
      visited.add(current)
      const neighbors = outgoingEdgesBySource.get(current)
      if (!neighbors || neighbors.size === 0) {
        continue
      }
      if (neighbors.has(toField)) {
        return true
      }
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor)
        }
      }
    }
    return false
  }

  const insertStructuralSource = (sourceField: string): void => {
    const segments = splitFieldPath(sourceField)
    let currentNode = structuralSourceTrieRoot
    currentNode.subtreeSources.add(sourceField)
    for (const segment of segments) {
      const existing = currentNode.children.get(segment)
      if (existing) {
        currentNode = existing
      } else {
        const next = createStructuralSourceTrieNode()
        currentNode.children.set(segment, next)
        currentNode = next
      }
      currentNode.subtreeSources.add(sourceField)
    }
    currentNode.terminalSources.add(sourceField)
  }

  const collectOverlappingStructuralSources = (
    fieldPath: string,
  ): ReadonlySet<string> => {
    if (fieldPath.length === 0) {
      return new Set<string>()
    }
    const segments = splitFieldPath(fieldPath)
    const overlappingSources = new Set<string>()
    let currentNode: StructuralSourceTrieNode | undefined = structuralSourceTrieRoot
    for (const sourceField of currentNode.terminalSources) {
      overlappingSources.add(sourceField)
    }
    for (const segment of segments) {
      currentNode = currentNode.children.get(segment)
      if (!currentNode) {
        break
      }
      for (const sourceField of currentNode.terminalSources) {
        overlappingSources.add(sourceField)
      }
    }
    if (currentNode) {
      for (const sourceField of currentNode.subtreeSources) {
        overlappingSources.add(sourceField)
      }
    }
    return overlappingSources
  }

  const registerDependency = (
    sourceField: string,
    dependentField: string,
    registerOptions: DataGridRegisterDependencyOptions = {},
  ): void => {
    const normalizedSourceField = normalizeFieldPath(sourceField)
    const normalizedDependentField = normalizeFieldPath(dependentField)
    if (normalizedSourceField.length === 0 || normalizedDependentField.length === 0) {
      return
    }
    const kind = registerOptions.kind ?? "structural"
    const targetMap = kind === "computed"
      ? computedDependentsBySource
      : structuralDependentsBySource

    const alreadyExistsForKind = targetMap.get(normalizedSourceField)?.has(normalizedDependentField) ?? false
    if (alreadyExistsForKind) {
      return
    }
    const outgoingEdgeExists = outgoingEdgesBySource.get(normalizedSourceField)?.has(normalizedDependentField) ?? false
    if (!outgoingEdgeExists) {
      const createsSelfCycle = normalizedSourceField === normalizedDependentField
      const createsGraphCycle = hasOutgoingPath(normalizedDependentField, normalizedSourceField)
      if ((createsSelfCycle || createsGraphCycle) && cyclePolicy === "throw") {
        throw new Error(
          `[DataGridDependencyGraph] Cycle detected for dependency '${normalizedSourceField}' -> '${normalizedDependentField}'.`,
        )
      }
    }

    const inserted = addMapEdge(targetMap, normalizedSourceField, normalizedDependentField)
    if (!inserted) {
      return
    }
    if (kind === "structural") {
      insertStructuralSource(normalizedSourceField)
    }
    addOutgoingEdge(normalizedSourceField, normalizedDependentField)
  }

  for (const dependency of initialDependencies) {
    registerDependency(
      dependency.sourceField,
      dependency.dependentField,
      { kind: dependency.kind },
    )
  }

  const getAffectedFields = (
    changedFields: ReadonlySet<string>,
  ): ReadonlySet<string> => {
    if (
      changedFields.size === 0 ||
      (structuralDependentsBySource.size === 0 && computedDependentsBySource.size === 0)
    ) {
      return new Set<string>(changedFields)
    }
    const affected = new Set<string>()
    const queue: string[] = []
    for (const changedField of changedFields) {
      const normalizedField = normalizeFieldPath(changedField)
      if (normalizedField.length === 0 || affected.has(normalizedField)) {
        continue
      }
      affected.add(normalizedField)
      queue.push(normalizedField)
    }

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        continue
      }

      if (structuralDependentsBySource.size > 0) {
        const overlappingSources = collectOverlappingStructuralSources(current)
        for (const sourceField of overlappingSources) {
          const dependentFields = structuralDependentsBySource.get(sourceField)
          if (!dependentFields) {
            continue
          }
          for (const dependentField of dependentFields) {
            if (affected.has(dependentField)) {
              continue
            }
            affected.add(dependentField)
            queue.push(dependentField)
          }
        }
      }

      const computedDependents = computedDependentsBySource.get(current)
      if (!computedDependents) {
        continue
      }
      for (const dependentField of computedDependents) {
        if (affected.has(dependentField)) {
          continue
        }
        affected.add(dependentField)
        queue.push(dependentField)
      }
    }

    return affected
  }

  const affectsAny = (
    changedFields: ReadonlySet<string>,
    dependencyFields: ReadonlySet<string>,
  ): boolean => {
    if (changedFields.size === 0 || dependencyFields.size === 0) {
      return false
    }
    for (const changed of changedFields) {
      for (const dependency of dependencyFields) {
        if (fieldPathsOverlap(changed, dependency)) {
          return true
        }
      }
    }
    return false
  }

  return {
    registerDependency,
    getAffectedFields,
    affectsAny,
  }
}
