export interface ProjectionRequestOptions {
  trackRequested?: boolean
}

export interface ProjectionRecomputeOptions<Stage extends string> {
  blockedStages?: readonly Stage[]
}

export interface ProjectionRecomputeMeta<Stage extends string> {
  hadActualRecompute: boolean
  recomputedStages: readonly Stage[]
  blockedStages: readonly Stage[]
}

export interface ProjectionStageNode<Stage extends string> {
  dependsOn?: readonly Stage[]
}

export interface ProjectionStageGraph<Stage extends string> {
  nodes: Readonly<Record<Stage, ProjectionStageNode<Stage>>>
}

export interface PrepareProjectionStageGraphOptions<Stage extends string> {
  refreshEntryStage?: Stage
}

export interface PreparedProjectionStageGraph<Stage extends string> extends ProjectionStageGraph<Stage> {
  declarationOrder: readonly Stage[]
  stageOrder: readonly Stage[]
  dependents: Readonly<Record<Stage, readonly Stage[]>>
  downstreamByStage: Readonly<Record<Stage, readonly Stage[]>>
}

export interface ProjectionStageEngineOptions<Stage extends string> extends ProjectionStageGraph<Stage> {
  refreshEntryStage: Stage
  preparedGraph?: PreparedProjectionStageGraph<Stage>
}

export interface ProjectionStageEngine<Stage extends string> {
  requestStages: (
    stages: readonly Stage[],
    options?: ProjectionRequestOptions,
  ) => void
  requestRefreshPass: () => void
  hasDirtyStages: () => boolean
  recompute: (
    executeStage: (stage: Stage, shouldRecompute: boolean) => boolean,
    options?: ProjectionRecomputeOptions<Stage>,
  ) => ProjectionRecomputeMeta<Stage> | null
  recomputeFromStage: (
    stage: Stage,
    executeStage: (stage: Stage, shouldRecompute: boolean) => boolean,
    options?: ProjectionRecomputeOptions<Stage>,
  ) => ProjectionRecomputeMeta<Stage> | null
  getStaleStages: () => readonly Stage[]
  expandStages: (stages: readonly Stage[]) => ReadonlySet<Stage>
}

interface ResolvedProjectionGraph<Stage extends string> {
  prepared: PreparedProjectionStageGraph<Stage>
  stageSet: ReadonlySet<Stage>
}

function isPreparedProjectionStageGraph<Stage extends string>(
  graph: ProjectionStageGraph<Stage> | PreparedProjectionStageGraph<Stage>,
): graph is PreparedProjectionStageGraph<Stage> {
  return (
    "stageOrder" in graph &&
    "dependents" in graph &&
    "downstreamByStage" in graph
  )
}

function resolveProjectionGraph<Stage extends string>(
  graph: ProjectionStageGraph<Stage>,
  refreshEntryStage?: Stage,
): ResolvedProjectionGraph<Stage> {
  const nodes = graph.nodes
  if (typeof nodes !== "object" || nodes === null) {
    throw new Error("[projection-engine] graph.nodes must be an object")
  }
  const declarationOrder = Object.keys(nodes) as Stage[]
  if (declarationOrder.length === 0) {
    throw new Error("[projection-engine] graph.nodes must contain at least one stage")
  }

  const stageSet = new Set<Stage>()
  for (const stage of declarationOrder) {
    if (stageSet.has(stage)) {
      throw new Error(`[projection-engine] graph.nodes contains duplicate stage "${String(stage)}"`)
    }
    stageSet.add(stage)
  }

  if (refreshEntryStage !== undefined && !stageSet.has(refreshEntryStage)) {
    throw new Error(
      `[projection-engine] refreshEntryStage "${String(refreshEntryStage)}" is not part of graph.nodes`,
    )
  }

  const dependencies = Object.create(null) as Record<Stage, Stage[]>
  const dependents = Object.create(null) as Record<Stage, Stage[]>
  const getDependentsBucket = (stage: Stage): Stage[] => dependents[stage]
  for (const stage of declarationOrder) {
    dependencies[stage] = []
    dependents[stage] = []
  }

  for (const stage of declarationOrder) {
    const node = nodes[stage]
    if (typeof node !== "object" || node === null) {
      throw new Error(`[projection-engine] graph.nodes["${String(stage)}"] must be an object`)
    }
    const dependsOn: readonly Stage[] = node.dependsOn ?? []
    if (!Array.isArray(dependsOn)) {
      throw new Error(`[projection-engine] graph.nodes["${String(stage)}"].dependsOn must be an array`)
    }
    const seenDependencies = new Set<Stage>()
    for (const dependency of dependsOn) {
      const dependencyStage = dependency as Stage
      if (!stageSet.has(dependency)) {
        throw new Error(
          `[projection-engine] stage "${String(stage)}" depends on unknown stage "${String(dependency)}"`,
        )
      }
      if (seenDependencies.has(dependency)) {
        throw new Error(
          `[projection-engine] stage "${String(stage)}" has duplicate dependency "${String(dependency)}"`,
        )
      }
      seenDependencies.add(dependencyStage)
      dependencies[stage].push(dependencyStage)
      getDependentsBucket(dependencyStage).push(stage)
    }
  }

  const visiting = new Set<Stage>()
  const visited = new Set<Stage>()
  const stack: Stage[] = []
  const visit = (stage: Stage) => {
    if (visited.has(stage)) {
      return
    }
    if (visiting.has(stage)) {
      const cycleStart = stack.indexOf(stage)
      const cyclePath = [...stack.slice(cycleStart), stage].map(String).join(" -> ")
      throw new Error(`[projection-engine] cycle detected in graph: ${cyclePath}`)
    }
    visiting.add(stage)
    stack.push(stage)
    for (const dependency of dependencies[stage]) {
      visit(dependency)
    }
    stack.pop()
    visiting.delete(stage)
    visited.add(stage)
  }

  for (const stage of declarationOrder) {
    visit(stage)
  }

  const declarationIndex = new Map<Stage, number>()
  declarationOrder.forEach((stage, index) => {
    declarationIndex.set(stage, index)
  })

  const indegree = new Map<Stage, number>()
  for (const stage of declarationOrder) {
    indegree.set(stage, dependencies[stage].length)
  }

  const ready: Stage[] = declarationOrder.filter((stage) => (indegree.get(stage) ?? 0) === 0)
  ready.sort((left, right) => {
    return (declarationIndex.get(left) ?? 0) - (declarationIndex.get(right) ?? 0)
  })

  const stageOrder: Stage[] = []
  while (ready.length > 0) {
    const current = ready.shift()
    if (current === undefined) {
      break
    }
    stageOrder.push(current)
    for (const dependent of dependents[current]) {
      const nextIndegree = (indegree.get(dependent) ?? 0) - 1
      indegree.set(dependent, nextIndegree)
      if (nextIndegree === 0) {
        ready.push(dependent)
      }
    }
    ready.sort((left, right) => {
      return (declarationIndex.get(left) ?? 0) - (declarationIndex.get(right) ?? 0)
    })
  }

  if (stageOrder.length !== declarationOrder.length) {
    throw new Error("[projection-engine] failed to compute topological order")
  }

  const stageOrderIndex = new Map<Stage, number>()
  stageOrder.forEach((stage, index) => {
    stageOrderIndex.set(stage, index)
  })

  for (const stage of declarationOrder) {
    dependents[stage].sort((left, right) => {
      return (stageOrderIndex.get(left) ?? 0) - (stageOrderIndex.get(right) ?? 0)
    })
  }

  const downstreamSets = new Map<Stage, Set<Stage>>()
  for (let index = stageOrder.length - 1; index >= 0; index -= 1) {
    const stage = stageOrder[index]
    if (stage === undefined) {
      continue
    }
    const downstream = new Set<Stage>([stage])
    for (const dependent of dependents[stage]) {
      const dependentDownstream = downstreamSets.get(dependent)
      if (!dependentDownstream) {
        continue
      }
      for (const value of dependentDownstream) {
        downstream.add(value)
      }
    }
    downstreamSets.set(stage, downstream)
  }

  const readonlyDependents = Object.create(null) as Record<Stage, readonly Stage[]>
  const downstreamByStage = Object.create(null) as Record<Stage, readonly Stage[]>
  for (const stage of declarationOrder) {
    readonlyDependents[stage] = Object.freeze([...dependents[stage]])
    const downstream = downstreamSets.get(stage)
    const orderedDownstream = stageOrder.filter((candidate) => downstream?.has(candidate) ?? false)
    downstreamByStage[stage] = Object.freeze(orderedDownstream)
  }

  const prepared: PreparedProjectionStageGraph<Stage> = {
    nodes,
    declarationOrder: Object.freeze([...declarationOrder]),
    stageOrder: Object.freeze([...stageOrder]),
    dependents: Object.freeze(readonlyDependents) as Readonly<Record<Stage, readonly Stage[]>>,
    downstreamByStage: Object.freeze(downstreamByStage) as Readonly<Record<Stage, readonly Stage[]>>,
  }

  return {
    prepared,
    stageSet,
  }
}

export function prepareProjectionStageGraph<Stage extends string>(
  graph: ProjectionStageGraph<Stage>,
  options: PrepareProjectionStageGraphOptions<Stage> = {},
): PreparedProjectionStageGraph<Stage> {
  const { refreshEntryStage } = options
  return resolveProjectionGraph(graph, refreshEntryStage).prepared
}

export function expandProjectionStages<Stage extends string>(
  stages: readonly Stage[],
  graph: ProjectionStageGraph<Stage> | PreparedProjectionStageGraph<Stage>,
): ReadonlySet<Stage> {
  const prepared = isPreparedProjectionStageGraph(graph)
    ? graph
    : prepareProjectionStageGraph(graph)
  const stageSet = new Set<Stage>(prepared.declarationOrder)
  const expanded = new Set<Stage>()

  for (const stage of stages) {
    if (!stageSet.has(stage)) {
      throw new Error(`[projection-engine] requested unknown stage "${String(stage)}"`)
    }
    for (const downstream of prepared.downstreamByStage[stage] ?? []) {
      expanded.add(downstream)
    }
  }

  return expanded
}

export function createProjectionStageEngine<Stage extends string>(
  options: ProjectionStageEngineOptions<Stage>,
): ProjectionStageEngine<Stage> {
  const { refreshEntryStage, preparedGraph, ...graph } = options
  const resolved = preparedGraph
    ? (() => {
        const stageSet = new Set<Stage>(preparedGraph.declarationOrder)
        if (!stageSet.has(refreshEntryStage)) {
          throw new Error(
            `[projection-engine] refreshEntryStage "${String(refreshEntryStage)}" is not part of prepared graph`,
          )
        }
        return {
          prepared: preparedGraph,
          stageSet,
        }
      })()
    : resolveProjectionGraph(graph, refreshEntryStage)
  const prepared = resolved.prepared
  const stageSet = resolved.stageSet
  const dirtyStages = new Set<Stage>()
  const requestedRevisions = new Map<Stage, number>()
  const computedRevisions = new Map<Stage, number>()

  for (const stage of prepared.stageOrder) {
    requestedRevisions.set(stage, 0)
    computedRevisions.set(stage, 0)
  }

  const requestStages = (
    stages: readonly Stage[],
    requestOptions: ProjectionRequestOptions = {},
  ): void => {
    if (!Array.isArray(stages) || stages.length === 0) {
      return
    }

    const shouldTrackRequested = requestOptions.trackRequested !== false
    const visited = new Set<Stage>()
    const getDownstreamStages = (stage: Stage): readonly Stage[] => prepared.downstreamByStage[stage]

    for (const stage of stages) {
      const stageKey = stage as Stage
      if (!stageSet.has(stage)) {
        throw new Error(`[projection-engine] requested unknown stage "${String(stage)}"`)
      }
      for (const downstream of getDownstreamStages(stageKey)) {
        if (visited.has(downstream)) {
          continue
        }
        visited.add(downstream)
        if (shouldTrackRequested) {
          requestedRevisions.set(downstream, (requestedRevisions.get(downstream) ?? 0) + 1)
        }
        dirtyStages.add(downstream)
      }
    }
  }

  const recompute = (
    executeStage: (stage: Stage, shouldRecompute: boolean) => boolean,
    recomputeOptions: ProjectionRecomputeOptions<Stage> = {},
  ): ProjectionRecomputeMeta<Stage> | null => {
    if (dirtyStages.size === 0) {
      return null
    }

    const blockedSet = new Set<Stage>(recomputeOptions.blockedStages ?? [])
    for (const stage of blockedSet) {
      if (!stageSet.has(stage)) {
        throw new Error(`[projection-engine] blocked unknown stage "${String(stage)}"`)
      }
    }

    const recomputedStages: Stage[] = []
    const nextDirtyStages = new Set<Stage>()
    let hadActualRecompute = false

    for (const stage of prepared.stageOrder) {
      if (!dirtyStages.has(stage)) {
        continue
      }
      const shouldRecompute = !blockedSet.has(stage)
      const recomputed = executeStage(stage, shouldRecompute)
      if (shouldRecompute && recomputed) {
        computedRevisions.set(stage, requestedRevisions.get(stage) ?? 0)
        recomputedStages.push(stage)
        hadActualRecompute = true
      }
      const requestedRevision = requestedRevisions.get(stage) ?? 0
      const computedRevision = computedRevisions.get(stage) ?? 0
      if (requestedRevision > computedRevision && (!shouldRecompute || !recomputed)) {
        nextDirtyStages.add(stage)
      }
    }

    dirtyStages.clear()
    for (const stage of nextDirtyStages) {
      dirtyStages.add(stage)
    }

    return {
      hadActualRecompute,
      recomputedStages,
      blockedStages: Array.from(blockedSet),
    }
  }

  return {
    requestStages,
    requestRefreshPass: () => {
      requestStages([refreshEntryStage], { trackRequested: false })
    },
    hasDirtyStages: () => dirtyStages.size > 0,
    recompute,
    recomputeFromStage: (
      stage: Stage,
      executeStage: (stage: Stage, shouldRecompute: boolean) => boolean,
      recomputeOptions: ProjectionRecomputeOptions<Stage> = {},
    ): ProjectionRecomputeMeta<Stage> | null => {
      requestStages([stage])
      return recompute(executeStage, recomputeOptions)
    },
    getStaleStages: () => prepared.stageOrder.filter((stage) => {
      return (requestedRevisions.get(stage) ?? 0) > (computedRevisions.get(stage) ?? 0)
    }),
    expandStages: (stages: readonly Stage[]): ReadonlySet<Stage> => expandProjectionStages(stages, prepared),
  }
}
