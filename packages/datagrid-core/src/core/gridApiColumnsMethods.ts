import type {
  DataGridColumnDef,
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridColumnModel,
  DataGridColumnPin,
} from "../models"
import type { DataGridColumnHistogramCapability } from "./gridApiCapabilities"

export interface DataGridApiColumnsMethods {
  getColumnModelSnapshot: () => ReturnType<DataGridColumnModel["getSnapshot"]>
  getColumn: (key: string) => ReturnType<DataGridColumnModel["getColumn"]>
  setColumns: (columns: DataGridColumnDef[]) => void
  setColumnOrder: (keys: readonly string[]) => void
  setColumnVisibility: (key: string, visible: boolean) => void
  setColumnWidth: (key: string, width: number | null) => void
  setColumnPin: (key: string, pin: DataGridColumnPin) => void
  getColumnHistogram: (columnId: string, options?: DataGridColumnHistogramOptions) => DataGridColumnHistogram
}

export interface CreateDataGridApiColumnsMethodsInput {
  columnModel: DataGridColumnModel
  getColumnHistogramCapability: () => DataGridColumnHistogramCapability | null
}

export function createDataGridApiColumnsMethods(
  input: CreateDataGridApiColumnsMethodsInput,
): DataGridApiColumnsMethods {
  const { columnModel, getColumnHistogramCapability } = input

  return {
    getColumnModelSnapshot() {
      return columnModel.getSnapshot()
    },
    getColumn(key: string) {
      return columnModel.getColumn(key)
    },
    setColumns(columns: DataGridColumnDef[]) {
      columnModel.setColumns(columns)
    },
    setColumnOrder(keys: readonly string[]) {
      columnModel.setColumnOrder(keys)
    },
    setColumnVisibility(key: string, visible: boolean) {
      columnModel.setColumnVisibility(key, visible)
    },
    setColumnWidth(key: string, width: number | null) {
      columnModel.setColumnWidth(key, width)
    },
    setColumnPin(key: string, pin: DataGridColumnPin) {
      columnModel.setColumnPin(key, pin)
    },
    getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions) {
      const capability = getColumnHistogramCapability()
      if (!capability) {
        return []
      }
      return capability.getColumnHistogram(columnId, options)
    },
  }
}
