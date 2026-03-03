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

  it("syncs pivot runtime columns into column model and removes them when pivot is cleared", () => {
    const runtime = useDataGridRuntimeService<{
      rowId: string
      team: string
      year: number
      revenue: number
    }>({
      rows: [
        { rowId: "r1", team: "A", year: 2024, revenue: 10 },
        { rowId: "r2", team: "A", year: 2025, revenue: 20 },
      ],
      columns: [{ key: "team", label: "Team", width: 180 }],
    })

    expect(runtime.getColumnSnapshot().columns.map(column => column.key)).toEqual(["team"])

    runtime.api.pivot.setModel({
      rows: ["team"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    })

    const withPivot = runtime.getColumnSnapshot()
    const pivotKeys = withPivot.columns
      .map(column => column.key)
      .filter(key => key.startsWith("pivot|"))
    expect(pivotKeys.length).toBe(2)
    expect(withPivot.columns.find(column => column.key === "team")?.width).toBe(180)

    runtime.api.pivot.setModel(null)
    const afterClear = runtime.getColumnSnapshot()
    expect(afterClear.columns.map(column => column.key)).toEqual(["team"])
    expect(afterClear.columns.find(column => column.key === "team")?.width).toBe(180)

    runtime.stop()
  })

  it("forwards client row model compute options when runtime creates client model internally", () => {
    const dispatchedKinds: string[] = []
    const runtime = useDataGridRuntimeService<{
      rowId: string
      name: string
    }>({
      rows: [
        { rowId: "r1", name: "alpha" },
        { rowId: "r2", name: "bravo" },
      ],
      columns: [{ key: "name", label: "Name" }],
      clientRowModelOptions: {
        computeMode: "worker",
        computeTransport: {
          dispatch(request) {
            dispatchedKinds.push(request.kind)
            return { handled: false }
          },
        },
      },
    })

    runtime.api.rows.setSortModel([{ key: "name", direction: "asc" }])
    runtime.setRows([
      { rowId: "r1", name: "alpha" },
      { rowId: "r2", name: "bravo" },
      { rowId: "r3", name: "charlie" },
    ])

    const diagnostics = (
      runtime.rowModel as {
        getComputeDiagnostics?: () => { configuredMode?: string; dispatchCount?: number }
      }
    ).getComputeDiagnostics?.()

    expect(diagnostics?.configuredMode).toBe("worker")
    expect((diagnostics?.dispatchCount ?? 0) > 0).toBe(true)
    expect(dispatchedKinds.length).toBeGreaterThan(0)

    runtime.stop()
  })

  it("passes api plugins through runtime constructor options", () => {
    const pluginEvents: string[] = []
    const runtime = useDataGridRuntimeService<Row>({
      rows: [{ rowId: "r1", name: "alpha" }],
      columns: [{ key: "name", label: "Name" }],
      plugins: [
        {
          id: "runtime-service-plugin",
          onEvent(event) {
            pluginEvents.push(String(event))
          },
        },
      ],
    })

    expect(runtime.api.plugins.has("runtime-service-plugin")).toBe(true)
    runtime.api.rows.setSortModel([{ key: "name", direction: "asc" }])
    expect(pluginEvents.some(event => event === "rows:changed")).toBe(true)
    runtime.stop()
  })
})
