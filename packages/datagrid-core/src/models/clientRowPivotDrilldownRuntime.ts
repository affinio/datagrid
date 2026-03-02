import type {
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  DataGridPivotColumn,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNode,
} from "./rowModel.js"

interface PivotDrilldownConstraint {
  field: string
  value: string
}

function resolvePivotDrilldownRowConstraints<T>(
  row: DataGridRowNode<T>,
  rowFields: readonly string[],
  normalizePivotAxisValue: (value: unknown) => string,
  readRowField: (row: DataGridRowNode<T>, key: string) => unknown,
): PivotDrilldownConstraint[] {
  if (String(row.rowId) === "pivot:grand-total") {
    return []
  }
  const constraints: PivotDrilldownConstraint[] = []
  if (row.kind === "group") {
    const depth = Math.max(1, Math.min(rowFields.length, Math.trunc((row.groupMeta?.level ?? 0) + 1)))
    for (let index = 0; index < depth; index += 1) {
      const field = rowFields[index]
      if (!field) {
        continue
      }
      constraints.push({
        field,
        value: normalizePivotAxisValue(readRowField(row, field)),
      })
    }
    return constraints
  }

  for (const field of rowFields) {
    const normalizedValue = normalizePivotAxisValue(readRowField(row, field))
    if (normalizedValue === "Subtotal" || normalizedValue === "Grand Total") {
      break
    }
    constraints.push({
      field,
      value: normalizedValue,
    })
  }
  return constraints
}

export interface ResolveClientRowPivotCellDrilldownInput<T> {
  input: DataGridPivotCellDrilldownInput
  pivotModel: DataGridPivotSpec | null
  pivotColumns: readonly DataGridPivotColumn[]
  aggregatedRowsProjection: readonly DataGridRowNode<T>[]
  pivotedRowsProjection: readonly DataGridRowNode<T>[]
  groupedRowsProjection: readonly DataGridRowNode<T>[]
  sourceRows: readonly DataGridRowNode<T>[]
  isDataGridRowId: (value: unknown) => value is DataGridRowId
  normalizePivotAxisValue: (value: unknown) => string
  readRowField: (row: DataGridRowNode<T>, key: string) => unknown
}

export function resolveClientRowPivotCellDrilldown<T>(
  context: ResolveClientRowPivotCellDrilldownInput<T>,
): DataGridPivotCellDrilldown<T> | null {
  const {
    input,
    pivotModel,
    pivotColumns,
    aggregatedRowsProjection,
    pivotedRowsProjection,
    groupedRowsProjection,
    sourceRows,
    isDataGridRowId,
    normalizePivotAxisValue,
    readRowField,
  } = context

  if (!pivotModel || !Array.isArray(pivotColumns) || pivotColumns.length === 0) {
    return null
  }
  if (!isDataGridRowId(input?.rowId)) {
    return null
  }
  const columnId = typeof input.columnId === "string" ? input.columnId.trim() : ""
  if (columnId.length === 0) {
    return null
  }
  const pivotColumn = pivotColumns.find(column => column.id === columnId)
  if (!pivotColumn) {
    return null
  }
  const pivotRow = aggregatedRowsProjection.find(row => row.rowId === input.rowId)
    ?? pivotedRowsProjection.find(row => row.rowId === input.rowId)
    ?? groupedRowsProjection.find(row => row.rowId === input.rowId)
  if (!pivotRow) {
    return null
  }
  const normalizedLimit = Number.isFinite(input.limit)
    ? Math.max(1, Math.min(5000, Math.trunc(input.limit as number)))
    : 200
  const rowConstraints = resolvePivotDrilldownRowConstraints(
    pivotRow,
    pivotModel.rows,
    normalizePivotAxisValue,
    readRowField,
  )
  const columnConstraints = pivotColumn.columnPath.map((segment: { field: string; value: string }) => ({
    field: segment.field,
    value: segment.value,
  }))
  const matches: DataGridRowNode<T>[] = []
  let matchCount = 0
  for (const sourceRow of sourceRows) {
    if (sourceRow.kind !== "leaf") {
      continue
    }
    let rowMatches = true
    for (const constraint of rowConstraints) {
      if (normalizePivotAxisValue(readRowField(sourceRow, constraint.field)) !== constraint.value) {
        rowMatches = false
        break
      }
    }
    if (!rowMatches) {
      continue
    }
    let columnMatches = true
    for (const constraint of columnConstraints) {
      if (normalizePivotAxisValue(readRowField(sourceRow, constraint.field)) !== constraint.value) {
        columnMatches = false
        break
      }
    }
    if (!columnMatches) {
      continue
    }
    matchCount += 1
    if (matches.length < normalizedLimit) {
      matches.push(sourceRow)
    }
  }
  return {
    rowId: input.rowId,
    columnId,
    valueField: pivotColumn.valueField,
    agg: pivotColumn.agg,
    cellValue: readRowField(pivotRow, columnId),
    matchCount,
    truncated: matchCount > matches.length,
    rows: matches,
  }
}
