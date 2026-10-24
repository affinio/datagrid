import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface AssignmentRow {
  id: string
  person: string
  team: string
  assignment: string
}

const rows: readonly AssignmentRow[] = [
  { id: "a1", person: "Ada Lovelace", team: "Platform", assignment: "runtime" },
  { id: "a2", person: "Grace Hopper", team: "Platform", assignment: "quality" },
  { id: "a3", person: "Katherine Johnson", team: "Research", assignment: "analytics" },
  { id: "a4", person: "Dorothy Vaughan", team: "Operations", assignment: "release" },
]

const assignmentOptions = [
  { value: "analytics", label: "Data analytics" },
  { value: "accessibility", label: "Accessibility review" },
  { value: "design", label: "Design systems" },
  { value: "documentation", label: "Developer documentation" },
  { value: "formula", label: "Formula engine" },
  { value: "quality", label: "Quality engineering" },
  { value: "release", label: "Release operations" },
  { value: "runtime", label: "Runtime architecture" },
  { value: "security", label: "Security review" },
  { value: "virtualization", label: "Viewport virtualization" },
] as const

export interface ComboboxCellDemoHandle {
  readonly grid: DataGridDomHandle<AssignmentRow>
  destroy(): Promise<void>
}

export function mountComboboxCellDemo(root: HTMLElement): ComboboxCellDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Team assignments"
  const description = document.createElement("p")
  description.textContent = "Search labels or values. Option selection commits a typed row patch through the same edit transaction path as other cells."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = `${rows.length} assignments`
  header.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  const grid = mountDataGrid(host, {
    label: "Team assignment combobox example",
    rows,
    columns: [
      { key: "person", field: "person", label: "Person", initialState: { width: 210 } },
      { key: "team", field: "team", label: "Team", initialState: { width: 150 } },
      {
        key: "assignment",
        field: "assignment",
        label: "Assignment",
        capabilities: { editable: true },
        presentation: { options: assignmentOptions },
      },
    ],
  })
  root.replaceChildren(header, host)
  const unsubscribe = grid.api.events.on("rows:edited", () => {
    status.textContent = `${rows.length} assignments · last edit saved`
  })
  void grid.ready.then(() => finishDemoLoading(document)).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      unsubscribe()
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#combobox-cell-demo")
  if (root) {
    const demo = mountComboboxCellDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
