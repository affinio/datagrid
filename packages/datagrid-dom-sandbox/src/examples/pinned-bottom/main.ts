import { createAdvancedClientRowModel } from "@affino/datagrid-core/advanced"
import type { DataGridRowNode } from "@affino/datagrid-core"
import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface FinanceRow {
  id: string
  account: string
  owner: string
  balance: number
}

export interface PinnedBottomDemoHandle {
  readonly grid: DataGridDomHandle<FinanceRow>
  destroy(): Promise<void>
}

const sourceRows: readonly FinanceRow[] = [
  { id: "a-100", account: "Operating account", owner: "Mina", balance: 148_250 },
  { id: "a-110", account: "Product revenue", owner: "Noah", balance: 92_600 },
  { id: "a-120", account: "Cloud services", owner: "Iris", balance: -24_840 },
  { id: "a-130", account: "Customer support", owner: "Mina", balance: -18_420 },
  { id: "a-140", account: "Equipment", owner: "Noah", balance: -12_700 },
  { id: "a-150", account: "Research budget", owner: "Iris", balance: -31_200 },
]

function createRowNodes(): readonly DataGridRowNode<FinanceRow>[] {
  return sourceRows.map((row, index) => ({
    kind: "leaf",
    data: row,
    row,
    rowKey: row.id,
    rowId: row.id,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    state: {
      selected: false,
      group: false,
      pinned: index === sourceRows.length - 1 ? "bottom" : "none",
      expanded: false,
    },
  }))
}

export function mountPinnedBottomDemo(root: HTMLElement): PinnedBottomDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Monthly account balances"
  const description = document.createElement("p")
  description.textContent = "The closing balance stays in a dedicated bottom lane while the account rows scroll. Horizontal scrolling remains synchronized across the body, header, and pinned row."
  title.append(heading, description)
  header.append(title)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(header, host)
  const rowModel = createAdvancedClientRowModel<FinanceRow>({ rows: createRowNodes() })
  const grid = mountDataGrid(host, {
    label: "Monthly account balances with pinned closing row",
    rowModel,
    columns: [
      { key: "account", field: "account", label: "Account", initialState: { width: 240 } },
      { key: "owner", field: "owner", label: "Owner", initialState: { width: 150 } },
      { key: "balance", field: "balance", label: "Balance", dataType: "currency", initialState: { width: 180 } },
    ],
  })

  void grid.ready.then(() => finishDemoLoading(document)).catch(() => failDemoLoading(document))
  return {
    grid,
    async destroy() {
      await grid.destroy()
      rowModel.dispose()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#pinned-bottom-demo")
  if (root) {
    const demo = mountPinnedBottomDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
