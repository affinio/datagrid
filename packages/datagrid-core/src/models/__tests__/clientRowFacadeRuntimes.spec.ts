import { describe, expect, it, vi } from "vitest"
import { createClientRowAccessHostRuntime } from "../host/clientRowAccessHostRuntime.js"
import { createClientRowRowsFacadeRuntime } from "../host/clientRowRowsFacadeRuntime.js"
import { createClientRowCalculationSnapshotFacadeRuntime } from "../host/clientRowCalculationSnapshotFacadeRuntime.js"
import type {
  DataGridRowNode,
  DataGridRowNodeInput,
} from "../rowModel.js"

interface RowData {
  id: string
}

function createRow(id: string, index = 0): DataGridRowNode<RowData> {
  return {
    kind: "leaf",
    data: { id },
    row: { id },
    rowKey: id,
    rowId: id,
    originalIndex: index,
    sourceIndex: index,
    displayIndex: index,
    state: { selected: false, group: false, pinned: "none", expanded: false },
  }
}

describe("client row facade runtimes", () => {
  it("serves row access methods through a focused read facade", () => {
    const rows = [createRow("r1", 0), createRow("r2", 1)]
    const ensureActive = vi.fn()
    const runtime = createClientRowAccessHostRuntime<RowData>({
      ensureActive,
      getMaterializedSourceRows: () => rows,
      getRowRevision: () => 7,
      getFormulaStructureRevision: () => 3,
      getRows: () => rows,
      normalizeViewportRange: range => range,
      materializeOutputRow: row => row,
      materializeOutputRowsInRange: (inputRows, start, end) => inputRows.slice(start, end + 1) as DataGridRowNode<RowData>[],
    })

    expect(runtime.getSourceRows().map(row => row.rowId)).toEqual(["r1", "r2"])
    expect(runtime.getSourceRowsRevision()).toBe(7)
    expect(runtime.getFormulaStructureRevision()).toBe(3)
    expect(runtime.getRowCount()).toBe(2)
    expect(runtime.getRow(1)?.rowId).toBe("r2")
    expect(runtime.getRowsInRange({ start: 0, end: 1 }).map(row => row.rowId)).toEqual(["r1", "r2"])
    expect(ensureActive).toHaveBeenCalledTimes(3)
  })

  it("keeps append and prepend row mutations out of the composition root", () => {
    const baseRows = [createRow("base")]
    const setRows = vi.fn()
    const runtime = createClientRowRowsFacadeRuntime<RowData>({
      getBaseSourceRows: () => baseRows,
      setRows,
      insertRowsAt: vi.fn(() => true),
      insertRowsBefore: vi.fn(() => true),
      insertRowsAfter: vi.fn(() => true),
    })
    const nextRows: readonly DataGridRowNodeInput<RowData>[] = [createRow("next")]

    runtime.appendRows([])
    expect(setRows).not.toHaveBeenCalled()

    runtime.appendRows(nextRows)
    expect(setRows).toHaveBeenLastCalledWith([...baseRows, ...nextRows])

    runtime.prependRows(nextRows)
    expect(setRows).toHaveBeenLastCalledWith([...nextRows, ...baseRows])
  })

  it("wraps calculation snapshot methods with active-state checks", () => {
    const ensureActive = vi.fn()
    const snapshot = { kind: "client-calculation" } as never
    const snapshotHostRuntime = {
      createCalculationSnapshot: vi.fn(() => snapshot),
      restoreCalculationSnapshot: vi.fn(() => true),
      inspectCalculationSnapshot: vi.fn(() => ({ restorable: true }) as never),
      pushCalculationSnapshot: vi.fn(() => ({ id: 1, label: null, snapshot }) as never),
      undoCalculationSnapshot: vi.fn(() => false),
      redoCalculationSnapshot: vi.fn(() => false),
      getCalculationSnapshotHistory: vi.fn(() => ({ index: -1, entries: [] })),
    }
    const runtime = createClientRowCalculationSnapshotFacadeRuntime<RowData>({
      ensureActive,
      snapshotHostRuntime,
    })

    expect(runtime.createCalculationSnapshot()).toBe(snapshot)
    expect(runtime.restoreCalculationSnapshot(snapshot)).toBe(true)
    expect(runtime.getCalculationSnapshotHistory()).toEqual({ index: -1, entries: [] })
    expect(ensureActive).toHaveBeenCalledTimes(3)
  })
})
