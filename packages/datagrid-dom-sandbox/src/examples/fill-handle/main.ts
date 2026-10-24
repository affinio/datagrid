import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface FillRow {
  id: string
  item: string
  quantity: number
  unit: string
}

const rows: readonly FillRow[] = [
  { id: "r1", item: "Cable ties", quantity: 10, unit: "pack" },
  { id: "r2", item: "Mounting clips", quantity: 20, unit: "box" },
  { id: "r3", item: "Label rolls", quantity: 0, unit: "roll" },
  { id: "r4", item: "Shipping cartons", quantity: 0, unit: "box" },
  { id: "r5", item: "Protective sleeves", quantity: 0, unit: "pack" },
]

export interface FillHandleDemoHandle {
  readonly grid: DataGridDomHandle<FillRow>
  destroy(): Promise<void>
}

export function mountFillHandleDemo(root: HTMLElement): FillHandleDemoHandle {
  const document = root.ownerDocument
  const status = document.createElement("output")
  status.className = "renderer-demo__action-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Drag the fill handle along one axis. Use the fill options after numeric fills to choose Series or Copy."

  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Replenishment plan"
  const description = document.createElement("p")
  description.textContent = "Fill extends along one axis only. Numeric seeds default to a series and expose Series / Increment or Copy options. Each fill is one undoable edit."
  title.append(heading, description)
  header.append(title)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(header, host, status)

  const grid = mountDataGrid(host, {
    label: "Replenishment plan with fill handle",
    fillHandle: true,
    rows,
    columns: [
      { key: "item", field: "item", label: "Item", capabilities: { editable: true } },
      { key: "quantity", field: "quantity", label: "Quantity", capabilities: { editable: true } },
      { key: "unit", field: "unit", label: "Unit", capabilities: { editable: true } },
    ],
  })

  const onPointerUp = (): void => {
    window.setTimeout(() => {
      const message = host.querySelector<HTMLElement>(".affino-grid-dom")?.dataset.clipboardAction
      if (message) status.textContent = message + " · Ctrl/Cmd+Z to undo"
    }, 0)
  }
  host.addEventListener("pointerup", onPointerUp)
  void grid.ready.then(() => finishDemoLoading(document)).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      host.removeEventListener("pointerup", onPointerUp)
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#fill-handle-demo")
  if (root) {
    const demo = mountFillHandleDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
