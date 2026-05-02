import { describe, expect, it, vi } from "vitest"
import { useDataGridAppIntentHistory } from "../useDataGridAppIntentHistory"

type DemoRow = {
  a: string
  b: string
  c: string
}

type DemoRowState = {
  rowId: string
  data: DemoRow
}

type DemoSnapshot = {
  kind: "full" | "partial"
  rows: Array<{ rowId: string | number; row: DemoRow }>
}

function createHistoryHarness(initialRows: DemoRowState[]) {
  let rows = initialRows.map(row => ({
    rowId: row.rowId,
    data: { ...row.data },
  }))

  const applyEdits = vi.fn((updates: Array<{ rowId: string | number; data: Partial<DemoRow> }>) => {
    rows = rows.map(row => {
      const update = updates.find(candidate => candidate.rowId === row.rowId)
      return update
        ? { ...row, data: { ...row.data, ...update.data } }
        : row
    })
  })

  const setData = vi.fn((nextRows: Array<{ rowId: string | number; originalIndex: number; row: DemoRow }>) => {
    rows = nextRows.map(entry => ({
      rowId: String(entry.rowId),
      data: { ...entry.row },
    }))
  })

  const syncViewport = vi.fn()
  const history = useDataGridAppIntentHistory<DemoRow>({
    runtime: {
      api: {
        rows: {
          getCount: () => rows.length,
          get: (rowIndex: number) => {
            const row = rows[rowIndex]
            return row ? { rowId: row.rowId, kind: "leaf", data: row.data } : null
          },
          setData,
          applyEdits,
        },
      },
      getBodyRowAtIndex: (rowIndex: number) => {
        const row = rows[rowIndex]
        return row ? { rowId: row.rowId, kind: "leaf", data: row.data } : null
      },
      resolveBodyRowIndexById: (rowId: string | number) => rows.findIndex(row => row.rowId === rowId),
    } as never,
    cloneRowData: row => ({ ...row }),
    syncViewport,
  })

  const setRowData = (rowId: string, patch: Partial<DemoRow>) => {
    rows = rows.map(row => (
      row.rowId === rowId
        ? { ...row, data: { ...row.data, ...patch } }
        : row
    ))
  }

  const snapshotRows = () => rows.map(row => ({
    rowId: row.rowId,
    data: { ...row.data },
  }))

  return {
    history,
    rows: snapshotRows,
    setRowData,
    applyEdits,
    setData,
    syncViewport,
  }
}

describe("useDataGridAppIntentHistory contract", () => {
  it("replays inline edit snapshots without duplicating the patch", async () => {
    const harness = createHistoryHarness([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
    ])

    const beforeSnapshot = harness.history.captureRowsSnapshotByIds(["r2"])
    harness.setRowData("r2", { a: "A2-edited" })
    const afterSnapshot: DemoSnapshot = {
      kind: "partial",
      rows: [
        {
          rowId: "r2",
          row: { a: "A2-edited", b: "B2", c: "C2" },
        },
      ],
    }

    await harness.history.recordIntentTransaction(
      { intent: "edit", label: "Cell edit" },
      beforeSnapshot,
      afterSnapshot,
    )

    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2-edited", b: "B2", c: "C2" } },
    ])

    await harness.history.runHistoryAction("undo")
    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
    ])

    await harness.history.runHistoryAction("redo")
    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2-edited", b: "B2", c: "C2" } },
    ])
  })

  it("replays multi-cell paste snapshots with exact undo and redo values", async () => {
    const harness = createHistoryHarness([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
      { rowId: "r3", data: { a: "A3", b: "B3", c: "C3" } },
    ])

    const beforeSnapshot = harness.history.captureRowsSnapshotByIds(["r1", "r2"])
    harness.setRowData("r1", { a: "X1", b: "Y1" })
    harness.setRowData("r2", { a: "X2", b: "Y2" })
    const afterSnapshot: DemoSnapshot = {
      kind: "partial",
      rows: [
        { rowId: "r1", row: { a: "X1", b: "Y1", c: "C1" } },
        { rowId: "r2", row: { a: "X2", b: "Y2", c: "C2" } },
      ],
    }

    await harness.history.recordIntentTransaction(
      { intent: "paste", label: "Paste 4 cells" },
      beforeSnapshot,
      afterSnapshot,
    )

    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "X1", b: "Y1", c: "C1" } },
      { rowId: "r2", data: { a: "X2", b: "Y2", c: "C2" } },
      { rowId: "r3", data: { a: "A3", b: "B3", c: "C3" } },
    ])

    await harness.history.runHistoryAction("undo")
    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
      { rowId: "r3", data: { a: "A3", b: "B3", c: "C3" } },
    ])

    await harness.history.runHistoryAction("redo")
    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "X1", b: "Y1", c: "C1" } },
      { rowId: "r2", data: { a: "X2", b: "Y2", c: "C2" } },
      { rowId: "r3", data: { a: "A3", b: "B3", c: "C3" } },
    ])
  })

  it("replays fill snapshots once for materialized ranges", async () => {
    const harness = createHistoryHarness([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
      { rowId: "r3", data: { a: "A3", b: "B3", c: "C3" } },
    ])

    const beforeSnapshot = harness.history.captureRowsSnapshotByIds(["r2", "r3"])
    harness.setRowData("r2", { a: "A1", b: "B1" })
    harness.setRowData("r3", { a: "A2", b: "B2" })
    const afterSnapshot: DemoSnapshot = {
      kind: "partial",
      rows: [
        { rowId: "r2", row: { a: "A1", b: "B1", c: "C2" } },
        { rowId: "r3", row: { a: "A2", b: "B2", c: "C3" } },
      ],
    }

    await harness.history.recordIntentTransaction(
      { intent: "fill", label: "Fill edit" },
      beforeSnapshot,
      afterSnapshot,
    )

    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A1", b: "B1", c: "C2" } },
      { rowId: "r3", data: { a: "A2", b: "B2", c: "C3" } },
    ])

    await harness.history.runHistoryAction("undo")
    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
      { rowId: "r3", data: { a: "A3", b: "B3", c: "C3" } },
    ])

    await harness.history.runHistoryAction("redo")
    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A1", b: "B1", c: "C2" } },
      { rowId: "r3", data: { a: "A2", b: "B2", c: "C3" } },
    ])
  })

  it("isolates recorded optimistic snapshots from later server refresh mutations", async () => {
    const harness = createHistoryHarness([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
    ])

    const beforeSnapshot = harness.history.captureRowsSnapshotByIds(["r1"])
    harness.setRowData("r1", { a: "A1-edited" })
    const afterSnapshot = harness.history.captureRowsSnapshotByIds(["r1"])

    await harness.history.recordIntentTransaction(
      { intent: "edit", label: "Optimistic edit" },
      beforeSnapshot,
      afterSnapshot,
    )

    beforeSnapshot.rows[0]!.row.a = "server-refresh-before"
    afterSnapshot.rows[0]!.row.a = "server-refresh-after"

    await harness.history.runHistoryAction("undo")
    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
    ])

    await harness.history.runHistoryAction("redo")
    expect(harness.rows()).toEqual([
      { rowId: "r1", data: { a: "A1-edited", b: "B1", c: "C1" } },
      { rowId: "r2", data: { a: "A2", b: "B2", c: "C2" } },
    ])
  })
})
