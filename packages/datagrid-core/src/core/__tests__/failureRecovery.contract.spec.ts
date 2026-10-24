import { describe, expect, it, vi } from "vitest"
import { createDataGridApi } from "../gridApi"
import { createDataGridCore } from "../gridCore"
import { createAdvancedClientRowModel, createDataGridColumnModel, createDataSourceBackedRowModel } from "../../models"
import { createClientRowStateMutationsRuntime } from "../../models/mutation/clientRowStateMutationsRuntime"

const rows = (...values: number[]) => values.map((v, index) => ({ rowId: String(index), row: { v }, originalIndex: index }))

function createApi() {
  const rowModel = createAdvancedClientRowModel({ rows: rows(1, 2) })
  const columnModel = createDataGridColumnModel({ columns: [{ key: "v" }] })
  const api = createDataGridApi({
    core: createDataGridCore({ services: {
      rowModel: { name: "rowModel", model: rowModel },
      columnModel: { name: "columnModel", model: columnModel },
    } }),
  })
  return { api, rowModel, columnModel }
}

describe("failure recovery contracts", () => {
  it("restores pagination and group expansion when stage materialization fails", () => {
    let pagination = { pageSize: 20, currentPage: 0 }
    let expandedByDefault = false
    const toggledKeys = new Set(["group:g"])
    let recomputes = 0
    const emit = vi.fn()
    const context = {
      ensureActive() {},
      emit,
      recomputeFromStage() {
        recomputes += 1
        if (recomputes === 1) throw new Error("materialize-once")
      },
      setProjectionInvalidation() {},
      bumpSortRevision() {},
      bumpFilterRevision() {},
      bumpGroupRevision() {},
      getRuntimeRowCount: () => 100,
      getViewportRange: () => ({ start: 0, end: 20 }),
      setViewportRange() {},
      getPaginationInput: () => pagination,
      setPaginationInput(value: typeof pagination) { pagination = value },
      getSortModel: () => [],
      setSortModel() {},
      cloneSortModel: (value: readonly never[]) => value,
      getFilterModel: () => null,
      setFilterModel() {},
      cloneFilterModel: () => null,
      isTreeDataEnabled: () => false,
      getGroupBy: () => null,
      setGroupBy() {},
      setExpansionExpandedByDefault(value: boolean) { expandedByDefault = value },
      clearToggledGroupKeys() { toggledKeys.clear() },
      getPivotModel: () => null,
      setPivotModel() {},
      resetPivotColumns() {},
      setPivotExpansionExpandedByDefault() {},
      clearToggledPivotGroupKeys() {},
      getAggregationModel: () => null,
      setAggregationModel() {},
      invalidateTreeProjectionCaches() {},
      applyGroupExpansion: () => false,
      getExpansionSpec: () => ({ fields: ["group"] }),
      getActiveExpansionStateStore: () => ({
        get expandedByDefault() { return expandedByDefault },
        setExpandedByDefault(value: boolean) { expandedByDefault = value },
        toggledKeys,
      }),
    } as never
    const runtime = createClientRowStateMutationsRuntime(context)

    expect(() => runtime.setCurrentPage(3)).toThrow("materialize-once")
    expect(pagination).toEqual({ pageSize: 20, currentPage: 0 })
    expect(recomputes).toBe(2)
    expect(emit).not.toHaveBeenCalled()

    recomputes = 0
    expect(() => runtime.expandAllGroups()).toThrow("materialize-once")
    expect(expandedByDefault).toBe(false)
    expect([...toggledKeys]).toEqual(["group:g"])
    expect(recomputes).toBe(2)
    expect(emit).not.toHaveBeenCalled()
  })

  it("discards computed column cache writes from a failed pass before retry", () => {
    let fail = false
    const model = createAdvancedClientRowModel({
      rows: rows(1, 2),
      initialComputedFields: [{ name: "double", deps: ["field:v"], compute(context) {
        if (fail && context.rowId === "1") throw new Error("second-row")
        return Number(context.get("field:v")) * 2
      } }],
    })
    fail = true
    expect(() => model.patchRows([{ rowId: "0", data: { v: 10 } }, { rowId: "1", data: { v: 20 } }])).toThrow("second-row")
    fail = false
    expect(model.getRow(0)?.data).toMatchObject({ v: 1, double: 2 })
    expect(model.getRow(1)?.data).toMatchObject({ v: 2, double: 4 })
    model.patchRows([{ rowId: "0", data: { v: 10 } }, { rowId: "1", data: { v: 20 } }])
    expect(model.getRow(0)?.data).toMatchObject({ v: 10, double: 20 })
    expect(model.getRow(1)?.data).toMatchObject({ v: 20, double: 40 })
    model.dispose()
  })

  it("rolls back source rows when a projection callback rejects a patch", () => {
    let fail = false
    const model = createAdvancedClientRowModel({
      rows: rows(1, 2),
      comparatorRegistry: { unstable: (left: number, right: number) => {
        if (fail) throw new Error("comparator")
        return left - right
      } },
    })
    model.setSortModel([{ key: "v", direction: "asc", comparator: { kind: "custom", comparatorId: "unstable" } }] as never)
    fail = true
    expect(() => model.patchRows([{ rowId: "0", data: { v: 9 } }], { recomputeSort: true })).toThrow(/projection recovery was incomplete/)
    expect(model.getRowById("0")?.data.v).toBe(1)
    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => row.data.v)).toEqual([1, 2])
    fail = false
    model.patchRows([{ rowId: "0", data: { v: 9 } }], { recomputeSort: true })
    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => row.data.v)).toEqual([2, 9])
    model.dispose()
  })

  it("restores the previous filter when its accessor throws and allows the same filter to retry", () => {
    let fail = true
    const model = createAdvancedClientRowModel({
      rows: rows(1, 2),
      readFilterCell(row, key) {
        if (fail) throw new Error("filter-accessor")
        return row.data[key]
      },
    })
    const filter = { columnFilters: { v: { kind: "valueSet", tokens: ["number:1"] } } } as never
    expect(() => model.setFilterModel(filter)).toThrow("filter-accessor")
    expect(model.getSnapshot().filterModel).toBeNull()
    fail = false
    model.setFilterModel(filter)
    expect(model.getRowCount()).toBe(1)
    model.dispose()
  })

  it("restores the source row set after sort materialization fails", () => {
    let fail = false
    const model = createAdvancedClientRowModel({
      rows: rows(1, 2, 3),
      comparatorRegistry: { unstable: (left: number, right: number) => {
        if (fail) throw new Error("comparator")
        return left - right
      } },
    })
    model.setSortModel([{ key: "v", direction: "asc", comparator: { kind: "custom", comparatorId: "unstable" } }] as never)
    fail = true
    expect(() => model.setRows(rows(7, 8))).toThrow(/projection recovery was incomplete/)
    expect(model.getRowCount()).toBe(3)
    expect(model.getRowById("0")?.data.v).toBe(1)
    fail = false
    model.setRows(rows(7, 8))
    expect(model.getRowCount()).toBe(2)
    expect(model.getRow(0)?.data.v).toBe(7)
    model.dispose()
  })

  it("restores source and grouped totals after an aggregate callback fails", () => {
    let fail = false
    const model = createAdvancedClientRowModel({
      rows: [
        { rowId: "a", row: { group: "G", v: 1 }, originalIndex: 0 },
        { rowId: "b", row: { group: "G", v: 2 }, originalIndex: 1 },
      ],
      initialGroupBy: { fields: ["group"], expandedByDefault: true },
      initialAggregationModel: { columns: [{
        key: "sum", field: "v", op: "custom", createState: () => ({ sum: 0 }),
        add(state: { sum: number }, value: unknown) { state.sum += Number(value) },
        finalize(state: { sum: number }) {
          if (fail) throw new Error("aggregate")
          return state.sum
        },
      }] },
    })
    expect(model.getRow(0)?.groupMeta?.aggregates?.sum).toBe(3)
    fail = true
    expect(() => model.patchRows([{ rowId: "a", data: { v: 10 } }], { recomputeGroup: true })).toThrow(/projection recovery was incomplete/)
    expect(model.getRowById("a")?.data.v).toBe(1)
    expect(model.getRow(0)?.groupMeta?.aggregates?.sum).toBe(3)
    fail = false
    model.patchRows([{ rowId: "a", data: { v: 10 } }], { recomputeGroup: true })
    expect(model.getRow(0)?.groupMeta?.aggregates?.sum).toBe(12)
    model.dispose()
  })

  it.each(["insert", "remove"] as const)("rolls back source identity after %s projection failure", operation => {
    let fail = false
    const model = createAdvancedClientRowModel({
      rows: operation === "insert" ? rows(1, 2) : rows(1, 2, 3),
      comparatorRegistry: { unstable: (left: number, right: number) => {
        if (fail) throw new Error("comparator")
        return left - right
      } },
    })
    model.setSortModel([{ key: "v", direction: "asc", comparator: { kind: "custom", comparatorId: "unstable" } }] as never)
    fail = true
    const mutate = operation === "insert"
      ? () => model.insertRowsAt(1, [{ rowId: "new", row: { v: 3 }, originalIndex: 2 }])
      : () => model.removeRows(["0"])
    expect(mutate).toThrow(/projection recovery was incomplete/)
    expect(model.getRowCount()).toBe(operation === "insert" ? 2 : 3)
    expect(model.getRowById("0")?.data.v).toBe(1)
    expect(model.getRowById("new")).toBeUndefined()
    fail = false
    if (operation === "insert") {
      expect(model.insertRowsAt(1, [{ rowId: "new", row: { v: 3 }, originalIndex: 2 }])).toBe(true)
      expect(model.getRowCount()).toBe(3)
    } else {
      expect(model.removeRows(["0"])).toBe(true)
      expect(model.getRowCount()).toBe(2)
      expect(model.getRowById("0")).toBeUndefined()
    }
    model.dispose()
  })

  it("unpublishes a computed field when its initial materialization fails", () => {
    const model = createAdvancedClientRowModel({ rows: rows(1, 2) })
    expect(() => model.registerComputedField({ name: "broken", deps: ["field:v"], compute: () => { throw new Error("compute") } })).toThrow("compute")
    expect(model.getComputedFields().some(field => field.name === "broken")).toBe(false)
    model.patchRows([{ rowId: "0", data: { v: 4 } }])
    expect(model.getRow(0)?.data.v).toBe(4)
    model.dispose()
  })

  it("retries a synchronous datasource pull after releasing the failed lane", async () => {
    let fail = true
    let calls = 0
    const model = createDataSourceBackedRowModel({ dataSource: { pull() {
      calls += 1
      if (fail) throw new Error("sync-pull")
      return Promise.resolve({ rows: [{ index: 0, rowId: "a", row: { v: 4 } }], total: 1 })
    } } })
    await model.refresh()
    expect(model.getBackpressureDiagnostics().inFlight).toBe(false)
    expect(model.getSnapshot().loading).toBe(false)
    expect(model.getSnapshot().error?.message).toBe("sync-pull")
    fail = false
    await model.refresh()
    expect(calls).toBe(2)
    expect(model.getRow(0)?.data.v).toBe(4)
    model.dispose()
  })

  it("does not roll back a server-confirmed edit when publication fails", async () => {
    let serverValue = 1
    const model = createDataSourceBackedRowModel({ dataSource: {
      pull: async () => ({ rows: [{ index: 0, rowId: "a", row: { v: serverValue } }], total: 1 }),
      commitEdits: async request => {
        serverValue = Number(request.edits[0]?.data.v)
        return { committed: [{ rowId: "a" }] }
      },
    } })
    await model.refresh()
    let notifications = 0
    const unsubscribe = model.subscribe(() => {
      notifications += 1
      if (notifications === 2) throw new Error("post-confirmation")
    })
    await expect(model.patchRows!([{ rowId: "a", data: { v: 5 } }])).rejects.toThrow("post-confirmation")
    expect(serverValue).toBe(5)
    expect(model.getRow(0)?.data.v).toBe(5)
    unsubscribe()
    model.dispose()
  })

  it("queues an optimistic edit before a throwing publication listener runs", async () => {
    let serverValue = 1
    let commits = 0
    const model = createDataSourceBackedRowModel({ dataSource: {
      pull: async () => ({ rows: [{ index: 0, rowId: "a", row: { v: serverValue } }], total: 1 }),
      commitEdits: async request => {
        commits += 1
        serverValue = Number(request.edits[0]?.data.v)
        return { committed: [{ rowId: "a" }] }
      },
    } })
    await model.refresh()
    let throwOnce = true
    const unsubscribe = model.subscribe(() => {
      if (throwOnce) {
        throwOnce = false
        throw new Error("optimistic-listener")
      }
    })
    await expect(model.patchRows!([{ rowId: "a", data: { v: 5 } }])).rejects.toThrow("publication failed")
    unsubscribe()
    expect(commits).toBe(1)
    await model.refresh()
    expect(model.getRow(0)?.data.v).toBe(5)
    model.dispose()
  })

  it("retains accepted datasource rows when another row is rejected", async () => {
    let accepted = 1
    const model = createDataSourceBackedRowModel({ initialRowCount: 2, dataSource: {
      pull: async () => ({ rows: [
        { index: 0, rowId: "a", row: { v: accepted } },
        { index: 1, rowId: "b", row: { v: 2 } },
      ], total: 2 }),
      commitEdits: async () => {
        accepted = 10
        return { committed: [{ rowId: "a" }], rejected: [{ rowId: "b", reason: "denied" }] }
      },
    } })
    await model.refresh()
    await expect(model.patchRows!([
      { rowId: "a", data: { v: 10 } },
      { rowId: "b", data: { v: 20 } },
    ])).rejects.toThrow("denied")
    expect(model.getRow(0)?.data.v).toBe(10)
    expect(model.getRow(1)?.data.v).toBe(2)
    model.dispose()
  })

  it("disposes terminally while startup is waiting and does not start later services", async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const calls: string[] = []
    const core = createDataGridCore({ services: {
      event: { name: "event", async start() { calls.push("event:start"); await gate }, dispose() { calls.push("event:dispose") } },
      rowModel: { name: "rowModel", start() { calls.push("rows:start") } },
    } })
    const starting = core.start()
    await Promise.resolve()
    await core.dispose()
    release()
    await expect(starting).rejects.toThrow(/disposed/)
    expect(core.lifecycle.state).toBe("disposed")
    expect(calls).not.toContain("rows:start")
    expect(calls).toContain("event:dispose")
  })

  it("does not repeat successful init work when a later service init fails", async () => {
    let fail = true
    let acquired = 0
    const core = createDataGridCore({ services: {
      event: { name: "event", init() { acquired += 1 }, dispose() { acquired -= 1 } },
      rowModel: { name: "rowModel", init() { if (fail) throw new Error("init") } },
    } })
    await expect(core.init()).rejects.toThrow("init")
    fail = false
    await core.init()
    expect(acquired).toBe(1)
    await core.dispose()
    expect(acquired).toBe(0)
  })

  it("attempts all core disposers and preserves repeated teardown completion", async () => {
    const calls: string[] = []
    const core = createDataGridCore({ services: {
      event: { name: "event", dispose() { calls.push("event") } },
      viewport: { name: "viewport", dispose() { calls.push("viewport"); throw new Error("cleanup") } },
    } })
    await core.start()
    const first = core.dispose()
    await expect(first).rejects.toThrow(/cleanup failures/)
    await expect(core.dispose()).rejects.toThrow(/cleanup failures/)
    expect(calls).toEqual(["viewport", "event"])
    expect(core.lifecycle.state).toBe("disposed")
  })

  it("discards undelivered events from a batch when a listener throws", async () => {
    const { api } = createApi()
    const revisions: number[] = []
    api.events.on("columns:changed", event => revisions.push(event.snapshot.revision))
    const off = api.events.on("rows:changed", () => { throw new Error("listener") })
    expect(() => api.rows.batch(() => {
      api.columns.setWidth("v", 111)
      api.rows.patch([{ rowId: "0", data: { v: 9 } }])
    })).toThrow("listener")
    off()
    api.columns.setWidth("v", 222)
    api.rows.batch(() => undefined)
    expect(revisions).toHaveLength(1)
    await api.dispose()
  })

  it("preserves structured restore failures when the end notification also throws", async () => {
    const { api, columnModel } = createApi()
    const state = api.state.get()
    state.columns.widths.v = 222
    const setWidth = columnModel.setColumnWidth.bind(columnModel)
    columnModel.setColumnWidth = () => { throw new Error("width-failure") }
    const off = api.events.on("state:import:end", () => { throw new Error("end-listener") })
    let failure: (Error & { report?: unknown; notificationError?: unknown }) | null = null
    try { api.state.set(state, { atomic: true }) } catch (error) { failure = error as typeof failure }
    expect(failure?.message).toContain("rollback failed")
    expect(failure?.report).toBeDefined()
    expect((failure?.notificationError as Error)?.message).toBe("end-listener")
    off()
    columnModel.setColumnWidth = setWidth
    expect(api.state.set(state).status).toBe("applied")
    await api.dispose()
  })
})
