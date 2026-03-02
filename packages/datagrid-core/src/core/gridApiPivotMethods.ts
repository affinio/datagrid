import type {
  DataGridColumnModel,
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  DataGridPivotSpec,
  DataGridRowModel,
} from "../models"
import {
  exportPivotInteropSnapshot,
  exportPivotLayoutSnapshot,
  importPivotLayoutSnapshot,
  type DataGridPivotLayoutImportOptions,
  type DataGridPivotLayoutSnapshot,
  type DataGridPivotInteropSnapshot,
} from "./gridApiPivotLayout"
import type { DataGridSortFilterBatchCapability } from "./gridApiCapabilities"

export interface DataGridApiPivotMethods<TRow = unknown> {
  setPivotModel: (pivotModel: DataGridPivotSpec | null) => void
  getPivotModel: () => DataGridPivotSpec | null
  getPivotCellDrilldown: (input: DataGridPivotCellDrilldownInput) => DataGridPivotCellDrilldown<TRow> | null
  exportPivotLayout: () => DataGridPivotLayoutSnapshot<TRow>
  exportPivotInterop: () => DataGridPivotInteropSnapshot<TRow> | null
  importPivotLayout: (
    layout: DataGridPivotLayoutSnapshot<TRow>,
    options?: DataGridPivotLayoutImportOptions,
  ) => void
}

export interface CreateDataGridApiPivotMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  getSortFilterBatchCapability: () => DataGridSortFilterBatchCapability | null
}

export function createDataGridApiPivotMethods<TRow = unknown>(
  input: CreateDataGridApiPivotMethodsInput<TRow>,
): DataGridApiPivotMethods<TRow> {
  const { rowModel, columnModel, getSortFilterBatchCapability } = input

  return {
    setPivotModel(pivotModel: DataGridPivotSpec | null) {
      rowModel.setPivotModel(pivotModel)
    },
    getPivotModel() {
      return rowModel.getPivotModel()
    },
    getPivotCellDrilldown(input: DataGridPivotCellDrilldownInput) {
      return typeof rowModel.getPivotCellDrilldown === "function"
        ? rowModel.getPivotCellDrilldown(input)
        : null
    },
    exportPivotLayout() {
      return exportPivotLayoutSnapshot(rowModel, columnModel)
    },
    exportPivotInterop() {
      return exportPivotInteropSnapshot(rowModel, columnModel)
    },
    importPivotLayout(
      layout: DataGridPivotLayoutSnapshot<TRow>,
      options: DataGridPivotLayoutImportOptions = {},
    ) {
      return importPivotLayoutSnapshot(
        rowModel,
        columnModel,
        getSortFilterBatchCapability(),
        layout,
        options,
      )
    },
  }
}
