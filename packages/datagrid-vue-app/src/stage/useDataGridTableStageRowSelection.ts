import { buildDataGridCellRenderModel } from "@affino/datagrid-core"
import type {
  DataGridColumnSnapshot,
  DataGridRowId,
  DataGridRowSelectionSnapshot,
} from "@affino/datagrid-vue"
import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import type {
  DataGridTableRow,
  DataGridTableStageAnchorCell,
} from "./dataGridTableStage.types"

export interface UseDataGridTableStageRowSelectionOptions<TRow extends Record<string, unknown>> {
  runtime: Pick<import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>, "api">
  rowSelectionColumn: ComputedRef<DataGridColumnSnapshot | null>
  orderedVisibleColumns: ComputedRef<readonly DataGridColumnSnapshot[]>
  displayRows: Ref<readonly DataGridTableRow<TRow>[]>
  rowSelectionSnapshot: Ref<DataGridRowSelectionSnapshot | null>
  viewportRowStart: Ref<number>
  selectionAnchorCell: ComputedRef<DataGridTableStageAnchorCell | null>
  applySelectionRange: (range: DataGridCopyRange) => void
}

export interface UseDataGridTableStageRowSelectionResult<TRow extends Record<string, unknown>> {
  rowSelectionSet: ComputedRef<Set<DataGridRowId>>
  isRowFocused: (row: DataGridTableRow<TRow>) => boolean
  isRowCheckboxSelected: (row: DataGridTableRow<TRow>) => boolean
  readRowSelectionCell: (row: DataGridTableRow<TRow>) => string
  readRowSelectionDisplayCell: (row: DataGridTableRow<TRow>) => string
  areAllVisibleRowsSelected: ComputedRef<boolean>
  areSomeVisibleRowsSelected: ComputedRef<boolean>
  focusRow: (row: DataGridTableRow<TRow>) => void
  toggleRowCheckboxSelected: (row: DataGridTableRow<TRow>) => void
  toggleVisibleRowsSelected: () => void
  selectRowRange: (row: DataGridTableRow<TRow>, rowOffset: number, extend: boolean) => void
}

export function useDataGridTableStageRowSelection<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStageRowSelectionOptions<TRow>,
): UseDataGridTableStageRowSelectionResult<TRow> {
  const rowSelectionSet = computed(() => new Set(options.rowSelectionSnapshot.value?.selectedRows ?? []))

  const isRowFocused = (row: DataGridTableRow<TRow>): boolean => {
    return row.rowId != null && options.rowSelectionSnapshot.value?.focusedRow === row.rowId
  }

  const isRowCheckboxSelected = (row: DataGridTableRow<TRow>): boolean => {
    return row.kind !== "group" && row.rowId != null && rowSelectionSet.value.has(row.rowId)
  }

  const readRowSelectionValue = (row: DataGridTableRow<TRow>): boolean => {
    return isRowCheckboxSelected(row)
  }

  const readRowSelectionCell = (row: DataGridTableRow<TRow>): string => {
    return readRowSelectionValue(row) ? "true" : "false"
  }

  const readRowSelectionDisplayCell = (row: DataGridTableRow<TRow>): string => {
    const column = options.rowSelectionColumn.value?.column
    if (!column || row.kind === "group") {
      return ""
    }
    return buildDataGridCellRenderModel({
      column,
      value: readRowSelectionValue(row),
    }).displayValue
  }

  const resolveVisibleSelectableRowIds = (): DataGridRowId[] => {
    return options.displayRows.value.flatMap(row => {
      if (row.kind === "group" || row.rowId == null) {
        return []
      }
      return [row.rowId]
    })
  }

  const areAllVisibleRowsSelected = computed(() => {
    const rowIds = resolveVisibleSelectableRowIds()
    return rowIds.length > 0 && rowIds.every(rowId => rowSelectionSet.value.has(rowId))
  })

  const areSomeVisibleRowsSelected = computed(() => {
    const rowIds = resolveVisibleSelectableRowIds()
    return rowIds.some(rowId => rowSelectionSet.value.has(rowId))
  })

  const focusRow = (row: DataGridTableRow<TRow>): void => {
    if (row.rowId == null || !options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    options.runtime.api.rowSelection.setFocusedRow(row.rowId)
  }

  const toggleRowCheckboxSelected = (row: DataGridTableRow<TRow>): void => {
    if (row.kind === "group" || row.rowId == null || !options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    options.runtime.api.rowSelection.setSelected(row.rowId, !rowSelectionSet.value.has(row.rowId))
  }

  const toggleVisibleRowsSelected = (): void => {
    if (!options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    const rowIds = resolveVisibleSelectableRowIds()
    if (!areAllVisibleRowsSelected.value) {
      options.runtime.api.rowSelection.selectRows(rowIds)
      return
    }
    options.runtime.api.rowSelection.deselectRows(rowIds)
  }

  const selectRowRange = (
    row: DataGridTableRow<TRow>,
    rowOffset: number,
    extend: boolean,
  ): void => {
    focusRow(row)
    const lastColumnIndex = options.orderedVisibleColumns.value.length - 1
    if (lastColumnIndex < 0) {
      return
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (!extend) {
      options.applySelectionRange({
        startRow: rowIndex,
        endRow: rowIndex,
        startColumn: 0,
        endColumn: lastColumnIndex,
      })
      return
    }
    const anchorRowIndex = options.selectionAnchorCell.value?.rowIndex ?? rowIndex
    options.applySelectionRange({
      startRow: Math.min(anchorRowIndex, rowIndex),
      endRow: Math.max(anchorRowIndex, rowIndex),
      startColumn: 0,
      endColumn: lastColumnIndex,
    })
  }

  return {
    rowSelectionSet,
    isRowFocused,
    isRowCheckboxSelected,
    readRowSelectionCell,
    readRowSelectionDisplayCell,
    areAllVisibleRowsSelected,
    areSomeVisibleRowsSelected,
    focusRow,
    toggleRowCheckboxSelected,
    toggleVisibleRowsSelected,
    selectRowRange,
  }
}