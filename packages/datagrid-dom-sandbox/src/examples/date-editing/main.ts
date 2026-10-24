import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface ScheduleRow {
  id: string
  task: string
  dueDate: string
  startsAt: string
}

const rows: readonly ScheduleRow[] = [
  { id: "s1", task: "Design review", dueDate: "2026-10-24", startsAt: "2026-10-24T09:30:00.000Z" },
  { id: "s2", task: "API review", dueDate: "2026-10-25", startsAt: "2026-10-25T13:00:00.000Z" },
  { id: "s3", task: "Release planning", dueDate: "2026-10-27", startsAt: "2026-10-27T15:15:00.000Z" },
]

export interface DateEditingDemoHandle {
  readonly grid: DataGridDomHandle<ScheduleRow>
  destroy(): Promise<void>
}

export function mountDateEditingDemo(root: HTMLElement): DateEditingDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Schedule dates"
  const description = document.createElement("p")
  description.textContent = "Double-click a date or time, or select a cell and press Enter/F2. Native date controls commit through Core and support Undo."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Schedule with editable dates and times",
    rows,
    columns: [
      { key: "task", field: "task", label: "Task" },
      { key: "dueDate", field: "dueDate", label: "Due date", cellType: "date", capabilities: { editable: true } },
      { key: "startsAt", field: "startsAt", label: "Starts at", cellType: "datetime", capabilities: { editable: true } },
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
  const root = document.querySelector<HTMLElement>("#date-editing-demo")
  if (root) {
    const demo = mountDateEditingDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
