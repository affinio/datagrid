import { describe, expect, it, vi } from "vitest"
import { useDataGridAppIntentHistory } from "../useDataGridAppIntentHistory"

type DemoRow = {
  value: string
}

describe("useDataGridAppIntentHistory contract", () => {
  it("captures and reapplies partial row snapshots by row id", async () => {
    let rows = [
      { rowId: "r1", data: { value: "A" } },
      { rowId: "r2", data: { value: "B" } },
      { rowId: "r3", data: { value: "C" } },
    ]
    const setData = vi.fn((nextRows: Array<{ rowId: string | number; row: DemoRow }>) => {
      rows = nextRows.map(entry => ({
        rowId: String(entry.rowId),
        data: { ...entry.row },
      }))
    })
    const applyEdits = vi.fn((updates: Array<{ rowId: string | number; data: Partial<DemoRow> }>) => {
      rows = rows.map(row => {
        const update = updates.find(candidate => candidate.rowId === row.rowId)
        return update ? { ...row, data: { ...row.data, ...update.data } } : row
      })
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

    const beforeSnapshot = history.captureRowsSnapshotByIds(["r2"])
    rows = rows.map(row => row.rowId === "r2" ? { ...row, data: { value: "patched" } } : row)

    await history.recordIntentTransaction({
      intent: "edit",
      label: "Patch row",
    }, beforeSnapshot)

    expect(setData).not.toHaveBeenCalled()

    await history.runHistoryAction("undo")

    expect(applyEdits).toHaveBeenCalledWith([
      {
        rowId: "r2",
        data: { value: "B" },
      },
    ])
    expect(rows.find(row => row.rowId === "r2")?.data.value).toBe("B")
  })
})
