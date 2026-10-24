import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface TeammateRow {
  id: string
  name: string
  team: string
  location: string
}

const rows: readonly TeammateRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine", location: "London" },
  { id: "p2", name: "Grace Hopper", team: "Platform", location: "Arlington" },
  { id: "p3", name: "Katherine Johnson", team: "Research", location: "Hampton" },
  { id: "p4", name: "Dorothy Vaughan", team: "Analysis", location: "Hampton" },
]

export interface EditingDemoHandle {
  readonly grid: DataGridDomHandle<TeammateRow>
  destroy(): Promise<void>
}

export function mountEditingDemo(root: HTMLElement): EditingDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "People directory"
  const description = document.createElement("p")
  description.textContent = "Select a name or team and start typing to replace its value. Enter saves and moves down, Shift+Enter saves and moves up, and Escape cancels. Double-click also opens the current value."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"
  header.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Editable people directory",
    rows,
    columns: [
      { key: "name", field: "name", label: "Name", capabilities: { editable: true } },
      { key: "team", field: "team", label: "Team", capabilities: { editable: true } },
      { key: "location", field: "location", label: "Location" },
    ],
  })
  root.replaceChildren(header, host)

  const updateStatus = (): void => {
    status.textContent = `${grid.api.rows.getCount()} rows · select and type to edit`
  }
  const unsubscribeRows = grid.api.events.on("rows:changed", updateStatus)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      unsubscribeRows()
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#editing-demo")
  if (root) {
    const demo = mountEditingDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
