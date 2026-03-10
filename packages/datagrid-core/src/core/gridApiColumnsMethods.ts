import type {
  DataGridColumnDef,
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridColumnModel,
  DataGridColumnPin,
} from "../models/index.js"
import type { DataGridColumnHistogramCapability } from "./gridApiCapabilities"

export interface DataGridApiColumnsMethods {
  getColumnModelSnapshot: () => ReturnType<DataGridColumnModel["getSnapshot"]>
  getColumn: (key: string) => ReturnType<DataGridColumnModel["getColumn"]>
  setColumns: (columns: DataGridColumnDef[]) => void
  insertColumnsAt: (index: number, columns: readonly DataGridColumnDef[]) => boolean
  insertColumnsBefore: (columnKey: string, columns: readonly DataGridColumnDef[]) => boolean
  insertColumnsAfter: (columnKey: string, columns: readonly DataGridColumnDef[]) => boolean
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
  const normalizeInsertedColumns = (columns: readonly DataGridColumnDef[]): DataGridColumnDef[] => {
    return Array.isArray(columns) ? columns.filter(Boolean) : []
  }
  const materializeColumnDefsFromSnapshot = (): DataGridColumnDef[] => {
    const snapshot = columnModel.getSnapshot()
    return snapshot.columns.map(column => ({
      ...column.column,
      visible: column.visible,
      pin: column.pin,
      width: column.width ?? undefined,
    }))
  }
  const insertColumnsAt = (index: number, columns: readonly DataGridColumnDef[]): boolean => {
    const nextColumns = normalizeInsertedColumns(columns)
    if (nextColumns.length === 0) {
      return false
    }
    const current = materializeColumnDefsFromSnapshot()
    const safeIndex = Number.isFinite(index)
      ? Math.max(0, Math.min(current.length, Math.trunc(index)))
      : current.length
    const merged = current.slice()
    merged.splice(safeIndex, 0, ...nextColumns)
    columnModel.setColumns(merged)
    return true
  }

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
    insertColumnsAt(index: number, columns: readonly DataGridColumnDef[]) {
      return insertColumnsAt(index, columns)
    },
    insertColumnsBefore(columnKey: string, columns: readonly DataGridColumnDef[]) {
      const snapshot = columnModel.getSnapshot()
      const targetIndex = snapshot.order.indexOf(columnKey)
      if (targetIndex < 0) {
        return false
      }
      return insertColumnsAt(targetIndex, columns)
    },
    insertColumnsAfter(columnKey: string, columns: readonly DataGridColumnDef[]) {
      const snapshot = columnModel.getSnapshot()
      const targetIndex = snapshot.order.indexOf(columnKey)
      if (targetIndex < 0) {
        return false
      }
      return insertColumnsAt(targetIndex + 1, columns)
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
