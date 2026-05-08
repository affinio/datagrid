import { describe, expect, it } from "vitest"
import {
  clearDataGridSelectedRows,
  deselectDataGridRows,
  isDataGridRowSelected,
  reconcileDataGridRowSelectionSnapshot,
  selectAllDataGridRows,
  selectDataGridRows,
  setDataGridRowFocused,
  setDataGridRowSelected,
} from "../rowSelection"

describe("rowSelection state", () => {
  it("keeps focused row independent from checkbox-selected rows", () => {
    const focused = setDataGridRowFocused(null, "r2")
    const selected = setDataGridRowSelected(focused, "r1", true)

    expect(selected.focusedRow).toBe("r2")
    expect(selected.selectedRows).toEqual(["r1"])
  })

  it("reconciles focus and selected rows against current row ids", () => {
    const snapshot = selectDataGridRows(setDataGridRowFocused(null, "r2"), ["r1", "r3"])
    const reconciled = reconcileDataGridRowSelectionSnapshot(snapshot, ["r1", "r4"])

    expect(reconciled.focusedRow).toBeNull()
    expect(reconciled.selectedRows).toEqual(["r1"])
    expect(clearDataGridSelectedRows(reconciled)).toEqual({
      focusedRow: null,
      selectedRows: [],
    })
  })

  it("represents all-row selection with explicit exclusions", () => {
    const allRows = selectAllDataGridRows(null)

    expect(allRows).toEqual({
      focusedRow: null,
      selectedRows: [],
      mode: "all",
      excludedRows: [],
    })
    expect(isDataGridRowSelected(allRows, "r1")).toBe(true)

    const excluded = setDataGridRowSelected(allRows, "r1", false)
    expect(isDataGridRowSelected(excluded, "r1")).toBe(false)
    expect(isDataGridRowSelected(excluded, "r2")).toBe(true)
    expect(excluded.excludedRows).toEqual(["r1"])

    expect(setDataGridRowSelected(excluded, "r1", true).excludedRows).toEqual([])
    expect(deselectDataGridRows(allRows, ["r2", "r3"]).excludedRows).toEqual(["r2", "r3"])
    expect(selectDataGridRows(deselectDataGridRows(allRows, ["r2"]), ["r2"]).excludedRows).toEqual([])
  })
})
