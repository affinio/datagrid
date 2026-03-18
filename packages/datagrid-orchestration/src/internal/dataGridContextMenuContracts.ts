export type DataGridContextMenuZone = "cell" | "range" | "header" | "row-index"

export type DataGridContextMenuActionId =
  | "copy"
  | "paste"
  | "cut"
  | "clear"
  | "insert-row-above"
  | "insert-row-below"
  | "copy-row"
  | "paste-row"
  | "cut-row"
  | "delete-selected-rows"
  | "sort-asc"
  | "sort-desc"
  | "sort-clear"
  | "filter"
  | "auto-size"

export interface DataGridContextMenuState {
  visible: boolean
  x: number
  y: number
  zone: DataGridContextMenuZone
  columnKey: string | null
  rowId: string | null
}

export interface DataGridContextMenuAction {
  id: DataGridContextMenuActionId
  label: string
}

export interface OpenDataGridContextMenuInput {
  zone: DataGridContextMenuZone
  columnKey?: string | null
  rowId?: string | null
}