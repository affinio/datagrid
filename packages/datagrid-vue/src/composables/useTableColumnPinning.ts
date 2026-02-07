import type { Ref } from "vue"

import type { UiTableColumn } from "@affino/datagrid-core/types"
import type { ColumnPinPosition } from "../context"
import { normalizeColumnPinInput, resolveColumnPinPosition } from "../adapters/columnPinNormalization"

interface UseTableColumnPinningOptions {
  localColumns: Ref<UiTableColumn[]>
  reorderColumns: (columns: UiTableColumn[]) => void
  getStoredPinState: () => Record<string, ColumnPinPosition> | null | undefined
}

export interface UseTableColumnPinningResult {
  resolveColumnPinState: (column: UiTableColumn) => ColumnPinPosition
  applyStoredPinState: () => void
  reorderPinnedColumns: () => void
  setColumnPin: (columnKey: string, position: ColumnPinPosition) => void
}

function applyPinProps(column: UiTableColumn, position: ColumnPinPosition): UiTableColumn {
  const normalized = normalizeColumnPinInput(column) as UiTableColumn
  if (normalized.isSystem) {
    return { ...normalized, pin: "left" }
  }
  return { ...normalized, pin: position }
}

export function useTableColumnPinning(options: UseTableColumnPinningOptions): UseTableColumnPinningResult {
  const resolveColumnPinState = (column: UiTableColumn): ColumnPinPosition => {
    return resolveColumnPinPosition(column)
  }

  const applyStoredPinState = () => {
    const stored = options.getStoredPinState()
    if (!stored) return
    options.localColumns.value = options.localColumns.value.map(column => {
      if (column.isSystem) return column
      const position = stored[column.key] ?? "none"
      return applyPinProps(column, position)
    })
  }

  const reorderPinnedColumns = () => {
    const columns = options.localColumns.value
    const left = columns.filter(column => !column.isSystem && resolveColumnPinState(column) === "left")
    const right = columns.filter(column => !column.isSystem && resolveColumnPinState(column) === "right")
    if (!left.length && !right.length) return

    const systemColumns = columns.filter(column => column.isSystem)
    const middle = columns.filter(column => !column.isSystem && resolveColumnPinState(column) === "none")
    const desiredOrder = [...systemColumns, ...left, ...middle, ...right]
    const currentOrderKey = columns.map(column => column.key).join("|")
    const desiredOrderKey = desiredOrder.map(column => column.key).join("|")
    if (currentOrderKey === desiredOrderKey) return
    options.reorderColumns(desiredOrder)
  }

  const setColumnPin = (columnKey: string, position: ColumnPinPosition) => {
    options.localColumns.value = options.localColumns.value.map(column =>
      column.key === columnKey ? applyPinProps(column, position) : column,
    )
    reorderPinnedColumns()
  }

  return {
    resolveColumnPinState,
    applyStoredPinState,
    reorderPinnedColumns,
    setColumnPin,
  }
}
