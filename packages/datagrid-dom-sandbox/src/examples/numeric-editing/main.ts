import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface InvoiceRow {
  id: string
  item: string
  quantity: number
  unitPrice: number
  taxRate: number
}

const rows: readonly InvoiceRow[] = [
  { id: "i1", item: "Desk lamp", quantity: 2, unitPrice: 48.5, taxRate: 0.08 },
  { id: "i2", item: "Monitor arm", quantity: 1, unitPrice: 129, taxRate: 0.08 },
  { id: "i3", item: "Cable tray", quantity: 3, unitPrice: 22.75, taxRate: 0.05 },
]

export interface NumericEditingDemoHandle {
  readonly grid: DataGridDomHandle<InvoiceRow>
  destroy(): Promise<void>
}

export function mountNumericEditingDemo(root: HTMLElement): NumericEditingDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Invoice values"
  const description = document.createElement("p")
  description.textContent = "Edit quantity, currency, or percent values. Core parses valid drafts into numbers; invalid input is discarded."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Invoice with typed numeric editing",
    rows,
    columns: [
      { key: "item", field: "item", label: "Item" },
      { key: "quantity", field: "quantity", label: "Quantity", cellType: "number", capabilities: { editable: true } },
      {
        key: "unitPrice",
        field: "unitPrice",
        label: "Unit price",
        cellType: "currency",
        presentation: { format: { number: { locale: "en-US", style: "currency", currency: "USD" } } },
        capabilities: { editable: true },
      },
      {
        key: "taxRate",
        field: "taxRate",
        label: "Tax rate",
        cellType: "percent",
        presentation: { format: { number: { style: "percent", maximumFractionDigits: 1 } } },
        capabilities: { editable: true },
      },
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
  const root = document.querySelector<HTMLElement>("#numeric-editing-demo")
  if (root) {
    const demo = mountNumericEditingDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
