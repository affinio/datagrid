import { type Ref } from "vue"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"

export interface UseDataGridAppActiveCellViewportOptions {
  bodyViewportRef: Ref<HTMLElement | null>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  columnWidths: Ref<Record<string, number>>
  normalizedBaseRowHeight: Ref<number>
  resolveRowHeight?: (rowIndex: number) => number
  resolveRowOffset?: (rowIndex: number) => number
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
  const defaultColumnWidth = options.defaultColumnWidth ?? 140
  const visibilityMarginPx = 2

  const resolveCellElement = (rowIndex: number, columnIndex: number): HTMLElement | null => {
    const viewport = options.bodyViewportRef.value
    if (!viewport) {
      return null
    }
    const selector = `.grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
    const stageRoot = viewport.closest(".grid-stage")
    const scopedRoot = stageRoot instanceof HTMLElement ? stageRoot : viewport.parentElement
    return scopedRoot?.querySelector<HTMLElement>(selector) ?? null
  }

  const resolveColumnWidth = (column: DataGridColumnSnapshot): number => {
    return options.columnWidths.value[column.key] ?? column.width ?? defaultColumnWidth
  }

  const ensureEstimatedRowVisible = (viewport: HTMLElement, rowIndex: number): void => {
    const estimatedTop = typeof options.resolveRowOffset === "function"
      ? Math.max(0, options.resolveRowOffset(rowIndex))
      : Math.max(0, rowIndex * options.normalizedBaseRowHeight.value)
    const estimatedBottom = estimatedTop + (
      typeof options.resolveRowHeight === "function"
        ? options.resolveRowHeight(rowIndex)
        : options.normalizedBaseRowHeight.value
    )
    const visibleTop = viewport.scrollTop
    const visibleBottom = visibleTop + viewport.clientHeight

    if (estimatedTop < visibleTop) {
      viewport.scrollTop = estimatedTop
      options.syncViewport()
    } else if (estimatedBottom > visibleBottom) {
      viewport.scrollTop = Math.max(0, estimatedBottom - viewport.clientHeight)
      options.syncViewport()
    }
  }

  const resolveCenterColumnMetrics = (
    columnIndex: number,
  ): { start: number; end: number; totalWidth: number } | null => {
    const targetColumn = options.visibleColumns.value[columnIndex]
    if (!targetColumn || targetColumn.pin === "left" || targetColumn.pin === "right") {
      return null
    }

    let currentOffset = 0
    let totalWidth = 0
    let targetStart: number | null = null
    let targetEnd: number | null = null

    for (const column of options.visibleColumns.value) {
      if (column.pin === "left" || column.pin === "right") {
        continue
      }
      const width = resolveColumnWidth(column)
      if (column.key === targetColumn.key) {
        targetStart = currentOffset
        targetEnd = currentOffset + width
      }
      currentOffset += width
      totalWidth += width
    }

    if (targetStart == null || targetEnd == null) {
      return null
    }

    return {
      start: targetStart,
      end: targetEnd,
      totalWidth,
    }
  }

  const focusResolvedCellOrViewport = (
    viewport: HTMLElement,
    rowIndex: number,
    columnIndex: number,
  ): void => {
    const targetCell = resolveCellElement(rowIndex, columnIndex)
    if (targetCell) {
      targetCell.focus({ preventScroll: true })
      return
    }
    viewport.focus({ preventScroll: true })
  }

  const ensureCenterCellVisibleByDomRect = (
    viewport: HTMLElement,
    rowIndex: number,
    columnIndex: number,
  ): boolean => {
    const targetCell = resolveCellElement(rowIndex, columnIndex)
    if (!targetCell) {
      return false
    }

    const viewportRect = viewport.getBoundingClientRect()
    const targetRect = targetCell.getBoundingClientRect()
    const visibleLeft = viewportRect.left + visibilityMarginPx
    const visibleRight = viewportRect.right - visibilityMarginPx
    let nextScrollLeft = viewport.scrollLeft

    if (targetRect.left < visibleLeft) {
      nextScrollLeft += targetRect.left - visibleLeft
    } else if (targetRect.right > visibleRight) {
      nextScrollLeft += targetRect.right - visibleRight
    }

    nextScrollLeft = Math.max(0, nextScrollLeft)
    if (Math.abs(nextScrollLeft - viewport.scrollLeft) < 1) {
      return true
    }

    viewport.scrollLeft = nextScrollLeft
    options.syncViewport()
    return true
  }

  const ensureKeyboardActiveCellVisible = (rowIndex: number, columnIndex: number): void => {
    const viewport = options.bodyViewportRef.value
    if (!viewport) {
      return
    }
    const targetColumn = options.visibleColumns.value[columnIndex]
    ensureEstimatedRowVisible(viewport, rowIndex)

    if (targetColumn?.pin === "left" || targetColumn?.pin === "right") {
      focusResolvedCellOrViewport(viewport, rowIndex, columnIndex)
      return
    }

    const usedDomScrollAlignment = ensureCenterCellVisibleByDomRect(viewport, rowIndex, columnIndex)

    if (!usedDomScrollAlignment) {
      const centerMetrics = resolveCenterColumnMetrics(columnIndex)
      if (centerMetrics) {
        const visibleLeft = viewport.scrollLeft
        const visibleRight = visibleLeft + viewport.clientWidth
        const maxScrollLeft = Math.max(0, centerMetrics.totalWidth - viewport.clientWidth)
        let nextScrollLeft = visibleLeft

        if (centerMetrics.start < visibleLeft) {
          nextScrollLeft = centerMetrics.start
        } else if (centerMetrics.end > visibleRight) {
          nextScrollLeft = centerMetrics.end - viewport.clientWidth
        }

        nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft))
        if (Math.abs(nextScrollLeft - viewport.scrollLeft) >= 1) {
          viewport.scrollLeft = nextScrollLeft
          options.syncViewport()
        }
      }
    }

    focusResolvedCellOrViewport(viewport, rowIndex, columnIndex)
  }

  return {
    ensureKeyboardActiveCellVisible,
  }
}
