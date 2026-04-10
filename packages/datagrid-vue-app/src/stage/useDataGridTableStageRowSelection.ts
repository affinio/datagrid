import type {
  DataGridColumnSnapshot,
  DataGridRowId,
  DataGridRowSelectionSnapshot,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import { buildDataGridCellRenderModel } from "@affino/datagrid-vue"
import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import type {
  DataGridTableRow,
  DataGridTableStageAnchorCell,
} from "./dataGridTableStage.types"

type DataGridTableStageRowSelectionApi<TRow extends Record<string, unknown>> =
  UseDataGridRuntimeResult<TRow>["api"]["rowSelection"]

export interface UseDataGridTableStageRowSelectionOptions<TRow extends Record<string, unknown>> {
  runtime: Pick<import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>, "api">
  isPlaceholderRow?: (row: DataGridTableRow<TRow>) => boolean
  rowSelectionColumn: ComputedRef<DataGridColumnSnapshot | null>
  orderedVisibleColumns: ComputedRef<readonly DataGridColumnSnapshot[]>
  displayRows: Ref<readonly DataGridTableRow<TRow>[]>
  rowSelectionSnapshot: Ref<DataGridRowSelectionSnapshot | null>
  applyRowSelectionMutation?: (mutator: (api: DataGridTableStageRowSelectionApi<TRow>) => void) => void
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
  const isPlaceholderRow = options.isPlaceholderRow ?? (() => false)
  const applyRowSelectionMutation = options.applyRowSelectionMutation
    ?? ((mutator: (api: DataGridTableStageRowSelectionApi<TRow>) => void) => {
      if (!options.runtime.api.rowSelection.hasSupport()) {
        return
      }
      mutator(options.runtime.api.rowSelection)
    })
  const rowSelectionSet = computed(() => new Set(options.rowSelectionSnapshot.value?.selectedRows ?? []))

  const isRowFocused = (row: DataGridTableRow<TRow>): boolean => {
    return !isPlaceholderRow(row) && row.rowId != null && options.rowSelectionSnapshot.value?.focusedRow === row.rowId
  }

  const isRowCheckboxSelected = (row: DataGridTableRow<TRow>): boolean => {
    return !isPlaceholderRow(row) && row.kind !== "group" && row.rowId != null && rowSelectionSet.value.has(row.rowId)
  }

  const readRowSelectionValue = (row: DataGridTableRow<TRow>): boolean => {
    return isRowCheckboxSelected(row)
  }

  const readRowSelectionCell = (row: DataGridTableRow<TRow>): string => {
    return readRowSelectionValue(row) ? "true" : "false"
  }

  const readRowSelectionDisplayCell = (row: DataGridTableRow<TRow>): string => {
    const column = options.rowSelectionColumn.value?.column
    if (!column || row.kind === "group" || isPlaceholderRow(row)) {
      return ""
    }
    return buildDataGridCellRenderModel({
      column,
      value: readRowSelectionValue(row),
    }).displayValue
  }

  const selectableRowIds = computed<DataGridRowId[]>(() => {
    const rowCount = options.runtime.api.rows.getCount()
    const rowIds: DataGridRowId[] = []
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = options.runtime.api.rows.get(rowIndex)
      if (!row || row.kind === "group" || row.rowId == null) {
        continue
      }
      rowIds.push(row.rowId)
    }
    return rowIds
  })

  const areAllVisibleRowsSelected = computed(() => {
    const rowIds = selectableRowIds.value
    return rowIds.length > 0 && rowIds.every(rowId => rowSelectionSet.value.has(rowId))
  })

  const areSomeVisibleRowsSelected = computed(() => {
    const rowIds = selectableRowIds.value
    return rowIds.some(rowId => rowSelectionSet.value.has(rowId))
  })

  const focusRow = (row: DataGridTableRow<TRow>): void => {
    if (isPlaceholderRow(row) || row.rowId == null || !options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    options.runtime.api.rowSelection.setFocusedRow(row.rowId)
  }

  const toggleRowCheckboxSelected = (row: DataGridTableRow<TRow>): void => {
    if (isPlaceholderRow(row) || row.kind === "group" || row.rowId == null || !options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    applyRowSelectionMutation(rowSelectionApi => {
      rowSelectionApi.setSelected(row.rowId, !rowSelectionSet.value.has(row.rowId))
    })
  }

  const toggleVisibleRowsSelected = (): void => {
    if (!options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    const rowIds = selectableRowIds.value
    if (!areAllVisibleRowsSelected.value) {
      applyRowSelectionMutation(rowSelectionApi => {
        rowSelectionApi.selectRows(rowIds)
      })
      return
    }
    applyRowSelectionMutation(rowSelectionApi => {
      rowSelectionApi.deselectRows(rowIds)
    })
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