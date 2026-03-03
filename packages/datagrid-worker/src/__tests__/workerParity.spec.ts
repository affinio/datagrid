import { describe, expect, it } from "vitest"
import {
  createClientRowModel,
  type ClientRowModel,
  type DataGridRowNodeInput,
} from "@affino/datagrid-core"
import {
  createDataGridWorkerMessageHost,
  createDataGridWorkerPostMessageTransport,
  type DataGridWorkerMessageEvent,
} from "../index"

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

interface BenchRow {
  id: number
  region: string
  team: string
  year: number
  revenue: number
}

function buildRows(count: number): DataGridRowNodeInput<BenchRow>[] {
  const regions = ["AMER", "EMEA", "APAC"] as const
  const teams = ["core", "growth", "platform", "payments"] as const
  return Array.from({ length: count }, (_, index) => {
    const row: BenchRow = {
      id: index + 1,
      region: regions[index % regions.length]!,
      team: teams[index % teams.length]!,
      year: 2024 + (index % 3),
      revenue: 10 + ((index * 17) % 200),
    }
    return {
      row,
      rowId: row.id,
      originalIndex: index,
      displayIndex: index,
    }
  })
}

function summarizeProjection(model: ClientRowModel<BenchRow>): Array<Record<string, unknown>> {
  const rowCount = model.getRowCount()
  if (rowCount <= 0) {
    return []
  }
  const rows = model.getRowsInRange({ start: 0, end: rowCount - 1 })
  return rows.map((row) => ({
    rowId: row.rowId,
    kind: row.kind,
    groupKey: row.groupMeta?.groupKey ?? null,
    region: (row.data as Partial<BenchRow>).region ?? null,
    team: (row.data as Partial<BenchRow>).team ?? null,
    year: (row.data as Partial<BenchRow>).year ?? null,
    revenue: (row.data as Partial<BenchRow>).revenue ?? null,
  }))
}

describe("datagrid worker parity", () => {
  it("keeps projection deterministic between sync and worker-mode transport", async () => {
    const rows = buildRows(180)
    const syncModel = createClientRowModel<BenchRow>({ rows })
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerMessageHost({
      source: channel.worker,
      target: channel.worker,
      handleRequest() {
        return { handled: true }
      },
    })
    const transport = createDataGridWorkerPostMessageTransport({
      target: channel.main,
      source: channel.main,
      dispatchStrategy: "sync-fallback",
      requestTimeoutMs: 2_000,
    })
    const workerModeModel = createClientRowModel<BenchRow>({
      rows,
      computeMode: "worker",
      computeTransport: transport,
    })

    const applyScenario = (model: ClientRowModel<BenchRow>): void => {
      model.setSortModel([{ key: "revenue", direction: "desc" }])
      model.setFilterModel({
        columnFilters: {
          region: { kind: "valueSet", tokens: ["string:AMER", "string:EMEA"] },
        },
        advancedFilters: {},
      })
      model.setGroupBy({
        fields: ["region", "team"],
        expandedByDefault: true,
      })
      model.patchRows(
        [
          { rowId: 5, data: { revenue: 999 } },
          { rowId: 7, data: { revenue: 777 } },
        ],
        {
          recomputeSort: true,
          recomputeFilter: true,
          recomputeGroup: true,
        },
      )
      model.refresh("reapply")
    }

    applyScenario(syncModel)
    applyScenario(workerModeModel)

    await Promise.resolve()
    await Promise.resolve()

    expect(summarizeProjection(workerModeModel)).toEqual(summarizeProjection(syncModel))
    const transportStats = transport.getStats()
    expect(transportStats.dispatched).toBeGreaterThan(0)
    expect(transportStats.acked).toBeGreaterThan(0)

    workerModeModel.dispose()
    syncModel.dispose()
    host.dispose()
    transport.dispose()
  })
})
