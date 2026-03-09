import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"
import {
  bumpRowVersions,
  createRowVersionIndex,
  rebuildRowVersionIndex,
} from "../clientRowRuntimeUtils.js"

export interface ClientRowRowVersionRuntime<T> {
  getIndex: () => Map<DataGridRowId, number>
  setIndex: (index: Map<DataGridRowId, number>) => void
  rebuild: (rows: readonly DataGridRowNode<T>[]) => Map<DataGridRowId, number>
  bump: (rowIds: readonly DataGridRowId[]) => void
  clear: () => void
}

export function createClientRowRowVersionRuntime<T>(
  rows: readonly DataGridRowNode<T>[],
): ClientRowRowVersionRuntime<T> {
  let rowVersionById = createRowVersionIndex(rows)

  return {
    getIndex() {
      return rowVersionById
    },
    setIndex(index: Map<DataGridRowId, number>) {
      rowVersionById = index
    },
    rebuild(rows: readonly DataGridRowNode<T>[]) {
      return rebuildRowVersionIndex(rowVersionById, rows)
    },
    bump(rowIds: readonly DataGridRowId[]) {
      bumpRowVersions(rowVersionById, rowIds)
    },
    clear() {
      rowVersionById.clear()
    },
  }
}
