import {
  createDataSourceBackedRowModel,
  type DataGridDataSource,
  type DataGridDataSourcePullRequest,
} from "@affino/datagrid-core"
import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface OrderRow {
  id: string
  customer: string
  region: "North" | "South" | "West"
  amount: number
}

const ROW_COUNT = 1_000
const REGIONS: OrderRow["region"][] = ["North", "South", "West"]
const sourceRows: readonly OrderRow[] = Array.from({ length: ROW_COUNT }, (_, index) => ({
  id: `order-${String(index + 1).padStart(4, "0")}`,
  customer: `Customer ${String((index * 37) % 241 + 1).padStart(3, "0")}`,
  region: REGIONS[index % REGIONS.length]!,
  amount: 120 + ((index * 83) % 9_700) / 10,
}))

function matchesRequest(row: OrderRow, request: DataGridDataSourcePullRequest): boolean {
  const quickFilter = request.filterModel?.quickFilter
  if (quickFilter?.query) {
    const query = quickFilter.query.toLocaleLowerCase()
    if (![row.customer, row.region, row.id].some(value => value.toLocaleLowerCase().includes(query))) return false
  }
  const regionFilter = request.filterModel?.columnFilters.region
  if (regionFilter?.kind === "valueSet" && regionFilter.tokens.length > 0) {
    if (!regionFilter.tokens.includes(`string:${row.region}`)) return false
  }
  return true
}

function orderRows(request: DataGridDataSourcePullRequest): OrderRow[] {
  const rows = sourceRows.filter(row => matchesRequest(row, request))
  const sort = request.sortModel[0]
  if (!sort) return rows
  const direction = sort.direction === "desc" ? -1 : 1
  return rows.sort((left, right) => {
    const a = left[sort.key as keyof OrderRow]
    const b = right[sort.key as keyof OrderRow]
    return (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))) * direction
  })
}

function createMemoryDataSource(onPull: (request: DataGridDataSourcePullRequest) => void) {
  let failNext = false
  const dataSource: DataGridDataSource<OrderRow> = {
    async pull(request) {
      onPull(request)
      await new Promise(resolve => setTimeout(resolve, 90))
      if (failNext) {
        failNext = false
        throw new Error("Temporary datasource failure. Retry the request.")
      }
      const rows = orderRows(request)
      const start = Math.min(request.range.start, rows.length)
      const end = Math.min(request.range.end + 1, rows.length)
      return {
        rows: rows.slice(start, end).map((row, offset) => ({ index: start + offset, row, rowId: row.id })),
        total: rows.length,
        datasetVersion: "orders-v1",
      }
    },
  }
  return { dataSource, failNextPull: () => { failNext = true } }
}

export interface ServerRowModelDemoHandle {
  readonly grid: DataGridDomHandle<OrderRow>
  readonly rowModel: ReturnType<typeof createDataSourceBackedRowModel<OrderRow>>
  getPullRequests(): readonly DataGridDataSourcePullRequest[]
  destroy(): Promise<void>
}

export function mountServerRowModelDemo(root: HTMLElement): ServerRowModelDemoHandle {
  const document = root.ownerDocument
  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Orders · 1,000 source records"
  const description = document.createElement("p")
  description.textContent = "The grid owns viewport requests; Core keeps loaded rows while a new projection refreshes."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "server-row-model-demo__status"
  status.dataset.serverRowModelStatus = ""
  status.setAttribute("aria-live", "polite")
  panelHeader.append(title, status)

  const controls = document.createElement("div")
  controls.className = "demo-controls"
  const searchLabel = document.createElement("label")
  searchLabel.textContent = "Search"
  const search = document.createElement("input")
  search.type = "search"
  search.placeholder = "Customer or order ID"
  search.dataset.serverRowModelSearch = ""
  searchLabel.append(search)
  const regionLabel = document.createElement("label")
  regionLabel.textContent = "Region"
  const region = document.createElement("select")
  region.dataset.serverRowModelRegion = ""
  for (const [value, label] of [["", "All regions"], ["North", "North"], ["South", "South"], ["West", "West"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    region.append(option)
  }
  regionLabel.append(region)
  const failButton = document.createElement("button")
  failButton.type = "button"
  failButton.textContent = "Fail next pull"
  failButton.dataset.serverRowModelFail = ""
  const retryButton = document.createElement("button")
  retryButton.type = "button"
  retryButton.textContent = "Retry failed request"
  retryButton.dataset.serverRowModelRetry = ""
  retryButton.disabled = true
  controls.append(searchLabel, regionLabel, failButton, retryButton)

  const host = document.createElement("div")
  host.className = "grid-host grid-host--virtualized"
  const pulls: DataGridDataSourcePullRequest[] = []
  const memory = createMemoryDataSource(request => pulls.push(request))
  const rowModel = createDataSourceBackedRowModel<OrderRow>({
    dataSource: memory.dataSource,
    resolveRowId: row => row.id,
    initialTotal: ROW_COUNT,
    // Match the Vue server datasource demo: fetch a bounded, directional
    // background buffer so normal scrolling consumes cached rows.
    prefetch: {
      enabled: true,
      triggerViewportFactor: 0.8,
      windowViewportFactor: 3,
      minBatchSize: 150,
      maxBatchSize: 600,
      directionalBias: "scroll-direction",
    },
  })
  const grid = mountDataGrid(host, {
    label: "Server-backed orders",
    rowModel,
    columns: [
      { key: "id", field: "id", label: "Order", initialState: { width: 150 } },
      { key: "customer", field: "customer", label: "Customer", initialState: { width: 190 } },
      { key: "region", field: "region", label: "Region", initialState: { width: 130 } },
      { key: "amount", field: "amount", label: "Amount", dataType: "currency", initialState: { width: 140 } },
    ],
    rowVirtualization: { rowHeight: 38, overscan: 8 },
  })
  root.replaceChildren(panelHeader, controls, host)

  const applyProjection = (): void => {
    grid.api.rows.setFilterModel({
      columnFilters: region.value ? { region: { kind: "valueSet", tokens: [`string:${region.value}`] } } : {},
      ...(search.value.trim() ? {
        quickFilter: { query: search.value.trim(), columns: ["id", "customer", "region"], mode: "contains" as const },
      } : {}),
    })
  }
  const updateStatus = (): void => {
    const snapshot = rowModel.getSnapshot()
    const phase = snapshot.error ? `Error · ${snapshot.error.message}`
      : snapshot.initialLoading ? "Loading first viewport…"
        : snapshot.refreshing || snapshot.loading ? "Refreshing · cached rows stay visible"
          : "Ready"
    status.textContent = `${snapshot.rowCount.toLocaleString()} rows · ${phase} · ${pulls.length} pulls`
    retryButton.disabled = snapshot.error == null
    failButton.disabled = Boolean(snapshot.loading || snapshot.refreshing)
  }
  const onSearch = (): void => applyProjection()
  const onFail = (): void => {
    memory.failNextPull()
    status.textContent = "Next datasource pull will fail. Change the filter or scroll to request rows."
  }
  const onRetry = (): void => { void rowModel.refresh("manual") }
  search.addEventListener("input", onSearch)
  region.addEventListener("change", onSearch)
  failButton.addEventListener("click", onFail)
  retryButton.addEventListener("click", onRetry)
  const unsubscribe = rowModel.subscribe(updateStatus)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    rowModel,
    getPullRequests: () => pulls,
    async destroy() {
      search.removeEventListener("input", onSearch)
      region.removeEventListener("change", onSearch)
      failButton.removeEventListener("click", onFail)
      retryButton.removeEventListener("click", onRetry)
      unsubscribe()
      await grid.destroy()
      rowModel.dispose()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#server-row-model-demo")
  if (root) {
    const demo = mountServerRowModelDemo(root)
    window.addEventListener("pagehide", () => { void demo.destroy() }, { once: true })
  }
}
