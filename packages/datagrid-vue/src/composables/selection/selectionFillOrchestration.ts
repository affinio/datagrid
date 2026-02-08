export interface SelectionFillPoint<RowKey = unknown> {
  rowIndex: number
  colIndex: number
  rowId?: RowKey | null
}

export interface SelectionFillArea {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export function selectionPointsEqual<RowKey>(
  left: SelectionFillPoint<RowKey> | null | undefined,
  right: SelectionFillPoint<RowKey> | null | undefined,
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  if (left.colIndex !== right.colIndex) return false
  const leftRowId = left.rowId ?? null
  const rightRowId = right.rowId ?? null
  if (leftRowId !== null || rightRowId !== null) {
    return leftRowId !== null && rightRowId !== null && leftRowId === rightRowId
  }
  return left.rowIndex === right.rowIndex
}

export function selectionAreasEqual(
  left: SelectionFillArea | null | undefined,
  right: SelectionFillArea | null | undefined,
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return (
    left.startRow === right.startRow &&
    left.endRow === right.endRow &&
    left.startCol === right.startCol &&
    left.endCol === right.endCol
  )
}

export function shouldProcessSelectionDragUpdate<RowKey>(
  previousPoint: SelectionFillPoint<RowKey> | null,
  nextPoint: SelectionFillPoint<RowKey> | null,
): boolean {
  return !selectionPointsEqual(previousPoint, nextPoint)
}

export function shouldProcessFillTargetUpdate<RowKey>(
  previousTarget: SelectionFillPoint<RowKey> | null,
  nextTarget: SelectionFillPoint<RowKey> | null,
): boolean {
  return !selectionPointsEqual(previousTarget, nextTarget)
}

export function shouldProcessFillPreviewUpdate(
  previousPreview: SelectionFillArea | null,
  nextPreview: SelectionFillArea | null,
): boolean {
  return !selectionAreasEqual(previousPreview, nextPreview)
}

export function hasMeaningfulFillPreview(
  originArea: SelectionFillArea,
  previewArea: SelectionFillArea | null,
): boolean {
  if (!previewArea) return false
  return !selectionAreasEqual(originArea, previewArea)
}
