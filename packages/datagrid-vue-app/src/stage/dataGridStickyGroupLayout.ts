import type { DataGridRowNode } from "@affino/datagrid-vue"

export type { StickyGroupRowsOptions } from "../config/dataGridStickyGroupRows"

export interface StickyRootGroupInterval {
  readonly nodeId: string
  readonly sourceIndex: number
  readonly subtreeEndIndex: number
  readonly expanded: boolean
}

export interface StickyGroupPlacement {
  readonly nodeId: string
  readonly sourceIndex: number
  readonly depth: 0
  readonly layer: "sticky-top"
  readonly naturalViewportY: number
  readonly viewportY: number
  readonly height: number
  readonly visibleRect: Readonly<{ x: number; y: number; width: number; height: number }>
}

export function buildStickyRootGroupIntervals<TRow>(
  totalRows: number,
  getRowAtIndex: (index: number) => DataGridRowNode<TRow> | null,
): readonly StickyRootGroupInterval[] {
  const groups: Array<Omit<StickyRootGroupInterval, "subtreeEndIndex"> & { subtreeEndIndex: number }> = []
  const total = Math.max(0, Math.trunc(totalRows))
  for (let index = 0; index < total; index += 1) {
    const row = getRowAtIndex(index)
    if (row?.kind !== "group" || row.groupMeta?.level !== 0) continue
    const previous = groups[groups.length - 1]
    if (previous) previous.subtreeEndIndex = index
    groups.push({
      nodeId: String(row.rowId),
      sourceIndex: index,
      subtreeEndIndex: total,
      expanded: row.state.expanded === true,
    })
  }
  return groups
}

export function resolveStickyRootGroupPlacement(
  groups: readonly StickyRootGroupInterval[],
  input: {
    enabled: boolean
    scrollTop: number
    viewportWidth: number
    viewportHeight: number
    topInset: number
    resolveRowOffset: (rowIndex: number) => number
    resolveRowHeight: (rowIndex: number) => number
  },
): StickyGroupPlacement | null {
  if (!input.enabled || groups.length === 0) return null
  const scrollTop = Math.max(0, Number.isFinite(input.scrollTop) ? input.scrollTop : 0)
  const topInset = Math.max(0, Number.isFinite(input.topInset) ? input.topInset : 0)

  // Root group intervals are projection-indexed. Locate the current interval in
  // logarithmic time; scrolling never walks the grouped dataset.
  let low = 0
  let high = groups.length
  while (low < high) {
    const middle = (low + high) >>> 1
    const groupTop = input.resolveRowOffset(groups[middle]!.sourceIndex)
    if (groupTop <= scrollTop + topInset) low = middle + 1
    else high = middle
  }
  const group = groups[low - 1]
  if (!group || !group.expanded || group.subtreeEndIndex <= group.sourceIndex + 1) return null

  const groupTop = input.resolveRowOffset(group.sourceIndex)
  const groupEnd = input.resolveRowOffset(group.subtreeEndIndex)
  const height = input.resolveRowHeight(group.sourceIndex)
  const availableHeight = input.viewportHeight - topInset
  if (!Number.isFinite(height) || height <= 0 || height > availableHeight) return null

  const naturalViewportY = groupTop - scrollTop
  const groupEndY = groupEnd - scrollTop
  if (naturalViewportY >= topInset || groupEndY <= topInset) return null

  const viewportY = Math.min(Math.max(naturalViewportY, topInset), groupEndY - height)
  const visibleTop = Math.max(topInset, viewportY)
  const visibleBottom = Math.min(input.viewportHeight, viewportY + height)
  if (visibleBottom <= visibleTop) return null

  return {
    nodeId: group.nodeId,
    sourceIndex: group.sourceIndex,
    depth: 0,
    layer: "sticky-top",
    naturalViewportY,
    viewportY,
    height,
    visibleRect: {
      x: 0,
      y: visibleTop,
      width: Math.max(0, input.viewportWidth),
      height: visibleBottom - visibleTop,
    },
  }
}
