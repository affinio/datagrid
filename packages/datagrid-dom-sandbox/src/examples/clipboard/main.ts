import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface ClipboardRow {
  id: string
  name: string
  team: string
  office: string
}

const initialRows: readonly ClipboardRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine", office: "London" },
  { id: "p2", name: "Grace Hopper", team: "Platform", office: "Arlington" },
  { id: "p3", name: "Katherine Johnson", team: "Research", office: "Hampton" },
  { id: "p4", name: "Dorothy Vaughan", team: "Analysis", office: "Hampton" },
]

export interface ClipboardDemoHandle {
  readonly grid: DataGridDomHandle<ClipboardRow>
  destroy(): Promise<void>
}

export function mountClipboardDemo(root: HTMLElement): ClipboardDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Editable people directory"
  const description = document.createElement("p")
  description.textContent = "Shift-click to select a range. Copy it to see a short-lived dashed outline, then paste at another cell. Single-cell paste fills the selected range."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status clipboard-demo__status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"
  header.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Clipboard people directory",
    rows: initialRows,
    columns: [
      { key: "name", field: "name", label: "Name", capabilities: { editable: true } },
      { key: "team", field: "team", label: "Team", capabilities: { editable: true } },
      { key: "office", field: "office", label: "Office", capabilities: { editable: true } },
    ],
  })
  root.replaceChildren(header, host)

  const updateStatus = (): void => {
    status.textContent = grid.api.rows.getCount() > 0
      ? grid.api.rows.getCount() + " rows · select cells and use Ctrl/Cmd+C or Ctrl/Cmd+V"
      : "No rows"
  }
  const onCopy = (): void => {
    queueMicrotask(() => {
      const action = host.querySelector<HTMLElement>(".affino-grid-dom")?.dataset.clipboardAction
      if (action) status.textContent = action
    })
  }
  const onPaste = (): void => {
    window.setTimeout(onCopy, 0)
  }
  host.addEventListener("copy", onCopy)
  host.addEventListener("paste", onPaste)
  void grid.ready.then(() => {
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      host.removeEventListener("copy", onCopy)
      host.removeEventListener("paste", onPaste)
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#clipboard-demo")
  if (root) {
    const demo = mountClipboardDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
