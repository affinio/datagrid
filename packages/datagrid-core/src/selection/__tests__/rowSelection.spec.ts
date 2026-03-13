import { describe, expect, it } from "vitest"
import {
  clearDataGridSelectedRows,
  reconcileDataGridRowSelectionSnapshot,
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
})