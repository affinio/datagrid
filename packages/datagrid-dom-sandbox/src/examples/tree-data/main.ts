import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface TaskRow {
  id: string
  title: string
  owner: string
  estimate: number
  path: readonly string[]
}

export interface TreeDataDemoHandle {
  readonly grid: DataGridDomHandle<TaskRow>
  destroy(): Promise<void>
}

const rows: readonly TaskRow[] = [
  { id: "t1", title: "Define interaction contract", owner: "Mina", estimate: 3, path: ["Atlas", "Planning"] },
  { id: "t2", title: "Build viewport controller", owner: "Noah", estimate: 8, path: ["Atlas", "Implementation"] },
  { id: "t3", title: "Add renderer tests", owner: "Mina", estimate: 5, path: ["Atlas", "Implementation"] },
  { id: "t4", title: "Document migration", owner: "Iris", estimate: 2, path: ["Borealis", "Planning"] },
  { id: "t5", title: "Run browser checks", owner: "Noah", estimate: 3, path: ["Borealis", "Verification"] },
]

export function mountTreeDataDemo(root: HTMLElement): TreeDataDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Tree expansion controls")
  const expand = createButton(document, "Expand all", "expand-all")
  const collapse = createButton(document, "Collapse all", "collapse-all")
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  controls.append(expand, collapse, status)

  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Engineering roadmap"
  const description = document.createElement("p")
  description.textContent = "Core builds the hierarchy from each task path; expand a project or workstream to reveal its tasks."
  title.append(heading, description)
  header.append(title)
  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(header, controls, host)

  const grid = mountDataGrid(host, {
    label: "Engineering roadmap tree",
    rows,
    columns: [
      { key: "title", field: "title", label: "Task" },
      { key: "owner", field: "owner", label: "Owner" },
      { key: "estimate", field: "estimate", label: "Estimate" },
    ],
    treeData: {
      mode: "path",
      getDataPath: row => row.path,
      expandedByDefault: true,
    },
  })

  const sync = (): void => {
    const groups = Array.from({ length: grid.api.rows.getCount() }, (_, index) => grid.api.rows.get(index))
      .filter(row => row?.kind === "group")
    status.textContent = `${groups.length} visible groups · ${grid.api.rows.getCount()} projected rows`
  }
  const onExpand = (): void => { grid.api.rows.expandAllGroups(); sync() }
  const onCollapse = (): void => { grid.api.rows.collapseAllGroups(); sync() }
  expand.addEventListener("click", onExpand)
  collapse.addEventListener("click", onCollapse)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", sync)
  void grid.ready.then(() => {
    sync()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      expand.removeEventListener("click", onExpand)
      collapse.removeEventListener("click", onCollapse)
      unsubscribeProjection()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

function createButton(document: Document, text: string, action: string): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = text
  button.dataset.treeAction = action
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#tree-data-demo")
  if (root) {
    const demo = mountTreeDataDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
