import { describe, expect, it } from "vitest"
import { createClientRowProjectionModel } from "../client-row-projection/model.js"
import { createDataGridComparatorRegistry } from "../client-row-projection/comparator-registry.js"

describe("client row projection model contract", () => {
  it("composes source rows with flat filtering and sorting", () => {
    const model = createClientRowProjectionModel({
      rows: [
        { id: "b", value: 2, visible: true },
        { id: "a", value: 1, visible: true },
        { id: "hidden", value: 0, visible: false },
      ],
      filterPredicate: row => row.data.visible,
      initialSortModel: [{ key: "value", direction: "asc" }],
    })

    expect(model.getRows().map(row => row.rowId)).toEqual(["a", "b"])
    expect(model.getRows().map(row => row.displayIndex)).toEqual([0, 1])
    expect(model.getSourceRows()).toHaveLength(3)
    expect(model).not.toHaveProperty("registerFormulaField")
    expect(model).not.toHaveProperty("registerComputedField")
  })

  it("recomputes on source and query changes and notifies subscribers", () => {
    const model = createClientRowProjectionModel({ rows: [{ id: 1, value: 2 }] })
    const revisions: number[] = []
    model.subscribe(snapshot => revisions.push(snapshot.revision))

    model.appendRows([{ id: 2, value: 1 }])
    model.setSortModel([{ key: "value", direction: "asc" }])
    model.setFilterPredicate(row => row.data.value > 1)

    expect(model.getRows().map(row => row.rowId)).toEqual([1])
    expect(revisions).toEqual([2, 3, 4])
  })

  it("paginates the sorted flat projection and reports the page snapshot", () => {
    const model = createClientRowProjectionModel({
      rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      initialPagination: { pageSize: 2, currentPage: 1 },
    })

    expect(model.getRows().map(row => row.rowId)).toEqual([3, 4])
    expect(model.getRows().map(row => row.displayIndex)).toEqual([0, 1])
    expect(model.getSnapshot().pagination).toEqual({
      enabled: true,
      pageSize: 2,
      currentPage: 1,
      pageCount: 2,
      totalRowCount: 4,
      startIndex: 2,
      endIndex: 3,
    })

    model.setPagination({ pageSize: 2, currentPage: 0 })
    expect(model.getRows().map(row => row.rowId)).toEqual([1, 2])
  })

  it("reverses a cached flat sort when only its direction changes", () => {
    const model = createClientRowProjectionModel({
      rows: [{ id: "a", value: 1 }, { id: "b", value: 2 }, { id: "c", value: 3 }],
      initialSortModel: [{ key: "value", direction: "asc" }],
    })

    model.setSortModel([{ key: "value", direction: "desc" }])

    expect(model.getRows().map(row => row.rowId)).toEqual(["c", "b", "a"])
  })

  it("accepts a comparator registry as an explicit optional dependency", () => {
    const model = createClientRowProjectionModel({
      rows: [{ id: "a", value: "a" }, { id: "b", value: "b" }],
      initialSortModel: [{ key: "value", direction: "asc", comparator: { kind: "custom", comparatorId: "reverse" } }],
      comparatorRegistry: createDataGridComparatorRegistry({
        reverse: (left, right) => String(right).localeCompare(String(left)),
      }),
    })

    expect(model.getRows().map(row => row.rowId)).toEqual(["b", "a"])
  })

  it("rejects mutations after disposal", () => {
    const model = createClientRowProjectionModel({ rows: [{ id: 1 }] })
    model.dispose()

    expect(() => model.setSortModel([])).toThrow("disposed")
    expect(() => model.appendRows([{ id: 2 }])).toThrow("disposed")
  })

  it("refreshes projections after in-place payload updates", () => {
    const source = { id: 1, value: 2 }
    const model = createClientRowProjectionModel({
      rows: [source, { id: 2, value: 1 }],
      initialSortModel: [{ key: "value", direction: "asc" }],
    })
    source.value = 0

    model.refresh()

    expect(model.getRows().map(row => row.rowId)).toEqual([1, 2])
  })
})
