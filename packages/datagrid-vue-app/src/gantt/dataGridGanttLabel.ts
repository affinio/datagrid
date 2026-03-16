export const DATAGRID_GANTT_MIN_INLINE_LABEL_WIDTH_PX = 44

export function resolveDataGridGanttInlineLabel(
  label: string,
  availableWidth: number,
  measureTextWidth: (text: string) => number,
): string | null {
  const normalizedLabel = label.trim()
  if (normalizedLabel.length === 0 || availableWidth < DATAGRID_GANTT_MIN_INLINE_LABEL_WIDTH_PX) {
    return null
  }

  if (measureTextWidth(normalizedLabel) <= availableWidth) {
    return normalizedLabel
  }

  const ellipsis = "..."
  const ellipsisWidth = measureTextWidth(ellipsis)
  if (ellipsisWidth > availableWidth) {
    return null
  }

  let low = 0
  let high = normalizedLabel.length
  let fitted = ""

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = `${normalizedLabel.slice(0, middle).trimEnd()}${ellipsis}`
    if (measureTextWidth(candidate) <= availableWidth) {
      fitted = candidate
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return fitted.length > 0 ? fitted : null
}
