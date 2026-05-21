import {
  normalizePivotAxisValue,
  type DataGridPivotCellDrilldown,
  type DataGridPivotCellDrilldownInput,
  type DataGridPivotSpec,
} from "@affino/datagrid-pivot"
import type {
  DataGridPivotColumn,
  DataGridRowId,
  DataGridRowNode,
} from "../rowModel.js"
import { normalizeText } from "../projection/clientRowProjectionPrimitives.js"
import { resolveClientRowPivotCellDrilldown } from "./clientRowPivotDrilldownRuntime.js"

export interface CreateClientRowPivotDrilldownHostRuntimeOptions<T> {
  ensureActive: () => void
  getPivotModel: () => DataGridPivotSpec | null
  getPivotColumns: () => readonly DataGridPivotColumn[]
  getAggregatedRowsProjection: () => readonly DataGridRowNode<T>[]
  getPivotedRowsProjection: () => readonly DataGridRowNode<T>[]
  getGroupedRowsProjection: () => readonly DataGridRowNode<T>[]
  getSourceRows: () => readonly DataGridRowNode<T>[]
  isDataGridRowId: (value: unknown) => value is DataGridRowId
  readProjectionRowField: (row: DataGridRowNode<T>, key: string) => unknown
  materializeOutputRows: (rows: readonly DataGridRowNode<T>[]) => DataGridRowNode<T>[]
}

export interface ClientRowPivotDrilldownHostRuntime<T> {
  getPivotCellDrilldown(input: DataGridPivotCellDrilldownInput): DataGridPivotCellDrilldown<T> | null
}

export function createClientRowPivotDrilldownHostRuntime<T>(
  options: CreateClientRowPivotDrilldownHostRuntimeOptions<T>,
): ClientRowPivotDrilldownHostRuntime<T> {
  return {
    getPivotCellDrilldown(input) {
      options.ensureActive()
      const drilldown = resolveClientRowPivotCellDrilldown({
        input,
        pivotModel: options.getPivotModel(),
        pivotColumns: options.getPivotColumns(),
        aggregatedRowsProjection: options.getAggregatedRowsProjection(),
        pivotedRowsProjection: options.getPivotedRowsProjection(),
        groupedRowsProjection: options.getGroupedRowsProjection(),
        sourceRows: options.getSourceRows(),
        isDataGridRowId: options.isDataGridRowId,
        normalizePivotAxisValue: (value: unknown) => normalizePivotAxisValue(value, normalizeText),
        readRowField: (row, key) => options.readProjectionRowField(row, key),
      })
      if (!drilldown) {
        return null
      }
      return {
        ...drilldown,
        rows: options.materializeOutputRows(drilldown.rows),
      }
    },
  }
}
