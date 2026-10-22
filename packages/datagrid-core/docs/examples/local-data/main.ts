import { api, disposeGrid, startGrid } from "./create-grid.js"
import { renderTable } from "./render-table.js"

export async function mount(host: HTMLElement): Promise<() => Promise<void>> {
  await startGrid()

  const render = () => renderTable(host, api)
  const unsubscribeRows = api.events.on("rows:changed", render)
  const unsubscribeProjection = api.events.on("projection:recomputed", render)
  render()

  // A real UI can call the same API from a sort control, editor, or toolbar.
  api.rows.setSortModel([{ colId: "amount", sort: "desc" }])

  return async () => {
    unsubscribeRows()
    unsubscribeProjection()
    await disposeGrid()
    host.replaceChildren()
  }
}
