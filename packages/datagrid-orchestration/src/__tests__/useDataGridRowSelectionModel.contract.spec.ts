import { describe, expect, it, vi } from "vitest"
import { useDataGridRowSelectionModel } from "../useDataGridRowSelectionModel"

describe("useDataGridRowSelectionModel contract", () => {
  it("applies anchor + shift range on filtered rows", () => {
    const rows = [
      { rowId: "r1" },
      { rowId: "r2" },
      { rowId: "r3" },
      { rowId: "r4" },
    ]

    const model = useDataGridRowSelectionModel({
      resolveFilteredRows: () => rows,
      resolveRowId: row => row.rowId,
    })

    model.toggleRowAtFilteredIndex(1, true)
    model.toggleRowAtFilteredIndex(3, true, { shiftKey: true })

    expect(Array.from(model.getSelection()).sort()).toEqual(["r2", "r3", "r4"])
    expect(model.getAnchorIndex()).toBe(3)
  })

  it("reconciles selection against full row source", () => {
    const onSelectionChange = vi.fn()
    const model = useDataGridRowSelectionModel<{ rowId: string }>({
      resolveFilteredRows: () => [{ rowId: "r1" }, { rowId: "r2" }],
      resolveRowId: row => row.rowId,
      resolveAllRows: () => [{ rowId: "r1" }],
      initialSelection: ["r1", "r2"],
      onSelectionChange,
    })

    model.reconcileWithRows()

    expect(Array.from(model.getSelection())).toEqual(["r1"])
    expect(onSelectionChange).toHaveBeenCalled()
  })

  it("uses precomputed filtered row ids when provided", () => {
    const model = useDataGridRowSelectionModel<{ rowId: string }>({
      resolveFilteredRows: () => [{ rowId: "unused" }],
      resolveFilteredRowIds: () => ["r1", "r2", "r3"],
      resolveRowId: row => row.rowId,
    })

    model.toggleRowAtFilteredIndex(2, true)

    expect(Array.from(model.getSelection())).toEqual(["r3"])
  })

  it("clears selection when source rows become empty by default", () => {
    const model = useDataGridRowSelectionModel<{ rowId: string }>({
      resolveFilteredRows: () => [],
      resolveRowId: row => row.rowId,
      resolveAllRows: () => [],
      initialSelection: ["r1", "r2"],
    })

    model.reconcileWithRows()

    expect(Array.from(model.getSelection())).toEqual([])
    expect(model.getAnchorIndex()).toBeNull()
  })

  it("keeps selection when source rows are empty and clear policy is disabled", () => {
    const model = useDataGridRowSelectionModel<{ rowId: string }>({
      resolveFilteredRows: () => [],
      resolveRowId: row => row.rowId,
      resolveAllRows: () => [],
      initialSelection: ["r1"],
      clearSelectionWhenSourceRowsEmpty: false,
    })

    model.reconcileWithRows()

    expect(Array.from(model.getSelection())).toEqual(["r1"])
  })
})
