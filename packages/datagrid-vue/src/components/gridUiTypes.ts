import type { DataGridRowNode } from "@affino/datagrid-core"

export interface DataGridUiColumn {
  key: string
  label: string
}

export interface DataGridCellClickPayload {
  row: DataGridRowNode<unknown>
  rowIndex: number
  columnKey: string
  columnIndex: number
  additive?: boolean
  toggle?: boolean
}

export interface DataGridRowSelectPayload {
  row: DataGridRowNode<unknown>
  rowIndex: number
  additive?: boolean
  toggle?: boolean
}
