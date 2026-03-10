import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridAppSelection } from "../useDataGridAppSelection"

describe("useDataGridAppSelection contract", () => {
  it("keeps selection anchor synchronized with the active snapshot range", () => {
    const runtimeSnapshot = {
      ranges: [
        {
          startRow: 0,
          endRow: 3,
          startCol: 0,
          endCol: 0,
          startRowId: "r1",
          endRowId: "r4",
          anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
          focus: { rowIndex: 3, colIndex: 0, rowId: "r4" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "r4" },
    } as never

    const selection = useDataGridAppSelection({
      mode: ref("base"),
      resolveRuntime: () => ({
        api: {
          selection: {
            hasSupport: () => true,
            getSnapshot: () => runtimeSnapshot,
          },
        },
      } as never),
    })

    selection.syncSelectionSnapshotFromRuntime()

    expect(selection.selectionSnapshot.value).toStrictEqual(runtimeSnapshot)
    expect(selection.selectionAnchor.value).toEqual({ rowIndex: 0, colIndex: 0, rowId: "r1" })

    selection.selectionService.clearSelection!()
    expect(selection.selectionSnapshot.value).toBeNull()
    expect(selection.selectionAnchor.value).toBeNull()
  })
})
