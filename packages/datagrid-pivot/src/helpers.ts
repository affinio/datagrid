import type {
  DataGridAggOp,
  DataGridPivotSpec,
  DataGridPivotValueSpec,
} from "./contracts.js"

function isPivotAggOp(value: unknown): value is DataGridAggOp {
  return (
    value === "sum"
    || value === "avg"
    || value === "min"
    || value === "max"
    || value === "count"
    || value === "countNonNull"
    || value === "first"
    || value === "last"
    || value === "custom"
  )
}

function normalizePivotFieldList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return []
  }
  const unique = new Set<string>()
  for (const rawField of input) {
    if (typeof rawField !== "string") {
      continue
    }
    const field = rawField.trim()
    if (field.length === 0 || unique.has(field)) {
      continue
    }
    unique.add(field)
  }
  return Array.from(unique)
}

export function normalizePivotSpec(
  pivotSpec: DataGridPivotSpec | null | undefined,
): DataGridPivotSpec | null {
  if (!pivotSpec) {
    return null
  }

  const normalizedRows = normalizePivotFieldList(pivotSpec.rows)
  const normalizedColumns = normalizePivotFieldList(pivotSpec.columns)
  const normalizedValues: DataGridPivotValueSpec[] = []
  const seenValues = new Set<string>()

  if (Array.isArray(pivotSpec.values)) {
    for (const valueSpec of pivotSpec.values) {
      const field = typeof valueSpec?.field === "string"
        ? valueSpec.field.trim()
        : ""
      const agg = valueSpec?.agg
      if (field.length === 0 || !isPivotAggOp(agg)) {
        continue
      }
      const dedupeKey = `${field}::${agg}`
      if (seenValues.has(dedupeKey)) {
        continue
      }
      seenValues.add(dedupeKey)
      normalizedValues.push({
        field,
        agg,
      })
    }
  }

  if (normalizedValues.length === 0) {
    return null
  }

  const rowSubtotals = pivotSpec.rowSubtotals === true
  const columnSubtotals = pivotSpec.columnSubtotals === true
  const columnGrandTotal = pivotSpec.columnGrandTotal === true
  const columnSubtotalPosition = pivotSpec.columnSubtotalPosition === "before"
    ? "before"
    : undefined
  const columnGrandTotalPosition = pivotSpec.columnGrandTotalPosition === "first"
    ? "first"
    : undefined
  const grandTotal = pivotSpec.grandTotal === true

  return {
    rows: normalizedRows,
    columns: normalizedColumns,
    values: normalizedValues,
    ...(rowSubtotals ? { rowSubtotals: true } : {}),
    ...(columnSubtotals ? { columnSubtotals: true } : {}),
    ...(columnGrandTotal ? { columnGrandTotal: true } : {}),
    ...(columnSubtotalPosition ? { columnSubtotalPosition } : {}),
    ...(columnGrandTotalPosition ? { columnGrandTotalPosition } : {}),
    ...(grandTotal ? { grandTotal: true } : {}),
  }
}

export function clonePivotSpec(
  pivotSpec: DataGridPivotSpec | null | undefined,
): DataGridPivotSpec | null {
  const normalized = normalizePivotSpec(pivotSpec)
  if (!normalized) {
    return null
  }
  return {
    rows: [...normalized.rows],
    columns: [...normalized.columns],
    values: normalized.values.map(value => ({ ...value })),
    ...(normalized.rowSubtotals ? { rowSubtotals: true } : {}),
    ...(normalized.columnSubtotals ? { columnSubtotals: true } : {}),
    ...(normalized.columnGrandTotal ? { columnGrandTotal: true } : {}),
    ...(normalized.columnSubtotalPosition
      ? { columnSubtotalPosition: normalized.columnSubtotalPosition }
      : {}),
    ...(normalized.columnGrandTotalPosition
      ? { columnGrandTotalPosition: normalized.columnGrandTotalPosition }
      : {}),
    ...(normalized.grandTotal ? { grandTotal: true } : {}),
  }
}

export function isSamePivotSpec(
  left: DataGridPivotSpec | null | undefined,
  right: DataGridPivotSpec | null | undefined,
): boolean {
  const normalizedLeft = normalizePivotSpec(left)
  const normalizedRight = normalizePivotSpec(right)
  if (!normalizedLeft && !normalizedRight) {
    return true
  }
  if (!normalizedLeft || !normalizedRight) {
    return false
  }
  if (normalizedLeft.rows.length !== normalizedRight.rows.length) {
    return false
  }
  if (normalizedLeft.columns.length !== normalizedRight.columns.length) {
    return false
  }
  if (normalizedLeft.values.length !== normalizedRight.values.length) {
    return false
  }
  if (Boolean(normalizedLeft.rowSubtotals) !== Boolean(normalizedRight.rowSubtotals)) {
    return false
  }
  if (Boolean(normalizedLeft.columnSubtotals) !== Boolean(normalizedRight.columnSubtotals)) {
    return false
  }
  if (Boolean(normalizedLeft.columnGrandTotal) !== Boolean(normalizedRight.columnGrandTotal)) {
    return false
  }
  if ((normalizedLeft.columnSubtotalPosition ?? "after") !== (normalizedRight.columnSubtotalPosition ?? "after")) {
    return false
  }
  if ((normalizedLeft.columnGrandTotalPosition ?? "last") !== (normalizedRight.columnGrandTotalPosition ?? "last")) {
    return false
  }
  if (Boolean(normalizedLeft.grandTotal) !== Boolean(normalizedRight.grandTotal)) {
    return false
  }
  for (let index = 0; index < normalizedLeft.rows.length; index += 1) {
    if (normalizedLeft.rows[index] !== normalizedRight.rows[index]) {
      return false
    }
  }
  for (let index = 0; index < normalizedLeft.columns.length; index += 1) {
    if (normalizedLeft.columns[index] !== normalizedRight.columns[index]) {
      return false
    }
  }
  for (let index = 0; index < normalizedLeft.values.length; index += 1) {
    const leftValue = normalizedLeft.values[index]
    const rightValue = normalizedRight.values[index]
    if (!leftValue || !rightValue) {
      return false
    }
    if (leftValue.field !== rightValue.field || leftValue.agg !== rightValue.agg) {
      return false
    }
  }
  return true
}
