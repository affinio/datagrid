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
  { id: "p4", name: "Margaret Hamilton", team: "Engine" },
  { id: "p5", name: "Dorothy Vaughan", team: "Research" },
]

export interface FilteringDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountFilteringDemo(root: HTMLElement): FilteringDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Filter people by team")

  const label = document.createElement("label")
  label.textContent = "Team"
  const filter = document.createElement("select")
  filter.dataset.filterTeam = ""
  filter.setAttribute("aria-label", "Filter by team")
  for (const [value, text] of [["", "All teams"], ["Engine", "Engine"], ["Platform", "Platform"], ["Research", "Research"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = text
    filter.append(option)
  }
  label.append(filter)
  controls.append(label)

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
  description.textContent = "The team filter is stored and applied by the Core row model."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "People directory with team filter",
    rows,
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
    ],
  })

  const updateStatus = (): void => {
    const count = grid.api.rows.getCount()
    status.textContent = `${count} ${count === 1 ? "row" : "rows"} · ${filter.value || "All teams"}`
  }
  const onFilterChange = (): void => {
    grid.api.rows.setFilterModel(filter.value
      ? { columnFilters: { team: { kind: "valueSet", tokens: [`string:${filter.value}`] } } }
      : null)
    updateStatus()
  }
  filter.addEventListener("change", onFilterChange)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      filter.removeEventListener("change", onFilterChange)
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#filtering-demo")
  if (root) {
    const demo = mountFilteringDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
