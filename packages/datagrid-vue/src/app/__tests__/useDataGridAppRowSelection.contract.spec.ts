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
})