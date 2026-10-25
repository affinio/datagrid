// Deterministic overload regressions plus one conditional hung-transport diagnostic.
// Run from repository root; no product sources are instrumented.
import { afterAll, afterEach, describe, expect, it, vi } from "vitest"
import { mkdirSync, writeFileSync } from "node:fs"
import { createDataGridCore } from "../../../packages/datagrid-core/src/core/gridCore"
import { createDataGridApi } from "../../../packages/datagrid-core/src/core/gridApi"
import { createDataGridColumnModel } from "../../../packages/datagrid-core/src/models/columnModel"
import { createAdvancedClientRowModel } from "../../../packages/datagrid-core/src/models/clientRowModel"
import { createDataSourceBackedRowModel } from "../../../packages/datagrid-core/src/models/dataSourceBackedRowModel"
import { useDataGridCellRefreshBatcher } from "../../../packages/datagrid-orchestration/src/runtime/useDataGridCellRefreshBatcher"
import { useDataGridVisibleRowsSyncScheduler } from "../../../packages/datagrid-orchestration/src/viewport/useDataGridVisibleRowsSyncScheduler"
import { createDataGridWorkerPostMessageTransport } from "../../../packages/datagrid-worker/src/postMessageTransport"
import { createDataGridWorkerOwnedRowModel } from "../../../packages/datagrid-worker/src/workerOwnedRowModel"
import { createDataGridWorkerOwnedRowModelHost } from "../../../packages/datagrid-worker/src/workerOwnedRowModelHost"
import { createChangeFeedPoller } from "../../../packages/datagrid-server-client/src/changeFeedPoller"
import { createRafScheduler } from "../../../packages/datagrid-core/src/runtime/rafScheduler"

type Row = { id: string; value: number }
const results: Record<string, unknown> = {}
const output = process.env.OVERLOAD_OUTPUT ?? "/tmp/affino-overload-audit"
function deferred<T = void>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
async function ticks(count = 20) { for (let i = 0; i < count; i++) await Promise.resolve() }
function localApi() {
  const rowModel = createAdvancedClientRowModel<Row>({ rows: [{ id: "r", value: 0 }], resolveRowId: r => r.id })
  const columnModel = createDataGridColumnModel({ columns: [{ key: "value" }] })
  const core = createDataGridCore({ services: { rowModel: { name: "rowModel", model: rowModel }, columnModel: { name: "columnModel", model: columnModel } } })
  return createDataGridApi({ core })
}
function frames() {
  let id = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id })
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => callbacks.delete(handle))
  const step = () => { const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(0)) }
  return { callbacks, step }
}
function messagePair() {
  const queue: Array<() => void> = []
  function endpoint() {
    const listeners = new Set<(event: { data: any }) => void>()
    return { listeners, messages: [] as any[], peer: null as any,
      postMessage(message: unknown) { const copy = structuredClone(message); queue.push(() => { for (const listener of this.peer.listeners) listener({ data: copy }); this.peer.messages.push(copy) }) },
      addEventListener(_type: string, fn: any) { listeners.add(fn) }, removeEventListener(_type: string, fn: any) { listeners.delete(fn) },
    }
  }
  const main = endpoint(), worker = endpoint(); main.peer = worker; worker.peer = main
  function pump() { let n = 0; while (queue.length) { if (++n > 100_000) throw Error("message feedback loop"); queue.shift()!() } return n }
  return { main, worker, queue, pump }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })
afterAll(() => { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/queues.json`, JSON.stringify(results, null, 2)) })

describe("overload audit — consumer-only diagnostics", () => {
  it("lifecycle: FIFO drain and recovery after rejection, 1000 accepted callbacks", async () => {
    const api = localApi(), gate = deferred(), order: number[] = []
    const first = api.lifecycle.runExclusive(() => gate.promise)
    const pending = Array.from({ length: 1000 }, (_, i) => api.lifecycle.runExclusive(() => { order.push(i); if (i === 333) throw Error("injected") }))
    const all = Promise.allSettled(pending)
    await ticks(); expect(order).toHaveLength(0); expect(api.lifecycle.isBusy()).toBe(true)
    let idle = false; const barrier = api.lifecycle.whenIdle().then(() => { idle = true })
    await ticks(); expect(idle).toBe(false)
    gate.resolve(); await first; const settled = await all; await barrier
    expect(order).toEqual(Array.from({ length: 1000 }, (_, i) => i))
    expect(settled.filter(r => r.status === "rejected")).toHaveLength(1)
    expect(api.lifecycle.isBusy()).toBe(false)
    results.lifecycleDrain = { queued: 1000, completed: order.length, rejected: 1, busyAfterDrain: false }
    await api.dispose()
  })

  it("lifecycle: rejects queued and new callbacks after terminal disposal", async () => {
    const api = localApi(), gate = deferred(); await api.start()
    const first = api.lifecycle.runExclusive(() => gate.promise)
    let effects = 0
    const queued = api.lifecycle.runExclusive(() => { effects++ })
    const queuedOutcome = queued.then(() => "fulfilled", () => "rejected")
    await ticks(); await api.dispose(); expect(api.lifecycle.state).toBe("disposed")
    gate.resolve(); await first
    expect(await queuedOutcome).toBe("rejected")
    await expect(api.lifecycle.runExclusive(() => { effects++ })).rejects.toThrow(/after disposal/i)
    expect(effects).toBe(0)
    results.lifecycleAfterDispose = { queuedEffects: effects, queuedOutcome: "rejected", newlySubmittedOutcome: "rejected", state: api.lifecycle.state }
  })

  it("optimistic: 500 FIFO writes accumulate behind a gate and drain without loss", async () => {
    const gate = deferred<any>(), calls: number[] = []
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 1, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      async pull() { return { total: 1, rows: [{ index: 0, row: { id: "r", value: 0 } }] } },
      commitEdits(request) { calls.push(request.edits[0]!.data.value!); return calls.length === 1 ? gate.promise : Promise.resolve({}) },
    } })
    await model.refresh(); model.pauseBackpressure()
    let settled = 0
    const writes = Array.from({ length: 500 }, (_, i) => Promise.resolve(model.patchRows!([{ rowId: "r", data: { value: i + 1 } }])).then(() => { settled++ }))
    await ticks(); expect(calls).toEqual([1]); expect(settled).toBe(0)
    const pending = model.getBackpressureDiagnostics()
    let flushed = false; await model.flushBackpressure().then(() => { flushed = true })
    expect(flushed).toBe(true); expect(settled).toBe(0) // documented pull-only barrier
    gate.resolve({}); await Promise.all(writes)
    expect(calls).toEqual(Array.from({ length: 500 }, (_, i) => i + 1))
    expect(model.getRow(0)?.data.value).toBe(500)
    expect(model.getSnapshot().loading).toBe(false)
    results.optimisticDrain = { accepted: 500, startedBeforeRelease: 1, pendingBeforeRelease: 500, diagnosticsBeforeRelease: pending, committed: calls.length, finalValue: model.getRow(0)?.data.value, flushDoesNotWaitWrites: true, pullPauseDoesNotPauseWrites: true }
    model.dispose()
  })

  it("optimistic: queued commits settle as cancelled and never start after dispose", async () => {
    const gate = deferred<any>(), calls: number[] = []
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 1, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      async pull() { return { total: 1, rows: [{ index: 0, row: { id: "r", value: 0 } }] } },
      commitEdits(request) { calls.push(request.edits[0]!.data.value!); return calls.length === 1 ? gate.promise : Promise.resolve({}) },
    } })
    await model.refresh()
    const writes = [1, 2, 3].map(value => Promise.resolve(model.patchRows!([{ rowId: "r", data: { value } }])).then(() => "fulfilled", () => "rejected"))
    await ticks(); expect(calls).toEqual([1]); model.dispose(); gate.resolve({});
    expect(await Promise.all(writes)).toEqual(["fulfilled", "rejected", "rejected"])
    expect(calls).toEqual([1])
    results.optimisticAfterDispose = { startedBeforeDispose: 1, startedAfterDispose: 0, outcomes: await Promise.all(writes), calls }
  })

  it("optimistic: preserves an in-flight write rejection after disposal", async () => {
    const gate = deferred<any>()
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 1, prefetch: { enabled: false }, dataSource: {
      async pull() { return { total: 1, rows: [] } }, commitEdits() { return gate.promise },
    } })
    const outcome = Promise.allSettled([model.patchRows!([{ rowId: "r", data: { value: 1 } }])])
    await ticks(); model.dispose(); gate.reject(Error("server rejected"))
    const settled = await outcome; expect(settled[0]!.status).toBe("rejected")
    results.optimisticDisposedRejection = { transportOutcome: "rejected", publicOutcome: settled[0]!.status }
  })

  it("optimistic: failure settles and releases the serial lane", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const gate = deferred<any>(); let calls = 0
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 1, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      async pull() { return { total: 1, rows: [{ index: 0, row: { id: "r", value: 0 } }] } },
      commitEdits() { return ++calls === 1 ? gate.promise : Promise.resolve({}) },
    } })
    await model.refresh()
    const all = Promise.allSettled([model.patchRows!([{ rowId: "r", data: { value: 1 } }]), model.patchRows!([{ rowId: "r", data: { value: 2 } }])])
    await ticks(); gate.reject(Error("injected")); const settled = await all
    expect(settled.map(v => v.status)).toEqual(["rejected", "fulfilled"])
    expect(model.getRow(0)?.data.value).toBe(2); expect(model.getSnapshot().loading).toBe(false)
    results.optimisticFailureDrain = { calls, finalValue: 2, outcomes: settled.map(v => v.status) }; model.dispose()
  })

  it("pull: 1000 viewport requests coalesce, stale results cannot replace the latest", async () => {
    const calls: Array<{ request: any; gate: ReturnType<typeof deferred<any>> }> = []
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 20_000, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      pull(request) { const gate = deferred<any>(); calls.push({ request, gate }); return gate.promise },
    } })
    for (let i = 0; i < 1000; i++) model.setViewportRange({ start: i * 10, end: i * 10 + 9 })
    await ticks(); expect(calls).toHaveLength(2); expect(calls[0]!.request.signal.aborted).toBe(true)
    let drained = false; const drain = model.flushBackpressure().then(() => { drained = true })
    await ticks(); expect(drained).toBe(false)
    calls[1]!.gate.resolve({ rows: [{ index: 9990, row: { id: "latest", value: 999 } }], total: 20_000 })
    await drain
    calls[0]!.gate.resolve({ rows: [{ index: 9990, row: { id: "stale", value: -1 } }], total: 20_000 })
    await ticks(); expect(model.getRow(9990)?.data.id).toBe("latest")
    results.viewportBurst = { produced: 1000, transportCalls: calls.length, diagnostics: model.getBackpressureDiagnostics(), latestValue: model.getRow(9990)?.data.value }
    model.dispose()
  })

  it("pull: paused 1000 requests retain latest intent; flush temporarily resumes and restores pause", async () => {
    const calls: any[] = []
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 20_000, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      async pull(request) { calls.push(request.range); return { total: 20_000, rows: [] } },
    } })
    model.pauseBackpressure()
    for (let i = 0; i < 1000; i++) model.setViewportRange({ start: i * 10, end: i * 10 + 9 })
    await ticks(); expect(calls).toHaveLength(0); await model.flushBackpressure()
    expect(calls).toEqual([{ start: 9990, end: 9999 }]); expect(model.getBackpressureDiagnostics().paused).toBe(true)
    const afterFlush = model.getBackpressureDiagnostics(); expect(model.resumeBackpressure()).toBe(true); expect(model.getBackpressureDiagnostics().paused).toBe(false)
    results.pausedPulls = { produced: 1000, transportCalls: calls.length, pausedAfterFlush: true, pausedAfterResume: false, diagnostics: afterFlush }; model.dispose()
  })

  it("DIAGNOSTIC: uncooperative hung pull keeps an already waiting flush pending after dispose", async () => {
    const gate = deferred<any>()
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 1, prefetch: { enabled: false }, dataSource: { pull: () => gate.promise } })
    const pull = model.refresh(); let settled = false
    const flush = model.flushBackpressure().then(() => { settled = true })
    await ticks(); model.dispose(); await ticks(100)
    expect(settled).toBe(false)
    results.hungPullDispose = { flushSettledAfterDispose: settled, diagnostics: model.getBackpressureDiagnostics(), contractCondition: "transport ignores abort" }
    gate.resolve({ rows: [], total: 0 }); await Promise.all([pull, flush])
  })

  it("pull: query supersession keeps freshness but cannot physically bound an abort-ignoring transport", async () => {
    const gates: Array<ReturnType<typeof deferred<any>>> = [], signals: AbortSignal[] = []
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 1, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      pull(request) { const gate = deferred<any>(); gates.push(gate); signals.push(request.signal); return gate.promise },
    } })
    for (let i = 0; i < 100; i++) model.setSortModel([{ key: `c${i}`, direction: "asc" }])
    await ticks(); expect(gates).toHaveLength(100); expect(signals.filter(s => s.aborted)).toHaveLength(99)
    gates.at(-1)!.resolve({ total: 1, rows: [{ index: 0, row: { id: "r", value: 99 } }] }); await model.flushBackpressure()
    for (const gate of gates.slice(0, -1)) gate.resolve({ total: 1, rows: [{ index: 0, row: { id: "r", value: -1 } }] })
    await ticks(); expect(model.getRow(0)?.data.value).toBe(99)
    results.uncooperativePulls = { produced: 100, unresolvedPhysicalRequestsAtPeak: 100, aborted: 99, logicalActiveLanes: 1, finalValue: 99 }; model.dispose()
  })

  it("refresh: duplicate cells coalesce and finite workload drains across budgeted frames", () => {
    const clock = frames(), delivered: string[] = []
    const batcher = useDataGridCellRefreshBatcher({ refreshCellsByRanges(ranges) { delivered.push(...ranges.map(r => String(r.rowKey))) } }, { maxBatchSize: 10 })
    for (let i = 0; i < 1000; i++) batcher.queueByRanges([{ rowKey: `r${i % 100}`, columnKeys: ["value"] }])
    expect(clock.callbacks.size).toBe(1); let used = 0
    while (clock.callbacks.size && used < 20) { clock.step(); used++ }
    expect(delivered).toHaveLength(100); expect(new Set(delivered).size).toBe(100); expect(used).toBe(10)
    results.refreshCoalescing = { requests: 1000, uniqueCells: 100, frames: used, delivered: delivered.length }; batcher.dispose()
  })

  it("refresh: manual flush cancels its scheduled frame", () => {
    const clock = frames(); let deliveries = 0
    const batcher = useDataGridCellRefreshBatcher({ refreshCellsByRanges() { deliveries++ } })
    for (let i = 0; i < 1000; i++) { batcher.queueByRanges([{ rowKey: "r", columnKeys: ["value"] }]); batcher.flush() }
    expect(clock.callbacks.size).toBe(0); batcher.dispose(); expect(clock.callbacks.size).toBe(0)
    results.refreshOrphanFrames = { cycles: 1000, callbacksAfterFlush: clock.callbacks.size, callbacksAfterDispose: clock.callbacks.size, deliveries }
  })

  it("refresh: failed chunk does not strand later rows", () => {
    const clock = frames(), delivered: string[] = []; let fail = true
    const batcher = useDataGridCellRefreshBatcher({ refreshCellsByRanges(ranges) { if (fail) { fail = false; throw Error("injected") }; delivered.push(...ranges.map(r => String(r.rowKey))) } }, { maxBatchSize: 1 })
    batcher.queueByRanges(["a", "b", "c"].map(rowKey => ({ rowKey, columnKeys: ["value"] })))
    expect(() => clock.step()).toThrow("injected"); expect(clock.callbacks.size).toBe(1); expect(delivered).toHaveLength(0)
    while (clock.callbacks.size) clock.step()
    expect(delivered).toEqual(["b", "c"])
    results.refreshFailure = { scheduledAfterFailure: true, failedBatchDiscarded: ["a"], remainingDrained: delivered }; batcher.dispose()
  })

  it("visible rows: 1000 invalidations use one frame and read current input, disposal cancels pending frame", () => {
    const clock = frames(); let value = 0; const outputs: number[] = []
    const scheduler = useDataGridVisibleRowsSyncScheduler({ resolveRows: () => [value], resolveRange: () => ({ start: 0, end: 0 }), setRows: () => {}, syncRowsInRange: () => [value], applyVisibleRows: rows => outputs.push(rows[0]!) })
    for (let i = 0; i < 1000; i++) { value = i; scheduler.scheduleVisibleRowsSync() }
    expect(clock.callbacks.size).toBe(1); clock.step(); expect(outputs).toEqual([999])
    scheduler.scheduleVisibleRowsSync(); scheduler.dispose(); expect(clock.callbacks.size).toBe(0)
    results.visibleRows = { requests: 1000, frames: 1, finalValue: outputs[0], callbacksAfterDispose: 0 }
  })

  it("compute messaging: 1000 unacknowledged dispatches cap at 32 and use fallback; timeout releases capacity", async () => {
    vi.useFakeTimers(); let posts = 0
    const transport = createDataGridWorkerPostMessageTransport({ target: { postMessage() { posts++ } }, requestTimeoutMs: 100, dispatchStrategy: "fire-and-forget" })
    const accepted = Array.from({ length: 1000 }, () => transport.dispatch({ kind: "refresh" }).handled)
    expect(posts).toBe(32); expect(accepted.filter(Boolean)).toHaveLength(32)
    await vi.advanceTimersByTimeAsync(100); expect(transport.getStats().inflight).toBe(0)
    results.computeCap = { produced: 1000, sent: posts, fallbackRequired: 968, statsAfterTimeout: transport.getStats() }; transport.dispose()
  })

  it("compute messaging: ACK timeout bounds bookkeeping, not physical undrained transport messages", async () => {
    vi.useFakeTimers(); let posts = 0
    const transport = createDataGridWorkerPostMessageTransport({ target: { postMessage() { posts++ } }, requestTimeoutMs: 100 })
    const backlog: number[] = []
    for (let round = 0; round < 10; round++) { for (let i = 0; i < 32; i++) transport.dispatch({ kind: "refresh" }); await vi.advanceTimersByTimeAsync(100); backlog.push(posts) }
    expect(posts).toBe(320); expect(transport.getStats().inflight).toBe(0)
    results.computePhysicalBacklog = { controlledDurationMs: 1000, backlogEvery100Ms: backlog, metadataInflight: 0, timedOut: transport.getStats().timedOut }; transport.dispose()
  })

  it("compute transport: rejects work after disposal", () => {
    vi.useFakeTimers(); let posts = 0
    const transport = createDataGridWorkerPostMessageTransport({ target: { postMessage() { posts++ } } })
    transport.dispose(); expect(() => transport.dispatch({ kind: "refresh" })).toThrow(/disposed/i); expect(posts).toBe(0); expect(vi.getTimerCount()).toBe(0)
    results.computeAfterDispose = { posts, timers: vi.getTimerCount(), stats: transport.getStats() }
  })

  it("worker coalescing preserves patch / replacement / patch order", async () => {
    const pair = messagePair()
    const host = createDataGridWorkerOwnedRowModelHost<Row>({ source: pair.worker, target: pair.worker, rows: [{ id: "r", value: 0 }], resolveRowId: r => r.id })
    const model = createDataGridWorkerOwnedRowModel<Row>({ source: pair.main, target: pair.main })
    await ticks(); pair.pump(); await ticks(); pair.pump()
    model.patchRows([{ rowId: "r", data: { value: 1 } }]); model.setRows([{ id: "r", value: 10 }]); model.patchRows([{ rowId: "r", data: { value: 2 } }])
    await ticks(); pair.pump(); const mirrorFinal = model.getRow(0)?.data.value
    expect(mirrorFinal).toBe(2)
    results.workerOrdering = { operations: ["patch(1)", "setRows(10)", "patch(2)"], expected: 2, mirrorFinal, diagnostics: model.getWorkerProtocolDiagnostics(), messages: pair.worker.messages.filter(m => m.payload?.type).map(m => ({ id: m.requestId, type: m.payload.type })) }
    model.dispose(); host.dispose()
  })

  it("worker commands preserve adjacent independent formula registrations", async () => {
    const pair = messagePair()
    const host = createDataGridWorkerOwnedRowModelHost<Row>({ source: pair.worker, target: pair.worker, rows: [{ id: "r", value: 2 }], resolveRowId: r => r.id })
    const model = createDataGridWorkerOwnedRowModel<Row>({ source: pair.main, target: pair.main })
    await ticks(); pair.pump(); await ticks(); pair.pump()
    model.registerFormulaField({ name: "a", field: "a", formula: "[value] * 2" }); model.registerFormulaField({ name: "b", field: "b", formula: "[value] * 3" })
    await ticks(); pair.pump()
    expect(model.getFormulaFields().map(f => f.name)).toEqual(["a", "b"])
    results.workerFormulaRegistration = { accepted: ["a", "b"], registered: model.getFormulaFields().map(f => f.name) }; model.dispose(); host.dispose()
  })

  it("worker commands: local cap flushes into an uncapped slow-transport mailbox; finite backlog drains", async () => {
    const pair = messagePair()
    const host = createDataGridWorkerOwnedRowModelHost<Row>({ source: pair.worker, target: pair.worker, rows: [{ id: "r", value: 0 }], resolveRowId: r => r.id })
    const model = createDataGridWorkerOwnedRowModel<Row>({ source: pair.main, target: pair.main })
    await ticks(); pair.pump(); await ticks(); pair.pump()
    const points: number[] = []
    for (let i = 0; i < 1000; i++) { model.patchRows([{ rowId: "r", data: { value: i + 1 } }]); await ticks(2); if ((i + 1) % 250 === 0) points.push(pair.queue.length) }
    expect(pair.queue.length).toBe(1000); pair.pump(); expect(model.getRow(0)?.data.value).toBe(1000)
    results.workerMailbox = { produced: 1000, backlogEvery250: points, localQueuePeak: model.getWorkerProtocolDiagnostics().queuePeak, finalValue: 1000 }
    model.dispose(); host.dispose()
  })

  it("optimistic: controlled sustained overload grows backlog and age, then drains after producer stops", async () => {
    let time = 0, completed = 0
    const calls: Array<{ value: number; gate: ReturnType<typeof deferred<any>> }> = []
    const acceptedAt = new Map<number, number>(), ages: number[] = []
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 1, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      async pull() { return { total: 1, rows: [{ index: 0, row: { id: "r", value: 0 } }] } },
      commitEdits(request) { const value = request.edits[0]!.data.value!; ages.push(time - acceptedAt.get(value)!); const gate = deferred<any>(); calls.push({ value, gate }); return gate.promise },
    } })
    await model.refresh(); const writes: Array<Promise<any>> = [], backlog: number[] = []
    for (let round = 0; round < 20; round++) {
      for (let i = 0; i < 10; i++) { const value = round * 10 + i + 1; acceptedAt.set(value, time); writes.push(Promise.resolve(model.patchRows!([{ rowId: "r", data: { value } }])).then(() => completed++)) }
      await ticks(); time += 20; calls[round]!.gate.resolve({}); await ticks(); backlog.push(writes.length - completed)
    }
    const pendingAtStop = writes.length - completed
    while (completed < writes.length) { time += 20; calls[completed]!.gate.resolve({}); await ticks() }
    await Promise.all(writes); expect(completed).toBe(200); expect(model.getRow(0)?.data.value).toBe(200)
    results.optimisticSustained = { virtualProducerDurationMs: 400, produced: 200, pendingAtStop, backlog, maxStartAgeMs: Math.max(...ages), virtualDrainDurationMs: time - 400, busyAfterDrain: model.getSnapshot().loading }; model.dispose()
  })

  it("streaming: synchronous push burst applies all updates, pause affects pulls, disposal ignores late pushes", async () => {
    let push!: (event: any) => void, events = 0, unsubscribed = 0
    const model = createDataSourceBackedRowModel<Row>({ initialTotal: 1, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      async pull() { return { total: 1, rows: [{ index: 0, row: { id: "r", value: 0 } }] } },
      subscribe(listener) { push = listener; return () => { unsubscribed++ } },
    } })
    await model.refresh(); model.pauseBackpressure(); const unsubscribe = model.subscribe(() => events++)
    for (let i = 1; i <= 1000; i++) push({ type: "upsert", rows: [{ index: 0, row: { id: "r", value: i } }] })
    expect(model.getRow(0)?.data.value).toBe(1000); expect(events).toBe(1000)
    unsubscribe(); model.dispose(); push({ type: "upsert", rows: [{ index: 0, row: { id: "r", value: -1 } }] })
    expect(unsubscribed).toBe(1); expect(model.getBackpressureDiagnostics().rowCacheSize).toBe(0)
    results.streamingBurst = { produced: 1000, synchronousNotifications: events, finalValueBeforeDispose: 1000, unsubscribeCount: unsubscribed, retainedRowsAfterLatePush: 0 }
  })

  it("change feed: slow request skips interval ticks instead of accumulating polls", async () => {
    vi.useFakeTimers(); const gate = deferred<number>(); let calls = 0
    const poller = createChangeFeedPoller({ getSinceVersion: () => 0, loadSinceVersion: () => { calls++; return gate.promise }, onResponse: () => {}, intervalMs: 250 })
    poller.start(); await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toBe(1); expect(poller.diagnostics().pending).toBe(true)
    gate.resolve(1); await ticks(); expect(poller.diagnostics().pending).toBe(false); poller.stop()
    results.pollingSlow = { controlledDurationMs: 10_000, intervalMs: 250, calls, pendingAfterResolution: false }
  })

  it("change feed: an old generation cannot clear or overlap the current poll", async () => {
    vi.useFakeTimers()
    const calls: Array<{ gate: ReturnType<typeof deferred<number>>; signal: AbortSignal }> = [], delivered: number[] = []
    const poller = createChangeFeedPoller({ getSinceVersion: () => 0, loadSinceVersion: (_version, signal) => {
      const gate = deferred<number>(); calls.push({ gate, signal: signal! }); signal!.addEventListener("abort", () => gate.reject(new DOMException("aborted", "AbortError")), { once: true }); return gate.promise
    }, onResponse: value => delivered.push(value), retry: false })
    poller.start(); await ticks(); poller.start(); await ticks()
    expect(calls).toHaveLength(2); expect(poller.diagnostics().pending).toBe(true)
    await poller.pollNow(); expect(calls).toHaveLength(2)
    calls[1]!.gate.resolve(2); await ticks()
    expect(delivered).toEqual([2])
    results.pollGeneration = { restartCalls: 2, pendingWhileSecondRequestActive: true, callsAfterPollNow: calls.length, delivered, oldRequestHonorsAbort: true }; poller.stop()
  })

  it("RAF scheduler skips detached callbacks after a preceding callback disposes it", () => {
    const scheduler = createRafScheduler(); let lateEffects = 0
    scheduler.schedule(() => scheduler.dispose())
    scheduler.schedule(() => { lateEffects++ })
    scheduler.flush()
    expect(lateEffects).toBe(0)
    expect(scheduler.schedule(() => { lateEffects++ })).toBe(-1)
    results.rafDisposalDuringDrain = { acceptedBeforeDispose: 2, notYetStartedEffectsAfterDispose: lateEffects, newTaskRejected: true }
  })
})
