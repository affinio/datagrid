import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface FormulaRow {
  id: string
  item: string
  unitPrice: number | string
  quantity: number
  taxRate: number
  subtotal?: number
  tax?: number
  total?: number
}

export interface FormulaDemoHandle {
  readonly grid: DataGridDomHandle<FormulaRow>
  destroy(): Promise<void>
}

export function mountFormulaDemo(root: HTMLElement): FormulaDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Calculated order totals"
  const description = document.createElement("p")
  description.textContent = "Double-click an editable unit price or select it and start typing. Core recalculates dependent formula fields when the edit is committed."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)

  const formulas = document.createElement("dl")
  formulas.className = "demo-formula-list"
  formulas.setAttribute("aria-label", "Formula definitions")
  for (const [field, expression] of [
    ["subtotal", "unitPrice * quantity"],
    ["tax", "ROUND(subtotal * taxRate, 2)"],
    ["total", "subtotal + tax"],
  ]) {
    const term = document.createElement("dt")
    term.textContent = field
    const value = document.createElement("dd")
    value.textContent = `=${expression}`
    formulas.append(term, value)
  }

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Order rows with calculated formula columns",
    rows: [
      { id: "o1", item: "Desk lamp", unitPrice: 42.5, quantity: 3, taxRate: 0.08 },
      { id: "o2", item: "Notebook set", unitPrice: 18, quantity: 5, taxRate: 0.08 },
      { id: "o3", item: "Monitor", unitPrice: 249.99, quantity: 2, taxRate: 0.08 },
      { id: "o4", item: "Keyboard", unitPrice: 76.25, quantity: 4, taxRate: 0.08 },
    ],
    columns: [
      { key: "item", field: "item", label: "Item" },
      { key: "unitPrice", field: "unitPrice", label: "Unit price", dataType: "number", capabilities: { editable: true } },
      { key: "quantity", field: "quantity", label: "Qty", dataType: "number" },
      { key: "taxRate", field: "taxRate", label: "Tax rate", dataType: "percent" },
      { key: "subtotal", field: "subtotal", label: "Subtotal", dataType: "number" },
      { key: "tax", field: "tax", label: "Tax", dataType: "number" },
      { key: "total", field: "total", label: "Total", dataType: "number" },
    ],
    formulas: [
      { name: "subtotal", formula: "unitPrice * quantity" },
      { name: "tax", formula: "ROUND(subtotal * taxRate, 2)" },
      { name: "total", formula: "subtotal + tax" },
    ],
  })
  root.replaceChildren(header, formulas, host)

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
  const root = document.querySelector<HTMLElement>("#formula-demo")
  if (root) {
    const demo = mountFormulaDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
