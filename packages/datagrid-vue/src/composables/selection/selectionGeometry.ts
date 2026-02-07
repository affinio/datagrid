export interface SelectionGeometryPoint<RowKey = unknown> {
  rowIndex: number
  colIndex: number
  rowId?: RowKey | null
}

export interface SelectionGeometryRange<RowKey = unknown> {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
  anchor: SelectionGeometryPoint<RowKey>
  focus: SelectionGeometryPoint<RowKey>
}

export interface SelectionGeometryArea {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export interface SelectionOverlaySignature {
  ranges: string
  active: string
  fill: string
  cut: string
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  if (value < min) return min
  if (value > max) return max
  return value
}

export function serializeSelectionRange<RowKey = unknown>(range: SelectionGeometryRange<RowKey>): string {
  return [
    range.startRow,
    range.endRow,
    range.startCol,
    range.endCol,
    range.anchor.rowIndex,
    range.anchor.colIndex,
    range.focus.rowIndex,
    range.focus.colIndex,
  ].join(":")
}

export function serializeSelectionRanges<RowKey = unknown>(ranges: readonly SelectionGeometryRange<RowKey>[]): string {
  if (!ranges.length) return ""
  return ranges.map(serializeSelectionRange).join("|")
}

export function serializeSelectionArea(area: SelectionGeometryArea | null): string {
  if (!area) return ""
  return [area.startRow, area.endRow, area.startCol, area.endCol].join(":")
}

export function serializeSelectionAreas(areas: readonly SelectionGeometryArea[]): string {
  if (!areas.length) return ""
  return areas.map(serializeSelectionArea).join("|")
}

export function buildSelectionOverlaySignature<RowKey = unknown>(input: {
  ranges: readonly SelectionGeometryRange<RowKey>[]
  activeRangeIndex: number
  fillPreview: SelectionGeometryArea | null
  cutPreviewAreas: readonly SelectionGeometryArea[]
}): SelectionOverlaySignature {
  const { ranges, fillPreview, cutPreviewAreas } = input
  const activeRangeIndexRaw = input.activeRangeIndex
  const hasActive = ranges.length > 0 && activeRangeIndexRaw >= 0 && activeRangeIndexRaw < ranges.length
  const activeRangeIndex = hasActive ? clampNumber(activeRangeIndexRaw, 0, ranges.length - 1) : -1
  const activeRange = hasActive ? ranges[activeRangeIndex] ?? null : null
  const staticRanges = hasActive ? ranges.filter((_, index) => index !== activeRangeIndex) : ranges

  return {
    ranges: serializeSelectionRanges(staticRanges),
    active: activeRange ? serializeSelectionRange(activeRange) : "",
    fill: serializeSelectionArea(fillPreview),
    cut: serializeSelectionAreas(cutPreviewAreas),
  }
}

export function detectFullColumnSelectionIndex<RowKey = unknown>(
  ranges: readonly SelectionGeometryRange<RowKey>[],
  grid: { rowCount: number; colCount: number },
): number | null {
  const rowCount = Math.max(grid.rowCount, 0)
  const colCount = Math.max(grid.colCount, 0)
  if (rowCount === 0 || colCount === 0) return null
  if (ranges.length !== 1) return null
  const [range] = ranges
  if (range.startCol !== range.endCol) return null
  if (range.startRow !== 0) return null
  const expectedEndRow = Math.max(rowCount - 1, 0)
  if (range.endRow !== expectedEndRow) return null
  return clampNumber(range.startCol, 0, colCount - 1)
}

export function createSelectionCellKey(rowIndex: number, columnIndex: number): string {
  return `${rowIndex}:${columnIndex}`
}

export const ROW_HEADER_CLASS_NONE = ""
export const ROW_HEADER_CLASS_FULL = "ui-table__row-index--full"
export const ROW_HEADER_CLASS_HIGHLIGHT = "ui-table__row-index--highlight"
export const ROW_HEADER_CLASS_RANGE = "ui-table__row-index--range"

export function resolveRowHeaderClassValue(isFull: boolean, isHighlighted: boolean, inSelection: boolean): string {
  if (isFull) return ROW_HEADER_CLASS_FULL
  if (isHighlighted) return ROW_HEADER_CLASS_HIGHLIGHT
  if (inSelection) return ROW_HEADER_CLASS_RANGE
  return ROW_HEADER_CLASS_NONE
}
