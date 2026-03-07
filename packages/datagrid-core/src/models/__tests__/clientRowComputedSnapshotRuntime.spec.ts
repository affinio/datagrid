import { describe, expect, it } from "vitest"
import { buildRowIdPositionIndex } from "../clientRowRuntimeUtils"
import { applyRowDataPatch } from "../clientRowRuntimeUtils"
import { createClientRowComputedSnapshotRuntime } from "../clientRowComputedSnapshotRuntime"
import type { DataGridRowNode } from "../rowModel"

interface SnapshotRow {
  id: string
  value: number
  total?: number
  score?: number
}

function createRow(rowId: string, value: number, index: number): DataGridRowNode<SnapshotRow> {
  const row: SnapshotRow = { id: rowId, value }
  return {
    kind: "leaf",
    data: row,
    row,
    rowId,
    rowKey: rowId,
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

describe("clientRowComputedSnapshotRuntime", () => {
  it("can atomically replace computed overlay fields", () => {
    let sourceRows = [createRow("r1", 2, 0)]
    let indexById = buildRowIdPositionIndex(sourceRows)
    const runtime = createClientRowComputedSnapshotRuntime<SnapshotRow>({
      applyRowDataPatch,
      getSourceRows: () => sourceRows,
      getSourceRowIndexById: () => indexById,
    })

    runtime.setComputedFields(["total"])
    runtime.applyComputedUpdates(new Map([["r1", { total: 10 }]]))
    expect((runtime.materializeRow(sourceRows[0])?.data as SnapshotRow).total).toBe(10)

    const result = runtime.replaceWithPatchedSnapshot({
      computedFields: ["score"],
      updatesByRowId: new Map([["r1", { score: 7 }]]),
    })

    expect(result.changed).toBe(true)
    expect(result.fieldsChanged).toBe(true)
    const materialized = runtime.materializeRow(sourceRows[0])
    expect((materialized.data as SnapshotRow).total).toBeUndefined()
    expect((materialized.data as SnapshotRow).score).toBe(7)
  })

  it("exports and restores calculation snapshots", () => {
    let sourceRows = [createRow("r1", 2, 0), createRow("r2", 5, 1)]
    let indexById = buildRowIdPositionIndex(sourceRows)
    const runtime = createClientRowComputedSnapshotRuntime<SnapshotRow>({
      applyRowDataPatch,
      getSourceRows: () => sourceRows,
      getSourceRowIndexById: () => indexById,
    })

    runtime.replaceWithPatchedSnapshot({
      computedFields: ["total"],
      updatesByRowId: new Map([
        ["r1", { total: 20 }],
        ["r2", { total: 50 }],
      ]),
    })

    const snapshot = runtime.createSnapshot()
    const restoredRuntime = createClientRowComputedSnapshotRuntime<SnapshotRow>({
      applyRowDataPatch,
      getSourceRows: () => sourceRows,
      getSourceRowIndexById: () => indexById,
    })
    restoredRuntime.replaceSnapshot(snapshot)

    expect((restoredRuntime.materializeRow(sourceRows[0]).data as SnapshotRow).total).toBe(20)
    expect((restoredRuntime.materializeRow(sourceRows[1]).data as SnapshotRow).total).toBe(50)

    sourceRows = [createRow("r2", 5, 0), createRow("r1", 2, 1)]
    restoredRuntime.pruneRows(sourceRows)
    indexById = buildRowIdPositionIndex(sourceRows)

    expect((restoredRuntime.materializeRow(sourceRows[0]).data as SnapshotRow).total).toBe(50)
    expect((restoredRuntime.materializeRow(sourceRows[1]).data as SnapshotRow).total).toBe(20)
  })
})
