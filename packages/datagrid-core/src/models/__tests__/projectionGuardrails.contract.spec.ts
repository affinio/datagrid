import { describe, expect, it } from "vitest"
import {
  createClientRowModel,
  createDataGridDependencyGraph,
} from "../index"

describe("projection guardrails contract", () => {
  it("fails fast on dependency cycles by default", () => {
    const graph = createDataGridDependencyGraph()
    graph.registerDependency("computed:a", "computed:b", { kind: "computed" })
    expect(() => {
      graph.registerDependency("computed:b", "computed:a", { kind: "computed" })
    }).toThrow(/Cycle detected/)
  })

  it("keeps token-domain invalidation deterministic across field/computed/meta edges", () => {
    const graph = createDataGridDependencyGraph([
      { sourceField: "field:testedAt", dependentField: "computed:testedAge", kind: "computed" },
      { sourceField: "computed:testedAge", dependentField: "meta:rowColor", kind: "computed" },
    ])

    const affected = graph.getAffectedFields(new Set<string>(["field:testedAt"]))
    expect(affected.has("field:testedAt")).toBe(true)
    expect(affected.has("computed:testedAge")).toBe(true)
    expect(affected.has("meta:rowColor")).toBe(true)
    expect(graph.affectsAny(affected, new Set<string>(["meta:rowColor"]))).toBe(true)
    expect(graph.affectsAny(affected, new Set<string>(["meta:unrelated"]))).toBe(false)
  })

  it("prevents stale sort cache reuse with rowVersion identity on partial patch", () => {
    const scoreReadsByRowId = new Map<string, number>()
    const makeRow = (rowId: string, testedAt: number) => {
      const row = { id: rowId, testedAt } as {
        id: string
        testedAt: number
        score: number
      }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          scoreReadsByRowId.set(rowId, (scoreReadsByRowId.get(rowId) ?? 0) + 1)
          return this.testedAt
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: makeRow("r1", 10), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: makeRow("r2", 20), rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc" }])
    expect(scoreReadsByRowId.get("r1")).toBe(1)
    expect(scoreReadsByRowId.get("r2")).toBe(1)

    model.patchRows([{ rowId: "r1", data: { testedAt: 30 } }], { recomputeSort: false })
    model.refresh("manual")

    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))).toEqual(["r2", "r1"])
    expect(scoreReadsByRowId.get("r1")).toBe(2)
    expect(scoreReadsByRowId.get("r2")).toBe(1)

    model.dispose()
  })
})
