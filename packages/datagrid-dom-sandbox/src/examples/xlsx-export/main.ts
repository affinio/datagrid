import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import { downloadDataGridDomXlsx, exportDataGridDomXlsx } from "@affino/datagrid-dom/xlsx"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import "./styles.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface SalesRow {
  id: string
  order: string
  region: string
  product: string
  unitPrice: number
  quantity: number
  total?: number
}

export interface XlsxExportDemoHandle {
  readonly grid: DataGridDomHandle<SalesRow>
  destroy(): Promise<void>
}

function createRows(): SalesRow[] {
  const regions = ["North", "South", "East", "West"]
  const products = ["Desk lamp", "Monitor", "Keyboard", "Notebook set"]
  return Array.from({ length: 2_000 }, (_, index) => ({
    id: `order-${index + 1}`,
    order: `SO-${String(index + 1).padStart(5, "0")}`,
    region: regions[index % regions.length]!,
    product: products[index % products.length]!,
    unitPrice: [42.5, 249.99, 76.25, 18][index % 4]!,
    quantity: index % 9 + 1,
  }))
}

export function mountXlsxExportDemo(root: HTMLElement): XlsxExportDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Export a sorted, virtualized grid"
  const description = document.createElement("p")
  description.textContent = "Click a column header to sort. The workbook contains every row in the current Core projection, including rows outside the mounted viewport."
  const title = document.createElement("div")
  title.className = "demo-panel__header"
  title.append(heading, description)

  const exportButton = document.createElement("button")
  exportButton.type = "button"
  exportButton.textContent = "Export XLSX"
  exportButton.dataset.xlsxExport = ""
  const groupButton = document.createElement("button")
  groupButton.type = "button"
  groupButton.textContent = "Group by region"
  groupButton.dataset.xlsxGroup = ""
  const status = document.createElement("output")
  status.className = "demo-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Ready to export 2,000 projected rows."
  const toolbar = document.createElement("div")
  toolbar.className = "xlsx-export-demo__toolbar"
  toolbar.append(exportButton, groupButton, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(title, toolbar, host)

  const grid = mountDataGrid(host, {
    label: "Sales orders for XLSX export",
    rows: createRows(),
    rowVirtualization: { rowHeight: 36, overscan: 6 },
    formulas: [{ name: "total", formula: "unitPrice * quantity" }],
    cellStyle: (_row, _rowIndex, column) => column.key === "total"
      ? { backgroundColor: "#eaf2fb", fontWeight: "700" }
      : column.key === "order"
        ? { color: "#245ea8" }
        : null,
    columns: [
      { key: "order", field: "order", label: "Order", initialState: { width: 150 }, export: { dataType: "text", style: { fontColor: "245EA8" } } },
      { key: "region", field: "region", label: "Region", initialState: { width: 150 }, export: { dataType: "text" } },
      { key: "product", field: "product", label: "Product", initialState: { width: 190 }, export: { dataType: "text" } },
      { key: "unitPrice", field: "unitPrice", label: "Unit price", dataType: "currency", initialState: { width: 150 }, export: { dataType: "currency", numberFormat: '"$"#,##0.00' } },
      { key: "quantity", field: "quantity", label: "Qty", dataType: "number", initialState: { width: 110 }, export: { dataType: "number", numberFormat: "0" } },
      { key: "total", field: "total", label: "Total", dataType: "currency", initialState: { width: 150 }, export: { dataType: "currency", numberFormat: '"$"#,##0.00', style: { bold: true, fillColor: "EAF2FB" } } },
    ],
  })

  let exporting = false
  let grouped = false
  const onGroup = (): void => {
    grouped = !grouped
    if (grouped) {
      grid.api.rows.setGroupBy({ fields: ["region"], expandedByDefault: true })
      grid.api.rows.setAggregationModel({ basis: "filtered", columns: [{ key: "total", field: "total", op: "sum" }] })
      groupButton.textContent = "Clear grouping"
      status.textContent = "Grouped by region; group totals export as Excel SUBTOTAL formulas."
    } else {
      grid.api.rows.setGroupBy(null)
      grid.api.rows.setAggregationModel(null)
      groupButton.textContent = "Group by region"
      status.textContent = "Ready to export the current projected rows."
    }
  }
  const onExport = async (): Promise<void> => {
    if (exporting) return
    exporting = true
    exportButton.disabled = true
    status.textContent = "Preparing workbook…"
    try {
      const result = await exportDataGridDomXlsx(grid.api, {
        fileName: "sales-orders.xlsx",
        sheetName: "Sales orders",
        formulas: "excel",
      })
      if (result.status === "success") {
        downloadDataGridDomXlsx(result, document)
        status.textContent = `Exported ${result.rowCount.toLocaleString()} rows and ${result.columnCount} columns.`
      } else {
        status.textContent = result.status === "unsupported" || result.status === "error"
          ? result.message
          : "Export cancelled."
      }
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error)
    } finally {
      exporting = false
      exportButton.disabled = false
    }
  }
  exportButton.addEventListener("click", onExport)
  groupButton.addEventListener("click", onGroup)
  void grid.ready.then(() => finishDemoLoading(document)).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      exportButton.removeEventListener("click", onExport)
      groupButton.removeEventListener("click", onGroup)
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#xlsx-export-demo")
  if (root) {
    const demo = mountXlsxExportDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
