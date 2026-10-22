import type {
  DataGridColumnSnapshot,
  DataGridRowId,
  DataGridRowSelectionSnapshot,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue/headless"
import {
  applyDataGridRowSelectionIntent,
  advanceDataGridRowSelectionModelRevision,
  createDataGridRowSelectionInteractionSnapshot,
  createDataGridRowSelectionModelSnapshot,
  normalizeDataGridRowSelectionSnapshot,
  resolveDataGridSelectableRowRange,
} from "@affino/datagrid-core"
import {
  createDataGridRowSelectionSessionController,
  type DataGridRowSelectionSessionController,
  type DataGridRowSelectionSessionPreview,
} from "@affino/datagrid-orchestration"
import {
  buildDataGridCellRenderModel,
} from "@affino/datagrid-vue/headless"
import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from "vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import type {
  DataGridTableRow,
  DataGridTableStageAnchorCell,
} from "./dataGridTableStage.types"
import type { DataGridRowHeaderAction } from "../config/dataGridRowSelection"

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
  runtime: Pick<import("@affino/datagrid-vue/headless").UseDataGridRuntimeResult<TRow>, "api">
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
  rowHeaderAction?: Ref<DataGridRowHeaderAction>
  isRowSelectable?: (row: DataGridTableRow<TRow>) => boolean
  resolveProjectionIndexByRowId?: (rowId: DataGridRowId) => number | null
  resolveProjectionRowAtIndex?: (rowIndex: number) => DataGridTableRow<TRow> | null
  getProjectionRevision?: () => number
  acquireInteractionOwner?: (owner: "row-selection") => (() => void) | null
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
  selectRowRange: (row: DataGridTableRow<TRow>, rowOffset: number, extend: boolean, additive?: boolean) => void
  selectCellRangeByRowId: (rowId: DataGridRowId, extend: boolean) => void
  selectCheckboxRowRange: (row: DataGridTableRow<TRow>, rowOffset: number, additive?: boolean) => void
  beginRowSelectionSession: (rowId: DataGridRowId, operation: "replace" | "add") => boolean
  updateRowSelectionSession: (rowId: DataGridRowId) => boolean
  commitRowSelectionSession: () => void
  cancelRowSelectionSession: () => void
  consumeRowSelectionClick: () => boolean
  dispose: () => void
}

export function useDataGridTableStageRowSelection<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStageRowSelectionOptions<TRow>,
): UseDataGridTableStageRowSelectionResult<TRow> {
  const isPlaceholderRow = options.isPlaceholderRow ?? (() => false)
  const rowSelectionInteraction = ref(createDataGridRowSelectionInteractionSnapshot())
  const applyRowSelectionMutation = options.applyRowSelectionMutation
    ?? ((mutator: (api: DataGridTableStageRowSelectionApi<TRow>) => void) => {
      if (!options.runtime.api.rowSelection.hasSupport()) {
        return
      }
      mutator(options.runtime.api.rowSelection)
    })
  const readLegacySelection = (): DataGridRowSelectionSnapshot => normalizeDataGridRowSelectionSnapshot(
    options.runtime.api.rowSelection.getSnapshot(),
  )
  const sameCommittedRows = (left: DataGridRowSelectionSnapshot, right: DataGridRowSelectionSnapshot): boolean => {
    const leftMode = left.mode === "all" ? "all" : "explicit"
    const rightMode = right.mode === "all" ? "all" : "explicit"
    const leftRows = leftMode === "all" ? left.excludedRows ?? [] : left.selectedRows
    const rightRows = rightMode === "all" ? right.excludedRows ?? [] : right.selectedRows
    return leftMode === rightMode
      && leftRows.length === rightRows.length
      && leftRows.every((rowId, index) => rowId === rightRows[index])
  }
  let observedLegacySelection = readLegacySelection()
  let applyingSessionCommit = false
  let suppressNextClick = false
  const committedSelectionModel = shallowRef(createDataGridRowSelectionModelSnapshot(
    observedLegacySelection.mode === "all" ? [] : observedLegacySelection.selectedRows,
  ))
  const rowSelectionSessionPreview = shallowRef<DataGridRowSelectionSessionPreview | null>(null)
  let rowSelectionSessionController!: DataGridRowSelectionSessionController
  watch(() => options.rowSelectionSnapshot.value, snapshot => {
    const next = normalizeDataGridRowSelectionSnapshot(snapshot)
    if (!sameCommittedRows(observedLegacySelection, next) && !applyingSessionCommit) {
      committedSelectionModel.value = advanceDataGridRowSelectionModelRevision(
        committedSelectionModel.value,
        next.mode === "all" ? [] : next.selectedRows,
      )
    }
    observedLegacySelection = next
  }, { flush: "sync" })

  const resolveSessionRange = (
    anchorRowId: DataGridRowId,
    targetRowId: DataGridRowId,
    projectionRevision: number,
  ) => options.resolveProjectionIndexByRowId && options.resolveProjectionRowAtIndex
    ? resolveDataGridSelectableRowRange({
        anchorRowId,
        targetRowId,
        projectionRevision,
        currentProjectionRevision: options.getProjectionRevision?.() ?? projectionRevision,
        resolveRowIndexById: options.resolveProjectionIndexByRowId,
        resolveRowAtIndex: (rowIndex: number) => {
          const row = options.resolveProjectionRowAtIndex?.(rowIndex) ?? null
          if (!row) return null
          if (isPlaceholderRow(row)) return { rowId: row.rowId ?? null, kind: "unloaded" as const }
          return {
            rowId: row.rowId ?? null,
            kind: row.kind === "group" ? "group" as const : "data" as const,
            selectable: !options.isRowSelectable || options.isRowSelectable(row),
          }
        },
      })
    : { status: "incomplete" as const, projectionRevision, rowIds: [] }

  rowSelectionSessionController = createDataGridRowSelectionSessionController({
    getSelection: () => committedSelectionModel.value,
    getInteraction: () => rowSelectionInteraction.value,
    getProjectionRevision: () => options.getProjectionRevision?.() ?? 0,
    resolveRange: resolveSessionRange,
    acquireInteractionOwner: owner => options.acquireInteractionOwner?.(owner) ?? null,
    publishPreview: preview => { rowSelectionSessionPreview.value = preview },
    commit: (selection, interaction) => {
      const operation = rowSelectionSessionController.getSession()?.operation ?? "replace"
      committedSelectionModel.value = selection
      rowSelectionInteraction.value = interaction
      applyingSessionCommit = true
      try {
        applyRowSelectionMutation(api => {
          if (operation === "add") {
            api.selectRows(selection.selectedRowIds)
            api.setFocusedRow(interaction.extentRowId)
          } else {
            api.setSnapshot({
              focusedRow: interaction.extentRowId,
              selectedRows: [...selection.selectedRowIds],
            })
          }
        })
      } finally {
        observedLegacySelection = readLegacySelection()
        applyingSessionCommit = false
      }
    },
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
      if (options.isRowSelectable) {
        const candidate = sourceRow as Record<string, unknown>
        const rowNode = candidate.kind === "leaf"
          ? candidate
          : { kind: "leaf", rowId, data }
        if (!options.isRowSelectable(rowNode as unknown as DataGridTableRow<TRow>)) return
      }
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
    const preview = rowSelectionSessionPreview.value
    if (preview) {
      return rowSelectionSessionController.getSession()?.operation === "add"
        ? options.runtime.api.rowSelection.isSelected(rowId) || preview.selection.selectedRowIds.has(rowId)
        : preview.selection.selectedRowIds.has(rowId)
    }
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
      if (!row || row.kind === "group" || row.rowId == null
        || (options.isRowSelectable && !options.isRowSelectable(row as DataGridTableRow<TRow>))) {
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
      if (options.isRowSelectable && !options.isRowSelectable(row)) continue
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
    if (isPlaceholderRow(row) || row.rowId == null || !options.runtime.api.rowSelection.hasSupport()
      || (row.kind !== "group" && options.isRowSelectable && !options.isRowSelectable(row))) {
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
    rowSelectionInteraction.value = { anchorRowId: row.rowId, extentRowId: row.rowId }
  }

  const toggleVisibleRowsSelected = (): void => {
    if (!options.runtime.api.rowSelection.hasSupport()) {
      return
    }
    const hasSelectableVisibleRows = selectableVisibleRowIds.value.length > 0
    if (!hasSelectableVisibleRows) {
      return
    }
    if (options.isRowSelectable) {
      const rowIds = selectableRowIds.value
      if (rowIds.length === 0) return
      const shouldClearSelection = rowIds.every(rowId => options.runtime.api.rowSelection.isSelected(rowId))
      applyRowSelectionMutation(rowSelectionApi => {
        if (shouldClearSelection) rowSelectionApi.deselectRows(rowIds)
        else rowSelectionApi.selectRows(rowIds)
      })
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
    additive = false,
    forceRecordSelection = false,
  ): void => {
    const rowHeaderAction = options.rowHeaderAction?.value ?? "select-cells"
    if (rowHeaderAction === "none" && !forceRecordSelection) {
      return
    }
    if (rowHeaderAction === "select-records" || forceRecordSelection) {
      focusRow(row)
      if (isPlaceholderRow(row) || row.kind === "group" || row.rowId == null
        || !options.runtime.api.rowSelection.hasSupport()
        || (options.isRowSelectable && !options.isRowSelectable(row))) {
        return
      }

      const currentSnapshot = normalizeDataGridRowSelectionSnapshot(options.runtime.api.rowSelection.getSnapshot())
      const currentIds = currentSnapshot.mode === "all" ? [] : currentSnapshot.selectedRows
      const selection = createDataGridRowSelectionModelSnapshot(currentIds)
      const targetRowId = row.rowId
      const intent = extend
        ? (() => {
            const anchorRowId = rowSelectionInteraction.value.anchorRowId ?? targetRowId
            const projectionRevision = options.getProjectionRevision?.() ?? 0
            const range = resolveSessionRange(anchorRowId, targetRowId, projectionRevision)
            return {
              type: additive ? "add-range" as const : "extend" as const,
              targetRowId,
              projectionRevision,
              expectedSelectionRevision: selection.revision,
              range,
              baseSelection: selection,
            }
          })()
        : additive
          ? { type: "toggle" as const, targetRowId }
          : { type: "replace" as const, targetRowId }
      const transition = applyDataGridRowSelectionIntent(selection, rowSelectionInteraction.value, intent)
      if (!transition.accepted) {
        return
      }

      applyRowSelectionMutation(api => {
        if (intent.type === "add-range" && currentSnapshot.mode === "all") {
          api.selectRows(intent.range.rowIds)
          api.setFocusedRow(targetRowId)
        } else if (intent.type === "toggle" && currentSnapshot.mode === "all") {
          api.setSelected(targetRowId, !api.isSelected(targetRowId))
          api.setFocusedRow(targetRowId)
        } else {
          api.setSnapshot({
            focusedRow: targetRowId,
            selectedRows: [...transition.selection.selectedRowIds],
          })
        }
      })
      rowSelectionInteraction.value = transition.interaction
      return
    }

    const selectableColumnIndexes = options.orderedVisibleColumns.value
      .map((column, index) => column.column.meta?.rowSelection === true ? -1 : index)
      .filter(index => index >= 0)
    if (selectableColumnIndexes.length === 0) {
      return
    }
    const firstColumnIndex = selectableColumnIndexes[0]!
    const lastColumnIndex = selectableColumnIndexes[selectableColumnIndexes.length - 1]!
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (!extend) {
      rowIndexRangeAnchor = rowIndex
      const range = {
        startRow: rowIndex,
        endRow: rowIndex,
        startColumn: firstColumnIndex,
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
      startColumn: firstColumnIndex,
      endColumn: lastColumnIndex,
    }
    options.applySelectionRange(range)
    lastRowIndexRange = range
  }

  const selectCellRangeByRowId = (rowId: DataGridRowId, extend: boolean): void => {
    if ((options.rowHeaderAction?.value ?? "select-cells") !== "select-cells") return
    const rowIndex = options.resolveProjectionIndexByRowId?.(rowId)
    const row = rowIndex == null ? null : options.resolveProjectionRowAtIndex?.(rowIndex) ?? null
    if (rowIndex == null || !row || isPlaceholderRow(row) || row.kind === "group") return
    selectRowRange(row, rowIndex - options.viewportRowStart.value, extend)
  }

  const selectCheckboxRowRange = (
    row: DataGridTableRow<TRow>,
    rowOffset: number,
    additive = false,
  ): void => selectRowRange(row, rowOffset, true, additive, true)

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
    selectCellRangeByRowId,
    selectCheckboxRowRange,
    beginRowSelectionSession: (rowId, operation) => {
      const index = options.resolveProjectionIndexByRowId?.(rowId) ?? null
      const row = index == null ? null : options.resolveProjectionRowAtIndex?.(index) ?? null
      if (!row || isPlaceholderRow(row) || row.kind === "group" || row.rowId !== rowId
        || (options.isRowSelectable && !options.isRowSelectable(row))) {
        return false
      }
      return rowSelectionSessionController.begin(rowId, operation)
    },
    updateRowSelectionSession: rowId => {
      rowSelectionSessionController.update(rowId)
      return rowSelectionSessionController.getSession() != null
    },
    commitRowSelectionSession: () => {
      rowSelectionSessionController.commit()
    },
    cancelRowSelectionSession: () => {
      rowSelectionSessionController.cancel()
    },
    consumeRowSelectionClick: () => {
      if (!suppressNextClick) return false
      suppressNextClick = false
      return true
    },
    dispose: () => {
      rowSelectionSessionController.dispose()
    },
  }
}
