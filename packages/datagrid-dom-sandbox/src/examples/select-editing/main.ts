import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface TaskRow {
  id: string
  task: string
  status: "queued" | "active" | "done"
}

const rows: readonly TaskRow[] = [
  { id: "t1", task: "Review pull request", status: "queued" },
  { id: "t2", task: "Update design tokens", status: "active" },
  { id: "t3", task: "Publish release notes", status: "done" },
]

export interface SelectEditingDemoHandle {
  readonly grid: DataGridDomHandle<TaskRow>
  destroy(): Promise<void>
}

export function mountSelectEditingDemo(root: HTMLElement): SelectEditingDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Task status"
  const description = document.createElement("p")
  description.textContent = "Double-click a status and choose an option. Core stores the selected value and the grid renders its label."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Task status select editing example",
    rows,
    columns: [
      { key: "task", field: "task", label: "Task" },
      {
        key: "status",
        field: "status",
        label: "Status",
        capabilities: { editable: true },
        presentation: { options: [
          { label: "Queued", value: "queued" },
          { label: "In progress", value: "active" },
          { label: "Done", value: "done" },
        ] },
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
  const root = document.querySelector<HTMLElement>("#select-editing-demo")
  if (root) {
    const demo = mountSelectEditingDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
