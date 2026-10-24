import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
}

export interface KeyboardNavigationDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountKeyboardNavigationDemo(root: HTMLElement): KeyboardNavigationDemoHandle {
  const document = root.ownerDocument
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Click a cell, then navigate with arrows, Enter, Tab, Home, End, or Page Up/Down"

  const clear = document.createElement("button")
  clear.type = "button"
  clear.textContent = "Clear selection"
  clear.dataset.action = "clear-selection"
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Keyboard navigation controls")
  controls.append(clear)

  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "People directory"
  const description = document.createElement("p")
  description.textContent = "Enter moves down a row; Shift+Enter moves up. Shift+Arrow extends from the selection focus."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host grid-host--scrollable"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "People directory with keyboard navigation",
    rows: [
      { id: "p1", name: "Ada Lovelace", team: "Engine" },
      { id: "p2", name: "Grace Hopper", team: "Platform" },
      { id: "p3", name: "Katherine Johnson", team: "Research" },
      ...Array.from({ length: 12 }, (_, index) => {
        const number = index + 4
        const teams = ["Engine", "Platform", "Research"]
        return { id: `p${number}`, name: `Team member ${number}`, team: teams[index % teams.length]! }
      }),
    ],
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
    ],
  })

  const updateStatus = (): void => {
    const activeCell = grid.api.selection.getSnapshot()?.activeCell
    const row = activeCell ? grid.api.rows.get(activeCell.rowIndex) : null
    const column = activeCell ? grid.api.columns.getSnapshot().visibleColumns[activeCell.colIndex] : null
    status.textContent = row && column
      ? `Active ${row.data.name} · ${column.column.label ?? column.key}`
      : "Click a cell, then navigate with arrows, Enter, Tab, Home, End, or Page Up/Down"
  }
  const onClear = (): void => grid.api.selection.clear({ origin: "datagrid-dom-keyboard-demo" })
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
  const root = document.querySelector<HTMLElement>("#keyboard-demo")
  if (root) {
    const demo = mountKeyboardNavigationDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
