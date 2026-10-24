import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface WorkItem {
  id: string
  title: string
  team: string
  status: string
  points: number
}

export interface GroupingDemoHandle {
  readonly grid: DataGridDomHandle<WorkItem>
  destroy(): Promise<void>
}

const rows: WorkItem[] = [
  { id: "w1", title: "Keyboard navigation", team: "Platform", status: "In progress", points: 5 },
  { id: "w2", title: "DOM virtualization", team: "Platform", status: "Review", points: 3 },
  { id: "w3", title: "Theme tokens", team: "Design", status: "Done", points: 2 },
  { id: "w4", title: "Pinned panes", team: "Platform", status: "Planned", points: 8 },
  { id: "w5", title: "Accessible controls", team: "Design", status: "In progress", points: 5 },
]

export function mountGroupingDemo(root: HTMLElement): GroupingDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  const label = document.createElement("label")
  label.textContent = "Group by"
  const select = document.createElement("select")
  select.dataset.groupBy = ""
  for (const [value, text] of [
    ["team", "Team"],
    ["team-status", "Team → Status"],
    ["status", "Status"],
    ["", "No grouping"],
  ]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = text
    select.append(option)
  }
  label.append(select)
  const expand = createButton(document, "Expand all", "expand-all")
  const collapse = createButton(document, "Collapse all", "collapse-all")
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  controls.append(label, expand, collapse, status)

  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Work items"
  const description = document.createElement("p")
  description.textContent = "Group rows in Core, inspect summed points, and expand or collapse each group."
  title.append(heading, description)
  header.append(title)
  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(header, controls, host)

  const grid = mountDataGrid(host, {
    label: "Grouped work items",
    rows,
    columns: [
      { key: "title", field: "title", label: "Work item" },
      { key: "team", field: "team", label: "Team" },
      { key: "status", field: "status", label: "Status" },
      { key: "points", field: "points", label: "Points" },
    ],
  })
  grid.api.rows.setAggregationModel({
    columns: [{ key: "points", field: "points", op: "sum" }],
  })

  const sync = (): void => {
    const groups = Array.from({ length: grid.api.rows.getCount() }, (_, index) => grid.api.rows.get(index))
      .filter(row => row?.kind === "group")
    status.textContent = `${groups.length} visible groups · ${grid.api.rows.getCount()} projected rows`
  }
  const onGroupByChange = (): void => {
    const fields = select.value === "team-status"
      ? ["team", "status"]
      : select.value ? [select.value] : []
    grid.api.rows.setGroupBy(fields.length ? { fields, expandedByDefault: true } : null)
    sync()
  }
  const onExpandAll = (): void => { grid.api.rows.expandAllGroups(); sync() }
  const onCollapseAll = (): void => { grid.api.rows.collapseAllGroups(); sync() }
  select.addEventListener("change", onGroupByChange)
  expand.addEventListener("click", onExpandAll)
  collapse.addEventListener("click", onCollapseAll)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", sync)
  void grid.ready.then(() => {
    select.value = "team"
    grid.api.rows.setGroupBy({ fields: ["team"], expandedByDefault: true })
    sync()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      select.removeEventListener("change", onGroupByChange)
      expand.removeEventListener("click", onExpandAll)
      collapse.removeEventListener("click", onCollapseAll)
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
  button.dataset.groupAction = action
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#grouping-demo")
  if (root) {
    const demo = mountGroupingDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
