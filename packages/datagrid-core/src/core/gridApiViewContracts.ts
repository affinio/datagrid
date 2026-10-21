import type {
  DataGridRowId,
  DataGridViewportRange,
} from "../models/index.js"

export type DataGridViewportAlignment = "start" | "center" | "nearest"

export interface DataGridViewportAnchorSnapshot {
  rowId: DataGridRowId | null
  rowIndex: number | null
  columnKey: string | null
  columnIndex: number | null
}

export interface DataGridViewportScrollSnapshot {
  top: number
  left: number
}

export interface DataGridViewportPositionSnapshot {
  version: 1
  range: DataGridViewportRange
  anchor: DataGridViewportAnchorSnapshot | null
  scroll: DataGridViewportScrollSnapshot | null
}

export interface DataGridSetViewportPositionOptions {
  strict?: boolean
}

export interface DataGridViewportRowTarget {
  rowId?: DataGridRowId | null
  rowIndex?: number | null
  align?: DataGridViewportAlignment
}

export interface DataGridViewportColumnTarget {
  columnKey?: string | null
  columnIndex?: number | null
  align?: DataGridViewportAlignment
}

export interface DataGridViewportCellTarget extends DataGridViewportRowTarget, DataGridViewportColumnTarget {}

export interface DataGridActivateCellTarget {
  rowId: DataGridRowId
  columnKey: string
}

export interface DataGridActivateCellOptions {
  selection?: "preserve" | "replace"
  focus?: boolean
  align?: "nearest"
  expandAncestors?: boolean
  signal?: AbortSignal
  origin?: string
  operationId?: string
}

export type DataGridActivateCellResult =
  | { status: "activated" }
  | {
      status: "unavailable"
      reason: "row-not-found" | "row-not-loaded" | "row-filtered-out" | "ancestor-collapsed" | "column-not-found" | "column-hidden"
    }
  | { status: "cancelled"; reason: "aborted" | "superseded" | "interaction-active" | "disposed" }
  | { status: "failed"; error: Error }
