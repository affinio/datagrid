import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface WideRow {
  id: string
  [key: string]: string
}

const columnCount = 120
const columns = Array.from({ length: columnCount }, (_, index) => {
  const key = `field-${index}`
  return {
    key,
    field: key,
    label: `Field ${String(index + 1).padStart(3, "0")}`,
    initialState: {
      width: 150,
      ...(index === 0 ? { pin: "left" as const } : {}),
      ...(index === columnCount - 1 ? { pin: "right" as const } : {}),
    },
  }
})
const rows: readonly WideRow[] = Array.from({ length: 80 }, (_, rowIndex) => {
  const row: WideRow = { id: `wide-row-${rowIndex + 1}` }
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    row[`field-${columnIndex}`] = `R${rowIndex + 1} · C${columnIndex + 1}`
  }
  return row
})

export interface ColumnVirtualizationDemoHandle {
  readonly grid: DataGridDomHandle<WideRow>
  destroy(): Promise<void>
}

export function mountColumnVirtualizationDemo(root: HTMLElement): ColumnVirtualizationDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Wide operational report"
  const description = document.createElement("p")
  description.textContent = "The pinned first and last columns remain mounted as the center window moves."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.dataset.columnVirtualizationStatus = ""
  status.textContent = "Starting grid…"
  header.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host grid-host--virtualized"
  const grid = mountDataGrid(host, {
    label: "Column virtualized wide report",
    rows,
    columns,
    columnVirtualization: { overscan: 3 },
    className: "affino-grid-dom--column-virtualization-demo",
  })
  root.replaceChildren(header, host)

  const updateStatus = (): void => {
    const cells = Array.from(host.querySelectorAll<HTMLElement>(".affino-grid-dom__header [role=columnheader]"))
    const indices = cells.map(cell => Number(cell.dataset.columnIndex)).filter(Number.isFinite)
    const center = indices.filter(index => index !== 0 && index !== columnCount - 1)
    const gridElement = host.querySelector<HTMLElement>("[role=grid]")
    const gridNodeCount = gridElement ? gridElement.querySelectorAll("*").length + 1 : 0
    const pageNodeCount = document.querySelectorAll("*").length
    status.textContent = `Window ${center.length ? `${Math.min(...center) + 1}–${Math.max(...center) + 1}` : "—"} · ${cells.length} columns · ${gridNodeCount.toLocaleString()} grid DOM nodes · ${pageNodeCount.toLocaleString()} page DOM nodes`
  }
  const gridElement = host.querySelector<HTMLElement>("[role=grid]")!
  const headerObserver = new MutationObserver(updateStatus)
  headerObserver.observe(gridElement, { childList: true, subtree: true })
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
      headerObserver.disconnect()
      if (statusFrame) document.defaultView?.cancelAnimationFrame(statusFrame)
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#column-virtualization-demo")
  if (root) {
    const demo = mountColumnVirtualizationDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
