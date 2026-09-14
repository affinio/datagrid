export function resolveUniformRowOffset(
  rowIndex: number,
  totalRowCount: number,
  rowHeight: number,
): number {
  const count = Math.max(0, Math.trunc(totalRowCount))
  const height = Number.isFinite(rowHeight) ? Math.max(1, rowHeight) : 1
  const index = Math.max(0, Math.min(count, Math.trunc(rowIndex)))
  return index * height
}

export function resolveUniformRowIndexAtOffset(
  offset: number,
  totalRowCount: number,
  rowHeight: number,
): number {
  const count = Math.max(0, Math.trunc(totalRowCount))
  if (count === 0) return 0
  const height = Number.isFinite(rowHeight) ? Math.max(1, rowHeight) : 1
  const normalizedOffset = Number.isNaN(offset) ? 0 : Math.max(0, offset)
  return Math.max(0, Math.min(count - 1, Math.floor(normalizedOffset / height)))
}
