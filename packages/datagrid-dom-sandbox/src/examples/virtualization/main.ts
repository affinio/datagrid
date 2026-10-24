import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface VirtualRow {
  id: string
  name: string
  department: string
  score: number
}

const departments = ["Engineering", "Design", "Operations", "Research", "Support"] as const

const rows: readonly VirtualRow[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: `employee-${index + 1}`,
  name: `Employee ${String(index + 1).padStart(5, "0")}`,
  department: departments[index % departments.length]!,
  score: (index * 17) % 100,
}))

export interface VirtualizationDemoHandle {
  readonly grid: DataGridDomHandle<VirtualRow>
  destroy(): Promise<void>
}

export function mountVirtualizationDemo(root: HTMLElement): VirtualizationDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Employee directory"
  const description = document.createElement("p")
  description.textContent = "The DOM contains only the current row window plus Core's overscan. Scroll inside the grid."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.dataset.virtualizationStatus = ""
  status.textContent = "Starting grid…"
  header.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host grid-host--virtualized"
  const grid = mountDataGrid(host, {
    label: "Virtualized employee directory",
    rows,
    columns: [
      { key: "name", field: "name", label: "Employee", initialState: { width: 220 } },
      { key: "department", field: "department", label: "Department", initialState: { width: 180 } },
      { key: "score", field: "score", label: "Score", initialState: { width: 100 } },
    ],
    rowVirtualization: { rowHeight: 36, overscan: 8 },
  })
  root.replaceChildren(header, host)

  const updateStatus = (): void => {
    const renderedRows = Array.from(host.querySelectorAll<HTMLElement>(".affino-grid-dom__body > [role=row][data-row-index]"))
    const firstIndex = renderedRows[0]?.dataset.rowIndex
    const lastIndex = renderedRows.at(-1)?.dataset.rowIndex
    status.textContent = firstIndex == null || lastIndex == null
      ? `0 mounted · ${rows.length.toLocaleString()} total`
      : `Rows ${Number(firstIndex) + 1}–${Number(lastIndex) + 1} · ${renderedRows.length} mounted · ${rows.length.toLocaleString()} total`
  }
  const gridElement = host.querySelector<HTMLElement>("[role=grid]")!
  let statusFrame = 0
  const onScroll = (): void => {
    if (statusFrame) return
    statusFrame = document.defaultView?.requestAnimationFrame(() => {
      statusFrame = 0
      updateStatus()
    }) ?? 0
  }
  gridElement.addEventListener("scroll", onScroll, { passive: true })
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      gridElement.removeEventListener("scroll", onScroll)
      if (statusFrame) document.defaultView?.cancelAnimationFrame(statusFrame)
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#virtualization-demo")
  if (root) {
    const demo = mountVirtualizationDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
