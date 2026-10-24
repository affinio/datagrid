import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface StockRow {
  id: string
  item: string
  reorderPoint: number
}

const rows: readonly StockRow[] = [
  { id: "stock-1", item: "Desk lamp", reorderPoint: 12 },
  { id: "stock-2", item: "Monitor arm", reorderPoint: 5 },
  { id: "stock-3", item: "Cable tray", reorderPoint: 18 },
]

export interface EditValidationDemoHandle {
  readonly grid: DataGridDomHandle<StockRow>
  destroy(): Promise<void>
}

export function mountEditValidationDemo(root: HTMLElement): EditValidationDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Invalid edit recovery"
  const description = document.createElement("p")
  description.textContent = "Enter an invalid number and press Enter. The editor stays open and marks the draft; correct it to commit."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Inventory grid with inline validation",
    rows,
    columns: [
      { key: "item", field: "item", label: "Item" },
      { key: "reorderPoint", field: "reorderPoint", label: "Reorder point", cellType: "number", capabilities: { editable: true } },
    ],
  })
  root.replaceChildren(header, host)
  void grid.ready.then(() => finishDemoLoading(document)).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#edit-validation-demo")
  if (root) {
    const demo = mountEditValidationDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
