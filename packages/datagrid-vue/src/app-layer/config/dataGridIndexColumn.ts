import type { CSSProperties } from "vue"

export const DEFAULT_DATA_GRID_INDEX_COLUMN_WIDTH = 72
const AUTO_INDEX_COLUMN_MIN_WIDTH = 32

function parsePixelWidth(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== "string") {
    return null
  }
  const match = /^\s*(\d+(?:\.\d+)?)px\s*$/i.exec(value)
  return match ? Number(match[1]) : null
}

/** Resolve the row index width from the configured fixed width or numeric labels. */
export function resolveDataGridIndexColumnWidth(
  style: CSSProperties | undefined,
  rowCount: number,
): number {
  const configuredWidth = style?.width
  let width = parsePixelWidth(configuredWidth)

  if (configuredWidth === "auto") {
    // The built-in row index renders one-based decimal labels. Reserve 8px per
    // digit plus the cell's horizontal padding and resize-handle space. Unlike
    // the fixed default, auto mode may shrink for short labels.
    const digitCount = String(Math.max(1, Math.trunc(rowCount))).length
    width = Math.max(AUTO_INDEX_COLUMN_MIN_WIDTH, digitCount * 8 + 24)
  }

  width ??= parsePixelWidth(style?.minWidth)
  width ??= DEFAULT_DATA_GRID_INDEX_COLUMN_WIDTH

  const minWidth = parsePixelWidth(style?.minWidth)
  const maxWidth = parsePixelWidth(style?.maxWidth)
  if (minWidth !== null) width = Math.max(width, minWidth)
  if (maxWidth !== null) width = Math.min(width, maxWidth)
  return width > 0 ? width : DEFAULT_DATA_GRID_INDEX_COLUMN_WIDTH
}
