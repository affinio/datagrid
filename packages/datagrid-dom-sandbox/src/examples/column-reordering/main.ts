import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PortfolioRow {
  id: string
  initiative: string
  owner: string
  status: string
  region: string
  value: string
}

const rows: readonly PortfolioRow[] = [
  { id: "i-1", initiative: "Data platform renewal", owner: "M. Chen", status: "Ready", region: "North America", value: "$184k" },
  { id: "i-2", initiative: "Identity migration", owner: "A. Patel", status: "In review", region: "Europe", value: "$92k" },
  { id: "i-3", initiative: "Analytics workspace", owner: "S. Okafor", status: "Blocked", region: "Asia Pacific", value: "$126k" },
  { id: "i-4", initiative: "Customer portal", owner: "R. Silva", status: "Ready", region: "Europe", value: "$78k" },
]

export interface ColumnReorderingDemoHandle {
  readonly grid: DataGridDomHandle<PortfolioRow>
  destroy(): Promise<void>
}

export function mountColumnReorderingDemo(root: HTMLElement): ColumnReorderingDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Initiative portfolio"
  const description = document.createElement("p")
  description.textContent = "Drag headers to reorder columns or move them between pinned zones. Cell selection follows its column."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.dataset.columnReorderStatus = ""
  header.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Initiative portfolio columns can be reordered",
    columnReorder: true,
    rows,
    columns: [
      { key: "initiative", field: "initiative", label: "Initiative", initialState: { width: 240, pin: "left" } },
      { key: "owner", field: "owner", label: "Owner", initialState: { width: 140 } },
      { key: "status", field: "status", label: "Status", initialState: { width: 125 } },
      { key: "region", field: "region", label: "Region", initialState: { width: 155 } },
      { key: "value", field: "value", label: "Portfolio value", initialState: { width: 150, pin: "right" } },
    ],
  })
  const updateStatus = (): void => {
    status.textContent = grid.api.columns.getSnapshot().visibleColumns.map(column => column.column.label ?? column.key).join("  →  ")
  }
  const unsubscribe = grid.api.events.on("columns:changed", updateStatus)
  root.replaceChildren(header, host)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      unsubscribe()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#column-reordering-demo")
  if (root) {
    const demo = mountColumnReorderingDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
