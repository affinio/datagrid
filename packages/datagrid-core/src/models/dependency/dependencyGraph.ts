function normalizeFieldPath(field: string): string {
  return field.trim()
}

function forEachFieldPathSegment(
  field: string,
  visitor: (segment: string) => boolean | void,
): void {
  if (field.length === 0) {
    return
  }
  let segmentStart = 0
  for (let index = 0; index <= field.length; index += 1) {
    const isSegmentBoundary = index === field.length || field.charCodeAt(index) === 46
    if (!isSegmentBoundary) {
      continue
    }
    if (index > segmentStart) {
      const segment = field.slice(segmentStart, index)
      if (visitor(segment) === false) {
        return
      }
    }
    segmentStart = index + 1
  }
}

function isPathPrefixOfPath(path: string, prefix: string): boolean {
  if (path.length <= prefix.length) {
    return false
  }
  return path.charCodeAt(prefix.length) === 46 && path.startsWith(prefix)
}

function fieldPathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    isPathPrefixOfPath(left, right) ||
    isPathPrefixOfPath(right, left)
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
  const overlappingStructuralSourcesBuffer = new Set<string>()
  const pathSearchVisited = new Set<string>()
  const pathSearchStack: string[] = []
  const normalizedDependencyFieldsCache = new WeakMap<ReadonlySet<string>, readonly string[]>()

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
    pathSearchVisited.clear()
    pathSearchStack.length = 0
    pathSearchStack.push(fromField)
    while (pathSearchStack.length > 0) {
      const current = pathSearchStack.pop()
      if (!current || pathSearchVisited.has(current)) {
        continue
      }
      pathSearchVisited.add(current)
      const neighbors = outgoingEdgesBySource.get(current)
      if (!neighbors || neighbors.size === 0) {
        continue
      }
      if (neighbors.has(toField)) {
        return true
      }
      for (const neighbor of neighbors) {
        if (!pathSearchVisited.has(neighbor)) {
          pathSearchStack.push(neighbor)
        }
      }
    }
    return false
  }

  const insertStructuralSource = (sourceField: string): void => {
    let currentNode = structuralSourceTrieRoot
    currentNode.subtreeSources.add(sourceField)
    forEachFieldPathSegment(sourceField, (segment) => {
      const existing = currentNode.children.get(segment)
      if (existing) {
        currentNode = existing
      } else {
        const next = createStructuralSourceTrieNode()
        currentNode.children.set(segment, next)
        currentNode = next
      }
      currentNode.subtreeSources.add(sourceField)
    })
    currentNode.terminalSources.add(sourceField)
  }

  const collectOverlappingStructuralSources = (
    fieldPath: string,
    output: Set<string>,
  ): void => {
    output.clear()
    if (fieldPath.length === 0) {
      return
    }
    let currentNode: StructuralSourceTrieNode | undefined = structuralSourceTrieRoot
    for (const sourceField of currentNode.terminalSources) {
      output.add(sourceField)
    }
    forEachFieldPathSegment(fieldPath, (segment) => {
      if (!currentNode) {
        return false
      }
      currentNode = currentNode.children.get(segment)
      if (!currentNode) {
        return false
      }
      for (const sourceField of currentNode.terminalSources) {
        output.add(sourceField)
      }
      return true
    })
    if (currentNode) {
      for (const sourceField of currentNode.subtreeSources) {
        output.add(sourceField)
      }
    }
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
    if (!outgoingEdgeExists && cyclePolicy === "throw") {
      const createsSelfCycle = normalizedSourceField === normalizedDependentField
      const createsGraphCycle = hasOutgoingPath(normalizedDependentField, normalizedSourceField)
      if (createsSelfCycle || createsGraphCycle) {
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
    let queueIndex = 0
    for (const changedField of changedFields) {
      const normalizedField = normalizeFieldPath(changedField)
      if (normalizedField.length === 0 || affected.has(normalizedField)) {
        continue
      }
      affected.add(normalizedField)
      queue.push(normalizedField)
    }

    while (queueIndex < queue.length) {
      const current = queue[queueIndex]
      queueIndex += 1
      if (!current) continue

      if (structuralDependentsBySource.size > 0) {
        collectOverlappingStructuralSources(current, overlappingStructuralSourcesBuffer)
        for (const sourceField of overlappingStructuralSourcesBuffer) {
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
    let normalizedDependencyFields = normalizedDependencyFieldsCache.get(dependencyFields)
    if (!normalizedDependencyFields) {
      const nextNormalizedDependencyFields: string[] = []
      for (const dependency of dependencyFields) {
        const normalized = normalizeFieldPath(dependency)
        if (normalized.length === 0) {
          continue
        }
        nextNormalizedDependencyFields.push(normalized)
      }
      normalizedDependencyFields = nextNormalizedDependencyFields
      normalizedDependencyFieldsCache.set(dependencyFields, normalizedDependencyFields)
    }
    if (normalizedDependencyFields.length === 0) {
      return false
    }
    for (const changed of changedFields) {
      const normalizedChanged = normalizeFieldPath(changed)
      if (normalizedChanged.length === 0) {
        continue
      }
      for (const dependency of normalizedDependencyFields) {
        if (fieldPathsOverlap(normalizedChanged, dependency)) {
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
