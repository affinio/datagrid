import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import { downloadDataGridDomXlsx, exportDataGridDomXlsx } from "@affino/datagrid-dom/xlsx"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import "./styles.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface SaleRow {
  id: string
  team: string
  quarter: string
  revenue: number
}

const rows: readonly SaleRow[] = [
  { id: "s1", team: "Platform", quarter: "Q1", revenue: 120 },
  { id: "s2", team: "Platform", quarter: "Q2", revenue: 145 },
  { id: "s3", team: "Research", quarter: "Q1", revenue: 80 },
  { id: "s4", team: "Research", quarter: "Q2", revenue: 110 },
  { id: "s5", team: "Operations", quarter: "Q1", revenue: 95 },
  { id: "s6", team: "Operations", quarter: "Q2", revenue: 105 },
]

export interface PivotDemoHandle {
  readonly grid: DataGridDomHandle<SaleRow>
  destroy(): Promise<void>
}

export function mountPivotDemo(root: HTMLElement): PivotDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-panel__header pivot-demo__controls"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Quarterly revenue"
  const description = document.createElement("p")
  description.textContent = "Pivot the Core row projection by team and quarter. Dynamic value columns and totals are rendered by the DOM adapter."
  title.append(heading, description)
  const actions = document.createElement("div")
  actions.className = "pivot-demo__actions"
  const apply = document.createElement("button")
  apply.type = "button"
  apply.textContent = "Show pivot"
  apply.dataset.pivotAction = "apply"
  const clear = document.createElement("button")
  clear.type = "button"
  clear.textContent = "Clear pivot"
  clear.dataset.pivotAction = "clear"
  const exportButton = document.createElement("button")
  exportButton.type = "button"
  exportButton.textContent = "Export pivot XLSX"
  exportButton.dataset.pivotAction = "export"
  exportButton.disabled = true
  const buttonGroup = document.createElement("div")
  buttonGroup.className = "pivot-demo__buttons"
  buttonGroup.append(apply, clear, exportButton)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  actions.append(status, buttonGroup)
  controls.append(title, actions)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Quarterly revenue pivot",
    rows,
    columns: [
      { key: "team", field: "team", label: "Team" },
      { key: "quarter", field: "quarter", label: "Quarter" },
      { key: "revenue", field: "revenue", label: "Revenue", dataType: "currency" },
    ],
  })
  root.replaceChildren(controls, host)

  const updateStatus = (): void => {
    const pivot = grid.api.pivot.getModel()
    const columnCount = grid.api.columns.getSnapshot().visibleColumns
      .filter(column => column.key.startsWith("pivot|")).length
    status.textContent = pivot
      ? `Pivot active · ${columnCount} generated value columns · ${grid.api.rows.getCount()} projected rows`
      : "Source rows · choose Show pivot"
    exportButton.disabled = !pivot
  }
  const onApply = (): void => {
    grid.api.pivot.setModel({
      rows: ["team"],
      columns: ["quarter"],
      values: [{ field: "revenue", agg: "sum" }],
      columnGrandTotal: true,
      grandTotal: true,
    })
    updateStatus()
  }
  const onClear = (): void => {
    grid.api.pivot.setModel(null)
    updateStatus()
  }
  const onExport = async (): Promise<void> => {
    exportButton.disabled = true
    status.textContent = "Preparing pivot workbook…"
    try {
      const result = await exportDataGridDomXlsx(grid.api, {
        fileName: "quarterly-revenue-pivot.xlsx",
        sheetName: "Quarterly revenue",
      })
      if (result.status === "success") {
        downloadDataGridDomXlsx(result, document)
        status.textContent = `Exported ${result.rowCount} projected rows and ${result.columnCount} visible columns.`
      } else {
        status.textContent = result.status === "unsupported" || result.status === "error"
          ? result.message
          : "Export cancelled."
      }
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error)
    } finally {
      exportButton.disabled = grid.api.pivot.getModel() == null
    }
  }
  const unsubscribe = grid.api.events.on("pivot:changed", updateStatus)
  apply.addEventListener("click", onApply)
  clear.addEventListener("click", onClear)
  exportButton.addEventListener("click", onExport)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      apply.removeEventListener("click", onApply)
      clear.removeEventListener("click", onClear)
      exportButton.removeEventListener("click", onExport)
      unsubscribe()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#pivot-demo")
  if (root) {
    const demo = mountPivotDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
