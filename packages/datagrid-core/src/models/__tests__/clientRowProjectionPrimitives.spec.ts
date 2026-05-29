import { describe, expect, it } from "vitest"
import { createFilterPredicate, hasActiveFilterModel, sortLeafRows } from "../projection/clientRowProjectionPrimitives"
import type { DataGridFilterSnapshot, DataGridRowNode } from "../rowModel"

interface Row {
  rowId: string
  service: string
  owner: string
  status: string
  latencyMs: number
}

function createRowNode(row: Row, index: number): DataGridRowNode<Row> {
  return {
    kind: "leaf",
    data: row,
    row,
    rowKey: row.rowId,
    rowId: row.rowId,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
  }
}

function createFilterModel(quickFilter: DataGridFilterSnapshot["quickFilter"]): DataGridFilterSnapshot {
  return {
    columnFilters: {},
    advancedFilters: {},
    quickFilter,
  }
}

describe("client row projection quick filter predicate", () => {
  const rows = [
    createRowNode({ rowId: "r1", service: "api", owner: "ops", status: "active", latencyMs: 200 }, 0),
    createRowNode({ rowId: "r2", service: "worker", owner: "platform", status: "active", latencyMs: 80 }, 1),
    createRowNode({ rowId: "r3", service: "api", owner: "platform", status: "paused", latencyMs: 120 }, 2),
  ]

  it("matches a quick filter query against one explicit column", () => {
    const predicate = createFilterPredicate(createFilterModel({
      query: "  API ",
      columns: ["service"],
    }))

    expect(rows.filter(predicate).map(row => row.rowId)).toEqual(["r1", "r3"])
  })

  it("matches a quick filter query against multiple explicit columns", () => {
    const predicate = createFilterPredicate(createFilterModel({
      query: "platform",
      columns: ["service", "owner"],
    }))

    expect(rows.filter(predicate).map(row => row.rowId)).toEqual(["r2", "r3"])
  })

  it("does not filter rows for an empty quick filter query", () => {
    const predicate = createFilterPredicate(createFilterModel({
      query: "   ",
      columns: ["service"],
    }))

    expect(rows.filter(predicate).map(row => row.rowId)).toEqual(["r1", "r2", "r3"])
  })

  it("composes quick filter with column filters through AND", () => {
    const filterModel: DataGridFilterSnapshot = {
      columnFilters: {
        service: { kind: "valueSet", tokens: ["string:api"] },
      },
      advancedFilters: {},
      quickFilter: {
        query: "platform",
        columns: ["owner"],
      },
    }
    const predicate = createFilterPredicate(filterModel)

    expect(rows.filter(predicate).map(row => row.rowId)).toEqual(["r3"])
  })

  it("matches value-set filters across primitive token types", () => {
    const filterModel: DataGridFilterSnapshot = {
      columnFilters: {
        service: { kind: "valueSet", tokens: ["string:API"] },
        latencyMs: { kind: "valueSet", tokens: ["number:200"] },
      },
      advancedFilters: {},
    }
    const predicate = createFilterPredicate(filterModel)

    expect(rows.filter(predicate).map(row => row.rowId)).toEqual(["r1"])
  })

  it("matches all quick filter tokens across searchable columns", () => {
    const predicate = createFilterPredicate(createFilterModel({
      query: "api platform",
      columns: ["service", "owner"],
      mode: "tokens",
    }))

    expect(rows.filter(predicate).map(row => row.rowId)).toEqual(["r3"])
  })

  it("uses default quick filter columns from predicate options", () => {
    const predicate = createFilterPredicate(createFilterModel({
      query: "paused",
    }), {
      quickFilterColumnKeys: ["status"],
    })

    expect(rows.filter(predicate).map(row => row.rowId)).toEqual(["r3"])
  })

  it("treats a non-empty quick filter as an active filter model", () => {
    expect(hasActiveFilterModel(createFilterModel({ query: "api", columns: ["service"] }))).toBe(true)
    expect(hasActiveFilterModel(createFilterModel({ query: "   ", columns: ["service"] }))).toBe(false)
  })
})

describe("client row projection sort primitives", () => {
  it("sorts bounded integer columns with deterministic row-id tie breaks", () => {
    const rows = Array.from({ length: 5000 }, (_, index) => createRowNode({
      rowId: `row-${String(5000 - index).padStart(5, "0")}`,
      service: "api",
      owner: "ops",
      status: "active",
      latencyMs: index % 16,
    }, index))

    const sortedRows = sortLeafRows(rows, [{ key: "latencyMs", direction: "asc" }])
    const values = sortedRows.map(row => row.data.latencyMs)
    expect(values.slice(0, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(values[values.length - 1]).toBe(15)

    const firstValueRows = sortedRows.filter(row => row.data.latencyMs === 0).map(row => String(row.rowId))
    expect(firstValueRows).toEqual([...firstValueRows].sort((left, right) => left.localeCompare(right)))
  })

  it("sorts bounded integer ties with numeric row-id ordering", () => {
    const rows = Array.from({ length: 5000 }, (_, index) => createRowNode({
      rowId: String(5000 - index),
      service: "api",
      owner: "ops",
      status: "active",
      latencyMs: 1,
    }, index))

    const sortedRows = sortLeafRows(rows, [{ key: "latencyMs", direction: "asc" }])
    expect(sortedRows.slice(0, 5).map(row => row.rowId)).toEqual(["1", "2", "3", "4", "5"])
    expect(sortedRows.slice(-3).map(row => row.rowId)).toEqual(["4998", "4999", "5000"])
  })
})
