import { describe, expect, it } from "vitest"
import {
  createDataGridDependencyEdge,
  isDataGridDependencyTokenDomain,
  normalizeDataGridDependencyToken,
  parseDataGridDependencyNode,
} from "../dependencyModel"

describe("dependencyModel", () => {
  it("normalizes dependency tokens into explicit domains", () => {
    expect(normalizeDataGridDependencyToken("testedAt")).toBe("field:testedAt")
    expect(normalizeDataGridDependencyToken("computed:latencyRank")).toBe("computed:latencyRank")
    expect(normalizeDataGridDependencyToken("meta:rowTone")).toBe("meta:rowTone")
  })

  it("parses nodes with domain-specific payload contracts", () => {
    expect(parseDataGridDependencyNode("field:service.region")).toEqual({
      kind: "field",
      token: "field:service.region",
      path: "service.region",
    })
    expect(parseDataGridDependencyNode("computed:latencyRank")).toEqual({
      kind: "computed",
      token: "computed:latencyRank",
      name: "latencyRank",
    })
    expect(parseDataGridDependencyNode("meta:rowColor")).toEqual({
      kind: "meta",
      token: "meta:rowColor",
      key: "rowColor",
    })
  })

  it("creates typed dependency edges with explicit source/target nodes", () => {
    const edge = createDataGridDependencyEdge({
      sourceToken: "field:testedAt",
      targetToken: "computed:testedAge",
      kind: "computed",
    })
    expect(edge.kind).toBe("computed")
    expect(edge.source.kind).toBe("field")
    expect(edge.target.kind).toBe("computed")
  })

  it("guards unknown or empty domains/tokens", () => {
    expect(isDataGridDependencyTokenDomain("field")).toBe(true)
    expect(isDataGridDependencyTokenDomain("computed")).toBe(true)
    expect(isDataGridDependencyTokenDomain("meta")).toBe(true)
    expect(isDataGridDependencyTokenDomain("unknown")).toBe(false)
    expect(() => parseDataGridDependencyNode("computed:")).toThrow(/empty payload/i)
    expect(() => normalizeDataGridDependencyToken("   ")).toThrow(/must be non-empty/i)
  })
})
