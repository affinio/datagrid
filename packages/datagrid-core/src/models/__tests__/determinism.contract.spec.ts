import { describe, expect, it } from "vitest"
import { createClientRowModel, createDataGridColumnModel } from "../index"
import type { DataGridFilterSnapshot, DataGridRowModelSnapshot, DataGridRowNodeInput, DataGridSortState } from "../rowModel"
import type { DataGridColumnDef, DataGridColumnModelSnapshot } from "../columnModel"

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function buildRowInputs(count: number): DataGridRowNodeInput<{ id: number; value: string }>[] {
  return Array.from({ length: count }, (_, index) => ({
    row: { id: index, value: `row-${index}` },
    rowId: `row-${index}`,
    originalIndex: index,
    displayIndex: index,
  }))
}

function buildColumns(): DataGridColumnDef[] {
  return [
    { key: "id", width: 120, pin: "left", meta: { isSystem: true } },
    { key: "value", width: 200, pin: "none", meta: { formatter: "text" } },
    { key: "owner", width: 180, pin: "none" },
  ]
}

function runRowProgram(): {
  snapshots: DataGridRowModelSnapshot<{ id: number; value: string }>[]
  finalSnapshot: DataGridRowModelSnapshot<{ id: number; value: string }>
  rangeIds: Array<string | number>
} {
  const rows = buildRowInputs(4)
  const model = createClientRowModel<{ id: number; value: string }>({ rows })
  const snapshots: DataGridRowModelSnapshot<{ id: number; value: string }>[] = []
  const sortModel: readonly DataGridSortState[] = [{ key: "value", direction: "asc" }]
  const filterModel: DataGridFilterSnapshot = {
    columnFilters: { value: ["row-1", "row-3"] },
    advancedFilters: {},
  }

  const unsubscribe = model.subscribe(snapshot => {
    snapshots.push(clone(snapshot))
  })

  model.setViewportRange({ start: 1, end: 3 })
  model.setSortModel(sortModel)
  model.setFilterModel(filterModel)
  model.refresh("manual")
  model.setRows([
    ...rows,
    {
      row: { id: 4, value: "row-4" },
      rowId: "row-4",
      originalIndex: 4,
      displayIndex: 4,
    },
  ])

  const rangeIds = model.getRowsInRange({ start: 1, end: 3 }).map(row => row.rowId)
  const finalSnapshot = clone(model.getSnapshot())

  unsubscribe()
  model.dispose()
  return { snapshots, finalSnapshot, rangeIds }
}

function runColumnProgram(): {
  snapshots: DataGridColumnModelSnapshot[]
  finalSnapshot: DataGridColumnModelSnapshot
} {
  const model = createDataGridColumnModel({ columns: buildColumns() })
  const snapshots: DataGridColumnModelSnapshot[] = []
  const unsubscribe = model.subscribe(snapshot => {
    snapshots.push(clone(snapshot))
  })

  model.setColumnOrder(["value", "id", "owner"])
  model.setColumnVisibility("owner", false)
  model.setColumnPin("value", "right")
  model.setColumnWidth("value", 240)

  const finalSnapshot = clone(model.getSnapshot())
  unsubscribe()
  model.dispose()
  return { snapshots, finalSnapshot }
}

describe("determinism contract", () => {
  it("keeps row model transitions deterministic for equal command sequence", () => {
    const first = runRowProgram()
    const second = runRowProgram()

    expect(second.snapshots).toEqual(first.snapshots)
    expect(second.finalSnapshot).toEqual(first.finalSnapshot)
    expect(second.rangeIds).toEqual(first.rangeIds)
  })

  it("keeps column model transitions deterministic for equal command sequence", () => {
    const first = runColumnProgram()
    const second = runColumnProgram()

    expect(second.snapshots).toEqual(first.snapshots)
    expect(second.finalSnapshot).toEqual(first.finalSnapshot)
  })
})
