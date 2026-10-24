import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface BudgetRow {
  id: string
  team: string
  project: string
  quarter: string
  spend: number
  hours: number
}

const rows: readonly BudgetRow[] = [
  { id: "b1", team: "Platform", project: "Grid runtime", quarter: "Q1", spend: 18_400, hours: 124 },
  { id: "b2", team: "Platform", project: "Virtualization", quarter: "Q1", spend: 12_600, hours: 96 },
  { id: "b3", team: "Platform", project: "Grid runtime", quarter: "Q2", spend: 21_800, hours: 138 },
  { id: "b4", team: "Research", project: "Formula engine", quarter: "Q1", spend: 15_200, hours: 112 },
  { id: "b5", team: "Research", project: "Formula engine", quarter: "Q2", spend: 17_600, hours: 128 },
  { id: "b6", team: "Research", project: "Analytics", quarter: "Q2", spend: 9_800, hours: 74 },
  { id: "b7", team: "Operations", project: "Release tooling", quarter: "Q1", spend: 8_400, hours: 68 },
  { id: "b8", team: "Operations", project: "Release tooling", quarter: "Q2", spend: 10_200, hours: 82 },
]

export interface AggregationDemoHandle {
  readonly grid: DataGridDomHandle<BudgetRow>
  destroy(): Promise<void>
}

export function mountAggregationDemo(root: HTMLElement): AggregationDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Quarterly project spend"
  const description = document.createElement("p")
  description.textContent = "Change the aggregation operation. Core recomputes values for every team group; expand a team to inspect its source rows."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  header.append(title, status)

  const controls = document.createElement("div")
  controls.className = "demo-controls"
  const operationLabel = document.createElement("label")
  operationLabel.textContent = "Spend operation"
  const operation = document.createElement("select")
  operation.dataset.aggregationOperation = ""
  for (const [value, label] of [
    ["sum", "Sum"],
    ["avg", "Average"],
    ["min", "Minimum"],
    ["max", "Maximum"],
    ["count", "Count"],
  ]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    operation.append(option)
  }
  operationLabel.append(operation)
  const basisLabel = document.createElement("label")
  basisLabel.textContent = "Aggregation basis"
  const basis = document.createElement("select")
  basis.dataset.aggregationBasis = ""
  for (const [value, label] of [["filtered", "Filtered rows"], ["source", "All source rows"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    basis.append(option)
  }
  basisLabel.append(basis)
  const quarterLabel = document.createElement("label")
  quarterLabel.textContent = "Filter quarter"
  const quarter = document.createElement("select")
  quarter.dataset.aggregationQuarter = ""
  for (const [value, label] of [["", "All quarters"], ["Q1", "Q1"], ["Q2", "Q2"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    quarter.append(option)
  }
  quarterLabel.append(quarter)
  const expand = createButton(document, "Expand all", "expand")
  const collapse = createButton(document, "Collapse all", "collapse")
  controls.append(operationLabel, basisLabel, quarterLabel, expand, collapse)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Project spend grouped by team",
    rows,
    columns: [
      { key: "project", field: "project", label: "Project", columnGroup: [{ id: "work", label: "Work" }] },
      { key: "quarter", field: "quarter", label: "Quarter", columnGroup: [{ id: "work", label: "Work" }] },
      { key: "spend", field: "spend", label: "Spend", dataType: "currency", columnGroup: [{ id: "metrics", label: "Metrics" }] },
      { key: "hours", field: "hours", label: "Hours", dataType: "number", columnGroup: [{ id: "metrics", label: "Metrics" }] },
    ],
  })
  root.replaceChildren(header, controls, host)

  const applyAggregation = (): void => {
    grid.api.rows.setAggregationModel({
      basis: basis.value as "filtered" | "source",
      columns: [
        { key: "spend", field: "spend", op: operation.value as "sum" | "avg" | "min" | "max" | "count" },
        { key: "hours", field: "hours", op: "sum" },
      ],
    })
    updateStatus()
  }
  const onQuarterChange = (): void => {
    grid.api.rows.setFilterModel(quarter.value
      ? { columnFilters: { quarter: { kind: "valueSet", tokens: [`string:${quarter.value}`] } } }
      : null)
  }
  const updateStatus = (): void => {
    const groups = Array.from({ length: grid.api.rows.getCount() }, (_, index) => grid.api.rows.get(index))
      .filter(row => row?.kind === "group")
    status.textContent = `${groups.length} team groups · ${operation.options[operation.selectedIndex]?.textContent} spend · ${basis.options[basis.selectedIndex]?.textContent?.toLowerCase()}`
  }
  const onExpand = (): void => grid.api.rows.expandAllGroups()
  const onCollapse = (): void => grid.api.rows.collapseAllGroups()
  operation.addEventListener("change", applyAggregation)
  basis.addEventListener("change", applyAggregation)
  quarter.addEventListener("change", onQuarterChange)
  expand.addEventListener("click", onExpand)
  collapse.addEventListener("click", onCollapse)
  const unsubscribe = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    grid.api.rows.setGroupBy({ fields: ["team"], expandedByDefault: true })
    applyAggregation()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      operation.removeEventListener("change", applyAggregation)
      basis.removeEventListener("change", applyAggregation)
      quarter.removeEventListener("change", onQuarterChange)
      expand.removeEventListener("click", onExpand)
      collapse.removeEventListener("click", onCollapse)
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
  button.dataset.aggregationAction = action
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#aggregation-demo")
  if (root) {
    const demo = mountAggregationDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
