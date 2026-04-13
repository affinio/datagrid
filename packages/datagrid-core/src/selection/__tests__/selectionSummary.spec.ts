import { describe, expect, it } from "vitest"
import { normalizeRowNode, type DataGridRowNode } from "../../models"
import type { DataGridSelectionSnapshot } from "../snapshot"
import { createDataGridSelectionSummary } from "../selectionSummary"

type Row = {
  id: number
  owner: string
  latencyMs: number
}

function makeRowNode(row: Row, index: number): DataGridRowNode<Row> {
  return normalizeRowNode<Row>(
    {
      row,
      rowId: row.id,
      originalIndex: index,
      displayIndex: index,
    },
    index,
  )
}

describe("selection summary", () => {
  it("computes deterministic aggregate metrics for selected range", () => {
    const rows = [
      makeRowNode({ id: 1, owner: "noc", latencyMs: 100 }, 0),
      makeRowNode({ id: 2, owner: "ops", latencyMs: 150 }, 1),
      makeRowNode({ id: 3, owner: "sre", latencyMs: 90 }, 2),
    ]

    const selection: DataGridSelectionSnapshot = {
      ranges: [
        {
          startRow: 0,
          endRow: 2,
          startCol: 0,
          endCol: 1,
          startRowId: 1,
          endRowId: 3,
          anchor: { rowIndex: 0, colIndex: 0, rowId: 1 },
          focus: { rowIndex: 2, colIndex: 1, rowId: 3 },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 2, colIndex: 1, rowId: 3 },
    }

    const summary = createDataGridSelectionSummary<Row>({
      selection,
      rowCount: rows.length,
      getRow: index => rows[index],
      getColumnKeyByIndex: index => {
        if (index === 0) return "owner"
        if (index === 1) return "latencyMs"
        return null
      },
      columns: [
        { key: "owner", aggregations: ["count", "countDistinct"] },
        { key: "latencyMs", aggregations: ["count", "sum", "avg", "min", "max"] },
      ],
    })

    expect(summary.selectedCells).toBe(6)
    expect(summary.selectedRows).toBe(3)
    expect(summary.columns.owner.metrics.count).toBe(3)
    expect(summary.columns.owner.metrics.countDistinct).toBe(3)
    expect(summary.columns.latencyMs.metrics.count).toBe(3)
    expect(summary.columns.latencyMs.metrics.sum).toBe(340)
    expect(summary.columns.latencyMs.metrics.avg).toBeCloseTo(113.3333333333)
    expect(summary.columns.latencyMs.metrics.min).toBe(90)
    expect(summary.columns.latencyMs.metrics.max).toBe(150)
  })

  it("returns empty summary for missing selection", () => {
    const summary = createDataGridSelectionSummary({
      selection: null,
      rowCount: 0,
      getRow: () => undefined,
      getColumnKeyByIndex: () => null,
    })

    expect(summary).toEqual({
      scope: "selected-loaded",
      isPartial: false,
      missingRowCount: 0,
      selectedCells: 0,
      selectedRows: 0,
      columns: {},
    })
  })

  it("prefers readSelectionCell before configured value getters", () => {
    const rows = [
      makeRowNode({ id: 1, owner: "noc", latencyMs: 100 }, 0),
      makeRowNode({ id: 2, owner: "ops", latencyMs: 150 }, 1),
    ]

    const selection: DataGridSelectionSnapshot = {
      ranges: [
        {
          startRow: 0,
          endRow: 1,
          startCol: 0,
          endCol: 0,
          startRowId: 1,
          endRowId: 2,
          anchor: { rowIndex: 0, colIndex: 0, rowId: 1 },
          focus: { rowIndex: 1, colIndex: 0, rowId: 2 },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: 2 },
    }

    const summary = createDataGridSelectionSummary<Row>({
      selection,
      rowCount: rows.length,
      getRow: index => rows[index],
      getColumnKeyByIndex: () => "latencyMs",
      readSelectionCell: rowNode => rowNode.data.latencyMs / 10,
      columns: [
        {
          key: "latencyMs",
          aggregations: ["sum", "min", "max", "avg"],
          valueGetter: () => 999,
        },
      ],
    })

    expect(summary.columns.latencyMs.metrics.sum).toBe(25)
    expect(summary.columns.latencyMs.metrics.min).toBe(10)
    expect(summary.columns.latencyMs.metrics.max).toBe(15)
    expect(summary.columns.latencyMs.metrics.avg).toBe(12.5)
  })

  it("falls back to existing getters when readSelectionCell returns undefined", () => {
    const rows = [
      makeRowNode({ id: 1, owner: "noc", latencyMs: 100 }, 0),
      makeRowNode({ id: 2, owner: "ops", latencyMs: 150 }, 1),
    ]

    const selection: DataGridSelectionSnapshot = {
      ranges: [
        {
          startRow: 0,
          endRow: 1,
          startCol: 0,
          endCol: 0,
          startRowId: 1,
          endRowId: 2,
          anchor: { rowIndex: 0, colIndex: 0, rowId: 1 },
          focus: { rowIndex: 1, colIndex: 0, rowId: 2 },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: 2 },
    }

    const summary = createDataGridSelectionSummary<Row>({
      selection,
      rowCount: rows.length,
      getRow: index => rows[index],
      getColumnKeyByIndex: () => "latencyMs",
      readSelectionCell: () => undefined,
      columns: [
        {
          key: "latencyMs",
          aggregations: ["sum", "min", "max", "avg"],
          valueGetter: rowNode => rowNode.data.latencyMs / 5,
        },
      ],
    })

    expect(summary.columns.latencyMs.metrics.sum).toBe(50)
    expect(summary.columns.latencyMs.metrics.min).toBe(20)
    expect(summary.columns.latencyMs.metrics.max).toBe(30)
    expect(summary.columns.latencyMs.metrics.avg).toBe(25)
  })
})
