import type {
  DataGridAggregationModel,
  DataGridPivotColumn,
} from "./rowModel.js"

export function clonePullAggregationModel<T>(
  input: DataGridAggregationModel<T> | null | undefined,
): DataGridAggregationModel<T> | null {
  if (!input) {
    return null
  }
  return {
    basis: input.basis,
    columns: input.columns.map(column => ({ ...column })),
  }
}

export function isSamePullAggregationModel<T>(
  left: DataGridAggregationModel<T> | null,
  right: DataGridAggregationModel<T> | null,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  if (left.basis !== right.basis || left.columns.length !== right.columns.length) {
    return false
  }
  for (let index = 0; index < left.columns.length; index += 1) {
    const leftColumn = left.columns[index]
    const rightColumn = right.columns[index]
    if (
      !leftColumn ||
      !rightColumn ||
      leftColumn.key !== rightColumn.key ||
      leftColumn.field !== rightColumn.field ||
      leftColumn.op !== rightColumn.op
    ) {
      return false
    }
  }
  return true
}

export function normalizePivotColumnsFromUnknown(
  pivotColumns: readonly DataGridPivotColumn[] | null | undefined,
): DataGridPivotColumn[] | null {
  if (!Array.isArray(pivotColumns)) {
    return null
  }
  return pivotColumns.map(column => ({
    id: String(column.id),
    valueField: String(column.valueField),
    agg: column.agg,
    label: String(column.label),
    ...(column.subtotal ? { subtotal: true } : {}),
    ...(column.grandTotal ? { grandTotal: true } : {}),
    columnPath: Array.isArray(column.columnPath)
      ? column.columnPath.map((segment: { field?: unknown; value?: unknown }) => ({
          field: String(segment.field ?? ""),
          value: String(segment.value ?? ""),
        }))
      : [],
  }))
}

export function clonePivotColumnsSnapshot(
  pivotColumns: readonly DataGridPivotColumn[],
): DataGridPivotColumn[] {
  return pivotColumns.map(column => ({
    id: column.id,
    valueField: column.valueField,
    agg: column.agg,
    label: column.label,
    ...(column.subtotal ? { subtotal: true } : {}),
    ...(column.grandTotal ? { grandTotal: true } : {}),
    columnPath: column.columnPath.map((segment: { field: string; value: string }) => ({
      field: segment.field,
      value: segment.value,
    })),
  }))
}

export function isSamePivotColumnsSnapshot(
  left: readonly DataGridPivotColumn[],
  right: readonly DataGridPivotColumn[],
): boolean {
  if (left === right) {
    return true
  }
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftColumn = left[index]
    const rightColumn = right[index]
    if (!leftColumn || !rightColumn) {
      return false
    }
    if (
      leftColumn.id !== rightColumn.id ||
      leftColumn.valueField !== rightColumn.valueField ||
      leftColumn.agg !== rightColumn.agg ||
      leftColumn.label !== rightColumn.label ||
      Boolean(leftColumn.subtotal) !== Boolean(rightColumn.subtotal) ||
      Boolean(leftColumn.grandTotal) !== Boolean(rightColumn.grandTotal)
    ) {
      return false
    }
    if (leftColumn.columnPath.length !== rightColumn.columnPath.length) {
      return false
    }
    for (let pathIndex = 0; pathIndex < leftColumn.columnPath.length; pathIndex += 1) {
      const leftPath = leftColumn.columnPath[pathIndex]
      const rightPath = rightColumn.columnPath[pathIndex]
      if (!leftPath || !rightPath || leftPath.field !== rightPath.field || leftPath.value !== rightPath.value) {
        return false
      }
    }
  }
  return true
}
