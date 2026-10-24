import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface ProductRow {
  id: string
  product: string
  owner: string
  status: string
  amount: string
}

const rows: ProductRow[] = [
  { id: "p-1", product: "Quarterly platform renewal", owner: "M. Chen", status: "Ready", amount: "$18,420" },
  { id: "p-2", product: "Regional data migration", owner: "A. Patel", status: "In review", amount: "$42,800" },
  { id: "p-3", product: "Identity access rollout", owner: "S. Okafor", status: "Blocked", amount: "$9,760" },
  { id: "p-4", product: "Analytics workspace", owner: "R. Silva", status: "Ready", amount: "$26,190" },
  { id: "p-5", product: "Customer portal refresh", owner: "J. Kim", status: "In review", amount: "$31,540" },
  { id: "p-6", product: "Audit retention project", owner: "L. Garcia", status: "Ready", amount: "$12,300" },
]

export interface ColumnResizingDemoHandle {
  readonly grid: DataGridDomHandle<ProductRow>
  destroy(): Promise<void>
}

export function mountColumnResizingDemo(root: HTMLElement): ColumnResizingDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Quarterly delivery portfolio"
  const description = document.createElement("p")
  description.textContent = "Drag a header edge to resize. Double-click an edge to fit its label and values."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.dataset.columnResizeStatus = ""
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"
  header.append(title, status)

  const controls = document.createElement("div")
  controls.className = "demo-controls"
  const reset = document.createElement("button")
  reset.type = "button"
  reset.textContent = "Reset column widths"
  controls.append(reset)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Quarterly delivery portfolio",
    rows,
    columns: [
      { key: "product", field: "product", label: "Product", initialState: { width: 280 } },
      { key: "owner", field: "owner", label: "Owner", initialState: { width: 150 } },
      { key: "status", field: "status", label: "Status", initialState: { width: 140 } },
      { key: "amount", field: "amount", label: "Contract value", initialState: { width: 160 } },
    ],
  })
  const initialWidths = new Map(grid.api.columns.getSnapshot().visibleColumns.map(column => [column.key, column.width]))
  const updateStatus = (): void => {
    status.textContent = grid.api.columns.getSnapshot().visibleColumns.map(column => `${column.column.label}: ${column.width ?? 160}px`).join(" · ")
  }
  const unsubscribe = grid.api.events.on("columns:changed", updateStatus)
  reset.addEventListener("click", () => {
    for (const [key, width] of initialWidths) grid.api.columns.setWidth(key, width)
  })
  root.replaceChildren(header, controls, host)
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
  const root = document.querySelector<HTMLElement>("#column-resizing-demo")
  if (root) {
    const demo = mountColumnResizingDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
