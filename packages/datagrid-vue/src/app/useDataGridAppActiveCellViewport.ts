import { type Ref } from "vue"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"

export interface UseDataGridAppActiveCellViewportOptions {
  bodyViewportRef: Ref<HTMLElement | null>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  columnWidths: Ref<Record<string, number>>
  normalizedBaseRowHeight: Ref<number>
  indexColumnWidth?: number
  defaultColumnWidth?: number
  syncViewport: () => void
}

export interface UseDataGridAppActiveCellViewportResult {
  ensureKeyboardActiveCellVisible: (rowIndex: number, columnIndex: number) => void
}

export function useDataGridAppActiveCellViewport(
  options: UseDataGridAppActiveCellViewportOptions,
): UseDataGridAppActiveCellViewportResult {
  const indexColumnWidth = options.indexColumnWidth ?? 72
  const defaultColumnWidth = options.defaultColumnWidth ?? 140

  const resolveColumnRenderWidth = (columnKey: string): number => {
    return options.columnWidths.value[columnKey] ?? defaultColumnWidth
  }

  const resolvePinnedViewportInsets = (): { left: number; right: number } => {
    const leftPinnedWidth = options.visibleColumns.value
      .filter(column => column.pin === "left")
      .reduce((sum, column) => sum + resolveColumnRenderWidth(column.key), 0)
    const rightPinnedWidth = options.visibleColumns.value
      .filter(column => column.pin === "right")
      .reduce((sum, column) => sum + resolveColumnRenderWidth(column.key), 0)
    return {
      left: indexColumnWidth + leftPinnedWidth,
      right: rightPinnedWidth,
    }
  }

  const ensureKeyboardActiveCellVisible = (rowIndex: number, columnIndex: number): void => {
    const viewport = options.bodyViewportRef.value
    if (!viewport) {
      return
    }
    const selector = `.grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
    let targetCell = viewport.querySelector<HTMLElement>(selector)

    if (!targetCell) {
      const estimatedTop = Math.max(0, rowIndex * options.normalizedBaseRowHeight.value)
      const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
      const nextTop = Math.min(maxTop, estimatedTop)
      if (viewport.scrollTop !== nextTop) {
        viewport.scrollTop = nextTop
        options.syncViewport()
      }
      targetCell = viewport.querySelector<HTMLElement>(selector)
    }

    if (!targetCell) {
      return
    }

    targetCell.scrollIntoView({ block: "nearest", inline: "nearest" })

    const viewportRect = viewport.getBoundingClientRect()
    const cellRect = targetCell.getBoundingClientRect()
    const insets = resolvePinnedViewportInsets()
    const visibleLeft = viewportRect.left + Math.max(0, insets.left)
    const visibleRight = viewportRect.right - Math.max(0, insets.right)

    if (cellRect.left < visibleLeft) {
      viewport.scrollLeft = Math.max(0, viewport.scrollLeft - (visibleLeft - cellRect.left))
    } else if (cellRect.right > visibleRight) {
      viewport.scrollLeft += cellRect.right - visibleRight
    }

    targetCell.focus({ preventScroll: true })
    options.syncViewport()
  }

  return {
    ensureKeyboardActiveCellVisible,
  }
}
