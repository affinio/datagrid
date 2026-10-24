import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
}

const rows: readonly PersonRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine" },
  { id: "p2", name: "Grace Hopper", team: "Platform" },
  { id: "p3", name: "Katherine Johnson", team: "Research" },
]

export interface EmptyStateDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountEmptyStateDemo(root: HTMLElement): EmptyStateDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Change empty state")

  const noRows = createButton(document, "No rows", "no-rows")
  const noMatches = createButton(document, "No filter matches", "filtered")
  const restore = createButton(document, "Restore rows", "restore")
  controls.append(noRows, noMatches, restore)

  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"

  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Empty state"
  const description = document.createElement("p")
  description.textContent = "The adapter distinguishes empty data from a filter with no matches."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid<PersonRow>(host, {
    label: "People directory empty state example",
    rows: [],
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
    ],
    emptyStateAlignment: "viewport",
    emptyState: ({ reason, hasActiveFilters }) => {
      const message = document.createElement("div")
      message.className = "empty-state-example"
      const title = document.createElement("strong")
      title.textContent = reason === "filtered" ? "No matching people" : "No people yet"
      const detail = document.createElement("span")
      detail.textContent = hasActiveFilters
        ? "Clear or change the active filter to see rows."
        : "Restore the example rows to continue."
      message.append(title, detail)
      return message
    },
  })

  const updateStatus = (): void => {
    const snapshot = grid.api.rows.getSnapshot()
    const count = grid.api.rows.getCount()
    status.textContent = `${count} ${count === 1 ? "row" : "rows"} · ${snapshot.filterModel ? "filter active" : "no filter"}`
  }
  const onNoRows = (): void => {
    grid.api.rows.setFilterModel(null)
    grid.api.rows.setData([])
    updateStatus()
  }
  const onNoMatches = (): void => {
    grid.api.rows.setData(rows)
    grid.api.rows.setFilterModel({ columnFilters: { team: { kind: "valueSet", tokens: ["string:Missing"] } } })
    updateStatus()
  }
  const onRestore = (): void => {
    grid.api.rows.setFilterModel(null)
    grid.api.rows.setData(rows)
    updateStatus()
  }
  noRows.addEventListener("click", onNoRows)
  noMatches.addEventListener("click", onNoMatches)
  restore.addEventListener("click", onRestore)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      noRows.removeEventListener("click", onNoRows)
      noMatches.removeEventListener("click", onNoMatches)
      restore.removeEventListener("click", onRestore)
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
  button.dataset.emptyStateAction = action
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#empty-state-demo")
  if (root) {
    const demo = mountEmptyStateDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
