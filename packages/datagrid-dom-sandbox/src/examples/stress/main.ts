import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface StressRow {
  id: string
  [key: string]: string | number
}

const rowCount = 10_000
const columnCount = 120
const metricCount = 24
const columns = Array.from({ length: columnCount }, (_, index) => {
  const key = `metric-${index}`
  return {
    key,
    field: `value-${index % metricCount}`,
    label: `Metric ${String(index + 1).padStart(3, "0")}`,
    initialState: {
      width: 140,
      ...(index === 0 ? { pin: "left" as const } : {}),
      ...(index === columnCount - 1 ? { pin: "right" as const } : {}),
    },
  }
})
const rows: readonly StressRow[] = Array.from({ length: rowCount }, (_, rowIndex) => {
  const row: StressRow = { id: `stress-${rowIndex + 1}` }
  for (let metricIndex = 0; metricIndex < metricCount; metricIndex += 1) {
    row[`value-${metricIndex}`] = ((rowIndex + 1) * (metricIndex + 7)) % 10_000
  }
  return row
})

export interface StressDemoHandle {
  readonly grid: DataGridDomHandle<StressRow>
  runViewportStress(): Promise<void>
  destroy(): Promise<void>
}

export function mountStressDemo(root: HTMLElement): StressDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Large operational matrix"
  const description = document.createElement("p")
  description.textContent = "10,000 rows × 120 columns. Move both viewport axes and check that mounted DOM stays bounded."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.dataset.stressStatus = ""
  status.textContent = "Starting grid…"
  header.append(title, status)

  const controls = document.createElement("div")
  controls.className = "demo-controls"
  const stressButton = document.createElement("button")
  stressButton.type = "button"
  stressButton.textContent = "Run viewport stress"
  controls.append(stressButton)

  const host = document.createElement("div")
  host.className = "grid-host grid-host--virtualized"
  const grid = mountDataGrid(host, {
    label: "Large virtualized operational matrix",
    rows,
    columns,
    rowVirtualization: { rowHeight: 34, overscan: 6 },
    columnVirtualization: { overscan: 3 },
  })
  root.replaceChildren(header, controls, host)

  const updateStatus = (message?: string): void => {
    const mountedRows = host.querySelectorAll(".affino-grid-dom__body > [role=row][data-row-index]").length
    const mountedCells = host.querySelectorAll(".affino-grid-dom__body [role=gridcell]").length
    const gridElement = host.querySelector<HTMLElement>("[role=grid]")
    const nodeCount = gridElement ? gridElement.querySelectorAll("*").length + 1 : 0
    status.textContent = message
      ?? `${rowCount.toLocaleString()} × ${columnCount} logical · ${mountedRows} rows · ${mountedCells} cells · ${nodeCount.toLocaleString()} DOM nodes`
  }

  let stressRunning = false
  let destroyed = false
  const runViewportStress = async (): Promise<void> => {
    if (stressRunning || destroyed) return
    stressRunning = true
    stressButton.disabled = true
    try {
      updateStatus("Moving viewport across 10,000 rows and 120 columns…")
      for (let pass = 0; pass < 24; pass += 1) {
        if (destroyed) return
        const rowIndex = pass % 2 === 0 ? pass * 397 : rowCount - 1 - pass * 311
        const columnIndex = (pass * 17) % columnCount
        grid.api.view.scrollToRow({ rowIndex, rowId: `stress-${rowIndex + 1}` })
        grid.api.view.scrollToColumn({ columnIndex, columnKey: `metric-${columnIndex}` })
        await new Promise<void>(resolve => {
          const requestFrame = document.defaultView?.requestAnimationFrame
          if (requestFrame) requestFrame.call(document.defaultView, () => resolve())
          else setTimeout(resolve, 0)
        })
      }
      updateStatus()
      status.textContent = `Viewport stress complete · ${status.textContent}`
    } finally {
      stressRunning = false
      stressButton.disabled = false
    }
  }
  const onStressClick = (): void => { void runViewportStress() }
  stressButton.addEventListener("click", onStressClick)

  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    runViewportStress,
    async destroy() {
      destroyed = true
      stressButton.removeEventListener("click", onStressClick)
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#stress-demo")
  if (root) {
    const demo = mountStressDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
