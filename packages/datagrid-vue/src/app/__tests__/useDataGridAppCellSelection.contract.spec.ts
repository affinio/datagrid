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

  it("creates a cell selection snapshot in tree mode", () => {
    const selectionSnapshot = ref(null as never)
    const selectionAnchor = ref(null)
    let runtimeSnapshot: unknown = null

    const api = useDataGridAppCellSelection({
      mode: ref("tree"),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
          },
          selection: {
            hasSupport: () => true,
            setSnapshot: (snapshot: unknown) => {
              runtimeSnapshot = snapshot
            },
          },
        },
        getBodyRowAtIndex: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
      } as never,
      totalRows: ref(10),
      visibleColumns: ref([
        { key: "a" },
        { key: "b" },
        { key: "c" },
      ] as never),
      viewportRowStart: ref(0),
      selectionSnapshot,
      selectionAnchor,
      isEditingCell: () => false,
    })

    api.applyCellSelectionByCoord({
      rowIndex: 2,
      columnIndex: 1,
      rowId: "r3",
    }, false)

    expect(selectionSnapshot.value).toMatchObject({
      activeCell: { rowIndex: 2, colIndex: 1, rowId: "r3" },
      ranges: [
        {
          startRow: 2,
          endRow: 2,
          startCol: 1,
          endCol: 1,
          anchor: { rowIndex: 2, colIndex: 1, rowId: "r3" },
          focus: { rowIndex: 2, colIndex: 1, rowId: "r3" },
        },
      ],
    })
    expect(runtimeSnapshot).toMatchObject({
      activeCell: { rowIndex: 2, colIndex: 1, rowId: "r3" },
    })
    expect(api.isSelectionAnchorCell(2, 1)).toBe(true)
  })
})
