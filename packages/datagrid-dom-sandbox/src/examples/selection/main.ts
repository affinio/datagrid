import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
}

export interface CellSelectionDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountCellSelectionDemo(root: HTMLElement): CellSelectionDemoHandle {
  const document = root.ownerDocument
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Click a cell to select it"

  const clear = document.createElement("button")
  clear.type = "button"
  clear.textContent = "Clear selection"
  clear.dataset.action = "clear-selection"
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Cell selection controls")
  controls.append(clear)

  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "People directory"
  const description = document.createElement("p")
  description.textContent = "Click different cells to move the active selection."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "People directory with cell selection",
    rows: [
      { id: "p1", name: "Ada Lovelace", team: "Engine" },
      { id: "p2", name: "Grace Hopper", team: "Platform" },
      { id: "p3", name: "Katherine Johnson", team: "Research" },
    ],
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
    ],
  })

  const updateStatus = (): void => {
    const activeCell = grid.api.selection.getSnapshot()?.activeCell
    if (!activeCell) {
      status.textContent = "Click a cell to select it"
      return
    }
    const row = grid.api.rows.get(activeCell.rowIndex)
    const column = grid.api.columns.getSnapshot().visibleColumns[activeCell.colIndex]
    status.textContent = row && column
      ? `Selected ${row.data.name} · ${column.column.label ?? column.key}`
      : "Selection unavailable"
  }
  const onClear = (): void => grid.api.selection.clear({ origin: "datagrid-dom-selection-demo" })
  clear.addEventListener("click", onClear)
  const unsubscribeSelection = grid.api.events.on("selection:changed", updateStatus)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      clear.removeEventListener("click", onClear)
      unsubscribeSelection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#selection-demo")
  if (root) {
    const demo = mountCellSelectionDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
