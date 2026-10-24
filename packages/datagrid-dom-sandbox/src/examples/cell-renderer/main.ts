import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface InventoryRow {
  id: string
  item: string
  available: number
  status: string
}

const rows: readonly InventoryRow[] = [
  { id: "sku-101", item: "Desk lamp", available: 18, status: "Ready" },
  { id: "sku-205", item: "Monitor arm", available: 3, status: "Low stock" },
  { id: "sku-318", item: "Cable tray", available: 0, status: "Out of stock" },
]

export interface CellRendererDemoHandle {
  readonly grid: DataGridDomHandle<InventoryRow>
  destroy(): Promise<void>
}

export function mountCellRendererDemo(root: HTMLElement): CellRendererDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Custom cell content"
  const description = document.createElement("p")
  description.textContent = "Render a DOM badge from typed row values while the grid keeps ownership of selection, layout, and navigation."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)

  const actionStatus = document.createElement("output")
  actionStatus.className = "renderer-demo__action-status"
  actionStatus.setAttribute("aria-live", "polite")
  actionStatus.textContent = "Click the status cell or focus it and press Space. Enter moves to the next row."

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Inventory with custom cell renderers",
    rows,
    columns: [
      { key: "item", field: "item", label: "Item" },
      {
        key: "available",
        field: "available",
        label: "Available",
        cellRenderer: ({ document: ownerDocument, value, displayValue }) => {
          const badge = ownerDocument.createElement("span")
          const count = Number(value ?? 0)
          badge.className = count === 0
            ? "renderer-demo__badge renderer-demo__badge--empty"
            : count < 5
              ? "renderer-demo__badge renderer-demo__badge--low"
              : "renderer-demo__badge renderer-demo__badge--ready"
          badge.textContent = displayValue
          return badge
        },
      },
      {
        key: "status",
        field: "status",
        label: "Status label",
        cellInteraction: {
          click: true,
          keyboard: ["space"],
          role: "button",
          disabled: ({ row }) => row?.available === 0,
          label: ({ row }) => `Open status details for ${row?.item ?? "item"}`,
          onInvoke: ({ row, trigger }) => {
            actionStatus.textContent = `${row?.item ?? "Item"} activated by ${trigger}.`
          },
        },
        cellRenderer: ({ document: ownerDocument, displayValue }) => {
          const pseudoButton = ownerDocument.createElement("span")
          pseudoButton.className = "renderer-demo__action"
          pseudoButton.textContent = displayValue.toUpperCase()
          return pseudoButton
        },
      },
    ],
  })
  root.replaceChildren(header, actionStatus, host)
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
  const root = document.querySelector<HTMLElement>("#cell-renderer-demo")
  if (root) {
    const demo = mountCellRendererDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
