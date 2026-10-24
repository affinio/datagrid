import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface CanvasChromeRow {
  id: string
  name: string
  department: string
  title: string
  status: string
  value: number
  office: string
  manager: string
  region: string
}

export interface CanvasChromeDemoHandle {
  readonly grid: DataGridDomHandle<CanvasChromeRow>
  destroy(): Promise<void>
}

function createRows(): CanvasChromeRow[] {
  return Array.from({ length: 2_000 }, (_, index) => ({
    id: `person-${index + 1}`,
    name: `Person ${String(index + 1).padStart(4, "0")}`,
    department: ["Engineering", "Finance", "Operations", "Research"][index % 4]!,
    title: ["Analyst", "Engineer", "Planner", "Researcher"][index % 4]!,
    status: index % 7 === 0 ? "Review" : "Active",
    value: 1_200 + index * 37,
    office: ["London", "Dublin", "Austin", "Toronto"][index % 4]!,
    manager: ["Mina", "Noah", "Iris", "Dorothy"][index % 4]!,
    region: ["North", "South", "East", "West"][index % 4]!,
  }))
}

export function mountCanvasChromeDemo(root: HTMLElement): CanvasChromeDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Canvas grid lines, DOM cells"
  const description = document.createElement("p")
  description.textContent = "Scroll both axes. Grid lines use the Canvas chrome layer while cell content and accessibility stay in the DOM."
  title.append(heading, description)
  header.append(title)

  const host = document.createElement("div")
  host.className = "grid-host--canvas-chrome"
  root.replaceChildren(header, host)

  const grid = mountDataGrid(host, {
    label: "Canvas chrome example",
    className: "affino-grid-dom--canvas-chrome-demo",
    rows: createRows(),
    rowSelection: true,
    gridChrome: "canvas",
    rowVirtualization: { rowHeight: 36, overscan: 8 },
    columnVirtualization: { overscan: 3 },
    columns: [
      { key: "name", field: "name", label: "Name", initialState: { width: 190, pin: "left" } },
      { key: "department", field: "department", label: "Department", initialState: { width: 180 } },
      { key: "title", field: "title", label: "Job title", initialState: { width: 180 } },
      { key: "status", field: "status", label: "Status", initialState: { width: 140 } },
      { key: "value", field: "value", label: "Annual value", dataType: "currency", initialState: { width: 180 } },
      { key: "office", field: "office", label: "Office", initialState: { width: 180 } },
      { key: "manager", field: "manager", label: "Manager", initialState: { width: 180 } },
      { key: "region", field: "region", label: "Region", initialState: { width: 130, pin: "right" } },
    ],
  })
  void grid.ready.then(() => finishDemoLoading(document)).catch(() => failDemoLoading(document))
  return {
    grid,
    async destroy() {
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#canvas-chrome-demo")
  if (root) {
    const demo = mountCanvasChromeDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
