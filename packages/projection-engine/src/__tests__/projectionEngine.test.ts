import { describe, expect, it } from "vitest"
import {
  createProjectionStageEngine,
  prepareProjectionStageGraph,
  expandProjectionStages,
} from "../index"

type Stage = "filter" | "sort" | "group"

const GRAPH = {
  nodes: {
    filter: {},
    sort: { dependsOn: ["filter"] },
    group: { dependsOn: ["sort"] },
  } as const satisfies Record<Stage, { dependsOn?: readonly Stage[] }>,
}

describe("projection-engine", () => {
  it("expands dependency closure deterministically", () => {
    const expanded = expandProjectionStages<Stage>(["sort"], GRAPH)
    expect(Array.from(expanded)).toEqual(["sort", "group"])
  })

  it("expands via prepared graph without re-resolving definitions", () => {
    const prepared = prepareProjectionStageGraph<Stage>(GRAPH)
    const expanded = expandProjectionStages<Stage>(["sort"], prepared)
    expect(Array.from(expanded)).toEqual(["sort", "group"])
  })

  it("reuses prepared graph for engine runtime", () => {
    const prepared = prepareProjectionStageGraph<Stage>(GRAPH, { refreshEntryStage: "filter" })
    const engine = createProjectionStageEngine<Stage>({
      nodes: prepared.nodes,
      preparedGraph: prepared,
      refreshEntryStage: "filter",
    })

    engine.requestStages(["filter"])
    const executed: Stage[] = []
    const meta = engine.recompute((stage, shouldRecompute) => {
      executed.push(stage)
      return shouldRecompute
    })

    expect(executed).toEqual(["filter", "sort", "group"])
    expect(meta?.recomputedStages).toEqual(["filter", "sort", "group"])
  })

  it("tracks stale stages when requested but blocked", () => {
    const engine = createProjectionStageEngine<Stage>({
      ...GRAPH,
      refreshEntryStage: "filter",
    })

    engine.requestStages(["filter"])
    const meta = engine.recompute(
      () => false,
      { blockedStages: ["filter", "sort", "group"] },
    )

    expect(meta?.hadActualRecompute).toBe(false)
    expect(engine.getStaleStages()).toEqual(["filter", "sort", "group"])
  })

  it("heals stale stage when later recomputed", () => {
    const engine = createProjectionStageEngine<Stage>({
      ...GRAPH,
      refreshEntryStage: "filter",
    })

    engine.requestStages(["sort"])
    engine.recompute(() => false, { blockedStages: ["sort", "group"] })
    expect(engine.getStaleStages()).toEqual(["sort", "group"])

    const executeOrder: Stage[] = []
    engine.requestStages(["sort"])
    const meta = engine.recompute((stage, shouldRecompute) => {
      executeOrder.push(stage)
      return shouldRecompute
    })

    expect(executeOrder).toEqual(["sort", "group"])
    expect(meta?.recomputedStages).toEqual(["sort", "group"])
    expect(engine.getStaleStages()).toEqual([])
  })

  it("keeps dirty when executeStage reports no recompute under requested revision drift", () => {
    const engine = createProjectionStageEngine<Stage>({
      ...GRAPH,
      refreshEntryStage: "filter",
    })

    engine.requestStages(["sort"])
    const firstMeta = engine.recompute((stage, shouldRecompute) => {
      if (stage === "sort" && shouldRecompute) {
        return false
      }
      return shouldRecompute
    })

    expect(firstMeta?.recomputedStages).toEqual(["group"])
    expect(engine.hasDirtyStages()).toBe(true)
    expect(engine.getStaleStages()).toContain("sort")

    const secondMeta = engine.recompute((_stage, shouldRecompute) => shouldRecompute)
    expect(secondMeta?.recomputedStages).toEqual(["sort"])
    expect(engine.hasDirtyStages()).toBe(false)
    expect(engine.getStaleStages()).toEqual([])
  })

  it("keeps stale blocked stages dirty until they are recomputed", () => {
    const engine = createProjectionStageEngine<Stage>({
      ...GRAPH,
      refreshEntryStage: "filter",
    })

    engine.requestStages(["sort"])
    engine.recompute(() => false, { blockedStages: ["sort", "group"] })
    expect(engine.hasDirtyStages()).toBe(true)
    expect(engine.getStaleStages()).toEqual(["sort", "group"])

    const executed: Stage[] = []
    const meta = engine.recompute((stage, shouldRecompute) => {
      executed.push(stage)
      return shouldRecompute
    })

    expect(executed).toEqual(["sort", "group"])
    expect(meta?.recomputedStages).toEqual(["sort", "group"])
    expect(engine.hasDirtyStages()).toBe(false)
    expect(engine.getStaleStages()).toEqual([])
  })

  it("supports refresh pass without growing requested revisions", () => {
    const engine = createProjectionStageEngine<Stage>({
      ...GRAPH,
      refreshEntryStage: "filter",
    })

    engine.requestRefreshPass()
    const refreshMeta = engine.recompute((_stage) => true)
    expect(refreshMeta?.recomputedStages).toEqual(["filter", "sort", "group"])
    expect(engine.getStaleStages()).toEqual([])

    engine.requestStages(["sort"])
    engine.recompute(() => false, { blockedStages: ["sort", "group"] })
    expect(engine.getStaleStages()).toEqual(["sort", "group"])
  })

  it("derives topological order from declarative graph, independent from declaration order", () => {
    const engine = createProjectionStageEngine<Stage>({
      nodes: {
        sort: { dependsOn: ["filter"] },
        group: { dependsOn: ["sort"] },
        filter: {},
      },
      refreshEntryStage: "filter",
    })

    engine.requestStages(["filter"])
    const executed: Stage[] = []
    engine.recompute((stage, shouldRecompute) => {
      executed.push(stage)
      return shouldRecompute
    })

    expect(executed).toEqual(["filter", "sort", "group"])
  })

  it("throws when stage dependency references unknown stage", () => {
    expect(() => createProjectionStageEngine<Stage>({
      nodes: {
        filter: {},
        sort: { dependsOn: ["filter"] },
        group: { dependsOn: ["unknown" as Stage] },
      },
      refreshEntryStage: "filter",
    })).toThrow(/unknown stage/i)
  })

  it("throws when graph has a cycle", () => {
    expect(() => createProjectionStageEngine<Stage>({
      nodes: {
        filter: { dependsOn: ["group"] },
        sort: { dependsOn: ["filter"] },
        group: { dependsOn: ["sort"] },
      },
      refreshEntryStage: "filter",
    })).toThrow(/cycle/i)
  })

  it("throws when refresh entry stage is outside graph", () => {
    expect(() => createProjectionStageEngine<Stage>({
      ...GRAPH,
      refreshEntryStage: "unknown" as Stage,
    })).toThrow(/refreshEntryStage/i)
  })
})
