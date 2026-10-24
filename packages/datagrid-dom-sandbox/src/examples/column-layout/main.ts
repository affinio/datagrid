import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface InitiativeRow {
  id: string
  initiative: string
  owner: string
  team: string
  status: string
  due: string
}

const rows: readonly InitiativeRow[] = [
  { id: "i-1", initiative: "Data platform renewal", owner: "M. Chen", team: "Platform", status: "Ready", due: "Jun 12" },
  { id: "i-2", initiative: "Identity migration", owner: "A. Patel", team: "Security", status: "In review", due: "Jun 18" },
  { id: "i-3", initiative: "Analytics workspace", owner: "S. Okafor", team: "Research", status: "Blocked", due: "Jun 24" },
  { id: "i-4", initiative: "Customer portal", owner: "R. Silva", team: "Experience", status: "Ready", due: "Jul 02" },
  { id: "i-5", initiative: "Audit retention", owner: "J. Kim", team: "Compliance", status: "Planned", due: "Jul 11" },
]

const columns = [
  { key: "initiative", field: "initiative", label: "Initiative", initialState: { width: 240, pin: "left" as const } },
  { key: "owner", field: "owner", label: "Owner", initialState: { width: 140 } },
  { key: "team", field: "team", label: "Team", initialState: { width: 150 } },
  { key: "status", field: "status", label: "Status", initialState: { width: 130 } },
  { key: "due", field: "due", label: "Due date", initialState: { width: 120 } },
]

export interface ColumnLayoutDemoHandle {
  readonly grid: DataGridDomHandle<InitiativeRow>
  destroy(): Promise<void>
}

export function mountColumnLayoutDemo(root: HTMLElement): ColumnLayoutDemoHandle {
  const document = root.ownerDocument
  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Initiative delivery view"
  const description = document.createElement("p")
  description.textContent = "Toggle columns and move them between the left, center, and right zones."
  title.append(heading, description)
  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.dataset.columnLayoutStatus = ""
  panelHeader.append(title, status)

  const layout = document.createElement("div")
  layout.className = "column-layout-demo"
  const controls = document.createElement("div")
  controls.className = "column-layout-demo__controls"
  controls.setAttribute("aria-label", "Column visibility and pinning")
  const host = document.createElement("div")
  host.className = "grid-host column-layout-demo__grid"
  const grid = mountDataGrid(host, {
    label: "Initiative delivery view",
    rows,
    columns,
  })

  const controlsByKey = new Map<string, { checkbox: HTMLInputElement; pin: HTMLSelectElement }>()
  for (const column of columns) {
    const row = document.createElement("div")
    row.className = "column-layout-demo__control"
    const label = document.createElement("label")
    label.className = "column-layout-demo__visibility"
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.checked = true
    checkbox.dataset.columnVisibility = column.key
    const text = document.createElement("span")
    text.textContent = column.label
    label.append(checkbox, text)

    const pinLabel = document.createElement("label")
    pinLabel.className = "column-layout-demo__pin-label"
    const pin = document.createElement("select")
    pin.dataset.columnPin = column.key
    pin.setAttribute("aria-label", `Pin ${column.label}`)
    for (const [value, name] of [["none", "Center"], ["left", "Left"], ["right", "Right"]] as const) {
      const option = document.createElement("option")
      option.value = value
      option.textContent = name
      pin.append(option)
    }
    pin.value = column.initialState?.pin ?? "none"
    pinLabel.append(pin)
    row.append(label, pinLabel)
    controls.append(row)
    controlsByKey.set(column.key, { checkbox, pin })
  }

  const update = (): void => {
    const snapshot = grid.api.columns.getSnapshot()
    for (const [key, inputs] of controlsByKey) {
      const column = snapshot.byKey[key]
      if (!column) continue
      inputs.checkbox.checked = column.visible
      inputs.pin.value = column.pin
    }
    const visible = snapshot.visibleColumns
    status.textContent = `${visible.length} visible · ${visible.filter(column => column.pin === "left").length} left pinned · ${visible.filter(column => column.pin === "right").length} right pinned`
  }

  for (const [key, inputs] of controlsByKey) {
    inputs.checkbox.addEventListener("change", () => grid.api.columns.setVisibility(key, inputs.checkbox.checked))
    inputs.pin.addEventListener("change", () => {
      const pin = inputs.pin.value
      if (pin === "left" || pin === "right" || pin === "none") grid.api.columns.setPin(key, pin)
    })
  }
  const unsubscribe = grid.api.events.on("columns:changed", update)
  layout.append(controls, host)
  root.replaceChildren(panelHeader, layout)
  void grid.ready.then(() => {
    update()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

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
  const root = document.querySelector<HTMLElement>("#column-layout-demo")
  if (root) {
    const demo = mountColumnLayoutDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
