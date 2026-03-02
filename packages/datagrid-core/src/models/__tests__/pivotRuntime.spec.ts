import { describe, expect, it } from "vitest"
import { createPivotRuntime } from "../pivotRuntime"
import type { DataGridPivotSpec, DataGridRowNode } from "../rowModel"

interface PivotRow {
  id: string
  region: string
  year: number
  revenue: number
}

function createLeafRow(row: PivotRow, index: number): DataGridRowNode<PivotRow> {
  return {
    kind: "leaf",
    data: row,
    row: row,
    rowKey: row.id,
    rowId: row.id,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
  }
}

describe("pivotRuntime incremental patching", () => {
  it("applies value-only patch without relying on cached binding by rowId", () => {
    const runtime = createPivotRuntime<PivotRow>()
    const sourceRows = [
      createLeafRow({ id: "r1", region: "AMER", year: 2024, revenue: 10 }, 0),
      createLeafRow({ id: "r2", region: "EMEA", year: 2024, revenue: 20 }, 1),
    ]
    const pivotModel: DataGridPivotSpec = {
      rows: ["region"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    }

    const projected = runtime.projectRows({
      inputRows: sourceRows,
      pivotModel,
      normalizeFieldValue: value => String(value ?? ""),
    })
    expect(projected.rows.length).toBeGreaterThanOrEqual(2)

    const yearColumnId = projected.columns[0]?.id
    expect(typeof yearColumnId).toBe("string")

    const patched = runtime.applyValueOnlyPatch({
      projectedRows: projected.rows,
      pivotModel,
      changedRows: [
        {
          previousRow: sourceRows[0]!,
          nextRow: createLeafRow({ id: "external-r1", region: "AMER", year: 2024, revenue: 100 }, 0),
        },
      ],
    })

    expect(patched).not.toBeNull()
    const amer = patched!.rows.find(row => String((row.row as Record<string, unknown>).region ?? "") === "AMER")
    const emea = patched!.rows.find(row => String((row.row as Record<string, unknown>).region ?? "") === "EMEA")
    expect(amer).toBeDefined()
    expect(emea).toBeDefined()
    expect((amer!.row as Record<string, unknown>)[String(yearColumnId)]).toBe(100)
    expect((emea!.row as Record<string, unknown>)[String(yearColumnId)]).toBe(20)
  })
})
