import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridAppCellSelection } from "../useDataGridAppCellSelection"

describe("useDataGridAppCellSelection contract", () => {
  it("prefers the explicit selection anchor over snapshot anchor when resolving the anchor cell", () => {
    const selectionSnapshot = ref({
      ranges: [
        {
          startRow: 0,
          endRow: 3,
          startCol: 0,
          endCol: 0,
          startRowId: "r1",
          endRowId: "r4",
          anchor: { rowIndex: 3, colIndex: 0, rowId: "r4" },
          focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "r4" },
    } as never)
    const selectionAnchor = ref({ rowIndex: 0, colIndex: 0, rowId: "r1" })

    const api = useDataGridAppCellSelection({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
          },
        },
      } as never,
      totalRows: ref(10),
      visibleColumns: ref([
        { key: "a" },
        { key: "b" },
      ] as never),
      viewportRowStart: ref(0),
      selectionSnapshot,
      selectionAnchor,
      isEditingCell: () => false,
    })

    expect(api.isSelectionAnchorCell(0, 0)).toBe(true)
    expect(api.isSelectionAnchorCell(3, 0)).toBe(false)
    expect(api.shouldHighlightSelectedCell(0, 0)).toBe(false)
    expect(api.shouldHighlightSelectedCell(1, 0)).toBe(true)
  })
})
