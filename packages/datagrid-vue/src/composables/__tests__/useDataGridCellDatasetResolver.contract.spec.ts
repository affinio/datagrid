import { describe, expect, it } from "vitest"
import { useDataGridCellDatasetResolver } from "../useDataGridCellDatasetResolver"

interface Row {
  rowId: string
}

describe("useDataGridCellDatasetResolver contract", () => {
  const rows: Row[] = [{ rowId: "r1" }, { rowId: "r2" }, { rowId: "r3" }]
  const api = useDataGridCellDatasetResolver<Row>({
    resolveRows: () => rows,
    resolveRowId: row => row.rowId,
    resolveColumnIndex: columnKey => {
      if (columnKey === "owner") return 2
      if (columnKey === "severity") return 5
      return -1
    },
    normalizeCellCoord(coord) {
      if (coord.columnIndex < 0) return null
      return { ...coord, columnIndex: Math.max(0, coord.columnIndex) }
    },
  })

  it("resolves row index by dataset row id", () => {
    expect(api.resolveRowIndexById("r2")).toBe(1)
    expect(api.resolveRowIndexById("missing")).toBe(-1)
  })

  it("resolves dataset cell coordinate and normalizes it", () => {
    expect(api.resolveCellCoordFromDataset("r3", "owner")).toEqual({
      rowIndex: 2,
      columnIndex: 2,
    })
  })

  it("returns null for unknown row or column", () => {
    expect(api.resolveCellCoordFromDataset("missing", "owner")).toBeNull()
    expect(api.resolveCellCoordFromDataset("r1", "unknown")).toBeNull()
  })
})
