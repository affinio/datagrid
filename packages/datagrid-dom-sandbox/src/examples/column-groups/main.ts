import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface SalesRow {
  id: string
  region: string
  team: string
  revenue: number
  margin: number
  orders: number
  quarter: string
}

const rows: readonly SalesRow[] = [
  { id: "r1", region: "North", team: "Platform", revenue: 128_400, margin: 0.34, orders: 184, quarter: "Q1" },
  { id: "r2", region: "West", team: "Research", revenue: 96_250, margin: 0.29, orders: 132, quarter: "Q1" },
  { id: "r3", region: "East", team: "Operations", revenue: 154_800, margin: 0.38, orders: 216, quarter: "Q1" },
]

export interface ColumnGroupsDemoHandle {
  readonly grid: DataGridDomHandle<SalesRow>
  destroy(): Promise<void>
}

export function mountColumnGroupsDemo(root: HTMLElement): ColumnGroupsDemoHandle {
  const document = root.ownerDocument
  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Regional sales"
  const description = document.createElement("p")
  description.textContent = "Column groups use Core columnGroup metadata. Nested headings stay aligned across pinned and center panes."
  title.append(heading, description)
  panelHeader.append(title)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Regional sales by team",
    rows,
    columns: [
      {
        key: "region",
        field: "region",
        label: "Region",
        columnGroup: [{ id: "organization", label: "Organization" }],
        initialState: { pin: "left", width: 140 },
      },
      {
        key: "team",
        field: "team",
        label: "Team",
        columnGroup: [
          { id: "organization", label: "Organization" },
          { id: "team-profile", label: "Team profile" },
        ],
        initialState: { width: 160 },
      },
      {
        key: "revenue",
        field: "revenue",
        label: "Revenue",
        dataType: "currency",
        columnGroup: [
          { id: "performance", label: "Performance" },
          { id: "financial", label: "Financial" },
        ],
        initialState: { width: 160 },
      },
      {
        key: "margin",
        field: "margin",
        label: "Margin",
        dataType: "percent",
        columnGroup: [
          { id: "performance", label: "Performance" },
          { id: "financial", label: "Financial" },
        ],
        initialState: { width: 130 },
      },
      {
        key: "orders",
        field: "orders",
        label: "Orders",
        dataType: "number",
        columnGroup: [
          { id: "performance", label: "Performance" },
          { id: "volume", label: "Volume" },
        ],
        initialState: { width: 130 },
      },
      {
        key: "quarter",
        field: "quarter",
        label: "Quarter",
        columnGroup: [{ id: "period", label: "Period" }],
        initialState: { width: 120 },
      },
    ],
  })
  root.replaceChildren(panelHeader, host)

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
  const root = document.querySelector<HTMLElement>("#column-groups-demo")
  if (root) {
    const demo = mountColumnGroupsDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
