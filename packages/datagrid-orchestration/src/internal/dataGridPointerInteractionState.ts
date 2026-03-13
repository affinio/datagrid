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

export interface DataGridPointerColumnResizeLike {
  isColumnResizing: boolean
}

export type DataGridPointerInteractionLike =
  & DataGridPointerRangeMoveLike
  & DataGridPointerFillLike
  & DataGridPointerDragLike
  & Partial<DataGridPointerColumnResizeLike>

export type DataGridPointerInteractionKind = "range" | "fill" | "drag"

export interface DataGridPointerResolverSet {
  resolveRangeMovePointer: () => DataGridPointerCoordinates | null
  resolveFillPointer: () => DataGridPointerCoordinates | null
  resolveDragPointer: () => DataGridPointerCoordinates | null
}

export function hasAnyDataGridPointerInteraction(state: DataGridPointerInteractionLike): boolean {
  return Boolean(
    state.isRangeMoving ||
    state.isFillDragging ||
    state.isDragSelecting ||
    state.isColumnResizing,
  )
}

export function isDataGridPointerInteractionActive(
  state: DataGridPointerRangeMoveLike & DataGridPointerFillLike & DataGridPointerDragLike,
): boolean {
  return Boolean(state.isRangeMoving || state.isFillDragging || state.isDragSelecting)
}

export function resolveDataGridActiveInteractionKind(
  state: DataGridPointerRangeMoveLike & DataGridPointerFillLike & DataGridPointerDragLike,
): DataGridPointerInteractionKind | null {
  if (state.isRangeMoving) {
    return "range"
  }
  if (state.isFillDragging) {
    return "fill"
  }
  if (state.isDragSelecting) {
    return "drag"
  }
  return null
}

export function resolveDataGridActiveInteractionPointer(
  resolvers: DataGridPointerResolverSet,
  state: DataGridPointerRangeMoveLike & DataGridPointerFillLike & DataGridPointerDragLike,
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