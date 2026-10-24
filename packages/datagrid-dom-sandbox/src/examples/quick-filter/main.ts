import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
  location: string
}

const rows: readonly PersonRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine", location: "London" },
  { id: "p2", name: "Grace Hopper", team: "Platform", location: "Arlington" },
  { id: "p3", name: "Katherine Johnson", team: "Research", location: "Hampton" },
  { id: "p4", name: "Margaret Hamilton", team: "Engine", location: "Cambridge" },
  { id: "p5", name: "Dorothy Vaughan", team: "Research", location: "Hampton" },
  { id: "p6", name: "Mary Jackson", team: "Flight", location: "Hampton" },
]

export interface QuickFilterDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountQuickFilterDemo(root: HTMLElement): QuickFilterDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Search people")

  const label = document.createElement("label")
  label.textContent = "Search"
  const input = document.createElement("input")
  input.type = "search"
  input.placeholder = "Name, team, or location"
  input.dataset.quickFilter = ""
  input.setAttribute("aria-label", "Search name, team, or location")
  label.append(input)

  const modeLabel = document.createElement("label")
  modeLabel.textContent = "Match"
  const mode = document.createElement("select")
  mode.dataset.quickFilterMode = ""
  mode.setAttribute("aria-label", "Quick filter match mode")
  for (const [value, text] of [["contains", "Phrase"], ["tokens", "All words"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = text
    mode.append(option)
  }
  modeLabel.append(mode)
  controls.append(label, modeLabel)

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
  description.textContent = "Search spans name, team, and location; all-word mode can match words across columns."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "People directory with quick filter",
    rows,
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
      { key: "location", field: "location", label: "Location" },
    ],
  })

  const updateStatus = (): void => {
    const count = grid.api.rows.getCount()
    status.textContent = `${count} ${count === 1 ? "row" : "rows"} · ${input.value.trim() || "All people"}`
  }
  const applyFilter = (): void => {
    const query = input.value.trim()
    grid.api.rows.setFilterModel(query
      ? { columnFilters: {}, quickFilter: { query, columns: ["name", "team", "location"], mode: mode.value as "contains" | "tokens" } }
      : null)
    updateStatus()
  }
  input.addEventListener("input", applyFilter)
  mode.addEventListener("change", applyFilter)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      input.removeEventListener("input", applyFilter)
      mode.removeEventListener("change", applyFilter)
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#quick-filter-demo")
  if (root) {
    const demo = mountQuickFilterDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
