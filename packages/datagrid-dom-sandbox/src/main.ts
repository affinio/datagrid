import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "./style.css"
import { failDemoLoading, finishDemoLoading } from "./pageLoading"

interface PersonRow {
  id: string
  name: string
  team: string
}

const host = document.querySelector<HTMLElement>("#grid-host")
const status = document.querySelector<HTMLOutputElement>("#grid-status")

if (!host || !status) throw new Error("DOM sandbox markup is incomplete")

const grid: DataGridDomHandle<PersonRow> = mountDataGrid(host, {
  label: "People directory",
  rows: [
    { id: "p1", name: "Ada Lovelace", team: "Engine" },
    { id: "p2", name: "Grace Hopper", team: "Platform" },
    { id: "p3", name: "Katherine Johnson", team: "Research" },
  ],
  columns: [
    { key: "name", field: "name", label: "Name" },
    { key: "team", field: "team", label: "Team" },
  ],
})

void grid.ready.then(() => {
  status.value = `${grid.api.rows.getCount()} rows · Core API ready`
  finishDemoLoading(document)
}).catch(() => failDemoLoading(document))

window.addEventListener("pagehide", () => {
  void grid.destroy()
}, { once: true })
