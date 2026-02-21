import { describe, expect, it } from "vitest"
import { createDataGridDependencyGraph } from "../dependencyGraph"

describe("createDataGridDependencyGraph", () => {
  it("expands transitive field dependencies", () => {
    const graph = createDataGridDependencyGraph([
      { sourceField: "raw.score", dependentField: "computed.score" },
      { sourceField: "computed.score", dependentField: "sort.score" },
    ])

    const affected = graph.getAffectedFields(new Set<string>(["raw"]))
    expect(affected.has("raw")).toBe(true)
    expect(affected.has("computed.score")).toBe(true)
    expect(affected.has("sort.score")).toBe(true)
  })

  it("checks dependency intersections against expanded field sets", () => {
    const graph = createDataGridDependencyGraph([
      { sourceField: "updatedAt", dependentField: "testedAt" },
    ])
    const affected = graph.getAffectedFields(new Set<string>(["updatedAt"]))
    expect(graph.affectsAny(affected, new Set<string>(["testedAt"]))).toBe(true)
    expect(graph.affectsAny(affected, new Set<string>(["status"]))).toBe(false)
  })

  it("matches both ancestor and descendant structural source paths", () => {
    const graph = createDataGridDependencyGraph([
      { sourceField: "raw", dependentField: "stage:ancestor", kind: "structural" },
      { sourceField: "raw.deep", dependentField: "stage:descendant", kind: "structural" },
    ])
    const fromNested = graph.getAffectedFields(new Set<string>(["raw.deep.value"]))
    expect(fromNested.has("stage:ancestor")).toBe(true)
    expect(fromNested.has("stage:descendant")).toBe(true)

    const fromParent = graph.getAffectedFields(new Set<string>(["raw"]))
    expect(fromParent.has("stage:descendant")).toBe(true)
  })

  it("treats computed dependencies as exact-token edges", () => {
    const graph = createDataGridDependencyGraph([
      { sourceField: "raw.score", dependentField: "computed.score", kind: "structural" },
      { sourceField: "computed.score", dependentField: "computed:total", kind: "computed" },
      { sourceField: "computed:total", dependentField: "sort.score", kind: "computed" },
    ])
    const affected = graph.getAffectedFields(new Set<string>(["raw"]))

    expect(affected.has("raw")).toBe(true)
    expect(affected.has("computed.score")).toBe(true)
    expect(affected.has("computed:total")).toBe(true)
    expect(affected.has("sort.score")).toBe(true)
  })

  it("throws on dependency cycle by default", () => {
    const graph = createDataGridDependencyGraph()
    graph.registerDependency("computed:a", "computed:b", { kind: "computed" })
    expect(() => {
      graph.registerDependency("computed:b", "computed:a", { kind: "computed" })
    }).toThrow(/Cycle detected/)
  })

  it("allows cycle registration when cycle policy is allow", () => {
    const graph = createDataGridDependencyGraph([], { cyclePolicy: "allow" })
    graph.registerDependency("computed:a", "computed:b", { kind: "computed" })
    graph.registerDependency("computed:b", "computed:a", { kind: "computed" })

    const affected = graph.getAffectedFields(new Set<string>(["computed:a"]))
    expect(affected.has("computed:a")).toBe(true)
    expect(affected.has("computed:b")).toBe(true)
  })
})
