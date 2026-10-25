// Audit-only production consumer fixture; reuses the existing real Vue grid.
import "../../datagrid-cost-browser/main"
import { createApp, h, ref } from "vue"
import DataGrid from "../../../../packages/datagrid-vue/src/app-layer/DataGrid"
import { createDataSourceBackedRowModel } from "../../../../packages/datagrid-core/src/models/dataSourceBackedRowModel"
const cost = (window as any).cost
const input: Array<{ delayMs: number; key: string }> = []
const longTasks: Array<{ startTime: number; duration: number }> = []
const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) longTasks.push({ startTime: entry.startTime, duration: entry.duration })
})
observer.observe({ type: "longtask", buffered: false })
document.addEventListener("keydown", event => {
  input.push({ key: event.key, delayMs: performance.now() - event.timeStamp })
}, true)
let result: any = null, gateRelease: (() => void) | null = null, pending = 0, completed = 0
let iteration = 0
let sourceApp: any = null, sourceModel: any = null, sourceApi: any = null, sourcePush: any = null
async function mount(n: number, streaming = false) {
  iteration = 0
  sourceApp?.unmount(); sourceModel?.dispose(); sourceApp = null; sourceModel = null; sourceApi = null
  if (streaming) {
    cost.close(); document.getElementById("app")!.replaceChildren()
    sourceModel = createDataSourceBackedRowModel({ initialTotal: n, resolveRowId: (r: any) => r.rowId, prefetch: { enabled: false }, dataSource: {
      async pull(request) { return { total: n, rows: Array.from({ length: request.range.end - request.range.start + 1 }, (_, i) => { const index = request.range.start + i; return { index, row: { rowId: `r${index}`, value: index } } }) } },
      subscribe(listener) { sourcePush = listener; return () => {} },
    } })
    const grid = ref<any>(null)
    sourceApp = createApp({ render: () => h(DataGrid, { ref: grid, rowModel: sourceModel, columns: Array.from({ length: 12 }, (_, i) => ({ key: i ? `c${i}` : "value", width: 125 })) }) })
    sourceApp.mount("#app")
    for (let i = 0; i < 6; i++) await cost.stable()
    sourceApi = grid.value.getApi()
    ;(document.getElementById("audit-input") as HTMLButtonElement).focus()
    return { production: import.meta.env.PROD, rows: n, cells: document.querySelectorAll(".grid-cell").length, datasource: true }
  }
  await cost.mount(n, 12, false)
  cost.raw().registerFormulaField({ name: "double", field: "double", formula: "[value] * 2" })
  cost.raw().registerFormulaField({ name: "plus", field: "plus", formula: "[double] + 1" })
  cost.api().rows.setSortModel([{ key: "value", direction: "asc" }])
  await cost.stable()
  ;(document.getElementById("audit-input") as HTMLButtonElement).focus()
  return { production: import.meta.env.PROD, rows: cost.raw().getRowCount(), cells: document.querySelectorAll(".grid-cell").length }
}
function begin(kind: "burst" | "exclusive" | "stream", count: number, counted = false) {
  result = null; input.length = 0; longTasks.length = 0
  const channel = new MessageChannel()
  channel.port1.onmessage = async () => {
    channel.port1.close(); channel.port2.close()
    const work: Record<string, number> = {}, restores: Array<() => void> = []
    if (counted) {
      const model = kind === "stream" ? sourceModel : cost.raw()
      for (const name of ["getSnapshot", "getRowsInRange", "getRow", "getEffectiveRowById"]) {
        const original = model[name]
        if (typeof original !== "function") continue
        model[name] = (...args: any[]) => { work[name] = (work[name] ?? 0) + 1; return original.apply(model, args) }
        restores.push(() => { model[name] = original })
      }
      const mutations = new MutationObserver(() => { work.domMutationDeliveries = (work.domMutationDeliveries ?? 0) + 1 })
      mutations.observe(document.getElementById("app")!, { childList: true, characterData: true, attributes: true, subtree: true })
      restores.push(() => mutations.disconnect())
    }
    const started = performance.now()
    let calls = 0
    const update = () => {
      const value = 1000 + ++iteration
      if (kind === "stream") sourcePush({ type: "upsert", rows: [{ index: 0, row: { rowId: "r0", value } }] })
      else cost.api().rows.patch([{ rowId: "r0", data: { value } }])
      calls++
    }
    if (kind === "exclusive") await Promise.all(Array.from({ length: count }, () => cost.api().lifecycle.runExclusive(update)))
    else for (let i = 0; i < count; i++) update()
    const mutationMs = performance.now() - started
    await cost.stable()
    for (const restore of restores) restore()
    result = { kind, count, calls, mutationMs, settledMs: performance.now() - started, expectedFinalValue: 1000 + iteration, finalValue: kind === "stream" ? sourceModel.getRow(0)?.data.value : cost.raw().getEffectiveRowById("r0")?.data.value, computedValue: kind === "stream" ? null : cost.raw().getEffectiveRowById("r0")?.data.plus, input: [...input], longTasks: [...longTasks], busy: (sourceApi ?? cost.api()).lifecycle.isBusy(), ...(counted ? { work } : {}) }
  }
  channel.port2.postMessage(0)
}
function hold() {
  pending = 0; completed = 0
  void cost.api().lifecycle.runExclusive(() => new Promise<void>(resolve => { gateRelease = resolve }))
}
function enqueue(count: number) {
  for (let i = 0; i < count; i++) {
    const payload = Array.from({ length: 128 }, (_, j) => i * 128 + j)
    pending++
    void cost.api().lifecycle.runExclusive(() => { pending--; completed++; return payload[0] }).catch(() => {})
  }
  return { pending, completed, busy: cost.api().lifecycle.isBusy() }
}
async function release() { gateRelease?.(); gateRelease = null; await cost.api().lifecycle.whenIdle(); return { pending, completed, busy: cost.api().lifecycle.isBusy() } }
async function activate(count: number, dispose = false) {
  const api = cost.api(), started = performance.now()
  const operations = Array.from({ length: count }, (_, i) => api.view.activateCell({ rowId: `r${i % 20}`, columnKey: "value" }, { selection: "replace", focus: false }))
  if (dispose) cost.close()
  const values = await Promise.all(operations)
  const statuses: Record<string, number> = {}
  for (const value of values) { const key = value.status + (value.reason ? `:${value.reason}` : ""); statuses[key] = (statuses[key] ?? 0) + 1 }
  return { count, statuses, settledMs: performance.now() - started, selection: dispose ? null : api.selection.getSnapshot() }
}
async function countActivation(count: number) {
  let geometryReads = 0, scrollTopWrites = 0, scrollLeftWrites = 0
  const restore: Array<() => void> = []
  const getRect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function() { geometryReads++; return getRect.call(this) }
  restore.push(() => { Element.prototype.getBoundingClientRect = getRect })
  for (const key of ["scrollTop", "scrollLeft"]) {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, key)!
    Object.defineProperty(Element.prototype, key, { ...descriptor, set(value) { if (key === "scrollTop") scrollTopWrites++; else scrollLeftWrites++; descriptor.set!.call(this, value) } })
    restore.push(() => Object.defineProperty(Element.prototype, key, descriptor))
  }
  try { const result = await activate(count); return { ...result, geometryReads, scrollTopWrites, scrollLeftWrites } }
  finally { for (const fn of restore) fn() }
}
;(window as any).overload = { mount, begin, result: () => result, hold, enqueue, release, activate, countActivation, close: () => { observer.disconnect(); sourceApp?.unmount(); sourceModel?.dispose(); cost.close() } }
