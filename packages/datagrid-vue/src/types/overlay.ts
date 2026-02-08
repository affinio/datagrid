import type { SelectionOverlayRect } from "@affino/datagrid-core/selection/selectionOverlay"
import type { FillHandleStylePayload } from "@affino/datagrid-core/selection/fillHandleStylePool"

export type DataGridOverlayRect = SelectionOverlayRect

export interface DataGridOverlayRectGroups {
  selection?: readonly DataGridOverlayRect[]
  activeSelection?: readonly DataGridOverlayRect[]
  fillPreview?: readonly DataGridOverlayRect[]
  cutPreview?: readonly DataGridOverlayRect[]
  cursor?: DataGridOverlayRect | null
}

export interface DataGridOverlayTransformInput {
  viewportWidth: number
  viewportHeight: number
  scrollLeft: number
  scrollTop: number
  pinnedLeftTranslateX: number
  pinnedRightTranslateX: number
}

export interface DataGridOverlayHandle {
  overlayRef: HTMLDivElement | null
  viewportRef: HTMLDivElement | null
  updateRects(payload: DataGridOverlayRectGroups): void
  updateTransforms(snapshot: DataGridOverlayTransformInput): void
  updateFillHandleStyle(style: FillHandleStylePayload | null | undefined): void
}

// Legacy aliases kept for internal migration paths.
export type UiTableOverlayRect = DataGridOverlayRect
export type UiTableOverlayRectGroups = DataGridOverlayRectGroups
export type UiTableOverlayTransformInput = DataGridOverlayTransformInput
export type UiTableOverlayHandle = DataGridOverlayHandle
