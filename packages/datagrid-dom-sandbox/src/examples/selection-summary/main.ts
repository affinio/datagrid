import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface WorkLogRow {
  id: string
  task: string
  owner: string
  hours: number
  cost: number
}

const rows: readonly WorkLogRow[] = [
  { id: "l1", task: "Selection controller", owner: "Ada", hours: 6, cost: 1200 },
  { id: "l2", task: "Viewport tests", owner: "Grace", hours: 8, cost: 1400 },
  { id: "l3", task: "Keyboard review", owner: "Katherine", hours: 4, cost: 720 },
  { id: "l4", task: "Docs and examples", owner: "Dorothy", hours: 5, cost: 850 },
]

export interface SelectionSummaryDemoHandle {
  readonly grid: DataGridDomHandle<WorkLogRow>
  destroy(): Promise<void>
}

export function mountSelectionSummaryDemo(root: HTMLElement): SelectionSummaryDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Work log selection"
  const description = document.createElement("p")
  description.textContent = "Select a rectangular range and edit Hours or Cost. Core summarizes the selected values; the adapter refreshes the result when selection or row data changes."
  title.append(heading, description)
  const summary = document.createElement("output")
  summary.className = "demo-panel__sort-status selection-summary-demo__output"
  summary.setAttribute("aria-live", "polite")
  header.append(title, summary)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Work log selection summary",
    rows,
    columns: [
      { key: "task", field: "task", label: "Work item" },
      { key: "owner", field: "owner", label: "Owner" },
      { key: "hours", field: "hours", label: "Hours", dataType: "number", capabilities: { editable: true } },
      { key: "cost", field: "cost", label: "Cost", dataType: "currency", capabilities: { editable: true } },
    ],
  })
  root.replaceChildren(header, host)

  const updateSummary = (): void => {
    const result = grid.api.selection.summarize({
      scope: "selected-loaded",
      columns: [
        { key: "hours", aggregations: ["sum", "avg"] },
        { key: "cost", aggregations: ["sum"] },
      ],
    })
    if (!result || result.selectedCells === 0) {
      summary.textContent = "No cells selected"
      return
    }
    const hours = result.columns.hours
    const cost = result.columns.cost
    const format = (value: number | null | undefined): string => (
      value == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)
    )
    summary.textContent = `${result.selectedCells} selected cells across ${result.selectedRows} rows`
      + ` · Hours sum ${format(hours?.metrics.sum)}, average ${format(hours?.metrics.avg)}`
      + ` · Cost sum ${format(cost?.metrics.sum)}`
      + (result.isPartial ? ` · Partial (${result.missingRowCount} rows not loaded)` : "")
  }
  const unsubscribe = [
    grid.api.events.on("selection:changed", updateSummary),
    grid.api.events.on("rows:edited", updateSummary),
    grid.api.events.on("rows:changed", updateSummary),
    grid.api.events.on("projection:recomputed", updateSummary),
  ]
  void grid.ready.then(() => {
    updateSummary()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      for (const dispose of unsubscribe) dispose()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#selection-summary-demo")
  if (root) {
    const demo = mountSelectionSummaryDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
