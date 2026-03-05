import { describe, expect, it } from "vitest"
import type { DataGridRowNode } from "../rowModel"
import { applyClientRowPatchUpdates } from "../clientRowPatchRuntime"

interface RowShape {
  id: string
  value: number
}

function createRow(id: string, value: number): DataGridRowNode<RowShape> {
  const row = { id, value }
  return {
    kind: "leaf",
    data: row,
    row,
    rowKey: id,
    rowId: id,
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: 0,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
    groupMeta: undefined,
  }
}

const applyRowDataPatch = (current: RowShape, patch: Partial<RowShape>): RowShape => ({
  ...current,
  ...patch,
})

describe("applyClientRowPatchUpdates", () => {
  it("returns a copied source array by default when rows change", () => {
    const sourceRows = [createRow("r1", 1), createRow("r2", 2)]
    const result = applyClientRowPatchUpdates({
      sourceRows,
      sourceRowIndexById: new Map([
        ["r1", 0],
        ["r2", 1],
      ]),
      updatesById: new Map([["r1", { value: 10 }]]),
      applyRowDataPatch,
    })

    expect(result.changed).toBe(true)
    expect(result.nextSourceRows).not.toBe(sourceRows)
    expect(result.nextSourceRows[0]?.data.value).toBe(10)
    expect(sourceRows[0]?.data.value).toBe(1)
  })

  it("updates source rows in place when mutateSourceRowsInPlace is enabled", () => {
    const sourceRows = [createRow("r1", 1), createRow("r2", 2)]
    const result = applyClientRowPatchUpdates({
      sourceRows,
      sourceRowIndexById: new Map([
        ["r1", 0],
        ["r2", 1],
      ]),
      updatesById: new Map([["r1", { value: 10 }]]),
      applyRowDataPatch,
      mutateSourceRowsInPlace: true,
    })

    expect(result.changed).toBe(true)
    expect(result.nextSourceRows).toBe(sourceRows)
    expect(sourceRows[0]?.data.value).toBe(10)
  })
})
