import type { DataGridApi } from "@affino/datagrid-core"

export function createDomHeaderSortController<TRow>(options: {
  grid: HTMLElement
  api: DataGridApi<TRow>
  getColumns: () => readonly { key: string; column: { capabilities?: { sortable?: boolean } } }[]
}) {
  const onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null
    if (target?.closest?.("[data-column-resize-handle], [data-column-menu-trigger]")) return
    const header = target?.closest<HTMLElement>(".affino-grid-dom__column-header[data-column-index]")
    if (!header || !options.grid.contains(header)) return

    const columnIndex = Number(header.dataset.columnIndex)
    const column = options.getColumns()[columnIndex]
    if (!column || column.column.capabilities?.sortable === false) return

    const current = options.api.rows.getSnapshot().sortModel
    const existingIndex = current.findIndex(sort => sort.key === column.key)
    const existing = existingIndex < 0 ? null : current[existingIndex]!
    const nextDirection = existing?.direction === "asc"
      ? "desc"
      : existing?.direction === "desc"
        ? null
        : "asc"

    if (event.shiftKey) {
      const next = [...current]
      if (existingIndex >= 0) {
        if (nextDirection) next[existingIndex] = { key: column.key, direction: nextDirection }
        else next.splice(existingIndex, 1)
      } else if (nextDirection) {
        next.push({ key: column.key, direction: nextDirection })
      }
      options.api.rows.setSortModel(next)
      return
    }

    options.api.rows.setSortModel(nextDirection ? [{ key: column.key, direction: nextDirection }] : [])
  }

  options.grid.addEventListener("click", onClick)
  return {
    dispose(): void {
      options.grid.removeEventListener("click", onClick)
    },
  }
}
