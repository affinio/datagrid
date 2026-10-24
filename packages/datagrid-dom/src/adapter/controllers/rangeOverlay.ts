import type { DataGridClipboardRange } from "@affino/datagrid-orchestration"

export function renderDomRangeOverlay(options: {
  grid: HTMLElement
  cells: ReadonlyMap<string, HTMLElement>
  columnPins: readonly ("left" | "right" | "none")[]
  range: DataGridClipboardRange
  className: string
  dataAttribute: string
}): HTMLElement[] {
  const body = options.grid.querySelector<HTMLElement>(".affino-grid-dom__body")
  if (!body) return []
  const panes = new Map<string, { startRow: number; endRow: number; startColumn: number; endColumn: number }>()
  for (const key of options.cells.keys()) {
    const [rowText, columnText] = key.split(":")
    const rowIndex = Number(rowText)
    const columnIndex = Number(columnText)
    if (!Number.isFinite(rowIndex) || !Number.isFinite(columnIndex)) continue
    if (rowIndex < options.range.startRow || rowIndex > options.range.endRow
      || columnIndex < options.range.startColumn || columnIndex > options.range.endColumn) continue
    const pane = options.columnPins[columnIndex] ?? "none"
    const bounds = panes.get(pane)
    if (bounds) {
      bounds.startRow = Math.min(bounds.startRow, rowIndex)
      bounds.endRow = Math.max(bounds.endRow, rowIndex)
      bounds.startColumn = Math.min(bounds.startColumn, columnIndex)
      bounds.endColumn = Math.max(bounds.endColumn, columnIndex)
    } else {
      panes.set(pane, { startRow: rowIndex, endRow: rowIndex, startColumn: columnIndex, endColumn: columnIndex })
    }
  }

  const bodyRect = body.getBoundingClientRect()
  const overlays: HTMLElement[] = []
  for (const [pane, bounds] of panes) {
    const firstCell = options.cells.get(`${bounds.startRow}:${bounds.startColumn}`)
    const lastColumnCell = options.cells.get(`${bounds.startRow}:${bounds.endColumn}`)
    const lastRowCell = options.cells.get(`${bounds.endRow}:${bounds.startColumn}`)
    if (!firstCell || !lastColumnCell || !lastRowCell) continue
    const firstRect = firstCell.getBoundingClientRect()
    const lastColumnRect = lastColumnCell.getBoundingClientRect()
    const lastRowRect = lastRowCell.getBoundingClientRect()
    const overlay = options.grid.ownerDocument.createElement("div")
    overlay.className = options.className
    overlay.dataset[options.dataAttribute] = pane
    overlay.setAttribute("aria-hidden", "true")
    overlay.style.left = `${firstRect.left - bodyRect.left + body.scrollLeft}px`
    overlay.style.top = `${firstRect.top - bodyRect.top + body.scrollTop}px`
    overlay.style.width = `${lastColumnRect.right - firstRect.left}px`
    overlay.style.height = `${lastRowRect.bottom - firstRect.top}px`
    body.append(overlay)
    overlays.push(overlay)
  }
  return overlays
}
