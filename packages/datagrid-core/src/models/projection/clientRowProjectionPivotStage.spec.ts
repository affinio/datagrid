import { describe, expect, it } from "vitest"
import { runPivotProjectionStage } from "./clientRowProjectionPivotStage"
import { createPivotRuntime } from "../pivot/pivotRuntime"
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
    row,
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

const pivotModel: DataGridPivotSpec = {
  rows: ["region"],
  columns: ["year"],
  values: [{ field: "revenue", agg: "sum" }],
}

const normalizeFieldValue = (value: unknown): string => String(value ?? "")

describe("client row pivot projection stage", () => {
  it("keeps the last valid snapshot when the next output exceeds the guard", () => {
    const runtime = createPivotRuntime<PivotRow>({ maxOutputCells: 2 })
    const initialRows = [
      createLeafRow({ id: "r1", region: "AMER", year: 2024, revenue: 10 }, 0),
    ]
    const initialProjection = runtime.projectRows({
      inputRows: initialRows,
      pivotModel,
      normalizeFieldValue,
    })
    expect(initialProjection.diagnostics).toBeUndefined()
    expect(initialProjection.rows).toHaveLength(1)
    expect(initialProjection.columns).toHaveLength(1)

    const previousRows = initialProjection.rows
    const previousColumns = initialProjection.columns
    const result = runPivotProjectionStage({
      pivotModel,
      shouldRecompute: true,
      previousPivotedRowsProjection: previousRows,
      previousPivotColumns: previousColumns,
      groupedRowsProjection: [
        ...initialRows,
        createLeafRow({ id: "r2", region: "EMEA", year: 2025, revenue: 20 }, 1),
      ],
      pendingValuePatchRows: null,
      pivotRuntime: runtime,
      normalizeFieldValue,
      expansionSnapshot: null,
    })

    expect(result.recomputed).toBe(false)
    expect(result.pivotedRowsProjection).toBe(previousRows)
    expect(result.pivotColumns).toBe(previousColumns)
    expect(result.diagnostics).toEqual({
      kind: "output-limit-exceeded",
      estimatedCells: 4,
      maxOutputCells: 2,
    })
  })
})
