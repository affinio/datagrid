import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
  region: string
}

const rows: readonly PersonRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine", region: "East" },
  { id: "p2", name: "Grace Hopper", team: "Platform", region: "East" },
  { id: "p3", name: "Katherine Johnson", team: "Research", region: "West" },
  { id: "p4", name: "Margaret Hamilton", team: "Engine", region: "West" },
  { id: "p5", name: "Dorothy Vaughan", team: "Research", region: "East" },
  { id: "p6", name: "Mary Jackson", team: "Flight", region: "West" },
]

export interface HistogramDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountHistogramDemo(root: HTMLElement): HistogramDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Filter histogram values")

  const regionLabel = document.createElement("label")
  regionLabel.textContent = "Region"
  const region = document.createElement("select")
  region.dataset.histogramRegion = ""
  region.setAttribute("aria-label", "Filter by region")
  for (const [value, text] of [["", "All regions"], ["East", "East"], ["West", "West"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = text
    region.append(option)
  }
  regionLabel.append(region)

  const searchLabel = document.createElement("label")
  searchLabel.textContent = "Find team"
  const search = document.createElement("input")
  search.type = "search"
  search.placeholder = "Search values"
  search.dataset.histogramSearch = ""
  search.setAttribute("aria-label", "Search histogram values")
  searchLabel.append(search)
  const clear = document.createElement("button")
  clear.type = "button"
  clear.textContent = "Clear team filter"
  clear.dataset.histogramClear = ""
  controls.append(regionLabel, searchLabel, clear)

  const histogramPanel = document.createElement("section")
  histogramPanel.className = "histogram-demo"
  histogramPanel.setAttribute("aria-label", "Team value histogram")
  const histogramHeading = document.createElement("h3")
  histogramHeading.textContent = "Teams"
  const histogramHint = document.createElement("p")
  histogramHint.textContent = "Counts honor the region filter and ignore this team's own filter."
  const values = document.createElement("div")
  values.className = "histogram-demo__values"
  values.setAttribute("role", "list")
  const histogramStatus = document.createElement("output")
  histogramStatus.setAttribute("aria-live", "polite")
  histogramStatus.textContent = "Loading values…"
  histogramPanel.append(histogramHeading, histogramHint, histogramStatus, values)

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
  description.textContent = "Core provides distinct values and counts for filter controls, independently of the rendered rows."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, histogramPanel, host)

  const grid = mountDataGrid(host, {
    label: "People directory with team histogram",
    rows,
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
      { key: "region", field: "region", label: "Region" },
    ],
  })
  let selectedTeam: string | null = null
  let histogramRequest = 0

  const updateStatus = (): void => {
    const count = grid.api.rows.getCount()
    status.textContent = count + " " + (count === 1 ? "person" : "people") + " · " + (region.value || "all regions")
  }
  const renderHistogram = async (): Promise<void> => {
    const requestId = ++histogramRequest
    try {
      const entries = await grid.api.columns.getHistogram("team", {
        scope: "filtered",
        ignoreSelfFilter: true,
        search: search.value,
        orderBy: "valueAsc",
      })
      if (requestId !== histogramRequest) return
      values.replaceChildren()
      histogramStatus.textContent = entries.length + " " + (entries.length === 1 ? "team" : "teams")
      for (const entry of entries) {
        const item = document.createElement("div")
        item.setAttribute("role", "listitem")
        const button = document.createElement("button")
        button.type = "button"
        button.className = "histogram-demo__value"
        button.setAttribute("aria-pressed", String(selectedTeam === String(entry.value)))
        button.dataset.histogramToken = entry.token
        const name = document.createElement("span")
        name.textContent = entry.text ?? String(entry.value)
        const count = document.createElement("span")
        count.className = "histogram-demo__count"
        count.textContent = String(entry.count)
        button.append(name, count)
        button.addEventListener("click", () => {
          selectedTeam = selectedTeam === String(entry.value) ? null : String(entry.value)
          applyFilters()
        }, { once: true })
        item.append(button)
        values.append(item)
      }
    } catch {
      if (requestId === histogramRequest) histogramStatus.textContent = "Histogram unavailable"
    }
  }
  const applyFilters = (): void => {
    const columnFilters: Record<string, { kind: "valueSet"; tokens: string[] }> = {}
    if (region.value) columnFilters.region = { kind: "valueSet", tokens: ["string:" + region.value] }
    if (selectedTeam) columnFilters.team = { kind: "valueSet", tokens: ["string:" + selectedTeam] }
    grid.api.rows.setFilterModel({ columnFilters })
    updateStatus()
    void renderHistogram()
  }
  const onRegionChange = (): void => applyFilters()
  const onSearch = (): void => void renderHistogram()
  const onClear = (): void => {
    selectedTeam = null
    applyFilters()
  }
  region.addEventListener("change", onRegionChange)
  search.addEventListener("input", onSearch)
  clear.addEventListener("click", onClear)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    updateStatus()
    void renderHistogram()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      histogramRequest += 1
      region.removeEventListener("change", onRegionChange)
      search.removeEventListener("input", onSearch)
      clear.removeEventListener("click", onClear)
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#histogram-demo")
  if (root) {
    const demo = mountHistogramDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
