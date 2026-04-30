import { defineComponent, h, nextTick, ref } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import {
  createClientRowModel,
  createDataSourceBackedRowModel,
  type DataGridDataSource,
  type DataGridRowNodeInput,
} from "@affino/datagrid-core"
import {
  createDataGridWorkerOwnedRowModel,
  createDataGridWorkerOwnedRowModelHost,
  type DataGridWorkerMessageEvent,
} from "@affino/datagrid-worker"
import { useDataGridRuntime } from "../useDataGridRuntime"

interface RuntimeRow {
  rowId: string
  name: string
  tested_at?: number
}

const COLUMNS = [{ key: "name", label: "Name" }] as const

async function flushRuntimeTasks() {
  await nextTick()
  await Promise.resolve()
}

type MessageListener = (event: DataGridWorkerMessageEvent) => void

class MemoryMessageEndpoint {
  private readonly listeners = new Set<MessageListener>()
  private peer: MemoryMessageEndpoint | null = null

  connect(peer: MemoryMessageEndpoint): void {
    this.peer = peer
  }

  postMessage(message: unknown): void {
    const peer = this.peer
    if (!peer) {
      return
    }
    queueMicrotask(() => {
      peer.emit(message)
    })
  }

  addEventListener(_type: "message", listener: MessageListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: "message", listener: MessageListener): void {
    this.listeners.delete(listener)
  }

  private emit(message: unknown): void {
    for (const listener of this.listeners) {
      listener({ data: message })
    }
  }
}

function createMessageChannelPair(): { main: MemoryMessageEndpoint; worker: MemoryMessageEndpoint } {
  const main = new MemoryMessageEndpoint()
  const worker = new MemoryMessageEndpoint()
  main.connect(worker)
  worker.connect(main)
  return { main, worker }
}

describe("useDataGridRuntime contract", () => {
  it("auto-starts lifecycle, syncs rows and disposes on unmount", async () => {
    const rows = ref<RuntimeRow[]>([
      { rowId: "r1", name: "Alpha", tested_at: 100 },
      { rowId: "r2", name: "Bravo", tested_at: 200 },
    ])
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeContractHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rows,
          columns: COLUMNS,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect(runtime!.api.lifecycle.state).toBe("started")
    expect(runtime!.api.rows.getCount()).toBe(2)
    expect(runtime!.virtualWindow.value?.rowTotal).toBe(2)
    expect(runtime!.virtualWindow.value?.colTotal).toBe(1)
    expect(runtime!.getProjectionMode()).toBe("excel-like")
    expect(runtime!.getSchema().columns.map(column => column.key)).toEqual(["name"])
    expect(runtime!.getApiCapabilities().patch).toBe(true)
    expect(runtime!.getRuntimeInfo().rowModelKind).toBe("client")
    const unifiedState = runtime!.getUnifiedState()
    const migratedState = runtime!.migrateUnifiedState(unifiedState, { strict: true })
    expect(migratedState).toEqual(unifiedState)
    if (migratedState) {
      runtime!.setUnifiedState(migratedState)
    }

    const pluginEvents: string[] = []
    expect(runtime!.registerPlugin({
      id: "runtime-contract-plugin",
      onEvent(event) {
        pluginEvents.push(String(event))
      },
    })).toBe(true)
    expect(runtime!.hasPlugin("runtime-contract-plugin")).toBe(true)
    expect(runtime!.listPlugins()).toContain("runtime-contract-plugin")

    runtime!.api.rows.setSortModel([{ key: "tested_at", direction: "desc" }])
    await flushRuntimeTasks()
    expect(pluginEvents.some(event => event === "rows:changed")).toBe(true)
    expect(runtime!.unregisterPlugin("runtime-contract-plugin")).toBe(true)
    expect(runtime!.hasPlugin("runtime-contract-plugin")).toBe(false)

    runtime!.setProjectionMode("immutable")
    expect(() => {
      runtime!.patchRows(
        [{ rowId: "r2", data: { name: "blocked" } }],
        { recomputeSort: false, recomputeFilter: false, recomputeGroup: false },
      )
    }).toThrow(/immutable/)
    runtime!.setProjectionMode("excel-like")

    rows.value = [
      { rowId: "r1", name: "Alpha", tested_at: 100 },
      { rowId: "r2", name: "Bravo", tested_at: 200 },
      { rowId: "r3", name: "Charlie", tested_at: 300 },
    ]
    await flushRuntimeTasks()

    expect(runtime!.api.rows.getCount()).toBe(3)
    expect(runtime!.virtualWindow.value?.rowTotal).toBe(3)

    runtime!.setAggregationModel({ columns: [{ key: "name", op: "count" }] })
    expect(runtime!.getAggregationModel()).toEqual({
      columns: [{ key: "name", op: "count" }],
    })
    runtime!.setPivotModel({
      rows: ["name"],
      columns: ["tested_at"],
      values: [{ field: "tested_at", agg: "count" }],
    })
    await flushRuntimeTasks()
    expect(runtime!.getPivotModel()).toEqual({
      rows: ["name"],
      columns: ["tested_at"],
      values: [{ field: "tested_at", agg: "count" }],
    })
    expect(runtime!.columnSnapshot.value.columns.some(column => column.key.startsWith("pivot|"))).toBe(true)

    const exportedPivotLayout = runtime!.exportPivotLayout()
    expect(exportedPivotLayout.pivotModel).toEqual({
      rows: ["name"],
      columns: ["tested_at"],
      values: [{ field: "tested_at", agg: "count" }],
    })
    const exportedPivotInterop = runtime!.exportPivotInterop()
    expect(exportedPivotInterop).not.toBeNull()
    expect(exportedPivotInterop?.layout.pivotModel).toEqual(exportedPivotLayout.pivotModel)
    expect(Array.isArray(exportedPivotInterop?.rows)).toBe(true)
    const pivotSnapshot = runtime!.api.rows.getSnapshot()
    const firstPivotColumn = pivotSnapshot.pivotColumns?.[0]
    const firstPivotRow = runtime!.api.rows.getRange({ start: 0, end: 10 }).find(row => row.kind === "leaf")
    if (firstPivotColumn && firstPivotRow) {
      const drilldown = runtime!.getPivotCellDrilldown({
        rowId: firstPivotRow.rowId,
        columnId: firstPivotColumn.id,
        limit: 50,
      })
      expect(drilldown).not.toBeNull()
      expect(drilldown?.rows.length).toBeGreaterThan(0)
    }

    runtime!.setPivotModel(null)
    await flushRuntimeTasks()
    expect(runtime!.columnSnapshot.value.columns.some(column => column.key.startsWith("pivot|"))).toBe(false)
    runtime!.importPivotLayout(exportedPivotLayout)
    await flushRuntimeTasks()
    expect(runtime!.columnSnapshot.value.columns.some(column => column.key.startsWith("pivot|"))).toBe(true)

    // Return to source-row projection before row patch/sort assertions.
    runtime!.setPivotModel(null)
    await flushRuntimeTasks()
    expect(runtime!.columnSnapshot.value.columns.some(column => column.key.startsWith("pivot|"))).toBe(false)

    runtime!.patchRows(
      [{ rowId: "r2", data: { name: "Bravo-updated" } }],
      { recomputeSort: false, recomputeFilter: false, recomputeGroup: false },
    )
    const patched = runtime!.api.rows.getRange({ start: 0, end: 2 })
    expect((patched[1]?.row as { name?: string })?.name).toBe("Bravo-updated")

    runtime!.api.rows.setSortModel([{ key: "tested_at", direction: "desc" }])
    expect(runtime!.api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])

    expect(runtime!.autoReapply.value).toBe(false)
    runtime!.applyEdits([{ rowId: "r1", data: { tested_at: 999 } }])
    expect(runtime!.api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])

    runtime!.autoReapply.value = true
    runtime!.applyEdits([{ rowId: "r2", data: { tested_at: 1 } }])
    expect(runtime!.api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r1", "r3", "r2"])

    runtime!.applyEdits(
      [{ rowId: "r3", data: { tested_at: 5000 } }],
      { freezeView: true, reapplyView: true },
    )
    expect(runtime!.api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r1", "r2"])

    const inRange = runtime!.syncRowsInRange({ start: 1, end: 2 })
    expect(inRange).toHaveLength(2)
    expect(String(inRange[0]?.rowId)).toBe("r1")
    expect(String(inRange[1]?.rowId)).toBe("r2")
    expect(runtime!.virtualWindow.value?.rowStart).toBe(1)
    expect(runtime!.virtualWindow.value?.rowEnd).toBe(2)

    wrapper.unmount()
    await flushRuntimeTasks()
    expect(runtime!.api.lifecycle.state).toBe("disposed")
  })

  it("supports manual start mode when autoStart=false", async () => {
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeManualStartHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rows: [{ rowId: "r1", name: "Alpha" }],
          columns: COLUMNS,
          autoStart: false,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect(runtime!.api.lifecycle.state).toBe("idle")
    expect(runtime!.virtualWindow.value?.rowTotal).toBe(1)

    await runtime!.start()
    expect(runtime!.api.lifecycle.state).toBe("started")
    expect(runtime!.api.rows.getCount()).toBe(1)

    runtime!.stop()
    await flushRuntimeTasks()
    expect(runtime!.api.lifecycle.state).toBe("disposed")

    wrapper.unmount()
  })

  it("no-ops viewport-facing body sync after dispose", async () => {
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeDisposedViewportHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rows: [{ rowId: "r1", name: "Alpha" }],
          columns: COLUMNS,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    wrapper.unmount()
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect(runtime!.api.lifecycle.state).toBe("disposed")
    expect(runtime!.syncBodyRowsInRange({ start: 0, end: 0 })).toEqual([])
    expect(runtime!.getBodyRowAtIndex(0)).toBeNull()
    expect(runtime!.resolveBodyRowIndexById("r1")).toBe(-1)
    expect(() => {
      runtime!.setViewportRange({ start: 0, end: 0 })
    }).not.toThrow()
    expect(() => {
      runtime!.setVirtualWindowRange({ start: 0, end: 0 })
    }).not.toThrow()
  })

  it("partitions interleaved pinned-bottom rows before viewport sync", async () => {
    const rows: DataGridRowNodeInput<RuntimeRow>[] = [
      { row: { rowId: "r1", name: "Alpha" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
      {
        row: { rowId: "r2", name: "Pinned total A" },
        rowId: "r2",
        originalIndex: 1,
        displayIndex: 1,
        state: { pinned: "bottom" },
      },
      { row: { rowId: "r3", name: "Bravo" }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      { row: { rowId: "r4", name: "Charlie" }, rowId: "r4", originalIndex: 3, displayIndex: 3 },
      {
        row: { rowId: "r5", name: "Pinned total B" },
        rowId: "r5",
        originalIndex: 4,
        displayIndex: 4,
        state: { pinned: "bottom" },
      },
      { row: { rowId: "r6", name: "Delta" }, rowId: "r6", originalIndex: 5, displayIndex: 5 },
    ]
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimePinnedBottomPartitionHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rowModel: createClientRowModel<RuntimeRow>({ rows }),
          columns: COLUMNS,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect(runtime!.rowPartition.value.bodyRowCount).toBe(4)
    expect(runtime!.virtualWindow.value?.rowTotal).toBe(4)
    expect(runtime!.rowPartition.value.pinnedBottomRows.map(row => String(row.rowId))).toEqual(["r2", "r5"])
    expect(runtime!.syncBodyRowsInRange({ start: 1, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r4"])
    expect(runtime!.getViewportRange()).toEqual({ start: 1, end: 2 })
    expect(runtime!.virtualWindow.value?.rowStart).toBe(1)
    expect(runtime!.virtualWindow.value?.rowEnd).toBe(2)
    expect(runtime!.syncBodyRowsInRange({ start: 0, end: 3 }).map(row => String(row.rowId))).toEqual([
      "r1",
      "r3",
      "r4",
      "r6",
    ])
    expect(runtime!.virtualWindow.value?.rowStart).toBe(0)
    expect(runtime!.virtualWindow.value?.rowEnd).toBe(3)

    wrapper.unmount()
    await flushRuntimeTasks()
  })

  it("forwards clientRowModelOptions to runtime-created client row model", async () => {
    const dispatchedKinds: string[] = []
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeClientModelOptionsHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rows: [
            { rowId: "r1", name: "Alpha", tested_at: 100 },
            { rowId: "r2", name: "Bravo", tested_at: 200 },
          ],
          columns: COLUMNS,
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
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    runtime!.api.rows.setSortModel([{ key: "name", direction: "asc" }])
    await flushRuntimeTasks()

    const diagnostics = (
      runtime!.rowModel as {
        getComputeDiagnostics?: () => { configuredMode?: string; dispatchCount?: number }
      }
    ).getComputeDiagnostics?.()

    expect(diagnostics?.configuredMode).toBe("worker")
    expect((diagnostics?.dispatchCount ?? 0) > 0).toBe(true)
    expect(dispatchedKinds.length).toBeGreaterThan(0)

    wrapper.unmount()
    await flushRuntimeTasks()
  })

  it("prefills client body-row cache so body-relative reads avoid per-row api.get calls", async () => {
    const rows: readonly DataGridRowNodeInput<RuntimeRow>[] = [
      { row: { rowId: "r1", name: "Alpha" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
      {
        row: { rowId: "r2", name: "Pinned total" },
        rowId: "r2",
        originalIndex: 1,
        displayIndex: 1,
        state: { pinned: "bottom" },
      },
      { row: { rowId: "r3", name: "Bravo" }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      { row: { rowId: "r4", name: "Charlie" }, rowId: "r4", originalIndex: 3, displayIndex: 3 },
    ]
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeBodyRowCacheHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rowModel: createClientRowModel<RuntimeRow>({ rows }),
          columns: COLUMNS,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()

    const getSpy = vi.spyOn(runtime!.api.rows, "get")

    expect(String(runtime!.getBodyRowAtIndex(0)?.rowId)).toBe("r1")
    expect(runtime!.syncBodyRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual([
      "r1",
      "r3",
      "r4",
    ])
    expect(getSpy).not.toHaveBeenCalled()

    wrapper.unmount()
    await flushRuntimeTasks()
  })

  it("treats data-source row models as sparse without worker diagnostics", async () => {
    const source: DataGridDataSource<RuntimeRow> = {
      async pull(request) {
        const rows: RuntimeRow[] = []
        for (let index = request.range.start; index <= request.range.end; index += 1) {
          rows.push({ rowId: `r${index}`, name: `Row ${index}`, tested_at: index })
        }
        return {
          total: 100,
          rows: rows.map((row, offset) => ({
            index: request.range.start + offset,
            row,
            rowId: row.rowId,
          })),
        }
      },
    }
    const rowModel = createDataSourceBackedRowModel<RuntimeRow>({
      dataSource: source,
      initialTotal: 100,
    })
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeDataSourceSparseHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rowModel,
          columns: COLUMNS,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect("getWorkerProtocolDiagnostics" in rowModel).toBe(false)
    expect(runtime!.rowPartition.value.bodyRowCount).toBe(100)
    expect(runtime!.virtualWindow.value?.rowTotal).toBe(100)
    expect(rowModel.getSparseRowModelDiagnostics()).toMatchObject({
      kind: "data-source",
      rowCount: 100,
    })

    wrapper.unmount()
    await flushRuntimeTasks()
    rowModel.dispose()
  })

  it("routes sparse virtual-window updates through the row model viewport", async () => {
    const pull = vi.fn(async (request) => ({
      total: 300,
      rows: Array.from(
        { length: Math.max(0, request.range.end - request.range.start + 1) },
        (_unused, offset) => {
          const index = request.range.start + offset
          return {
            index,
            row: { rowId: `r${index}`, name: `Row ${index}`, tested_at: index },
            rowId: `r${index}`,
          }
        },
      ),
    })) satisfies DataGridDataSource<RuntimeRow>["pull"]
    const rowModel = createDataSourceBackedRowModel<RuntimeRow>({
      dataSource: { pull },
      initialTotal: 300,
    })
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeSparseVirtualWindowHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rowModel,
          columns: COLUMNS,
          autoStart: false,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    runtime!.setVirtualWindowRange({ start: 128, end: 255 })
    await flushRuntimeTasks()

    expect(pull).toHaveBeenCalledTimes(1)
    expect(pull.mock.calls[0]?.[0]).toMatchObject({
      reason: "viewport-change",
      range: { start: 128, end: 255 },
    })

    wrapper.unmount()
    await flushRuntimeTasks()
    rowModel.dispose()
  })

  it("passes plugin definitions from composable options into runtime api", async () => {
    const pluginEvents: string[] = []
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimePluginsHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rows: [{ rowId: "r1", name: "Alpha", tested_at: 100 }],
          columns: COLUMNS,
          plugins: [
            {
              id: "seed-plugin",
              onEvent(event) {
                pluginEvents.push(String(event))
              },
            },
          ],
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect(runtime!.listPlugins()).toContain("seed-plugin")
    runtime!.api.rows.setFilterModel({
      columnFilters: { name: { kind: "valueSet", tokens: ["string:alpha"] } },
      advancedFilters: {},
    })
    await flushRuntimeTasks()
    expect(pluginEvents.some(event => event === "rows:changed")).toBe(true)

    wrapper.unmount()
    await flushRuntimeTasks()
  })

  it("supports worker-owned row model mode through composable options", async () => {
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<RuntimeRow>({
      source: channel.worker,
      target: channel.worker,
      rows: [
        { row: { rowId: "r1", name: "Alpha", tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { rowId: "r2", name: "Bravo", tested_at: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null
    const Host = defineComponent({
      name: "RuntimeWorkerOwnedModeHost",
      setup() {
        const rowModel = createDataGridWorkerOwnedRowModel<RuntimeRow>({
          source: channel.main,
          target: channel.main,
        })
        runtime = useDataGridRuntime<RuntimeRow>({
          columns: COLUMNS,
          rowModel,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect(runtime!.rowPartition.value.bodyRowCount).toBe(2)
    expect(runtime!.syncBodyRowsInRange({ start: 0, end: 1 }).map(row => String(row.rowId))).toEqual(["r1", "r2"])
    expect(String(runtime!.getBodyRowAtIndex(0)?.rowId)).toBe("r1")
    expect(runtime!.api.rows.getCount()).toBe(2)
    expect(runtime!.api.rows.getRange({ start: 0, end: 1 }).map(row => String(row.rowId))).toEqual(["r1", "r2"])
    expect(runtime!.api.rows.hasFormulaSupport()).toBe(true)

    runtime!.api.rows.registerFormulaField({
      name: "double_tested_at",
      formula: "tested_at * 2",
    })
    await flushRuntimeTasks()
    expect(runtime!.api.rows.getFormulaFields().map(field => field.name)).toEqual(["double_tested_at"])
    expect((runtime!.api.rows.get(0)?.row as { double_tested_at?: number }).double_tested_at).toBe(200)

    wrapper.unmount()
    await flushRuntimeTasks()
    host.dispose()
  })
})
