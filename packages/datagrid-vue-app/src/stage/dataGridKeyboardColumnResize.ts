import type { DataGridColumnSnapshot } from "@affino/datagrid-vue"

export function resolveKeyboardColumnWidth(
  columns: readonly DataGridColumnSnapshot[],
  columnKey: string,
  direction: -1 | 1,
  options: { defaultWidth: number; minWidth: number; step?: number },
): number | null {
  const columnIndex = columns.findIndex(column => column.key === columnKey)
  const column = columns[columnIndex]
  if (!column || column.column.meta?.isSystem === true) return null

  const currentWidth = column.width ?? options.defaultWidth
  const minWidth = Math.max(options.minWidth, column.column.minWidth ?? 0)
  const adjacentColumn = columns[columnIndex + 1]
  const samePaneNeighbor = adjacentColumn?.pin === column.pin && adjacentColumn.column.meta?.isSystem !== true
    ? adjacentColumn
    : null
  const adjacentWidth = samePaneNeighbor?.width ?? options.defaultWidth
  const adjacentMinWidth = samePaneNeighbor
    ? Math.max(options.minWidth, samePaneNeighbor.column.minWidth ?? 0)
    : 0
  const maxWidth = Math.min(
    column.column.maxWidth ?? Number.POSITIVE_INFINITY,
    currentWidth + Math.max(0, adjacentWidth - adjacentMinWidth),
  )
  const nextWidth = Math.max(minWidth, Math.min(maxWidth, currentWidth + direction * (options.step ?? 10)))
  return nextWidth === currentWidth ? null : nextWidth
}
