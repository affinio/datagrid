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

  it("propagates async partial snapshot replay through undo", async () => {
    let rows = [
      { rowId: "r1", data: { value: "A" } },
      { rowId: "r2", data: { value: "B" } },
    ]
    let releaseCommit: () => void = () => undefined
    const applyEdits = vi.fn(async (updates: Array<{ rowId: string | number; data: Partial<DemoRow> }>) => {
      await new Promise<void>((resolve: (value: void | PromiseLike<void>) => void) => {
        releaseCommit = resolve
      })
      rows = rows.map(row => {
        const update = updates.find(candidate => candidate.rowId === row.rowId)
        return update ? { ...row, data: { ...row.data, ...update.data } } : row
      })
    })

    const history = useDataGridAppIntentHistory<DemoRow>({
      runtime: {
        api: {
          rows: {
            getCount: () => rows.length,
            get: (rowIndex: number) => {
              const row = rows[rowIndex]
              return row ? { rowId: row.rowId, kind: "leaf", data: row.data } : null
            },
            setData: vi.fn(),
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
      syncViewport: vi.fn(),
    })

    const beforeSnapshot = history.captureRowsSnapshotByIds(["r1"])
    rows = rows.map(row => row.rowId === "r1" ? { ...row, data: { value: "patched" } } : row)

    await history.recordIntentTransaction({ intent: "edit", label: "Patch row" }, beforeSnapshot)

    const undoPromise = history.runHistoryAction("undo")
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)
    releaseCommit()
    await undoPromise

    expect(applyEdits).toHaveBeenCalledWith([
      {
        rowId: "r1",
        data: { value: "A" },
      },
    ])
    expect(rows.find(row => row.rowId === "r1")?.data.value).toBe("A")
  })

  it("replays full snapshots with row patches when setRows is unavailable", async () => {
    let rows = [
      { rowId: "r1", data: { value: "A" } },
      { rowId: "r2", data: { value: "B" } },
    ]
    const setData = vi.fn()
    const applyEdits = vi.fn((updates: Array<{ rowId: string | number; data: Partial<DemoRow> }>) => {
      rows = rows.map(row => {
        const update = updates.find(candidate => candidate.rowId === row.rowId)
        return update ? { ...row, data: { ...row.data, ...update.data } } : row
      })
    })

    const history = useDataGridAppIntentHistory<DemoRow>({
      runtime: {
        api: {
          rows: {
            getCount: () => rows.length,
            get: (rowIndex: number) => {
              const row = rows[rowIndex]
              return row ? { rowId: row.rowId, kind: "leaf", data: row.data } : null
            },
            hasDataMutationSupport: () => false,
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
      syncViewport: vi.fn(),
    })

    const beforeSnapshot = history.captureRowsSnapshot()
    rows = rows.map(row => ({ ...row, data: { value: `${row.data.value}-edited` } }))

    await history.recordIntentTransaction({
      intent: "fill",
      label: "Fill edit",
    }, beforeSnapshot)

    await history.runHistoryAction("undo")
    await history.runHistoryAction("redo")

    expect(setData).not.toHaveBeenCalled()
    expect(applyEdits).toHaveBeenCalled()
    expect(rows.map(row => row.data.value)).toEqual(["A-edited", "B-edited"])
  })
})
