import type {
  DataGridAggOp,
  DataGridPivotColumn,
  DataGridPivotColumnPathSegment,
  DataGridPivotSpec,
} from "./contracts.js"

export interface DataGridPivotRuntimeValueSpec {
  field: string
  agg: DataGridAggOp
  aggregateKey: string
}

const pivotPathValueCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

export function createPivotAxisKey(
  prefix: "pivot:row:" | "pivot:column:" | "pivot:column-subtotal:" | "pivot:subtotal:" | "pivot:group:",
  segments: readonly { field: string; value: string }[],
): string {
  let encoded = prefix
  for (const segment of segments) {
    encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`
  }
  return encoded
}

export function createPivotAggregateKey(spec: DataGridPivotRuntimeValueSpec): string {
  return `pivot:agg:${spec.agg.length}:${spec.agg}${spec.field.length}:${spec.field}`
}

export function createPivotColumnId(
  columnKey: string,
  valueSpec: DataGridPivotRuntimeValueSpec,
): string {
  return `pivot|${columnKey}|${createPivotAggregateKey(valueSpec)}`
}

export function createPivotColumnLabel(
  columnPath: readonly DataGridPivotColumnPathSegment[],
  valueSpec: DataGridPivotRuntimeValueSpec,
  options: { subtotal?: boolean; grandTotal?: boolean } = {},
): string {
  const axisLabel = options.grandTotal
    ? "grand total"
    : columnPath.length === 0
      ? "total"
      : columnPath.map(segment => `${segment.field}=${segment.value}`).join(" · ")
  const subtotalLabel = options.subtotal ? " · subtotal" : ""
  return `${axisLabel}${subtotalLabel} · ${valueSpec.agg}(${valueSpec.field})`
}

export function normalizePivotAxisValue(
  value: unknown,
  normalizeFieldValue: (value: unknown) => string,
): string {
  if (value == null) {
    return ""
  }
  const normalized = normalizeFieldValue(value)
  return normalized == null ? "" : String(normalized)
}

export function comparePivotPathSegments(
  left: readonly { field: string; value: string }[],
  right: readonly { field: string; value: string }[],
): number {
  const maxLength = Math.max(left.length, right.length)
  for (let index = 0; index < maxLength; index += 1) {
    const leftSegment = left[index]
    const rightSegment = right[index]
    if (!leftSegment && !rightSegment) {
      return 0
    }
    if (!leftSegment) {
      return -1
    }
    if (!rightSegment) {
      return 1
    }
    const fieldComparison = leftSegment.field < rightSegment.field
      ? -1
      : leftSegment.field > rightSegment.field
        ? 1
        : 0
    if (fieldComparison !== 0) {
      return fieldComparison
    }
    const valueComparison = pivotPathValueCollator.compare(leftSegment.value, rightSegment.value)
    if (valueComparison !== 0) {
      return valueComparison
    }
  }
  return 0
}

export function isPivotPathPrefixOrEqual(
  prefix: readonly { field: string; value: string }[],
  candidate: readonly { field: string; value: string }[],
): boolean {
  if (prefix.length > candidate.length) {
    return false
  }
  for (let index = 0; index < prefix.length; index += 1) {
    const leftSegment = prefix[index]
    const rightSegment = candidate[index]
    if (!leftSegment || !rightSegment) {
      return false
    }
    if (leftSegment.field !== rightSegment.field || leftSegment.value !== rightSegment.value) {
      return false
    }
  }
  return true
}

export function normalizePivotColumns(
  columns: readonly DataGridPivotColumn[],
): DataGridPivotColumn[] {
  return columns.map(column => ({
    id: column.id,
    valueField: column.valueField,
    agg: column.agg,
    label: column.label,
    ...(column.subtotal ? { subtotal: true } : {}),
    ...(column.grandTotal ? { grandTotal: true } : {}),
    columnPath: column.columnPath.map(segment => ({
      field: segment.field,
      value: segment.value,
    })),
  }))
}

export function serializePivotModelForIncrementalState(pivotModel: DataGridPivotSpec): string {
  return JSON.stringify({
    rows: pivotModel.rows,
    columns: pivotModel.columns,
    values: pivotModel.values.map(value => ({ field: value.field, agg: value.agg })),
    rowSubtotals: pivotModel.rowSubtotals === true,
    columnSubtotals: pivotModel.columnSubtotals === true,
    grandTotal: pivotModel.grandTotal === true,
    columnGrandTotal: pivotModel.columnGrandTotal === true,
    columnSubtotalPosition: pivotModel.columnSubtotalPosition === "before" ? "before" : "after",
    columnGrandTotalPosition: pivotModel.columnGrandTotalPosition === "first" ? "first" : "last",
  })
}
