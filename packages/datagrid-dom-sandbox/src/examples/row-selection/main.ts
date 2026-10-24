import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
  role: string
}

export interface RowSelectionDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountRowSelectionDemo(root: HTMLElement): RowSelectionDemoHandle {
  const document = root.ownerDocument
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  const selectVisible = createButton(document, "Select visible", "select-visible")
  const clear = createButton(document, "Clear records", "clear")
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Record selection controls")
  controls.append(selectVisible, clear, status)

  const heading = document.createElement("h2")
  heading.textContent = "Team directory"
  const description = document.createElement("p")
  description.textContent = "Select records with checkboxes; Shift-click extends a record range. Record selection stays independent from cell selection."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)
  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(header, controls, host)

  const grid = mountDataGrid(host, {
    label: "Team directory with record selection",
    rowSelection: true,
    rows: [
      { id: "p1", name: "Ada Lovelace", team: "Engine", role: "Architect" },
      { id: "p2", name: "Grace Hopper", team: "Platform", role: "Compiler lead" },
      { id: "p3", name: "Katherine Johnson", team: "Research", role: "Analyst" },
      { id: "p4", name: "Radia Perlman", team: "Network", role: "Engineer" },
    ],
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
      { key: "role", field: "role", label: "Role" },
    ],
  })

  const syncStatus = (): void => {
    const selected = Array.from({ length: grid.api.rows.getCount() }, (_, index) => grid.api.rows.get(index))
      .flatMap(row => row?.kind === "leaf" && grid.api.rowSelection.isSelected(row.rowId) ? [row.rowId] : [])
    status.textContent = selected.length === 0
      ? "No records selected"
      : `${selected.length} selected · ${selected.join(", ")}`
  }
  const onSelectVisible = (): void => {
    const rowIds = Array.from({ length: grid.api.rows.getCount() }, (_, index) => grid.api.rows.get(index))
      .flatMap(row => row?.kind === "leaf" ? [row.rowId] : [])
    grid.api.rowSelection.selectRows(rowIds, { origin: "datagrid-dom-row-selection-demo" })
  }
  const onClear = (): void => grid.api.rowSelection.clearSelectedRows({ origin: "datagrid-dom-row-selection-demo" })
  selectVisible.addEventListener("click", onSelectVisible)
  clear.addEventListener("click", onClear)
  const unsubscribe = grid.api.events.on("row-selection:changed", syncStatus)
  void grid.ready.then(() => {
    syncStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      selectVisible.removeEventListener("click", onSelectVisible)
      clear.removeEventListener("click", onClear)
      unsubscribe()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

function createButton(document: Document, text: string, action: string): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = text
  button.dataset.action = action
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#row-selection-demo")
  if (root) {
    const demo = mountRowSelectionDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
