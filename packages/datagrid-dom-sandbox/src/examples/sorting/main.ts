import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
}

export interface SortingDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountSortingDemo(root: HTMLElement): SortingDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Sort people")

  const ascending = createSortButton(document, "Name A to Z", "asc")
  const descending = createSortButton(document, "Name Z to A", "desc")
  const clear = document.createElement("button")
  clear.type = "button"
  clear.textContent = "Clear sort"
  clear.dataset.sortDirection = "none"

  controls.append(ascending, descending, clear)

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
  description.textContent = "Click a header to sort; Shift-click adds another sort key. The buttons below use the same Core API."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "Sortable people directory",
    rows: [
      { id: "p3", name: "Katherine Johnson", team: "Research" },
      { id: "p1", name: "Ada Lovelace", team: "Engine" },
      { id: "p2", name: "Grace Hopper", team: "Platform" },
    ],
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
    ],
  })

  const syncControls = (): void => {
    const sort = grid.api.rows.getSnapshot().sortModel.find(item => item.key === "name")
    ascending.setAttribute("aria-pressed", String(sort?.direction === "asc"))
    descending.setAttribute("aria-pressed", String(sort?.direction === "desc"))
    status.textContent = sort
      ? `Sorted by Name · ${sort.direction === "asc" ? "A to Z" : "Z to A"} · ${grid.api.rows.getCount()} rows`
      : `${grid.api.rows.getCount()} rows · Original order`
  }

  const setSort = (direction: "asc" | "desc" | null): void => {
    grid.api.rows.setSortModel(direction ? [{ key: "name", direction }] : [])
    syncControls()
  }
  const onAscending = (): void => setSort("asc")
  const onDescending = (): void => setSort("desc")
  const onClear = (): void => setSort(null)
  ascending.addEventListener("click", onAscending)
  descending.addEventListener("click", onDescending)
  clear.addEventListener("click", onClear)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", syncControls)
  void grid.ready.then(() => {
    syncControls()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      ascending.removeEventListener("click", onAscending)
      descending.removeEventListener("click", onDescending)
      clear.removeEventListener("click", onClear)
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

function createSortButton(document: Document, label: string, direction: "asc" | "desc"): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  button.dataset.sortDirection = direction
  button.setAttribute("aria-pressed", "false")
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#sorting-demo")
  if (root) {
    const demo = mountSortingDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
