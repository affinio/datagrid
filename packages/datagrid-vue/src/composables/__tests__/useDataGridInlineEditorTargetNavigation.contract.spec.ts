import { describe, expect, it, vi } from "vitest"
import { useDataGridInlineEditorTargetNavigation } from "../useDataGridInlineEditorTargetNavigation"

interface Row {
  rowId: string
}

type ColumnKey = "service" | "owner" | "region"

describe("useDataGridInlineEditorTargetNavigation contract", () => {
  const columns: Array<{ key: ColumnKey }> = [
    { key: "service" },
    { key: "owner" },
    { key: "region" },
  ]
  const rows: Row[] = [{ rowId: "r1" }, { rowId: "r2" }]

  function createApi() {
    return useDataGridInlineEditorTargetNavigation<Row, ColumnKey>({
      resolveRows: () => rows,
      resolveOrderedColumns: () => columns,
      resolveRowId: row => row.rowId,
      resolveColumnIndex: columnKey => columns.findIndex(column => column.key === columnKey),
      isEditableColumn: (columnKey): columnKey is ColumnKey => columnKey !== "service",
      applyCellSelection: vi.fn(),
      beginInlineEdit: vi.fn(() => true),
      isSelectColumn: key => key === "region",
    })
  }

  it("resolves next editable target in the same row", () => {
    const api = createApi()
    expect(api.resolveNextEditableTarget("r1", "owner", 1)).toEqual({
      rowId: "r1",
      columnKey: "region",
      rowIndex: 0,
      columnIndex: 2,
    })
  })

  it("wraps to next row when moving forward from last editable column", () => {
    const api = createApi()
    expect(api.resolveNextEditableTarget("r1", "region", 1)).toEqual({
      rowId: "r2",
      columnKey: "owner",
      rowIndex: 1,
      columnIndex: 1,
    })
  })

  it("focuses target and opens editor with select mode for enum-like columns", () => {
    const applyCellSelection = vi.fn()
    const beginInlineEdit = vi.fn(() => true)
    const api = useDataGridInlineEditorTargetNavigation<Row, ColumnKey>({
      resolveRows: () => rows,
      resolveOrderedColumns: () => columns,
      resolveRowId: row => row.rowId,
      resolveColumnIndex: columnKey => columns.findIndex(column => column.key === columnKey),
      isEditableColumn: (columnKey): columnKey is ColumnKey => columnKey !== "service",
      applyCellSelection,
      beginInlineEdit,
      isSelectColumn: key => key === "region",
    })

    const focused = api.focusInlineEditorTarget({
      rowId: "r2",
      columnKey: "region",
      rowIndex: 1,
      columnIndex: 2,
    })

    expect(focused).toBe(true)
    expect(applyCellSelection).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 2 }, false)
    expect(beginInlineEdit).toHaveBeenCalledWith(rows[1], "region", "select", false)
  })
})
