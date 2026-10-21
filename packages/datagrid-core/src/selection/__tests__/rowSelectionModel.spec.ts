import { describe, expect, it } from "vitest"
import {
  addDataGridRowSelectionModelRows,
  createDataGridRowSelectionModelSnapshot,
  removeDataGridRowSelectionModelRows,
  replaceDataGridRowSelectionModel,
  toggleDataGridRowSelectionModelRow,
} from "../rowSelectionModel.js"

describe("row selection model", () => {
  it("keeps selected row ids separate from focus and protects snapshots from mutation", () => {
    const input = new Set(["r1", "r2"])
    const snapshot = createDataGridRowSelectionModelSnapshot(input)
    input.clear()

    expect(snapshot.revision).toBe(0)
    expect([...snapshot.selectedRowIds]).toEqual(["r1", "r2"])
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.selectedRowIds)).toBe(true)
    expect("add" in snapshot.selectedRowIds).toBe(false)
    expect("delete" in snapshot.selectedRowIds).toBe(false)
    expect("clear" in snapshot.selectedRowIds).toBe(false)
    expect("backingSet" in snapshot.selectedRowIds).toBe(false)
  })

  it("applies replace, add, remove, and toggle as versioned immutable transitions", () => {
    const initial = createDataGridRowSelectionModelSnapshot(["r1", "r2"])
    const added = addDataGridRowSelectionModelRows(initial, ["r2", "r3"])
    const removed = removeDataGridRowSelectionModelRows(added, ["r1"])
    const toggled = toggleDataGridRowSelectionModelRow(removed, "r3")
    const replaced = replaceDataGridRowSelectionModel(toggled, ["r4", "r4"])

    expect([...initial.selectedRowIds]).toEqual(["r1", "r2"])
    expect(added.revision).toBe(1)
    expect([...added.selectedRowIds]).toEqual(["r1", "r2", "r3"])
    expect(removed.revision).toBe(2)
    expect([...removed.selectedRowIds]).toEqual(["r2", "r3"])
    expect(toggled.revision).toBe(3)
    expect([...toggled.selectedRowIds]).toEqual(["r2"])
    expect(replaced.revision).toBe(4)
    expect([...replaced.selectedRowIds]).toEqual(["r4"])
  })

  it("keeps the same snapshot and revision for no-op operations", () => {
    const snapshot = createDataGridRowSelectionModelSnapshot(["r1"])

    expect(addDataGridRowSelectionModelRows(snapshot, ["r1"])).toBe(snapshot)
    expect(removeDataGridRowSelectionModelRows(snapshot, ["r2"])).toBe(snapshot)
    expect(replaceDataGridRowSelectionModel(snapshot, ["r1"])).toBe(snapshot)
    expect(toggleDataGridRowSelectionModelRow(snapshot, "r2").revision).toBe(1)
  })
})
