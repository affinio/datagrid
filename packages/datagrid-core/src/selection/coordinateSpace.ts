/**
 * Selection coordinate-space contract:
 * - table/world space: content coordinates before scroll transforms.
 * - viewport space: coordinates inside visible viewport after scroll is applied.
 * - client space: DOM client coordinates (needs viewport origin + scroll to convert).
 */

export const SELECTION_WORLD_PRECISION = 1000
export const SELECTION_PIXEL_EPSILON = 0.5

export interface SelectionWorldRowSpan {
  top: number
  height: number
}

export function normalizeSelectionIndexRange(a: number, b: number): [number, number] {
  return [Math.min(a, b), Math.max(a, b)]
}

export function roundSelectionWorldUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * SELECTION_WORLD_PRECISION) / SELECTION_WORLD_PRECISION
}

export function tableToViewportSpace(tableCoordinate: number, scrollOffset: number): number {
  return tableCoordinate - scrollOffset
}

export function viewportToTableSpace(viewportCoordinate: number, scrollOffset: number): number {
  return viewportCoordinate + scrollOffset
}

export function clientToTableSpace(
  clientCoordinate: number,
  viewportOriginCoordinate: number,
  scrollOffset: number,
): number {
  return viewportToTableSpace(clientCoordinate - viewportOriginCoordinate, scrollOffset)
}

export function createWorldRowSpan(
  startRow: number,
  endRow: number,
  rowHeight: number,
): SelectionWorldRowSpan | null {
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) {
    return null
  }

  const [normalizedStart, normalizedEnd] = normalizeSelectionIndexRange(startRow, endRow)
  if (normalizedEnd < 0) {
    return null
  }

  const clampedStart = Math.max(0, normalizedStart)
  const top = roundSelectionWorldUnit(clampedStart * rowHeight)
  const bottom = roundSelectionWorldUnit((Math.max(clampedStart, normalizedEnd) + 1) * rowHeight)
  const height = roundSelectionWorldUnit(bottom - top)

  if (height <= SELECTION_PIXEL_EPSILON) {
    return null
  }

  return {
    top,
    height,
  }
}
