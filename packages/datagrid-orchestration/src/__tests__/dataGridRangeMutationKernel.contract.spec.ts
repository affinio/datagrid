import { describe, expect, it } from "vitest"
import {
  createDataGridMutableRowStore,
  forEachDataGridRangeCell,
  getDataGridRangeWidth,
} from "../dataGridRangeMutationKernel"

interface Row {
  rowId: string
  value: string
}

describe("dataGridRangeMutationKernel contract", () => {
  it("iterates range cells with deterministic offsets", () => {
    const visited: string[] = []
    forEachDataGridRangeCell(
      {
        startRow: 2,
        endRow: 3,
        startColumn: 5,
        endColumn: 6,
      },
      cell => {
        visited.push(
          `${cell.rowIndex}:${cell.columnIndex}:${cell.rowOffset}:${cell.columnOffset}`,
        )
      },
    )

    expect(visited).toEqual([
      "2:5:0:0",
      "2:6:0:1",
      "3:5:1:0",
      "3:6:1:1",
    ])
    expect(getDataGridRangeWidth({
      startRow: 2,
      endRow: 3,
      startColumn: 5,
      endColumn: 6,
    })).toBe(2)
  })

  it("keeps mutable row clones isolated and commits by row id", () => {
    const sourceRows: readonly Row[] = [
      { rowId: "r1", value: "alpha" },
      { rowId: "r2", value: "beta" },
    ]
    const store = createDataGridMutableRowStore({
      rows: sourceRows,
      resolveRowId: row => row.rowId,
      cloneRow: row => ({ ...row }),
    })

    const mutable = store.getMutableRow("r2")
    expect(mutable).not.toBeNull()
    if (mutable) {
      mutable.value = "updated"
    }

    const committed = store.commitRows(sourceRows)
    expect(committed).toEqual([
      { rowId: "r1", value: "alpha" },
      { rowId: "r2", value: "updated" },
    ])
    expect(sourceRows[1]?.value).toBe("beta")
  })
})
