import { describe, expect, it } from "vitest"
import { useDataGridA11yCellIds } from "../useDataGridA11yCellIds"

describe("useDataGridA11yCellIds contract", () => {
  const api = useDataGridA11yCellIds<{ rowId: string }>({
    resolveColumnIndex(columnKey) {
      if (columnKey === "service") return 2
      if (columnKey === "status") return 8
      return -1
    },
    resolveRowIndex(row) {
      return row.data.rowId === "row-5" ? 5 : -1
    },
  })

  it("builds stable header and cell ids with sanitization", () => {
    expect(api.getHeaderCellId("slo burn rate")).toBe("datagrid-header-slo-burn-rate")
    expect(api.getGridCellId("row:5", "status%")).toBe("datagrid-cell-row-5-status-")
  })

  it("maps aria indexes with lower-bound guards", () => {
    expect(api.getColumnAriaIndex("service")).toBe(3)
    expect(api.getColumnAriaIndex("unknown")).toBe(1)
    expect(api.getRowAriaIndex({ data: { rowId: "row-5" } } as never)).toBe(7)
    expect(api.getRowAriaIndex({ data: { rowId: "missing" } } as never)).toBe(2)
  })
})
