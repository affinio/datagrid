import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface OrderRow {
  id: string
  order: string
  status: string
  amount: number
}

const rows: readonly OrderRow[] = [
  { id: "o1", order: "SO-1042", status: "Open", amount: 420 },
  { id: "o2", order: "SO-1043", status: "Closed", amount: 185 },
  { id: "o3", order: "SO-1044", status: "Open", amount: 960 },
  { id: "o4", order: "SO-1045", status: "Open", amount: 315 },
  { id: "o5", order: "SO-1046", status: "Closed", amount: 740 },
  { id: "o6", order: "SO-1047", status: "Closed", amount: 125 },
]

export interface AdvancedFilterDemoHandle {
  readonly grid: DataGridDomHandle<OrderRow>
  destroy(): Promise<void>
}

export function mountAdvancedFilterDemo(root: HTMLElement): AdvancedFilterDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Compose order filters")

  const statusLabel = document.createElement("label")
  statusLabel.textContent = "Status is"
  const statusFilter = document.createElement("select")
  statusFilter.dataset.advancedFilterStatus = ""
  statusFilter.setAttribute("aria-label", "Status condition value")
  for (const value of ["Open", "Closed"]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = value
    statusFilter.append(option)
  }
  statusLabel.append(statusFilter)

  const joinLabel = document.createElement("label")
  joinLabel.textContent = "Match"
  const join = document.createElement("select")
  join.dataset.advancedFilterJoin = ""
  join.setAttribute("aria-label", "How to combine conditions")
  for (const [value, text] of [["and", "All conditions (AND)"], ["or", "Any condition (OR)"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = text
    join.append(option)
  }
  joinLabel.append(join)

  const amountLabel = document.createElement("label")
  amountLabel.textContent = "Amount at least"
  const amount = document.createElement("input")
  amount.type = "number"
  amount.min = "0"
  amount.step = "50"
  amount.value = "500"
  amount.dataset.advancedFilterAmount = ""
  amount.setAttribute("aria-label", "Minimum order amount condition")
  amountLabel.append(amount)
  controls.append(statusLabel, joinLabel, amountLabel)

  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"

  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Sales orders"
  const description = document.createElement("p")
  description.textContent = "Combine typed conditions with AND or OR; Core evaluates the expression against each row."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "Sales orders with advanced filter",
    rows,
    columns: [
      { key: "order", field: "order", label: "Order" },
      { key: "status", field: "status", label: "Status" },
      { key: "amount", field: "amount", label: "Amount" },
    ],
  })

  const updateStatus = (): void => {
    const count = grid.api.rows.getCount()
    status.textContent = count + " " + (count === 1 ? "order" : "orders") + " · " + join.value.toUpperCase()
  }
  const applyFilter = (): void => {
    const minimum = Number(amount.value)
    if (!Number.isFinite(minimum)) return
    grid.api.rows.setFilterModel({
      columnFilters: {},
      advancedExpression: {
        kind: "group",
        operator: join.value as "and" | "or",
        children: [
          { kind: "condition", key: "status", type: "text", operator: "equals", value: statusFilter.value },
          { kind: "condition", key: "amount", type: "number", operator: "gte", value: minimum },
        ],
      },
    })
    updateStatus()
  }
  statusFilter.addEventListener("change", applyFilter)
  join.addEventListener("change", applyFilter)
  amount.addEventListener("input", applyFilter)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    applyFilter()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      statusFilter.removeEventListener("change", applyFilter)
      join.removeEventListener("change", applyFilter)
      amount.removeEventListener("input", applyFilter)
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#advanced-filter-demo")
  if (root) {
    const demo = mountAdvancedFilterDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
