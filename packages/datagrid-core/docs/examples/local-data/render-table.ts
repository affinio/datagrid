import type { DataGridApi } from "@affino/datagrid-core"
import type { Order } from "./schema.js"

/** Minimal DOM adapter: intentionally not virtualized or production accessible. */
export function renderTable(host: HTMLElement, api: DataGridApi<Order>): void {
  const visibleColumns = api.columns.getSnapshot().visibleColumns
  const table = document.createElement("table")
  const head = document.createElement("thead")
  const headerRow = document.createElement("tr")

  for (const column of api.columns.getSnapshot().visibleColumns) {
    const th = document.createElement("th")
    th.scope = "col"
    th.textContent = column.column.label ?? column.key
    headerRow.append(th)
  }
  head.append(headerRow)

  const body = document.createElement("tbody")
  for (const row of api.rows.getProjectedRows()) {
    const tr = document.createElement("tr")
    for (const column of visibleColumns) {
      const td = document.createElement("td")
      const definition = column.column
      const field = definition.field ?? column.key
      const value = definition.valueGetter
        ? definition.valueGetter(row)
        : (row as Record<string, unknown>)[field]
      td.textContent = value == null ? "" : String(value)
      tr.append(td)
    }
    body.append(tr)
  }

  table.append(head, body)
  host.replaceChildren(table)
}
