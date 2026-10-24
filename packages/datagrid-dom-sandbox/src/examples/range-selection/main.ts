import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
}

export interface RangeSelectionDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountRangeSelectionDemo(root: HTMLElement): RangeSelectionDemoHandle {
  const document = root.ownerDocument
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Drag to select · Shift-click extends · Ctrl/Cmd-click or drag adds a range"

  const clear = document.createElement("button")
  clear.type = "button"
  clear.textContent = "Clear selection"
  clear.dataset.action = "clear-selection"
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Cell range selection controls")
  controls.append(clear)

  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "People directory"
  const description = document.createElement("p")
  description.textContent = "Selection is stored as a Core range snapshot."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "People directory with range selection",
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
    const snapshot = grid.api.selection.getSnapshot()
    const activeRange = snapshot?.ranges[snapshot.activeRangeIndex]
    if (!activeRange) {
      status.textContent = "Drag to select · Shift-click extends · Ctrl/Cmd-click or drag adds a range"
      return
    }
    const rowCount = activeRange.endRow - activeRange.startRow + 1
    const columnCount = activeRange.endCol - activeRange.startCol + 1
    status.textContent = `Selected ${rowCount} rows × ${columnCount} columns · ${snapshot?.ranges.length ?? 1} range(s)`
  }
  const onClear = (): void => grid.api.selection.clear({ origin: "datagrid-dom-range-demo" })
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
  const root = document.querySelector<HTMLElement>("#range-selection-demo")
  if (root) {
    const demo = mountRangeSelectionDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
