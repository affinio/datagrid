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

function resolveSourceRowData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {}
  const candidate = value as Record<string, unknown>
  const isNodeInput = candidate.kind === "leaf" || candidate.kind === "group"
  if (isNodeInput && candidate.data && typeof candidate.data === "object") {
    return candidate.data as Record<string, unknown>
  }
  if (isNodeInput && candidate.row && typeof candidate.row === "object") {
    return candidate.row as Record<string, unknown>
  }
  return candidate
}

function resolveDefaultSourceRowId<TRow extends Record<string, unknown>>(row: TRow, index: number): DataGridRowId {
  const candidate = row as Record<string, unknown>
  if ((candidate.kind === "leaf" || candidate.kind === "group") && candidate.rowId != null) {
    return candidate.rowId as DataGridRowId
  }
  const id = candidate.rowId ?? candidate.id
  return (typeof id === "string" || typeof id === "number") ? id : index
}

function readGroupField(data: Record<string, unknown>, field: string): unknown {
  if (data[field] !== undefined) return data[field]
  let current: unknown = data
  for (const segment of field.split(".")) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function normalizeGroupValue(value: unknown): string {
  return value == null ? "" : String(value)
}

export interface UseDataGridTableStageRowSelectionOptions<TRow extends Record<string, unknown>> {
  runtime: Pick<import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>, "api">
  isPlaceholderRow?: (row: DataGridTableRow<TRow>) => boolean
  rowSelectionColumn: ComputedRef<DataGridColumnSnapshot | null>
  orderedVisibleColumns: ComputedRef<readonly DataGridColumnSnapshot[]>
  displayRows: Ref<readonly DataGridTableRow<TRow>[]>
  sourceRows?: Ref<readonly TRow[]>
  resolveSourceRowId?: (row: TRow, index: number) => DataGridRowId | null | undefined
  rowSelectionSnapshot: Ref<DataGridRowSelectionSnapshot | null>
  applyRowSelectionMutation?: (mutator: (api: DataGridTableStageRowSelectionApi<TRow>) => void) => void
  viewportRowStart: Ref<number>
  selectionAnchorCell: ComputedRef<DataGridTableStageAnchorCell | null>
  resolveSelectionRange?: () => DataGridCopyRange | null
  applySelectionRange: (range: DataGridCopyRange) => void
}

export interface UseDataGridTableStageRowSelectionResult<TRow extends Record<string, unknown>> {
  rowSelectionSet: ComputedRef<Set<DataGridRowId>>
  isRowFocused: (row: DataGridTableRow<TRow>) => boolean
  isRowCheckboxSelected: (row: DataGridTableRow<TRow>) => boolean
  isRowCheckboxMixed: (row: DataGridTableRow<TRow>) => boolean
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
  const rowSelectionExcludedSet = computed(() => new Set(options.rowSelectionSnapshot.value?.excludedRows ?? []))
  const isAllRowsSelectionMode = computed(() => options.rowSelectionSnapshot.value?.mode === "all")
  const groupMemberIdsByKey = computed(() => {
    // Tie this cache to projection refreshes so groupBy changes invalidate it
    // without adding work to scroll or render loops.
    void options.displayRows.value
    const snapshot = options.runtime.api.rows.getSnapshot()
    const fields = snapshot.groupBy?.fields ?? []
    if (snapshot.kind !== "client" || fields.length === 0 || !options.sourceRows) {
      return new Map<string, DataGridRowId[]>()
    }

    const members = new Map<string, DataGridRowId[]>()
    options.sourceRows.value.forEach((sourceRow, sourceIndex) => {
      const rowId = options.resolveSourceRowId
        ? options.resolveSourceRowId(sourceRow, sourceIndex)
        : resolveDefaultSourceRowId(sourceRow, sourceIndex)
      if (rowId == null) return
      const data = resolveSourceRowData(sourceRow)
      let groupKey = "group:"
      for (const field of fields) {
        const value = normalizeGroupValue(readGroupField(data, field))
        groupKey += `${field.length}:${field}${value.length}:${value}`
        const groupMembers = members.get(groupKey)
        if (groupMembers) groupMembers.push(rowId)
        else members.set(groupKey, [rowId])
      }
    })
    return members
  })
  let rowIndexRangeAnchor: number | null = null
  let lastRowIndexRange: DataGridCopyRange | null = null
  const shouldUseVisibleRowsForAllSelectionState = computed(() => {
    if (isAllRowsSelectionMode.value) {
      return true
    }
    const snapshot = options.runtime.api.rows.getSnapshot()
    return snapshot.kind === "server"
  })

  const isRowFocused = (row: DataGridTableRow<TRow>): boolean => {
    return !isPlaceholderRow(row) && row.rowId != null && options.rowSelectionSnapshot.value?.focusedRow === row.rowId
  }

  const resolveCheckboxState = (row: DataGridTableRow<TRow>): "true" | "false" | "mixed" => {
    if (isPlaceholderRow(row) || row.rowId == null) {
      return "false"
    }
    if (row.kind === "group") {
      const ids = groupMemberIdsByKey.value.get(row.groupMeta?.groupKey ?? "") ?? []
      if (ids.length === 0) return "false"
      let selectedCount = 0
      for (const rowId of ids) {
        if (isRowIdSelected(rowId)) selectedCount += 1
      }
      return selectedCount === 0 ? "false" : selectedCount === ids.length ? "true" : "mixed"
    }
    return isRowIdSelected(row.rowId) ? "true" : "false"
  }

  const isRowIdSelected = (rowId: DataGridRowId): boolean => {
    return isAllRowsSelectionMode.value
      ? !rowSelectionExcludedSet.value.has(rowId)
      : rowSelectionSet.value.has(rowId)
  }

  const isRowCheckboxSelected = (row: DataGridTableRow<TRow>): boolean => {
    return resolveCheckboxState(row) === "true"
  }

  const isRowCheckboxMixed = (row: DataGridTableRow<TRow>): boolean => {
    return resolveCheckboxState(row) === "mixed"
  }

  const readRowSelectionCell = (row: DataGridTableRow<TRow>): string => {
    return resolveCheckboxState(row)
  }

  const readRowSelectionDisplayCell = (row: DataGridTableRow<TRow>): string => {
    const column = options.rowSelectionColumn.value?.column
    if (!column || isPlaceholderRow(row) || row.kind === "group") {
      return ""
    }
    return buildDataGridCellRenderModel({
      column,
      value: isRowCheckboxSelected(row),
    }).displayValue
  }

  const selectableRowIds = computed<DataGridRowId[]>(() => {
    if (shouldUseVisibleRowsForAllSelectionState.value) {
      return selectableVisibleRowIds.value
    }
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

  const selectableVisibleRowIds = computed<DataGridRowId[]>(() => {
    const rowIds: DataGridRowId[] = []
    for (const row of options.displayRows.value) {
      if (isPlaceholderRow(row) || row.kind === "group" || row.rowId == null) {
        continue
      }
      rowIds.push(row.rowId)
    }
    return rowIds
  })

  const areAllVisibleRowsSelected = computed(() => {
    const rowIds = selectableRowIds.value
    return rowIds.length > 0 && rowIds.every(rowId => (
      isAllRowsSelectionMode.value
        ? !rowSelectionExcludedSet.value.has(rowId)
        : rowSelectionSet.value.has(rowId)
    ))
  })

  const areSomeVisibleRowsSelected = computed(() => {
    const rowIds = selectableRowIds.value
    return rowIds.some(rowId => (
      isAllRowsSelectionMode.value
        ? !rowSelectionExcludedSet.value.has(rowId)
        : rowSelectionSet.value.has(rowId)
    ))
  })

  const focusRow = (row: DataGridTableRow<TRow>): void => {
    if (isPlaceholderRow(row) || row.rowId == null || !options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    options.runtime.api.rowSelection.setFocusedRow(row.rowId)
  }

  const toggleRowCheckboxSelected = (row: DataGridTableRow<TRow>): void => {
    if (isPlaceholderRow(row) || row.rowId == null || !options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    if (row.kind === "group") {
      const rowIds = groupMemberIdsByKey.value.get(row.groupMeta?.groupKey ?? "") ?? []
      if (rowIds.length === 0) return
      const shouldSelect = !isRowCheckboxSelected(row)
      applyRowSelectionMutation(rowSelectionApi => {
        if (shouldSelect) rowSelectionApi.selectRows(rowIds)
        else rowSelectionApi.deselectRows(rowIds)
      })
      return
    }
    applyRowSelectionMutation(rowSelectionApi => {
      rowSelectionApi.setSelected(row.rowId, !isRowCheckboxSelected(row))
    })
  }

  const toggleVisibleRowsSelected = (): void => {
    if (!options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    const hasSelectableVisibleRows = selectableVisibleRowIds.value.length > 0
    if (!hasSelectableVisibleRows) {
      return
    }
    applyRowSelectionMutation(rowSelectionApi => {
      const shouldClearSelection = isAllRowsSelectionMode.value
        ? areAllVisibleRowsSelected.value
        : rowSelectionSet.value.size > 0 && areAllVisibleRowsSelected.value
      if (shouldClearSelection) {
        rowSelectionApi.clearSelectedRows()
        return
      }
      rowSelectionApi.setSnapshot({
        focusedRow: options.rowSelectionSnapshot.value?.focusedRow ?? null,
        selectedRows: [],
        mode: "all",
        excludedRows: [],
      })
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
      rowIndexRangeAnchor = rowIndex
      const range = {
        startRow: rowIndex,
        endRow: rowIndex,
        startColumn: 0,
        endColumn: lastColumnIndex,
      }
      options.applySelectionRange(range)
      lastRowIndexRange = range
      return
    }
    const currentRange = options.resolveSelectionRange?.() ?? null
    const stillOwnsSelection = lastRowIndexRange != null && currentRange != null
      && lastRowIndexRange.startRow === currentRange.startRow
      && lastRowIndexRange.endRow === currentRange.endRow
      && lastRowIndexRange.startColumn === currentRange.startColumn
      && lastRowIndexRange.endColumn === currentRange.endColumn
    const anchorRowIndex = stillOwnsSelection && rowIndexRangeAnchor != null
      ? rowIndexRangeAnchor
      : options.selectionAnchorCell.value?.rowIndex ?? rowIndex
    rowIndexRangeAnchor = anchorRowIndex
    const range = {
      startRow: Math.min(anchorRowIndex, rowIndex),
      endRow: Math.max(anchorRowIndex, rowIndex),
      startColumn: 0,
      endColumn: lastColumnIndex,
    }
    options.applySelectionRange(range)
    lastRowIndexRange = range
  }

  return {
    rowSelectionSet,
    isRowFocused,
    isRowCheckboxSelected,
    isRowCheckboxMixed,
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
