import { describe, expect, it } from "vitest"
import { resolveClientProjectionInvalidationStages } from "../projection/projectionStages"

describe("projectionStages invalidation mapping", () => {
  it("expands compute-root reasons to full stage chain", () => {
    expect(resolveClientProjectionInvalidationStages(["rowsChanged"])).toEqual([
      "compute",
      "filter",
      "sort",
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
    expect(resolveClientProjectionInvalidationStages(["computedChanged"])).toEqual([
      "compute",
      "filter",
      "sort",
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
    expect(resolveClientProjectionInvalidationStages(["manualRefresh"])).toEqual([
      "compute",
      "filter",
      "sort",
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
  })

  it("expands sortChanged to tail chain", () => {
    expect(resolveClientProjectionInvalidationStages(["sortChanged"])).toEqual([
      "sort",
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
  })
})
