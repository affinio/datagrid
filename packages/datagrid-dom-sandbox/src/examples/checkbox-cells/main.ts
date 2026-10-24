import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface ReleaseRow {
  id: string
  task: string
  approved: boolean
}

const rows: readonly ReleaseRow[] = [
  { id: "r1", task: "API contract reviewed", approved: true },
  { id: "r2", task: "Migration guide approved", approved: false },
  { id: "r3", task: "Release notes approved", approved: false },
]

export interface CheckboxCellsDemoHandle {
  readonly grid: DataGridDomHandle<ReleaseRow>
  destroy(): Promise<void>
}

export function mountCheckboxCellsDemo(root: HTMLElement): CheckboxCellsDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Release checklist"
  const description = document.createElement("p")
  description.textContent = "Click a checkbox or its cell, or select the cell and press Space. Each toggle is recorded in Core history."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Release checklist with editable boolean cells",
    rows,
    columns: [
      { key: "task", field: "task", label: "Checklist item" },
      {
        key: "approved",
        field: "approved",
        label: "Approved",
        dataType: "boolean",
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
  const root = document.querySelector<HTMLElement>("#checkbox-cells-demo")
  if (root) {
    const demo = mountCheckboxCellsDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
