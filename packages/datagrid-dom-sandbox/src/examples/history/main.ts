import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface HistoryRow {
  id: string
  item: string
  owner: string
  quantity: number
}

export interface HistoryDemoHandle {
  readonly grid: DataGridDomHandle<HistoryRow>
  destroy(): Promise<void>
}

export function mountHistoryDemo(root: HTMLElement): HistoryDemoHandle {
  const document = root.ownerDocument
  const heading = document.createElement("h2")
  heading.textContent = "Inventory changes"
  const description = document.createElement("p")
  description.textContent = "Edit a cell or paste a range, then undo or redo with the controls or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z."
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  header.append(heading, description)

  const undo = createButton(document, "Undo", "undo")
  const redo = createButton(document, "Redo", "redo")
  undo.disabled = true
  redo.disabled = true
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "No changes to undo"
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "History controls")
  controls.append(undo, redo, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Editable inventory with undo and redo",
    rows: [
      { id: "i1", item: "Desk lamp", owner: "Ada", quantity: 12 },
      { id: "i2", item: "Notebook", owner: "Grace", quantity: 34 },
      { id: "i3", item: "Monitor", owner: "Katherine", quantity: 8 },
      { id: "i4", item: "Keyboard", owner: "Dorothy", quantity: 17 },
    ],
    columns: [
      { key: "item", field: "item", label: "Item", capabilities: { editable: true } },
      { key: "owner", field: "owner", label: "Owner", capabilities: { editable: true } },
      { key: "quantity", field: "quantity", label: "Quantity", capabilities: { editable: true } },
    ],
  })
  root.replaceChildren(header, controls, host)

  const syncState = (): void => {
    const snapshot = grid.api.transaction.getSnapshot()
    const canUndo = grid.api.transaction.canUndo()
    const canRedo = grid.api.transaction.canRedo()
    undo.disabled = !canUndo
    redo.disabled = !canRedo
    status.textContent = snapshot
      ? `${snapshot.undoDepth} undo · ${snapshot.redoDepth} redo`
      : "History unavailable"
  }
  const runAction = async (direction: "undo" | "redo"): Promise<void> => {
    try {
      if (direction === "undo") await grid.api.transaction.undo()
      else await grid.api.transaction.redo()
      syncState()
    } catch {
      status.textContent = `${direction === "undo" ? "Undo" : "Redo"} failed`
    }
  }
  const onUndo = (): void => { void runAction("undo") }
  const onRedo = (): void => { void runAction("redo") }
  undo.addEventListener("click", onUndo)
  redo.addEventListener("click", onRedo)
  const unsubscribe = grid.api.events.on("transaction:changed", syncState)
  const unsubscribeRows = grid.api.events.on("rows:changed", () => {
    window.setTimeout(syncState, 0)
  })
  void grid.ready.then(() => {
    syncState()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      undo.removeEventListener("click", onUndo)
      redo.removeEventListener("click", onRedo)
      unsubscribe()
      unsubscribeRows()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

function createButton(document: Document, label: string, action: string): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  button.dataset.historyAction = action
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#history-demo")
  if (root) {
    const demo = mountHistoryDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
