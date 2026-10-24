import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
}

const initialRows: readonly PersonRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine" },
  { id: "p2", name: "Grace Hopper", team: "Platform" },
  { id: "p3", name: "Katherine Johnson", team: "Research" },
]

export interface DataUpdatesDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountDataUpdatesDemo(root: HTMLElement): DataUpdatesDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Update grid data")

  const add = createButton(document, "Add row", "add")
  const remove = createButton(document, "Remove last row", "remove")
  const reset = createButton(document, "Reset data", "reset")
  controls.append(add, remove, reset)

  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"

  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "People directory"
  const description = document.createElement("p")
  description.textContent = "Rows are changed only through the Core API."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "People directory with row updates",
    rows: initialRows,
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
    ],
  })

  let nextId = 4
  const updateStatus = (): void => {
    const count = grid.api.rows.getCount()
    status.textContent = `${count} ${count === 1 ? "row" : "rows"} · Core API ready`
    remove.disabled = count === 0
  }
  const onAdd = (): void => {
    const id = `p${nextId++}`
    grid.api.rows.appendData([{
      id,
      name: `New teammate ${id.slice(1)}`,
      team: "New team",
    }])
    updateStatus()
  }
  const onRemove = (): void => {
    const lastRow = grid.api.rows.get(grid.api.rows.getCount() - 1)
    if (lastRow) grid.api.rows.removeData([lastRow.rowId])
    updateStatus()
  }
  const onReset = (): void => {
    grid.api.rows.setData(initialRows)
    nextId = 4
    updateStatus()
  }
  add.addEventListener("click", onAdd)
  remove.addEventListener("click", onRemove)
  reset.addEventListener("click", onReset)

  const unsubscribeRows = grid.api.events.on("rows:changed", updateStatus)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      add.removeEventListener("click", onAdd)
      remove.removeEventListener("click", onRemove)
      reset.removeEventListener("click", onReset)
      unsubscribeRows()
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

function createButton(document: Document, label: string, action: string): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  button.dataset.action = action
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#updates-demo")
  if (root) {
    const demo = mountDataUpdatesDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
