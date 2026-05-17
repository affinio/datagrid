import { describe, expect, it } from "vitest"
import { useDataGridAppRowSelection } from "../useDataGridAppRowSelection"

describe("useDataGridAppRowSelection contract", () => {
  it("syncs the snapshot from the current runtime bulk-selection state", () => {
    const selectedRows = new Set<string>()
    let focusedRow: string | null = null

    const selection = useDataGridAppRowSelection({
      resolveRuntime: () => ({
        api: {
          rowSelection: {
            hasSupport: () => true,
            getSnapshot: () => ({
              focusedRow,
              selectedRows: [...selectedRows],
            }),
            selectRows: (rowIds: Iterable<string>) => {
              for (const rowId of rowIds) {
                selectedRows.add(rowId)
              }
            },
            deselectRows: (rowIds: Iterable<string>) => {
              for (const rowId of rowIds) {
                selectedRows.delete(rowId)
              }
            },
          },
        },
      } as never),
    })

    selectedRows.clear()
    selectedRows.add("r1")
    selectedRows.add("r2")
    focusedRow = "r2"

    selection.syncRowSelectionSnapshotFromRuntime()

    expect(selection.rowSelectionSnapshot.value).toEqual({
      focusedRow: "r2",
      selectedRows: ["r1", "r2"],
    })

    selectedRows.delete("r1")
    selectedRows.add("r3")
    focusedRow = "r3"

    selection.syncRowSelectionSnapshotFromRuntime()

    expect(selection.rowSelectionSnapshot.value).toEqual({
      focusedRow: "r3",
      selectedRows: ["r2", "r3"],
    })
  })

  it("treats grouped projection row ids as visible row-selection targets", () => {
    const rows = [
      { rowId: "group:team=platform", kind: "group" },
      { rowId: "r2", kind: "data" },
    ]

    const selection = useDataGridAppRowSelection({
      resolveRuntime: () => ({
        api: {
          rows: {
            getCount: () => rows.length,
            get: (rowIndex: number) => rows[rowIndex] ?? null,
          },
          rowSelection: {
            hasSupport: () => true,
            getSnapshot: () => selection.rowSelectionSnapshot.value,
          },
        },
      } as never),
    })

    selection.selectionService.setFocusedRow!("group:team=platform")
    selection.selectionService.selectRows!(["group:team=platform", "r1", "r2"])
    selection.reconcileRowSelectionFromRuntime()

    expect(selection.focusedRow.value).toBe("group:team=platform")
    expect(selection.selectionService.isRowSelected!("group:team=platform")).toBe(true)
    expect(selection.rowSelectionSnapshot.value).toEqual({
      focusedRow: "group:team=platform",
      selectedRows: ["group:team=platform", "r2"],
    })
  })

  it("reconciles selected descendants after a grouped projection collapses", () => {
    let rows = [
      { rowId: "group:team=platform", kind: "group" },
      { rowId: "r2", kind: "data" },
      { rowId: "r3", kind: "data" },
    ]

    const selection = useDataGridAppRowSelection({
      resolveRuntime: () => ({
        api: {
          rows: {
            getCount: () => rows.length,
            get: (rowIndex: number) => rows[rowIndex] ?? null,
          },
          rowSelection: {
            hasSupport: () => true,
            getSnapshot: () => selection.rowSelectionSnapshot.value,
          },
        },
      } as never),
    })

    selection.selectionService.setFocusedRow!("group:team=platform")
    selection.selectionService.selectRows!(["group:team=platform", "r2", "r3"])
    rows = [{ rowId: "group:team=platform", kind: "group" }]
    selection.reconcileRowSelectionFromRuntime()

    expect(selection.focusedRow.value).toBe("group:team=platform")
    expect(selection.rowSelectionSnapshot.value).toEqual({
      focusedRow: "group:team=platform",
      selectedRows: ["group:team=platform"],
    })
  })
})
