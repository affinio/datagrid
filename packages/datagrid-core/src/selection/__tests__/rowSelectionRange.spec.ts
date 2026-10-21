import { describe, expect, it } from "vitest"
import { resolveDataGridSelectableRowRange } from "../rowSelectionRange.js"

const projection = [
  { rowId: "r1", kind: "data" as const },
  { rowId: "group:a", kind: "group" as const },
  { rowId: "r2", kind: "data" as const },
  { rowId: null, kind: "unloaded" as const },
  { rowId: "r4", kind: "data" as const },
]

function resolve(anchorRowId: string, targetRowId: string, projectionRevision = 4) {
  return resolveDataGridSelectableRowRange({
    anchorRowId,
    targetRowId,
    projectionRevision,
    currentProjectionRevision: 4,
    resolveRowIndexById: rowId => projection.findIndex(row => row.rowId === rowId) < 0
      ? null
      : projection.findIndex(row => row.rowId === rowId),
    resolveRowAtIndex: index => projection[index] ?? null,
  })
}

describe("resolveDataGridSelectableRowRange", () => {
  it("resolves IDs in logical projection order, skipping group nodes", () => {
    expect(resolve("r1", "r2")).toEqual({
      status: "complete",
      projectionRevision: 4,
      rowIds: ["r1", "r2"],
    })
  })

  it("blocks ranges that cross an unloaded projection segment", () => {
    expect(resolve("r2", "r4")).toEqual({
      status: "incomplete",
      projectionRevision: 4,
      rowIds: [],
    })
  })

  it("replaces a missing anchor with a single target and rejects stale projections", () => {
    expect(resolve("missing", "r2")).toMatchObject({ status: "anchor-missing", rowIds: ["r2"] })
    expect(resolve("r1", "r2", 3)).toMatchObject({ status: "stale", rowIds: [] })
  })

  it("rejects non-data targets and excludes explicitly unselectable rows", () => {
    expect(resolve("r1", "group:a")).toMatchObject({ status: "target-unselectable" })
    const result = resolveDataGridSelectableRowRange({
      anchorRowId: "r1",
      targetRowId: "r2",
      projectionRevision: 4,
      currentProjectionRevision: 4,
      resolveRowIndexById: rowId => rowId === "r1" ? 0 : rowId === "r2" ? 2 : null,
      resolveRowAtIndex: index => [
        { rowId: "r1", kind: "data" as const, selectable: false },
        { rowId: "group:a", kind: "group" as const },
        { rowId: "r2", kind: "data" as const },
      ][index] ?? null,
    })
    expect(result).toMatchObject({ status: "complete", rowIds: ["r2"] })
  })
})
