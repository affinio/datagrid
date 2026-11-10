import { createApp, h, nextTick, ref } from "vue"
import { DataGrid, createDataSourceBackedRowModel } from "@affino/datagrid-vue"
import { createAffinoDatasource } from "@affino/datagrid-server-adapters"
import type { DataGridDataSource } from "../../../../packages/datagrid-core/src/models/server/dataSourceProtocol"

type Row = { id: string; index: number; value: string }
const params = new URLSearchParams(location.search)
const enabled = (key: string) => params.get(key) === "1"
let calls = 0
let respond!: (rows: Row[], total: number) => void
const pending: Array<(rows: Row[], total: number) => void> = []
const basic: DataGridDataSource<Row> = {
  async pull(request) {
    calls++
    return await new Promise(resolve => pending.push((rows, total) => resolve({
      rows: rows.map((row, offset) => ({ index: request.range.start + offset, rowId: row.id, row })),
      total,
    })))
  },
  subscribe() { return () => undefined },
}
respond = (rows, total) => pending.shift()?.(rows, total)
const affino = createAffinoDatasource<Row>({
  baseUrl: "http://grid.test",
  tableId: "rows",
  fetchImpl: async () => await new Promise(resolve => pending.push((rows, total) => resolve(new Response(JSON.stringify({ rows, total }), { status: 200, headers: { "content-type": "application/json" } })))),
})
const source = enabled("affino") ? affino : basic
const model = createDataSourceBackedRowModel<Row>({ dataSource: source, initialTotal: enabled("total") ? 300 : 0, prefetch: { enabled: false } })
const loadedRows = () => model.getRowsInRange({ start: 0, end: 299 }).filter(row => !("__placeholder" in row)).length
const grid = ref<any>(null)
const columns = Array.from({ length: enabled("columns") ? 14 : 3 }, (_, index) => ({
  key: `c${index}`, label: `Column ${index}`, width: 150,
  ...(enabled("renderer") ? { cellRenderer: ({ displayValue }: any) => h("span", { class: "custom-cell" }, String(displayValue ?? "")) } : {}),
}))
const app = createApp({ render: () => h(DataGrid, {
  ref: grid,
  rowModel: model,
  columns,
  virtualization: enabled("virtual"),
  layoutMode: "fill",
  advancedFilter: enabled("filter"),
  statePersistence: enabled("persistence") ? { key: "vnode-scroll-repro", includeViewportPosition: true, restoreOnReady: true } : undefined,
}) })
app.config.errorHandler = (error, _instance, info) => {
  ;(window as any).__errors.push({ message: String(error), info })
}
;(window as any).__errors = []
app.mount("#app")
const settle = async () => { await nextTick(); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); await nextTick() }
;(window as any).scenario = {
  async respond(total = 300, count = 60) {
    const rows = Array.from({ length: count }, (_, index) => ({ id: `r${index}`, index, value: `row-${index}` }))
    for (let index = 0; index < 4 && pending.length; index++) respond(rows, total)
    await settle()
    return { pending: pending.length, calls, rowCount: model.getSnapshot().rowCount, loadedRows: loadedRows() }
  },
  async empty(total = 0) { while (pending.length) respond([], total); await settle(); return { pending: pending.length, calls, rowCount: model.getSnapshot().rowCount, loadedRows: loadedRows() } },
  async scrollAndRespond() {
    const viewport = document.querySelector<HTMLElement>(".datagrid-body-viewport, .grid-body-viewport, [data-grid-viewport]")
    if (!viewport) return { viewport: false }
    viewport.scrollTop = 500
    viewport.dispatchEvent(new Event("scroll"))
    const result = await this.respond(300, 60)
    await settle()
    return { ...result, errors: (window as any).__errors }
  },
  async scroll() {
    const viewport = document.querySelector<HTMLElement>(".datagrid-body-viewport, .grid-body-viewport, [data-grid-viewport]")
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return { errors: (window as any).__errors, calls, pending: pending.length, hasViewport: Boolean(viewport), scrollTop: viewport?.scrollTop, scrollHeight: viewport?.scrollHeight, clientHeight: viewport?.clientHeight, className: viewport?.className }
  },
  enableScroll() {
    const viewport = document.querySelector<HTMLElement>(".grid-body-viewport")
    if (viewport && !document.getElementById("repro-scroll-space")) {
      const style = document.createElement("style")
      style.id = "repro-scroll-space"
      style.textContent = ".grid-body-viewport::after{content:'';display:block;height:5000px}"
      document.head.append(style)
    }
    return { hasViewport: Boolean(viewport), scrollHeight: viewport?.scrollHeight, clientHeight: viewport?.clientHeight }
  },
  errors: () => (window as any).__errors,
  dispose() { app.unmount(); model.dispose() },
}
