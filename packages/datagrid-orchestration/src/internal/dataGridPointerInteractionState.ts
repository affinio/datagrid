import type { DataGridPointerCoordinates } from "./dataGridPointerContracts"

export interface DataGridPointerRangeMoveLike {
  isRangeMoving: boolean
}

export interface DataGridPointerFillLike {
  isFillDragging: boolean
}

export interface DataGridPointerDragLike {
  isDragSelecting: boolean
}

export interface DataGridPointerRowSelectionLike {
  isRowSelectionDragging?: boolean
}

export interface DataGridPointerColumnResizeLike {
  isColumnResizing: boolean
}

export type DataGridPointerInteractionLike =
  & DataGridPointerRangeMoveLike
  & DataGridPointerFillLike
  & DataGridPointerDragLike
  & DataGridPointerRowSelectionLike
  & Partial<DataGridPointerColumnResizeLike>

export type DataGridPointerInteractionKind = "range" | "fill" | "drag" | "row-selection"

export interface DataGridPointerResolverSet {
  resolveRangeMovePointer: () => DataGridPointerCoordinates | null
  resolveFillPointer: () => DataGridPointerCoordinates | null
  resolveDragPointer: () => DataGridPointerCoordinates | null
  resolveRowSelectionPointer?: () => DataGridPointerCoordinates | null
}

export function hasAnyDataGridPointerInteraction(state: DataGridPointerInteractionLike): boolean {
  return Boolean(
    state.isRangeMoving ||
    state.isFillDragging ||
    state.isDragSelecting ||
    state.isRowSelectionDragging ||
    state.isColumnResizing,
  )
}

export function isDataGridPointerInteractionActive(
  state: DataGridPointerRangeMoveLike & DataGridPointerFillLike & DataGridPointerDragLike & DataGridPointerRowSelectionLike,
): boolean {
  return Boolean(state.isRangeMoving || state.isFillDragging || state.isDragSelecting || state.isRowSelectionDragging)
}

export function resolveDataGridActiveInteractionKind(
  state: DataGridPointerRangeMoveLike & DataGridPointerFillLike & DataGridPointerDragLike & DataGridPointerRowSelectionLike,
): DataGridPointerInteractionKind | null {
  if (state.isRangeMoving) {
    return "range"
  }
  if (state.isFillDragging) {
    return "fill"
  }
  if (state.isRowSelectionDragging) {
    return "row-selection"
  }
  if (state.isDragSelecting) {
    return "drag"
  }
  return null
}

export function resolveDataGridActiveInteractionPointer(
  resolvers: DataGridPointerResolverSet,
  state: DataGridPointerRangeMoveLike & DataGridPointerFillLike & DataGridPointerDragLike & DataGridPointerRowSelectionLike,
): DataGridPointerCoordinates | null {
  const kind = resolveDataGridActiveInteractionKind(state)
  if (kind === "range") {
    return resolvers.resolveRangeMovePointer()
  }
  if (kind === "fill") {
    return resolvers.resolveFillPointer()
  }
  if (kind === "drag") {
    return resolvers.resolveDragPointer()
  }
  if (kind === "row-selection") {
    return resolvers.resolveRowSelectionPointer?.() ?? null
  }
  return null
}

export function syncDataGridPointerIfChanged(
  current: DataGridPointerCoordinates | null,
  next: DataGridPointerCoordinates,
  apply: (pointer: DataGridPointerCoordinates) => void,
): boolean {
  if (current && current.clientX === next.clientX && current.clientY === next.clientY) {
    return false
  }
  apply(next)
  return true
}
