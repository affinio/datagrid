import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
  office: string
}

const rows: readonly PersonRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine", office: "London" },
  { id: "p2", name: "Grace Hopper", team: "Platform", office: "Arlington" },
  { id: "p3", name: "Katherine Johnson", team: "Research", office: "Hampton" },
  { id: "p4", name: "Dorothy Vaughan", team: "Analysis", office: "Hampton" },
]

export interface RangeMoveDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountRangeMoveDemo(root: HTMLElement): RangeMoveDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Editable people directory"
  const description = document.createElement("p")
  description.textContent = "Select a rectangular range, then drag from its outer edge to move the values. Undo restores the source and destination."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"
  header.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Move selected cell range",
    rows,
    columns: [
      { key: "name", field: "name", label: "Name", capabilities: { editable: true } },
      { key: "team", field: "team", label: "Team", capabilities: { editable: true } },
      { key: "office", field: "office", label: "Office", capabilities: { editable: true } },
    ],
  })
  root.replaceChildren(header, host)

  const updateStatus = (): void => {
    const gridElement = host.querySelector<HTMLElement>(".affino-grid-dom")
    status.textContent = gridElement?.dataset.rangeMoveAction
      ?? "Shift-click a second cell to select a rectangle, then drag within it."
  }
  const onPointerUp = (): void => { window.setTimeout(updateStatus, 0) }
  host.addEventListener("pointerup", onPointerUp)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

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
  const root = document.querySelector<HTMLElement>("#range-move-demo")
  if (root) {
    const demo = mountRangeMoveDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
