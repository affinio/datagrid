import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface OrderRow {
  id: string
  order: string
  customer: string
  amount: number
}

const rows: readonly OrderRow[] = [
  { id: "o1", order: "SO-1042", customer: "Northstar Labs", amount: 420 },
  { id: "o2", order: "SO-1043", customer: "Cedar Works", amount: 185 },
  { id: "o3", order: "SO-1044", customer: "Northstar Labs", amount: 960 },
  { id: "o4", order: "SO-1045", customer: "Juniper Systems", amount: 315 },
  { id: "o5", order: "SO-1046", customer: "Cedar Works", amount: 740 },
  { id: "o6", order: "SO-1047", customer: "Juniper Systems", amount: 125 },
]

export interface ConditionFilterDemoHandle {
  readonly grid: DataGridDomHandle<OrderRow>
  destroy(): Promise<void>
}

export function mountConditionFilterDemo(root: HTMLElement): ConditionFilterDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Filter orders by amount")

  const operationLabel = document.createElement("label")
  operationLabel.textContent = "Amount"
  const operation = document.createElement("select")
  operation.dataset.conditionFilterOperator = ""
  operation.setAttribute("aria-label", "Amount filter condition")
  for (const [value, text] of [["gte", "At least"], ["lte", "At most"], ["between", "Between"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = text
    operation.append(option)
  }
  operationLabel.append(operation)

  const valueLabel = document.createElement("label")
  valueLabel.textContent = "Value"
  const value = document.createElement("input")
  value.type = "number"
  value.min = "0"
  value.step = "25"
  value.value = "300"
  value.dataset.conditionFilterValue = ""
  value.setAttribute("aria-label", "Amount filter value")
  valueLabel.append(value)

  const upperLabel = document.createElement("label")
  upperLabel.dataset.conditionFilterUpperLabel = ""
  upperLabel.textContent = "And up to"
  const upper = document.createElement("input")
  upper.type = "number"
  upper.min = "0"
  upper.step = "25"
  upper.value = "750"
  upper.dataset.conditionFilterUpper = ""
  upper.setAttribute("aria-label", "Maximum amount filter value")
  upperLabel.append(upper)
  upperLabel.hidden = true
  controls.append(operationLabel, valueLabel, upperLabel)

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
  description.textContent = "A numeric predicate filters the Core row projection without changing source rows."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "Sales orders with amount condition filter",
    rows,
    columns: [
      { key: "order", field: "order", label: "Order" },
      { key: "customer", field: "customer", label: "Customer" },
      { key: "amount", field: "amount", label: "Amount" },
    ],
  })

  const updateStatus = (): void => {
    const count = grid.api.rows.getCount()
    const phrase = operation.value === "between"
      ? "$" + value.value + "–$" + upper.value
      : (operation.value === "gte" ? "≥ $" : "≤ $") + value.value
    status.textContent = count + " " + (count === 1 ? "order" : "orders") + " · " + phrase
  }
  const applyFilter = (): void => {
    upperLabel.hidden = operation.value !== "between"
    const lowerAmount = Number(value.value)
    const upperAmount = Number(upper.value)
    if (!Number.isFinite(lowerAmount) || !Number.isFinite(upperAmount)) return
    const predicate = operation.value === "between"
      ? { kind: "predicate" as const, operator: "between" as const, value: lowerAmount, value2: upperAmount }
      : { kind: "predicate" as const, operator: operation.value as "gte" | "lte", value: lowerAmount }
    grid.api.rows.setFilterModel({ columnFilters: { amount: predicate } })
    updateStatus()
  }
  operation.addEventListener("change", applyFilter)
  value.addEventListener("input", applyFilter)
  upper.addEventListener("input", applyFilter)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    applyFilter()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      operation.removeEventListener("change", applyFilter)
      value.removeEventListener("input", applyFilter)
      upper.removeEventListener("input", applyFilter)
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#condition-filter-demo")
  if (root) {
    const demo = mountConditionFilterDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
