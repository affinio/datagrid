import { describe, expect, it, vi } from "vitest"
import { useDataGridRuntimeService } from "../runtime/useDataGridRuntimeService"

interface Row {
  rowId: string
  name: string
}

describe("useDataGridRuntimeService contract", () => {
  it("preserves row identity and formula lifecycle methods on the orchestrated API", () => {
    const runtime = useDataGridRuntimeService<Row>({
      rows: [
        { rowId: "r1", name: "alpha" },
        { rowId: "r2", name: "bravo" },
      ],
      columns: [{ key: "name", label: "Name" }],
    })

    expect(runtime.api.rows.getById("r1")?.rowId).toBe("r1")
    expect(runtime.api.rows.hasRowIdLookupSupport()).toBe(true)
    expect(runtime.api.rows.hasRemoveSupport()).toBe(true)
    expect(runtime.api.rows.hasComputedUnregisterSupport()).toBe(true)
    expect(runtime.api.rows.hasFormulaUnregisterSupport()).toBe(true)
    expect(typeof runtime.api.rows.batchMutations).toBe("function")
    expect(runtime.api.rows.removeData(["r2"])).toBe(true)
    expect(runtime.api.rows.getById("r2")).toBeUndefined()
  })

  it("exposes canonical virtualWindow snapshot and updates it on range/row/column changes", async () => {
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
    await runtime.stop()
    expect(runtime.isDisposed()).toBe(true)
  })

  it("routes stop through API disposal and preserves its completion", async () => {
    let pluginDisposals = 0
    const runtime = useDataGridRuntimeService<Row>({
      rows: [{ rowId: "r1", name: "alpha" }],
      columns: [{ key: "name" }],
      plugins: [{ id: "resource", onDispose: () => { pluginDisposals += 1 } }],
    })
    await runtime.start()
    const stopping = runtime.stop()
    expect(runtime.stop()).toBe(stopping)
    await stopping
    expect(pluginDisposals).toBe(1)
    expect(runtime.api.plugins.has("resource")).toBe(false)
    expect(runtime.isDisposed()).toBe(true)
  })

  it("attempts cleanup after one service disposer rejects and reports stop failure", async () => {
    const disposed: string[] = []
    const runtime = useDataGridRuntimeService<Row>({
      rows: [{ rowId: "r1", name: "alpha" }],
      columns: [{ key: "name" }],
      services: {
        event: { name: "event", dispose: () => { disposed.push("event") } },
        viewport: { name: "viewport", dispose: () => { disposed.push("viewport"); throw new Error("viewport-cleanup") } },
      },
    })
    await runtime.start()
    await expect(runtime.stop()).rejects.toThrow(/cleanup failures/)
    expect(disposed).toEqual(["viewport", "event"])
    expect(runtime.isDisposed()).toBe(true)
  })

  it("syncs pivot runtime columns into column model and removes them when pivot is cleared", async () => {
    const runtime = useDataGridRuntimeService<{
      rowId: string
      team: string
      year: number
      revenue: number
      note: string
    }>({
      rows: [
        { rowId: "r1", team: "A", year: 2024, revenue: 10, note: "first" },
        { rowId: "r2", team: "A", year: 2025, revenue: 20, note: "second" },
      ],
      columns: [
        { key: "team", field: "team", label: "Team", initialState: { width: 180 } },
        { key: "year", field: "year", label: "Year" },
        { key: "revenue", field: "revenue", label: "Revenue" },
        { key: "note", field: "note", label: "Note", initialState: { visible: false } },
      ],
    })

    expect(runtime.getColumnSnapshot().visibleColumns.map(column => column.key)).toEqual(["team", "year", "revenue"])

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
    expect(withPivot.visibleColumns.map(column => column.key)).toEqual(["team", ...pivotKeys])
    expect(withPivot.columns.find(column => column.key === "year")?.visible).toBe(false)
    expect(withPivot.columns.find(column => column.key === "revenue")?.visible).toBe(false)

    runtime.api.pivot.setModel(null)
    const afterClear = runtime.getColumnSnapshot()
    expect(afterClear.columns.map(column => column.key)).toEqual(["team", "year", "revenue", "note"])
    expect(afterClear.visibleColumns.map(column => column.key)).toEqual(["team", "year", "revenue"])
    expect(afterClear.columns.find(column => column.key === "team")?.width).toBe(180)

    runtime.api.columns.setAll([
      { key: "customName", field: "team", label: "Name" },
      { key: "year", field: "year", label: "Year" },
      { key: "revenue", field: "revenue", label: "Revenue" },
      { key: "note", field: "note", label: "Note", initialState: { visible: false } },
    ])
    runtime.api.pivot.setModel({
      rows: ["team"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    })
    expect(runtime.getColumnSnapshot().columns.some(column => column.key === "customName")).toBe(true)
    runtime.api.pivot.setModel(null)
    expect(runtime.getColumnSnapshot().columns.map(column => column.key)).toEqual(["customName", "year", "revenue", "note"])

    await runtime.stop()
  })

  it("forwards client row model compute options when runtime creates client model internally", async () => {
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

    await runtime.stop()
  })

  it("keeps worker mode responsive when column metadata is cyclic", async () => {
    const meta: Record<string, unknown> = {
      section: "ops",
    }
    meta.self = meta

    const runtime = useDataGridRuntimeService<Row>({
      rows: [
        { rowId: "r1", name: "alpha" },
        { rowId: "r2", name: "bravo" },
      ],
      columns: [{ key: "name", label: "Name", meta }],
      clientRowModelOptions: {
        computeMode: "worker",
        computeTransport: {
          dispatch() {
            return { handled: false }
          },
        },
      },
    })

    expect(() => {
      runtime.api.rows.setSortModel([{ key: "name", direction: "asc" }])
      runtime.syncRowsInRange({ start: 0, end: 1 })
    }).not.toThrow()

    expect(runtime.getColumnSnapshot().columns.map(column => column.key)).toEqual(["name"])

    await runtime.stop()
  })

  it("passes api plugins through runtime constructor options", async () => {
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
    await runtime.stop()
  })

  it("uses matching viewport anchor indexes before row id scans", async () => {
    const runtime = useDataGridRuntimeService<Row>({
      rows: Array.from({ length: 100 }, (_, index) => ({
        rowId: `r${index}`,
        name: `row ${index}`,
      })),
      columns: [
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ],
    })
    const getRowSpy = vi.spyOn(runtime.rowModel, "getRow")

    runtime.setViewportPosition({
      version: 1,
      range: { start: 90, end: 95 },
      anchor: { rowId: "r90", rowIndex: 90, columnKey: "status", columnIndex: 1 },
      scroll: { top: 900, left: 120 },
    })

    expect(getRowSpy).toHaveBeenCalledTimes(1)
    expect(getRowSpy).toHaveBeenCalledWith(90)
    expect(runtime.getVirtualWindowSnapshot()).toMatchObject({
      rowStart: 90,
      rowEnd: 95,
      colStart: 1,
      colEnd: 1,
    })

    await runtime.stop()
  })

  it("roundtrips semantic viewport position through runtime service", async () => {
    const runtime = useDataGridRuntimeService<Row>({
      rows: [
        { rowId: "r1", name: "alpha" },
        { rowId: "r2", name: "bravo" },
      ],
      columns: [
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ],
    })

    expect(runtime.api.capabilities.viewportPosition).toBe(true)

    runtime.scrollToCell({ rowId: "r2", columnKey: "status" })

    expect(runtime.getVirtualWindowSnapshot()).toMatchObject({
      rowStart: 1,
      rowEnd: 1,
      colStart: 1,
      colEnd: 1,
    })
    expect(runtime.getViewportPosition()).toEqual({
      version: 1,
      range: { start: 1, end: 1 },
      anchor: { rowId: "r2", rowIndex: 1, columnKey: "status", columnIndex: 1 },
      scroll: { top: 0, left: 0 },
    })

    const state = runtime.api.state.get({ includeViewportPosition: true })
    runtime.setViewportPosition({
      version: 1,
      range: { start: 0, end: 0 },
      anchor: { rowId: "r1", rowIndex: 0, columnKey: "name", columnIndex: 0 },
      scroll: { top: 12, left: 24 },
    })
    expect(runtime.getVirtualWindowSnapshot()).toMatchObject({
      rowStart: 0,
      colStart: 0,
    })

    runtime.api.state.set(state)
    expect(runtime.getVirtualWindowSnapshot()).toMatchObject({
      rowStart: 1,
      colStart: 1,
    })

    await runtime.stop()
  })
})
