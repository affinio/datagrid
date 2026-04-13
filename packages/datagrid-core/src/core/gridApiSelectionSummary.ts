import type { DataGridColumnModel, DataGridRowModel } from "../models/index.js"
import type { DataGridRowNode } from "../models/index.js"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import { createDataGridSelectionSummary } from "../selection/selectionSummary"
import type { DataGridSelectionSummaryApiOptions } from "./gridApiContracts"

function readByPath(value: unknown, path: string): unknown {
  if (!path || typeof value !== "object" || value === null) {
    return undefined
  }
  const segments = path.split(".").filter(Boolean)
  let current: unknown = value
  for (const segment of segments) {
    if (typeof current !== "object" || current === null || !(segment in (current as Record<string, unknown>))) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function buildColumnValueGetter<TRow>(
  column: ReturnType<DataGridColumnModel["getSnapshot"]>["visibleColumns"][number],
): (rowNode: import("../models/index.js").DataGridRowNode<TRow>) => unknown {
  return rowNode => {
    const rowData = rowNode.data
    if (typeof column.column.valueGetter === "function") {
      return column.column.valueGetter(rowData)
    }
    if (typeof column.column.accessor === "function") {
      return column.column.accessor(rowData)
    }
    const source = rowData as unknown
    if (typeof column.column.field === "string" && column.column.field.length > 0) {
      const fieldValue = readByPath(source, column.column.field)
      if (typeof fieldValue !== "undefined") {
        return fieldValue
      }
    }
    if (typeof source !== "object" || source === null) {
      return undefined
    }
    const direct = (source as Record<string, unknown>)[column.key]
    if (typeof direct !== "undefined") {
      return direct
    }
    return readByPath(source, column.key)
  }
}

export interface BuildDataGridSelectionSummaryInput<TRow = unknown> {
  selectionSnapshot: DataGridSelectionSnapshot
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  options?: DataGridSelectionSummaryApiOptions<TRow>
}

export function buildDataGridSelectionSummary<TRow = unknown>(
  input: BuildDataGridSelectionSummaryInput<TRow>,
) {
  const options = input.options ?? {}
  const columnSnapshot = input.columnModel.getSnapshot()
  const visibleColumns = columnSnapshot.visibleColumns
  const optionColumns = new Map((options.columns ?? []).map(column => [column.key, column]))
  const resolvedColumns: Array<{
    key: string
    aggregations?: readonly import("../selection/selectionSummary.js").DataGridSelectionAggregationKind[]
    valueGetter: (rowNode: DataGridRowNode<TRow>) => unknown
  }> = visibleColumns.map(column => {
    const optionColumn = optionColumns.get(column.key)
    return {
      key: column.key,
      aggregations: optionColumn?.aggregations,
      valueGetter: optionColumn?.valueGetter ?? buildColumnValueGetter<TRow>(column),
    }
  })
  for (const column of options.columns ?? []) {
    if (!optionColumns.has(column.key) || resolvedColumns.some(entry => entry.key === column.key)) {
      continue
    }
    resolvedColumns.push({
      key: column.key,
      aggregations: column.aggregations,
      valueGetter: column.valueGetter ?? ((rowNode: DataGridRowNode<TRow>) => {
        const source = rowNode.data as unknown
        if (typeof source === "object" && source !== null) {
          const direct = (source as Record<string, unknown>)[column.key]
          if (typeof direct !== "undefined") {
            return direct
          }
        }
        return readByPath(source, column.key)
      }),
    })
  }
  const getColumnKeyByIndex = options.getColumnKeyByIndex ?? ((columnIndex: number) => {
    return visibleColumns[columnIndex]?.key ?? null
  })
  const scope = options.scope ?? "selected-loaded"
  const viewportRange = input.rowModel.getSnapshot().viewportRange
  const includeRowIndex = scope === "selected-visible"
    ? (rowIndex: number) => rowIndex >= viewportRange.start && rowIndex <= viewportRange.end
    : undefined

  return createDataGridSelectionSummary<TRow>({
    selection: input.selectionSnapshot,
    scope,
    rowCount: input.rowModel.getRowCount(),
    includeRowIndex,
    getRow: rowIndex => input.rowModel.getRow(rowIndex),
    getColumnKeyByIndex,
    columns: resolvedColumns,
    readSelectionCell: options.readSelectionCell,
    defaultAggregations: options.defaultAggregations,
  })
}
