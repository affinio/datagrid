export type DataGridPivotColumnSubtotalPosition = "after" | "before"
export type DataGridPivotColumnGrandTotalPosition = "last" | "first"

export type DataGridAggOp =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "countNonNull"
  | "first"
  | "last"
  | "custom"

export interface DataGridPivotValueSpec {
  field: string
  agg: DataGridAggOp
  aggregationId?: string
}

export interface DataGridPivotSpec {
  rows: string[]
  columns: string[]
  values: DataGridPivotValueSpec[]
  rowSubtotals?: boolean
  columnSubtotals?: boolean
  columnGrandTotal?: boolean
  columnSubtotalPosition?: DataGridPivotColumnSubtotalPosition
  columnGrandTotalPosition?: DataGridPivotColumnGrandTotalPosition
  grandTotal?: boolean
}

export interface DataGridPivotColumnPathSegment {
  field: string
  value: string
}

export interface DataGridPivotColumn {
  id: string
  valueField: string
  agg: DataGridAggOp
  aggregationId?: string
  columnPath: readonly DataGridPivotColumnPathSegment[]
  label: string
  subtotal?: boolean
  grandTotal?: boolean
}
