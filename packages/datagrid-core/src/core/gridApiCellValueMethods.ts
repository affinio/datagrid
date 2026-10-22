import { buildDataGridCellRenderModel } from "../cells/runtime.js"
import type { DataGridColumnModel, DataGridColumnSnapshot, DataGridRowModel, DataGridRowNode } from "../models/index.js"
import type { DataGridRowId } from "../models/rowModel.js"

export type DataGridCellValuePurpose = "source" | "computed" | "display"

/** Immutable row and column inputs for resolving a value against a captured read view. */
export interface DataGridCellValueSnapshot<TRow = unknown> {
  readonly row: Pick<DataGridRowNode<TRow>, "rowId" | "kind" | "data">
  readonly column: DataGridColumnSnapshot
}

export type DataGridCellValueResolution =
  | Readonly<{
      status: "available"
      rowId: DataGridRowId
      columnKey: string
      sourceValue: unknown
      computedValue: unknown
      formattedValue: string
      displayValue: string
      value: unknown
      writeTarget: Readonly<{ kind: "row-patch"; key: string }> | Readonly<{ kind: "custom-setter" }> | null
    }>
  | Readonly<{
      status: "unavailable"
      reason: "row-not-found" | "row-not-loaded" | "group-row" | "column-not-found"
    }>

export interface DataGridApiCellValueMethods<TRow = unknown> {
  resolveValue(input: {
    rowId: DataGridRowId
    columnKey: string
    purpose: DataGridCellValuePurpose
    snapshot?: DataGridCellValueSnapshot<TRow>
  }): DataGridCellValueResolution
}

export function createDataGridApiCellValueMethods<TRow>(input: {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
}): DataGridApiCellValueMethods<TRow> {
  return {
    resolveValue({ rowId, columnKey, purpose, snapshot }) {
      const column = snapshot
        ? snapshot.column.key === columnKey ? snapshot.column : undefined
        : input.columnModel.getSnapshot().byKey[columnKey]
      if (!column) return Object.freeze({ status: "unavailable", reason: "column-not-found" })
      if (snapshot && snapshot.row.rowId !== rowId) {
        return Object.freeze({ status: "unavailable", reason: "row-not-found" })
      }
      const row = snapshot ? snapshot.row : input.rowModel.getRowById?.(rowId)
      if (!row) {
        return Object.freeze({
          status: "unavailable",
          reason: input.rowModel.kind === "server" ? "row-not-loaded" : "row-not-found",
        })
      }
      if (row.kind === "group") return Object.freeze({ status: "unavailable", reason: "group-row" })

      const field = typeof column.column.field === "string" && column.column.field.length > 0
        ? column.column.field
        : columnKey
      const sourceValue = readPath(row.data, field)
      const computedValue = typeof column.column.accessor === "function"
        ? column.column.accessor(row.data)
        : typeof column.column.valueGetter === "function"
          ? column.column.valueGetter(row.data)
          : sourceValue
      const rendered = buildDataGridCellRenderModel({ column: column.column, row: row.data, value: computedValue })
      const value = purpose === "source"
        ? sourceValue
        : purpose === "computed"
          ? computedValue
          : rendered.displayValue
      const writeTarget = typeof column.column.valueSetter === "function"
        ? Object.freeze({ kind: "custom-setter" as const })
        : typeof column.column.accessor === "function"
          || typeof column.column.valueGetter === "function"
          || field.includes(".")
          ? null
          : Object.freeze({ kind: "row-patch" as const, key: field })

      return Object.freeze({
        status: "available",
        rowId,
        columnKey,
        sourceValue,
        computedValue,
        formattedValue: rendered.formattedValue,
        displayValue: rendered.displayValue,
        value,
        writeTarget,
      })
    },
  }
}

function readPath(value: unknown, path: string): unknown {
  let current = value
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object" || !(key in current)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}
