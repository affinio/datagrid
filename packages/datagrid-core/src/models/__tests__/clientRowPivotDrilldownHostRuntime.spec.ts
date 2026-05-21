import { describe, expect, it } from "vitest"
import { createClientRowModel } from "../clientRowModel.js"
import type { DataGridRowNode } from "../rowModel.js"

interface PivotRow {
  id: string
  region: string
  team: string
  year: number
  revenue: number
}

function createRow(row: PivotRow, index: number): DataGridRowNode<PivotRow> {
  return {
    kind: "leaf",
    data: row,
    row,
    rowKey: row.id,
    rowId: row.id,
    originalIndex: index,
    sourceIndex: index,
    displayIndex: index,
    state: { selected: false, group: false, pinned: "none", expanded: false },
  }
}

describe("createClientRowPivotDrilldownHostRuntime", () => {
  it("returns materialized pivot drilldown rows for subtotal and grand total cells", () => {
    const model = createClientRowModel<PivotRow>({
      rows: [
        createRow({ id: "r1", region: "AMER", team: "core", year: 2024, revenue: 10 }, 0),
        createRow({ id: "r2", region: "AMER", team: "payments", year: 2024, revenue: 20 }, 1),
        createRow({ id: "r3", region: "EMEA", team: "core", year: 2025, revenue: 5 }, 2),
        createRow({ id: "r4", region: "EMEA", team: "payments", year: 2025, revenue: 7 }, 3),
      ],
      initialPivotModel: {
        rows: ["region", "team"],
        columns: ["year"],
        values: [{ field: "revenue", agg: "sum" }],
        rowSubtotals: true,
        columnGrandTotal: true,
        grandTotal: true,
      },
    })

    const rows = model.getRowsInRange({ start: 0, end: 30 })
    const amerSubtotal = rows.find(row => {
      const record = row.row as Record<string, unknown>
      return String(record.region ?? "") === "AMER" && String(record.team ?? "") === "Subtotal"
    })
    const grandTotalRow = rows.find(row => String(row.rowId) === "pivot:grand-total")
    const pivotColumns = model.getSnapshot().pivotColumns ?? []
    const year2024 = pivotColumns.find(column => column.label.includes("year=2024"))
    const columnGrandTotal = pivotColumns.find(column => column.grandTotal === true)

    const subtotalDrilldown = model.getPivotCellDrilldown?.({
      rowId: amerSubtotal?.rowId ?? "",
      columnId: String(year2024?.id ?? ""),
      limit: 10,
    })
    expect(subtotalDrilldown?.matchCount).toBe(2)
    expect(subtotalDrilldown?.truncated).toBe(false)
    expect(subtotalDrilldown?.rows.map(row => String(row.rowId))).toEqual(["r1", "r2"])

    const grandTotalDrilldown = model.getPivotCellDrilldown?.({
      rowId: grandTotalRow?.rowId ?? "",
      columnId: String(columnGrandTotal?.id ?? ""),
      limit: 2,
    })
    expect(grandTotalDrilldown?.matchCount).toBe(4)
    expect(grandTotalDrilldown?.truncated).toBe(true)
    expect(grandTotalDrilldown?.rows.map(row => String(row.rowId))).toEqual(["r1", "r2"])

    model.dispose()
  })
})
