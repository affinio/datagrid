import { describe, expect, it } from "vitest"
import { createAdvancedClientRowModel } from "../clientRowModel"

const fullRecompute = {
  recomputeFilter: true,
  recomputeSort: true,
  recomputeGroup: true,
} as const

function createModel<TRow extends { id: string | number }>(
  rows: readonly TRow[],
  options: Record<string, unknown> = {},
) {
  return createAdvancedClientRowModel<TRow>({
    rows: structuredClone(rows),
    resolveRowId: row => row.id,
    ...options,
  } as Parameters<typeof createAdvancedClientRowModel<TRow>>[0])
}

function effectiveValues(model: ReturnType<typeof createModel<any>>, field: string): unknown[] {
  return model.getSourceRows().map(row => model.getEffectiveRowById(row.rowId)?.data[field])
}

function visibleRows(model: ReturnType<typeof createModel<any>>) {
  return model.getRowsInRange({ start: 0, end: 100 }).map(row => ({
    id: row.rowId,
    kind: row.kind,
    data: row.data,
    groupMeta: row.groupMeta,
  }))
}

describe("client row incremental computation and projection equivalence", () => {
  it("reads cold relative and window references from the referenced rows and respects boundaries", () => {
    const rows = [{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "c", v: 3 }]
    const model = createModel(rows, {
      initialFormulaFields: [
        { name: "previous", formula: "COALESCE(v[-1], 0)" },
        { name: "window", formula: "SUM(v[-1:1])" },
        { name: "next", formula: "COALESCE(v[+1], 0)" },
      ],
    })
    try {
      expect(effectiveValues(model, "previous")).toEqual([0, 1, 2])
      expect(effectiveValues(model, "window")).toEqual([3, 6, 5])
      expect(effectiveValues(model, "next")).toEqual([2, 3, 0])
    } finally {
      model.dispose()
    }
  })

  it("invalidates relative, window, computed-chain, and absolute-reference consumers", () => {
    const rows = [{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "c", v: 3 }]
    const model = createModel(rows, {
      initialFormulaFields: [
        { name: "base", formula: "v * 2" },
        { name: "previous", formula: "COALESCE(base[-1], 0)" },
        { name: "window", formula: "SUM(base[-1:1])" },
        { name: "absolute", formula: "[base]1" },
      ],
      formulaReferenceParserOptions: { syntax: "smartsheet", smartsheetAbsoluteRowBase: 1 },
    })
    try {
      expect(effectiveValues(model, "previous")).toEqual([0, 2, 4])
      model.patchRows([{ rowId: "a", data: { v: 8 } }], fullRecompute)
      expect(effectiveValues(model, "base")).toEqual([16, 4, 6])
      expect(effectiveValues(model, "previous")).toEqual([0, 16, 4])
      expect(effectiveValues(model, "window")).toEqual([20, 26, 10])
      expect(effectiveValues(model, "absolute")).toEqual([16, 16, 16])
    } finally {
      model.dispose()
    }
  })

  it("rebuilds overlay presence when setRows replaces an ID at a retained position", () => {
    const model = createModel([{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "c", v: 3 }], {
      initialFormulaFields: [{ name: "double", formula: "v * 2" }],
    })
    try {
      model.setRows([{ id: "x", v: 5 }, { id: "b", v: 2 }, { id: "c", v: 3 }])
      expect(effectiveValues(model, "double")).toEqual([10, 4, 6])
      model.recomputeComputedFields()
      expect(effectiveValues(model, "double")).toEqual([10, 4, 6])
    } finally {
      model.dispose()
    }
  })

  it("applies pivot value changes once and rebuilds row and column membership after removal", () => {
    const model = createModel([
      { id: "a", region: "X", year: 2024, value: 1 },
      { id: "b", region: "Y", year: 2025, value: 2 },
    ], {
      initialFormulaFields: [],
      initialPivotModel: { rows: ["region"], columns: ["year"], values: [{ field: "value", agg: "sum" }] },
    })
    try {
      model.patchRows([{ rowId: "a", data: { value: 8 } }], fullRecompute)
      model.removeRows(["b"])
      const rows = visibleRows(model)
      const columns = model.getSnapshot().pivotColumns ?? []
      expect(rows).toHaveLength(1)
      expect(rows[0]?.data[columns[0]?.id ?? ""]).toBe(8)
      expect(columns.map(column => column.columnPath)).toEqual([[{ field: "year", value: "2024" }]])
    } finally {
      model.dispose()
    }
  })

  it("rebuilds tree aggregates when a leaf aggregate input changes on the group-recompute path", () => {
    const model = createModel([
      { id: "root", parent: null, value: 0 },
      { id: "child", parent: "root", value: 2 },
    ], {
      initialFormulaFields: [],
      initialTreeData: {
        mode: "parent",
        getParentId: (row: { parent: string | null }) => row.parent,
        dependencyFields: ["parent"],
        expandedByDefault: true,
      },
      initialAggregationModel: { columns: [{ key: "value", op: "sum" }] },
    })
    try {
      model.patchRows([{ rowId: "child", data: { value: 9 } }], fullRecompute)
      const root = visibleRows(model).find(row => row.id === "root")
      expect(root?.groupMeta?.aggregates?.value).toBe(9)
    } finally {
      model.dispose()
    }
  })

  it("groups by effective computed values", () => {
    const model = createModel([{ id: "a", value: 1 }, { id: "b", value: 2 }], {
      initialFormulaFields: [{ name: "bucket", formula: "value * 2" }],
      initialGroupBy: { fields: ["bucket"], expandedByDefault: true },
    })
    try {
      expect(visibleRows(model).filter(row => row.kind === "group").map(row => row.groupMeta?.groupValue))
        .toEqual(["2", "4"])
    } finally {
      model.dispose()
    }
  })

  it("aggregates computed pivot measures through the effective field reader", () => {
    const model = createModel([
      { id: "a", region: "X", year: 2024, value: 1 },
      { id: "b", region: "X", year: 2024, value: 2 },
    ], {
      initialFormulaFields: [{ name: "double", formula: "value * 2" }],
      initialPivotModel: { rows: ["region"], columns: ["year"], values: [{ field: "double", agg: "sum" }] },
    })
    try {
      const columnId = model.getSnapshot().pivotColumns?.[0]?.id
      expect(columnId).toBeDefined()
      expect(model.getRow(0)?.data[columnId ?? ""]).toBe(6)
    } finally {
      model.dispose()
    }
  })

  it("restores active sort and grouping semantics when pivot is disabled", () => {
    const rows = [
      { id: "a", region: "X", year: 2024, value: 1 },
      { id: "b", region: "Y", year: 2025, value: 2 },
    ]
    const model = createModel(rows, { initialFormulaFields: [] })
    try {
      model.setPivotModel({ rows: ["region"], columns: ["year"], values: [{ field: "value", agg: "sum" }] })
      model.setSortModel([{ key: "value", direction: "desc" }])
      model.setPivotModel(null)
      expect(model.getRowsInRange({ start: 0, end: 100 }).map(row => row.rowId)).toEqual(["b", "a"])
    } finally {
      model.dispose()
    }
  })

  it("restores nested group rows after edits made while pivot is active", () => {
    const rows = [
      { id: "a", region: "X", team: "one", year: 2024, value: 1 },
      { id: "b", region: "X", team: "two", year: 2025, value: 2 },
    ]
    const model = createModel(rows, {
      initialFormulaFields: [],
      initialGroupBy: { fields: ["region", "team"], expandedByDefault: true },
      initialAggregationModel: { columns: [{ key: "value", op: "sum" }] },
    })
    try {
      model.setPivotModel({ rows: ["region"], columns: ["year"], values: [{ field: "value", agg: "sum" }] })
      model.patchRows([{ rowId: "a", data: { value: 8 } }], fullRecompute)
      model.setSortModel([{ key: "value", direction: "desc" }])
      model.setPivotModel(null)
      expect(visibleRows(model).filter(row => row.kind === "group").map(row => row.groupMeta?.groupValue))
        .toEqual(["X", "one", "two"])
      expect(visibleRows(model).find(row => row.id === "a")?.data.value).toBe(8)
    } finally {
      model.dispose()
    }
  })
})
