import { mountDataGrid, type DataGridDomCellClassResolver, type DataGridDomCellStyleResolver, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import "./styles.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface WorkRow {
  id: string
  task: string
  owner: string
  status: "On track" | "At risk" | "Blocked"
  completion: number
}

const rows: readonly WorkRow[] = [
  { id: "w1", task: "DOM adapter", owner: "Ada", status: "On track", completion: 82 },
  { id: "w2", task: "Selection overlay", owner: "Grace", status: "At risk", completion: 48 },
  { id: "w3", task: "Export contract", owner: "Katherine", status: "Blocked", completion: 24 },
  { id: "w4", task: "Keyboard audit", owner: "Dorothy", status: "On track", completion: 96 },
]

const cellClass: DataGridDomCellClassResolver<WorkRow> = (row, _rowIndex, column) => ({
  "dom-cell-styles__blocked": row.kind === "leaf" && row.data.status === "Blocked" && column.key === "status",
  "dom-cell-styles__progress": row.kind === "leaf" && column.key === "completion",
})

const cellStyle: DataGridDomCellStyleResolver<WorkRow> = (row, _rowIndex, column) => {
  if (row.kind !== "leaf") return null
  if (column.key === "status") {
    const palette = {
      "On track": { backgroundColor: "#e3f5eb", color: "#176b3a" },
      "At risk": { backgroundColor: "#fff1cf", color: "#805b00" },
      Blocked: { backgroundColor: "#ffe3e0", color: "#a33026" },
    } as const
    return palette[row.data.status]
  }
  if (column.key === "completion") {
    const progress = Math.max(0, Math.min(100, row.data.completion))
    return {
      backgroundImage: `linear-gradient(90deg, #dbeafe ${progress}%, transparent ${progress}%)`,
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
    }
  }
  return null
}

export interface CellStylesDemoHandle {
  readonly grid: DataGridDomHandle<WorkRow>
  destroy(): Promise<void>
}

export function mountCellStylesDemo(root: HTMLElement): CellStylesDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Project workboard"
  const description = document.createElement("p")
  description.textContent = "Cell class and style resolvers receive Core row identity, projected indexes, and the column snapshot. Status colors and progress fills are computed without custom renderers."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"
  header.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Project workboard with cell styles",
    rows,
    cellClass,
    cellStyle,
    columns: [
      { key: "task", field: "task", label: "Work item", initialState: { pin: "left" } },
      { key: "owner", field: "owner", label: "Owner" },
      { key: "status", field: "status", label: "Status" },
      { key: "completion", field: "completion", label: "Complete" },
    ],
  })
  root.replaceChildren(header, host)
  void grid.ready.then(() => {
    status.textContent = "Cell presentation is resolved from row and column data. Sort the grid to see styles follow row identity."
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#cell-styles-demo")
  if (root) {
    const demo = mountCellStylesDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
