import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
}

const rows: readonly PersonRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine" },
  { id: "p2", name: "Grace Hopper", team: "Platform" },
  { id: "p3", name: "Katherine Johnson", team: "Research" },
  { id: "p4", name: "Margaret Hamilton", team: "Engine" },
  { id: "p5", name: "Dorothy Vaughan", team: "Research" },
  { id: "p6", name: "Mary Jackson", team: "Research" },
  { id: "p7", name: "Annie Easley", team: "Engineering" },
  { id: "p8", name: "Jean Bartik", team: "Engineering" },
  { id: "p9", name: "Frances Allen", team: "Compiler" },
  { id: "p10", name: "Barbara Liskov", team: "Research" },
  { id: "p11", name: "Radia Perlman", team: "Network" },
]

export interface PaginationDemoHandle {
  readonly grid: DataGridDomHandle<PersonRow>
  destroy(): Promise<void>
}

export function mountPaginationDemo(root: HTMLElement): PaginationDemoHandle {
  const document = root.ownerDocument
  const controls = document.createElement("div")
  controls.className = "demo-controls"
  controls.setAttribute("role", "toolbar")
  controls.setAttribute("aria-label", "Grid pagination")

  const pageSizeLabel = document.createElement("label")
  pageSizeLabel.textContent = "Rows per page"
  const pageSize = document.createElement("select")
  pageSize.dataset.pageSize = ""
  pageSize.setAttribute("aria-label", "Rows per page")
  for (const size of [3, 5]) {
    const option = document.createElement("option")
    option.value = String(size)
    option.textContent = String(size)
    if (size === 3) option.selected = true
    pageSize.append(option)
  }
  pageSizeLabel.append(pageSize)

  const previous = createButton(document, "Previous", "previous")
  const next = createButton(document, "Next", "next")
  controls.append(pageSizeLabel, previous, next)

  const status = document.createElement("output")
  status.className = "demo-panel__sort-status"
  status.setAttribute("aria-live", "polite")
  status.textContent = "Starting grid…"

  const panelHeader = document.createElement("div")
  panelHeader.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "People directory"
  const description = document.createElement("p")
  description.textContent = "Pagination slices the logical projection in Core before rows reach the renderer."
  title.append(heading, description)
  panelHeader.append(title, status)

  const host = document.createElement("div")
  host.className = "grid-host"
  root.replaceChildren(panelHeader, controls, host)

  const grid = mountDataGrid(host, {
    label: "Paginated people directory",
    rows,
    columns: [
      { key: "name", field: "name", label: "Name" },
      { key: "team", field: "team", label: "Team" },
    ],
  })

  const updateStatus = (): void => {
    const pagination = grid.api.rows.getPagination()
    status.textContent = pagination.pageCount > 0
      ? `Page ${pagination.currentPage + 1} of ${pagination.pageCount} · ${pagination.totalRowCount} people`
      : "No rows"
    previous.disabled = !pagination.enabled || pagination.currentPage <= 0
    next.disabled = !pagination.enabled || pagination.currentPage >= pagination.pageCount - 1
  }
  const onPrevious = (): void => grid.api.rows.setCurrentPage(grid.api.rows.getPagination().currentPage - 1)
  const onNext = (): void => grid.api.rows.setCurrentPage(grid.api.rows.getPagination().currentPage + 1)
  const onPageSizeChange = (): void => grid.api.rows.setPageSize(Number(pageSize.value))
  previous.addEventListener("click", onPrevious)
  next.addEventListener("click", onNext)
  pageSize.addEventListener("change", onPageSizeChange)
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", updateStatus)
  void grid.ready.then(() => {
    grid.api.rows.setPagination({ pageSize: Number(pageSize.value), currentPage: 0 })
    updateStatus()
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))

  return {
    grid,
    async destroy() {
      previous.removeEventListener("click", onPrevious)
      next.removeEventListener("click", onNext)
      pageSize.removeEventListener("change", onPageSizeChange)
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
  button.dataset.pageAction = action
  return button
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#pagination-demo")
  if (root) {
    const demo = mountPaginationDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}
