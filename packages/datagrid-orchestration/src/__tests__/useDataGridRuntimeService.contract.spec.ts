import { describe, expect, it } from "vitest"
import { useDataGridRuntimeService } from "../useDataGridRuntimeService"

interface Row {
  rowId: string
  name: string
}

describe("useDataGridRuntimeService contract", () => {
  it("exposes canonical virtualWindow snapshot and updates it on range/row/column changes", () => {
    const runtime = useDataGridRuntimeService<Row>({
      rows: [
        { rowId: "r1", name: "alpha" },
        { rowId: "r2", name: "bravo" },
      ],
      columns: [{ key: "name", label: "Name" }],
    })

    const snapshots: Array<{ rowStart: number; rowEnd: number; rowTotal: number; colTotal: number }> = []
    const unsubscribe = runtime.subscribeVirtualWindow(snapshot => {
      if (!snapshot) {
        return
      }
      snapshots.push({
        rowStart: snapshot.rowStart,
        rowEnd: snapshot.rowEnd,
        rowTotal: snapshot.rowTotal,
        colTotal: snapshot.colTotal,
      })
    })

    expect(runtime.getVirtualWindowSnapshot()).toMatchObject({
      rowTotal: 2,
      colTotal: 1,
    })

    runtime.syncRowsInRange({ start: 1, end: 1 })
    expect(runtime.getVirtualWindowSnapshot()).toMatchObject({
      rowStart: 1,
      rowEnd: 1,
      rowTotal: 2,
      colTotal: 1,
    })

    runtime.setRows([
      { rowId: "r1", name: "alpha" },
      { rowId: "r2", name: "bravo" },
      { rowId: "r3", name: "charlie" },
    ])
    expect(runtime.getVirtualWindowSnapshot()).toMatchObject({
      rowTotal: 3,
      colTotal: 1,
    })

    runtime.setColumns([
      { key: "name", label: "Name" },
      { key: "status", label: "Status" },
    ])
    expect(runtime.getVirtualWindowSnapshot()).toMatchObject({
      rowTotal: 3,
      colTotal: 2,
    })

    expect(snapshots.length).toBeGreaterThan(0)
    unsubscribe()
    runtime.stop()
    expect(runtime.isDisposed()).toBe(true)
  })
})
