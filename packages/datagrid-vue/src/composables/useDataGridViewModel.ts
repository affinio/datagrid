import type { DataGridRowModelSnapshot, DataGridRowNode } from "@affino/datagrid-core"
import { computed, onBeforeUnmount, shallowRef, watch, type ComputedRef, type ShallowRef } from "vue"

interface DataGridRuntimeShape<TRow = unknown> {
  api: {
    rows: {
      getSnapshot(): DataGridRowModelSnapshot<TRow>
      getRange(range: DataGridRowModelSnapshot<TRow>["viewportRange"]): readonly DataGridRowNode<TRow>[]
    }
  }
  runtime: {
    rowModel: {
      subscribe(listener: () => void): () => void
    }
    columnModel: {
      subscribe(listener: () => void): () => void
    }
    columnSnapshot: {
      value: {
        visibleColumns: ReadonlyArray<{
          key: string
          column: {
            label?: string
          }
        }>
      }
    }
    virtualWindow: {
      value: {
        rowTotal: number
        colTotal: number
      } | null
    }
  }
}

export interface DataGridViewColumn {
  key: string
  label: string
}

export interface UseDataGridViewModelResult<TRow = unknown> {
  rowSnapshot: ShallowRef<DataGridRowModelSnapshot<TRow>>
  visibleRows: ShallowRef<ReadonlyArray<DataGridRowNode<TRow>>>
  visibleColumns: ComputedRef<ReadonlyArray<DataGridViewColumn>>
  virtualWindow: DataGridRuntimeShape<TRow>["runtime"]["virtualWindow"]
  readCell: (row: DataGridRowNode<TRow>, columnKey: string) => unknown
}

export function useDataGridViewModel<TRow = unknown>(grid: DataGridRuntimeShape<TRow>): UseDataGridViewModelResult<TRow> {
  const rowSnapshot: ShallowRef<DataGridRowModelSnapshot<TRow>> = shallowRef(
    grid.api.rows.getSnapshot() as DataGridRowModelSnapshot<TRow>,
  )
  const visibleRows: ShallowRef<ReadonlyArray<DataGridRowNode<TRow>>> = shallowRef(
    grid.api.rows.getRange(rowSnapshot.value.viewportRange) as readonly DataGridRowNode<TRow>[],
  )

  const refreshRows = () => {
    const snapshot = grid.api.rows.getSnapshot() as DataGridRowModelSnapshot<TRow>
    rowSnapshot.value = snapshot
    visibleRows.value = grid.api.rows.getRange(snapshot.viewportRange) as readonly DataGridRowNode<TRow>[]
  }

  const unsubscribeRowModel = grid.runtime.rowModel.subscribe(() => {
    refreshRows()
  })

  const unsubscribeColumnModel = grid.runtime.columnModel.subscribe(() => {
    refreshRows()
  })

  watch(
    () => grid.runtime.virtualWindow.value,
    () => {
      refreshRows()
    },
    { deep: true },
  )

  onBeforeUnmount(() => {
    unsubscribeRowModel()
    unsubscribeColumnModel()
  })

  const visibleColumns = computed<ReadonlyArray<DataGridViewColumn>>(() => {
    return grid.runtime.columnSnapshot.value.visibleColumns.map(column => ({
      key: column.key,
      label: column.column.label ?? column.key,
    }))
  })

  const readCell = (row: DataGridRowNode<TRow>, columnKey: string): unknown => {
    const rowRecord = row.row as Record<string, unknown>
    return rowRecord[columnKey]
  }

  return {
    rowSnapshot,
    visibleRows,
    visibleColumns,
    virtualWindow: grid.runtime.virtualWindow,
    readCell,
  }
}
