/** Reveals a mounted cell inside the unobscured center area of a DOM viewport. */
export function revealMountedDomCell(
  viewport: HTMLElement,
  rowIndex: number,
  columnIndex: number,
  rowHeight: number | null = null,
): boolean {
  const cell = viewport.querySelector<HTMLElement>(
    `[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
  )
  if (!cell) return false

  const row = cell.closest<HTMLElement>(".affino-grid-dom__row")
  const viewportRect = viewport.getBoundingClientRect()
  const cellRect = cell.getBoundingClientRect()
  const rowRect = row?.getBoundingClientRect()
  const previousScrollTop = viewport.scrollTop
  const previousScrollLeft = viewport.scrollLeft
  const scrollTop = resolveVerticalScrollTop(viewport, rowIndex, rowRect, viewportRect, rowHeight)
  const isPinned = cell.classList.contains("affino-grid-dom__cell--pinned")
  const scrollLeft = isPinned
    ? viewport.scrollLeft
    : resolveHorizontalScrollLeft(viewport, row, cellRect, viewportRect)

  if (scrollTop !== viewport.scrollTop) viewport.scrollTop = scrollTop
  if (scrollLeft !== viewport.scrollLeft) viewport.scrollLeft = scrollLeft
  if (scrollTop !== previousScrollTop || scrollLeft !== previousScrollLeft) {
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }))
  }
  return true
}

function resolveVerticalScrollTop(
  viewport: HTMLElement,
  rowIndex: number,
  rowRect: DOMRect | undefined,
  viewportRect: DOMRect,
  rowHeight: number | null,
): number {
  if (rowHeight != null) {
    const top = rowIndex * rowHeight
    const bottom = top + rowHeight
    if (top < viewport.scrollTop) return top
    if (bottom > viewport.scrollTop + viewport.clientHeight) {
      return Math.max(0, bottom - viewport.clientHeight)
    }
    return viewport.scrollTop
  }
  if (!rowRect || viewport.clientHeight <= 0) return viewport.scrollTop
  const visibleTop = viewportRect.top + viewport.clientTop
  const visibleBottom = visibleTop + viewport.clientHeight
  let delta = 0
  if (rowRect.top < visibleTop) delta = rowRect.top - visibleTop
  else if (rowRect.bottom > visibleBottom) delta = rowRect.bottom - visibleBottom
  return clampScroll(viewport.scrollTop + delta, viewport.scrollHeight - viewport.clientHeight)
}

function resolveHorizontalScrollLeft(
  viewport: HTMLElement,
  row: HTMLElement | null,
  cellRect: DOMRect,
  viewportRect: DOMRect,
): number {
  if (viewport.clientWidth <= 0) return viewport.scrollLeft
  let visibleLeft = viewportRect.left + viewport.clientLeft
  let visibleRight = visibleLeft + viewport.clientWidth

  for (const pinnedCell of Array.from(row?.querySelectorAll<HTMLElement>(".affino-grid-dom__cell--pinned") ?? [])) {
    const pinnedRect = pinnedCell.getBoundingClientRect()
    if (pinnedCell.classList.contains("affino-grid-dom__cell--pinned-left")) {
      visibleLeft = Math.max(visibleLeft, pinnedRect.right)
    } else if (pinnedCell.classList.contains("affino-grid-dom__cell--pinned-right")) {
      visibleRight = Math.min(visibleRight, pinnedRect.left)
    }
  }

  const availableWidth = Math.max(0, visibleRight - visibleLeft)
  const cellWidth = cellRect.right - cellRect.left
  let delta = 0
  if (cellWidth > availableWidth) delta = cellRect.left - visibleLeft
  else if (cellRect.left < visibleLeft) delta = cellRect.left - visibleLeft
  else if (cellRect.right > visibleRight) delta = cellRect.right - visibleRight
  return clampScroll(viewport.scrollLeft + delta, viewport.scrollWidth - viewport.clientWidth)
}

function clampScroll(value: number, max: number): number {
  return Math.max(0, Math.min(Math.max(0, max), value))
}
