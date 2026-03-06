import { describe, expect, it } from "vitest"
import {
  createClientRowModel,
  type DataGridAggregationModel,
  type DataGridRowModelSnapshot,
  type DataGridRowNodeInput,
} from "@affino/datagrid-core"
import {
  DATAGRID_WORKER_ROW_MODEL_PAYLOAD_SCHEMA_VERSION,
  DATAGRID_WORKER_ROW_MODEL_PROTOCOL_VERSION,
  createDataGridWorkerOwnedRowModel,
  createDataGridWorkerOwnedRowModelHost,
  createDataGridWorkerRowModelUpdateMessage,
  isDataGridWorkerRowModelCommandMessage,
  type DataGridWorkerRowModelCommand,
  type DataGridWorkerMessageEvent,
} from "../index"

type MessageListener = (event: DataGridWorkerMessageEvent) => void

class MemoryMessageEndpoint {
  private readonly listeners = new Set<MessageListener>()
  private peer: MemoryMessageEndpoint | null = null
  readonly receivedMessages: unknown[] = []

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
    this.receivedMessages.push(message)
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

function countRowModelCommands(endpoint: MemoryMessageEndpoint, type: string): number {
  return endpoint.receivedMessages.filter((message) => {
    if (!isDataGridWorkerRowModelCommandMessage(message)) {
      return false
    }
    return message.payload.type === type
  }).length
}

function getRowModelCommandsByType<TType extends DataGridWorkerRowModelCommand["type"]>(
  endpoint: MemoryMessageEndpoint,
  type: TType,
): Array<Extract<DataGridWorkerRowModelCommand, { type: TType }>> {
  const commands: Array<Extract<DataGridWorkerRowModelCommand, { type: TType }>> = []
  for (const message of endpoint.receivedMessages) {
    if (!isDataGridWorkerRowModelCommandMessage(message)) {
      continue
    }
    if (message.payload.type !== type) {
      continue
    }
    commands.push(message.payload as Extract<DataGridWorkerRowModelCommand, { type: TType }>)
  }
  return commands
}

function getViewportCommandScopes(endpoint: MemoryMessageEndpoint): string[] {
  const scopes: string[] = []
  for (const message of endpoint.receivedMessages) {
    if (!isDataGridWorkerRowModelCommandMessage(message)) {
      continue
    }
    if (message.payload.type !== "set-viewport-range") {
      continue
    }
    const command = message.payload as Extract<DataGridWorkerRowModelCommand, { type: "set-viewport-range" }>
    scopes.push(command.coalesceScope ?? "user")
  }
  return scopes
}

async function flushMessages(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

interface BenchRow {
  id: number
  region: string
  revenue: number
  qty?: number
  total?: number
}

function buildRows(count: number): DataGridRowNodeInput<BenchRow>[] {
  const regions = ["AMER", "EMEA", "APAC"] as const
  return Array.from({ length: count }, (_, index) => {
    const row = {
      id: index + 1,
      region: regions[index % regions.length]!,
      revenue: 10 + ((index * 11) % 100),
    }
    return {
      row,
      rowId: row.id,
      originalIndex: index,
      displayIndex: index,
    }
  })
}

function createSnapshot(
  rowCount: number,
  range: { start: number; end: number },
): DataGridRowModelSnapshot<BenchRow> {
  return {
    kind: "client",
    rowCount,
    loading: false,
    error: null,
    viewportRange: {
      start: range.start,
      end: range.end,
    },
    pagination: {
      enabled: false,
      pageSize: 0,
      currentPage: 0,
      pageCount: 0,
      totalRowCount: rowCount,
      startIndex: 0,
      endIndex: Math.max(0, rowCount - 1),
    },
    sortModel: [],
    filterModel: null,
    groupBy: null,
    pivotModel: null,
    pivotColumns: [],
    groupExpansion: {
      expandedByDefault: false,
      toggledGroupKeys: [],
    },
  }
}

describe("worker-owned row model", () => {
  it("stamps schema version on row-model update payloads", () => {
    const message = createDataGridWorkerRowModelUpdateMessage<BenchRow>(
      1,
      {
        snapshot: createSnapshot(0, { start: 0, end: 0 }),
        aggregationModel: null,
        visibleRows: [],
        visibleRange: { start: 0, end: 0 },
      },
    )
    expect(message.payload.schemaVersion).toBe(DATAGRID_WORKER_ROW_MODEL_PAYLOAD_SCHEMA_VERSION)
  })

  it("mirrors snapshot + visible rows from worker-owned host", async () => {
    const rows = buildRows(60)
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows,
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
    })

    const expected = createClientRowModel<BenchRow>({ rows })
    await flushMessages()

    mirror.setSortModel([{ key: "revenue", direction: "desc" }])
    mirror.setFilterModel({
      columnFilters: {
        region: { kind: "valueSet", tokens: ["string:AMER", "string:EMEA"] },
      },
      advancedFilters: {},
    })
    mirror.setViewportRange({ start: 0, end: 10 })

    expected.setSortModel([{ key: "revenue", direction: "desc" }])
    expected.setFilterModel({
      columnFilters: {
        region: { kind: "valueSet", tokens: ["string:AMER", "string:EMEA"] },
      },
      advancedFilters: {},
    })
    expected.setViewportRange({ start: 0, end: 10 })
    await flushMessages()

    const mirrorSnapshot = mirror.getSnapshot()
    const expectedSnapshot = expected.getSnapshot()
    expect(mirrorSnapshot.rowCount).toBe(expectedSnapshot.rowCount)
    expect(mirrorSnapshot.viewportRange).toEqual(expectedSnapshot.viewportRange)

    const mirrorRows = mirror.getRowsInRange({ start: 0, end: 10 }).map(row => row.rowId)
    const expectedRows = expected.getRowsInRange({ start: 0, end: 10 }).map(row => row.rowId)
    expect(mirrorRows).toEqual(expectedRows)

    mirror.patchRows([{ rowId: 5, data: { revenue: 999 } }], {
      recomputeSort: true,
      recomputeFilter: true,
      recomputeGroup: true,
    })
    expected.patchRows([{ rowId: 5, data: { revenue: 999 } }], {
      recomputeSort: true,
      recomputeFilter: true,
      recomputeGroup: true,
    })
    await flushMessages()

    const mirrorRowsAfterPatch = mirror.getRowsInRange({ start: 0, end: 10 }).map(row => row.rowId)
    const expectedRowsAfterPatch = expected.getRowsInRange({ start: 0, end: 10 }).map(row => row.rowId)
    expect(mirrorRowsAfterPatch).toEqual(expectedRowsAfterPatch)

    mirror.dispose()
    host.dispose()
    expected.dispose()
  })

  it("coalesces high-frequency viewport commands before worker dispatch", async () => {
    const rows = buildRows(100)
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows,
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
    })
    await flushMessages()

    const beforeViewportCommands = countRowModelCommands(channel.worker, "set-viewport-range")
    mirror.setViewportRange({ start: 0, end: 10 })
    mirror.setViewportRange({ start: 10, end: 20 })
    mirror.setViewportRange({ start: 20, end: 30 })
    await flushMessages()

    const afterViewportCommands = countRowModelCommands(channel.worker, "set-viewport-range")
    expect(afterViewportCommands - beforeViewportCommands).toBe(1)
    expect(mirror.getSnapshot().viewportRange).toEqual({ start: 20, end: 30 })

    mirror.dispose()
    host.dispose()
  })

  it("coalesces high-frequency patch commands and merges payload/options", async () => {
    const rows = buildRows(20)
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows,
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
    })
    await flushMessages()
    mirror.setViewportRange({ start: 0, end: 1 })
    await flushMessages()

    const beforePatchCommands = countRowModelCommands(channel.worker, "patch-rows")
    mirror.patchRows(
      [{ rowId: 1, data: { revenue: 150 } }],
      { recomputeSort: true, recomputeFilter: false, recomputeGroup: false, emit: false },
    )
    mirror.patchRows(
      [
        { rowId: 1, data: { qty: 3 } },
        { rowId: 2, data: { revenue: 250 } },
      ],
      { recomputeFilter: true, recomputeGroup: true },
    )
    await flushMessages()

    const afterPatchCommands = countRowModelCommands(channel.worker, "patch-rows")
    expect(afterPatchCommands - beforePatchCommands).toBe(1)

    const patchCommands = getRowModelCommandsByType(channel.worker, "patch-rows")
    const mergedPatchCommand = patchCommands.at(-1)
    expect(mergedPatchCommand?.updates).toEqual([
      { rowId: 1, data: { revenue: 150, qty: 3 } },
      { rowId: 2, data: { revenue: 250 } },
    ])
    expect(mergedPatchCommand?.options).toEqual({
      recomputeSort: true,
      recomputeFilter: true,
      recomputeGroup: true,
    })
    expect((mirror.getRow(0)?.row as { revenue?: number })?.revenue).toBe(150)
    expect((mirror.getRow(1)?.row as { revenue?: number })?.revenue).toBe(250)
    expect((mirror.getRow(0)?.row as { qty?: number })?.qty).toBe(3)
    expect(mirror.getWorkerProtocolDiagnostics()).toMatchObject({
      commandsCoalesced: 1,
      patchCommandsCoalesced: 1,
      patchUpdatesReceived: 3,
      patchUpdatesDispatched: 2,
      patchUpdatesMergedAway: 1,
    })

    mirror.dispose()
    host.dispose()
  })

  it("flushes large patch bursts immediately", async () => {
    const rows = buildRows(2000)
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows,
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
    })
    await flushMessages()
    mirror.setViewportRange({ start: 0, end: 10 })
    await flushMessages()

    const beforePatchCommands = countRowModelCommands(channel.worker, "patch-rows")
    const updates = Array.from({ length: 1100 }, (_, index) => ({
      rowId: index + 1,
      data: { revenue: 500 + index },
    }))
    mirror.patchRows(updates, { recomputeSort: true })

    expect(mirror.getWorkerProtocolDiagnostics()).toMatchObject({
      patchUpdatesReceived: 1100,
      patchUpdatesDispatched: 1100,
      immediateFlushCount: 1,
    })
    await flushMessages()

    const afterPatchCommands = countRowModelCommands(channel.worker, "patch-rows")
    expect(afterPatchCommands - beforePatchCommands).toBe(1)

    mirror.dispose()
    host.dispose()
  })

  it("skips redundant user viewport dispatch when prefetch already covers requested range", async () => {
    const rows = buildRows(20)
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows,
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
    })

    await flushMessages()
    const beforeViewportCommands = countRowModelCommands(channel.worker, "set-viewport-range")
    mirror.setViewportRange({ start: 5, end: 12 })
    await flushMessages()
    const afterViewportCommands = countRowModelCommands(channel.worker, "set-viewport-range")

    expect(afterViewportCommands).toBe(beforeViewportCommands)
    expect(mirror.getRowsInRange({ start: 5, end: 12 }).length).toBe(8)
    expect(mirror.getSnapshot().loading).toBe(false)

    mirror.dispose()
    host.dispose()
  })

  it("supports simple viewport coalescing strategy that shares one lane", async () => {
    const rows = buildRows(20)
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows,
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
      viewportCoalescingStrategy: "simple",
    })

    await flushMessages()
    mirror.setViewportRange({ start: 5, end: 12 })
    await flushMessages()

    const scopes = getViewportCommandScopes(channel.worker)
    const uniqueScopes = new Set(scopes)
    expect(uniqueScopes.size).toBe(1)
    expect(uniqueScopes.has("user")).toBe(true)

    mirror.dispose()
    host.dispose()
  })

  it("ignores stale worker updates that arrive out of order", async () => {
    const channel = createMessageChannelPair()
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
      requestInitialSync: false,
    })

    const aggregationModel: DataGridAggregationModel<BenchRow> | null = null
    channel.worker.postMessage(createDataGridWorkerRowModelUpdateMessage<BenchRow>(
      10,
      {
        snapshot: createSnapshot(5, { start: 0, end: 0 }),
        aggregationModel,
        visibleRows: [{
          kind: "leaf",
          data: { id: 10, region: "AMER", revenue: 10 },
          row: { id: 10, region: "AMER", revenue: 10 },
          rowId: 10,
          rowKey: 10,
          sourceIndex: 0,
          originalIndex: 0,
          displayIndex: 0,
          state: { selected: false, group: false, pinned: "none", expanded: false },
        }],
        visibleRange: { start: 0, end: 0 },
      },
    ))
    channel.worker.postMessage(createDataGridWorkerRowModelUpdateMessage<BenchRow>(
      9,
      {
        snapshot: createSnapshot(1, { start: 0, end: 0 }),
        aggregationModel,
        visibleRows: [{
          kind: "leaf",
          data: { id: 9, region: "EMEA", revenue: 9 },
          row: { id: 9, region: "EMEA", revenue: 9 },
          rowId: 9,
          rowKey: 9,
          sourceIndex: 0,
          originalIndex: 0,
          displayIndex: 0,
          state: { selected: false, group: false, pinned: "none", expanded: false },
        }],
        visibleRange: { start: 0, end: 0 },
      },
    ))
    await flushMessages()

    expect(mirror.getSnapshot().rowCount).toBe(5)
    expect(mirror.getRowsInRange({ start: 0, end: 0 })[0]?.rowId).toBe(10)
    const protocolDiagnostics = mirror.getWorkerProtocolDiagnostics()
    expect(protocolDiagnostics.updatesReceived).toBe(2)
    expect(protocolDiagnostics.updatesApplied).toBe(1)
    expect(protocolDiagnostics.updatesDroppedStale).toBe(1)
    mirror.dispose()
  })

  it("tracks payload schema mismatches in worker protocol diagnostics", async () => {
    const channel = createMessageChannelPair()
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
      requestInitialSync: false,
    })

    channel.worker.postMessage(createDataGridWorkerRowModelUpdateMessage<BenchRow>(
      1,
      {
        schemaVersion: 1,
        snapshot: createSnapshot(2, { start: 0, end: 0 }),
        aggregationModel: null,
        visibleRows: [],
        visibleRange: { start: 0, end: 0 },
      },
    ))
    channel.worker.postMessage(createDataGridWorkerRowModelUpdateMessage<BenchRow>(
      2,
      {
        snapshot: createSnapshot(3, { start: 0, end: 0 }),
        aggregationModel: null,
        visibleRows: [],
        visibleRange: { start: 0, end: 0 },
      },
    ))
    await flushMessages()

    const protocolDiagnostics = mirror.getWorkerProtocolDiagnostics()
    expect(protocolDiagnostics.protocolVersion).toBe(DATAGRID_WORKER_ROW_MODEL_PROTOCOL_VERSION)
    expect(protocolDiagnostics.expectedPayloadSchemaVersion).toBe(
      DATAGRID_WORKER_ROW_MODEL_PAYLOAD_SCHEMA_VERSION,
    )
    expect(protocolDiagnostics.lastPayloadSchemaVersion).toBe(
      DATAGRID_WORKER_ROW_MODEL_PAYLOAD_SCHEMA_VERSION,
    )
    expect(protocolDiagnostics.payloadSchemaMismatches).toBe(1)
    expect(protocolDiagnostics.updatesApplied).toBe(2)

    mirror.dispose()
  })

  it("uses cached windows and exposes loading while worker viewport update is in flight", async () => {
    const rows = buildRows(100)
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows,
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
    })
    await flushMessages()

    mirror.setViewportRange({ start: 0, end: 10 })
    await flushMessages()
    const cachedFirstWindow = mirror.getRowsInRange({ start: 0, end: 10 })
    expect(cachedFirstWindow.length).toBeGreaterThan(0)

    const immediateSecondWindow = mirror.getRowsInRange({ start: 30, end: 40 })
    // Prefetch padding can provide a partial hit immediately, but not the full requested window.
    expect(immediateSecondWindow.length).toBeLessThan(11)
    expect(mirror.getSnapshot().loading).toBe(true)
    await flushMessages()
    expect(mirror.getSnapshot().loading).toBe(false)
    const secondWindowAfterUpdate = mirror.getRowsInRange({ start: 30, end: 40 })
    expect(secondWindowAfterUpdate.length).toBe(11)
    expect(secondWindowAfterUpdate.length).toBeGreaterThan(immediateSecondWindow.length)

    const firstWindowAgainImmediate = mirror.getRowsInRange({ start: 0, end: 10 })
    expect(firstWindowAgainImmediate.length).toBeLessThanOrEqual(cachedFirstWindow.length)
    expect(mirror.getSnapshot().loading).toBe(true)
    await flushMessages()
    expect(mirror.getSnapshot().loading).toBe(false)
    const firstWindowAgainAfterUpdate = mirror.getRowsInRange({ start: 0, end: 10 })
    expect(firstWindowAgainAfterUpdate.length).toBe(cachedFirstWindow.length)

    mirror.dispose()
    host.dispose()
  })

  it("clears loading when update range matches pending viewport even if request id is older", async () => {
    const channel = createMessageChannelPair()
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
      requestInitialSync: false,
    })

    mirror.setViewportRange({ start: 0, end: 5 })
    mirror.setViewportRange({ start: 10, end: 15 })
    await flushMessages()
    expect(mirror.getSnapshot().loading).toBe(true)

    channel.worker.postMessage(createDataGridWorkerRowModelUpdateMessage<BenchRow>(
      1,
      {
        snapshot: createSnapshot(30, { start: 10, end: 15 }),
        aggregationModel: null,
        visibleRows: Array.from({ length: 6 }, (_, offset) => {
          const id = 100 + offset
          return {
            kind: "leaf" as const,
            data: { id, region: "AMER", revenue: 10 + offset },
            row: { id, region: "AMER", revenue: 10 + offset },
            rowId: id,
            rowKey: id,
            sourceIndex: offset,
            originalIndex: offset,
            displayIndex: offset,
            state: { selected: false, group: false, pinned: "none", expanded: false },
          }
        }),
        visibleRange: { start: 10, end: 15 },
      },
    ))
    await flushMessages()

    expect(mirror.getSnapshot().loading).toBe(false)
    expect(mirror.getRowsInRange({ start: 10, end: 15 }).length).toBe(6)
    mirror.dispose()
  })

  it("reports worker compute diagnostics", async () => {
    const channel = createMessageChannelPair()
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
      requestInitialSync: false,
    })

    mirror.setViewportRange({ start: 0, end: 0 })
    await flushMessages()

    const diagnostics = mirror.getComputeDiagnostics()
    expect(diagnostics.configuredMode).toBe("worker")
    expect(diagnostics.effectiveMode).toBe("worker")
    expect(diagnostics.transportKind).toBe("custom")
    expect(diagnostics.dispatchCount).toBeGreaterThan(0)
    expect(diagnostics.fallbackCount).toBe(0)

    mirror.dispose()
  })

  it("supports formula registration through worker protocol and recomputes on patch", async () => {
    const rows: DataGridRowNodeInput<BenchRow>[] = [
      {
        row: { id: 1, region: "AMER", revenue: 10, qty: 2 },
        rowId: 1,
        originalIndex: 0,
        displayIndex: 0,
      },
    ]
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows,
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
    })

    await flushMessages()
    mirror.setViewportRange({ start: 0, end: 0 })
    await flushMessages()

    mirror.registerFormulaField({
      name: "total",
      formula: "revenue * qty",
    })
    await flushMessages()

    expect(mirror.getFormulaFields().map(field => field.name)).toEqual(["total"])
    expect(mirror.getFormulaExecutionPlan()).toEqual({
      order: ["total"],
      levels: [["total"]],
      nodes: [
        {
          name: "total",
          field: "total",
          level: 0,
          fieldDeps: ["revenue", "qty"],
          computedDeps: [],
          dependents: [],
        },
      ],
    })
    expect((mirror.getRow(0)?.row as { total?: number })?.total).toBe(20)

    mirror.patchRows(
      [{ rowId: 1, data: { revenue: 15 } }],
      { recomputeSort: false, recomputeFilter: false, recomputeGroup: false },
    )
    await flushMessages()

    expect((mirror.getRow(0)?.row as { total?: number })?.total).toBe(30)
    expect(mirror.getFormulaComputeStageDiagnostics()).toEqual({
      strategy: "column-cache",
      rowsTouched: 1,
      changedRows: 1,
      fieldsTouched: ["total"],
      evaluations: 1,
      skippedByObjectIs: 0,
      dirtyRows: 1,
      dirtyNodes: ["total"],
    })

    mirror.dispose()
    host.dispose()
  })

  it("rejects function-based aggregation model in worker-owned mode", async () => {
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerOwnedRowModelHost<BenchRow>({
      source: channel.worker,
      target: channel.worker,
      rows: buildRows(20),
    })
    const mirror = createDataGridWorkerOwnedRowModel<BenchRow>({
      source: channel.main,
      target: channel.main,
    })

    await flushMessages()

    const invalidModel: DataGridAggregationModel<BenchRow> = {
      columns: [{
        key: "revenue",
        op: "custom",
        createState: () => ({ total: 0 }),
        add: (state, value) => {
          const aggregateState = state as { total: number }
          aggregateState.total += Number(value ?? 0)
        },
        finalize: (state) => (state as { total: number }).total,
      }],
    }

    expect(() => mirror.setAggregationModel(invalidModel)).toThrow(
      "aggregationModel with function callbacks is not supported in worker-owned mode",
    )

    mirror.dispose()
    host.dispose()
  })
})
