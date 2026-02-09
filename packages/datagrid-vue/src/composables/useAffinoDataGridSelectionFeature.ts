import { computed, ref, watch, type ComputedRef, type Ref } from "vue"
import type { DataGridSelectionSnapshot } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "./useDataGridRuntime"

export interface AffinoSelectionFeatureInput<TRow> {
  enabled?: boolean
  initialSelectedRowKeys?: readonly string[]
  resolveRowKey?: (row: TRow, index: number) => string
}

export interface NormalizedAffinoSelectionFeature<TRow> {
  enabled: boolean
  initialSelectedRowKeys: readonly string[]
  resolveRowKey?: (row: TRow, index: number) => string
}

export interface UseAffinoDataGridSelectionFeatureOptions<TRow> {
  rows: Ref<readonly TRow[]>
  runtime: UseDataGridRuntimeResult<TRow>
  feature: NormalizedAffinoSelectionFeature<TRow>
  fallbackResolveRowKey: (row: TRow, index: number) => string
  internalSelectionSnapshot: Ref<DataGridSelectionSnapshot | null>
}

export interface UseAffinoDataGridSelectionFeatureResult<TRow> {
  selectionEnabled: Ref<boolean>
  selectedRowKeySet: Ref<Set<string>>
  selectedRowKeys: ComputedRef<readonly string[]>
  selectedCount: ComputedRef<number>
  resolveRowKey: (row: TRow, index: number) => string
  isSelectedByKey: (rowKey: string) => boolean
  setSelectedByKey: (rowKey: string, selected: boolean) => void
  toggleSelectedByKey: (rowKey: string) => void
  clearSelection: () => void
  selectOnlyRow: (rowKey: string) => void
  selectAllRows: () => number
  resolveSelectedRows: () => readonly TRow[]
  selectionSnapshot: ComputedRef<DataGridSelectionSnapshot | null>
}

export function normalizeSelectionFeature<TRow>(
  input: boolean | AffinoSelectionFeatureInput<TRow> | undefined,
): NormalizedAffinoSelectionFeature<TRow> {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      initialSelectedRowKeys: [],
    }
  }
  if (!input) {
    return {
      enabled: false,
      initialSelectedRowKeys: [],
    }
  }
  return {
    enabled: input.enabled ?? true,
    initialSelectedRowKeys: input.initialSelectedRowKeys ?? [],
    resolveRowKey: input.resolveRowKey,
  }
}

export function useAffinoDataGridSelectionFeature<TRow>(
  options: UseAffinoDataGridSelectionFeatureOptions<TRow>,
): UseAffinoDataGridSelectionFeatureResult<TRow> {
  const selectionEnabled = ref(options.feature.enabled)
  const selectedRowKeySet = ref<Set<string>>(new Set(options.feature.initialSelectedRowKeys))
  const normalizeResolvedRowKey = (rowKey: unknown, index: number): string => {
    if (typeof rowKey !== "string" && typeof rowKey !== "number") {
      throw new Error(
        `[AffinoDataGrid] resolveRowKey must return string|number (received ${typeof rowKey}) at row index ${index}.`,
      )
    }
    const normalized = String(rowKey).trim()
    if (normalized.length === 0) {
      throw new Error(
        `[AffinoDataGrid] resolveRowKey returned an empty key at row index ${index}.`,
      )
    }
    return normalized
  }
  const resolveRowKey = (row: TRow, index: number): string => (
    normalizeResolvedRowKey(
      options.feature.resolveRowKey
        ? options.feature.resolveRowKey(row, index)
        : options.fallbackResolveRowKey(row, index),
      index,
    )
  )

  watch(options.rows, nextRows => {
    if (!selectionEnabled.value) {
      return
    }
    const allowed = new Set<string>()
    nextRows.forEach((row, index) => {
      allowed.add(resolveRowKey(row, index))
    })
    const nextSelected = new Set<string>()
    selectedRowKeySet.value.forEach(rowKey => {
      if (allowed.has(rowKey)) {
        nextSelected.add(rowKey)
      }
    })
    selectedRowKeySet.value = nextSelected
  })

  const selectedRowKeys = computed<readonly string[]>(() => Array.from(selectedRowKeySet.value))
  const selectedCount = computed(() => selectedRowKeySet.value.size)

  const isSelectedByKey = (rowKey: string): boolean => (
    selectionEnabled.value && selectedRowKeySet.value.has(rowKey)
  )

  const setSelectedByKey = (rowKey: string, selected: boolean): void => {
    if (!selectionEnabled.value) {
      return
    }
    const next = new Set(selectedRowKeySet.value)
    if (selected) {
      next.add(rowKey)
    } else {
      next.delete(rowKey)
    }
    selectedRowKeySet.value = next
  }

  const toggleSelectedByKey = (rowKey: string): void => {
    setSelectedByKey(rowKey, !isSelectedByKey(rowKey))
  }

  const clearSelection = (): void => {
    if (selectedRowKeySet.value.size === 0) {
      return
    }
    selectedRowKeySet.value = new Set()
  }

  const selectOnlyRow = (rowKey: string): void => {
    if (!selectionEnabled.value) {
      return
    }
    selectedRowKeySet.value = new Set([rowKey])
  }

  const resolveSelectedRows = (): readonly TRow[] => options.rows.value.filter((row, index) => (
    selectedRowKeySet.value.has(resolveRowKey(row, index))
  ))

  const selectAllRows = (): number => {
    if (!selectionEnabled.value) {
      return 0
    }
    const nextSelected = new Set<string>()
    options.rows.value.forEach((row, index) => {
      nextSelected.add(resolveRowKey(row, index))
    })
    selectedRowKeySet.value = nextSelected
    return nextSelected.size
  }

  const selectionSnapshot = computed<DataGridSelectionSnapshot | null>(() => {
    if (!selectionEnabled.value || selectedRowKeySet.value.size === 0) {
      return null
    }

    const totalRows = options.runtime.api.getRowCount()
    if (totalRows <= 0) {
      return null
    }

    const visibleColumns = options.runtime.columnSnapshot.value.visibleColumns
    const endCol = Math.max(0, visibleColumns.length - 1)
    const ranges: DataGridSelectionSnapshot["ranges"] = []

    for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
      const rowNode = options.runtime.api.getRow<TRow>(rowIndex)
      if (!rowNode || rowNode.kind !== "leaf") {
        continue
      }
      const rowKey = resolveRowKey(rowNode.data as TRow, rowNode.sourceIndex)
      if (!selectedRowKeySet.value.has(rowKey)) {
        continue
      }
      ranges.push({
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: 0,
        endCol,
        startRowId: rowNode.rowId ?? null,
        endRowId: rowNode.rowId ?? null,
        anchor: {
          rowIndex,
          colIndex: 0,
          rowId: rowNode.rowId ?? null,
        },
        focus: {
          rowIndex,
          colIndex: endCol,
          rowId: rowNode.rowId ?? null,
        },
      })
    }

    if (ranges.length === 0) {
      return null
    }

    return {
      ranges,
      activeRangeIndex: 0,
      activeCell: ranges[0]?.anchor ?? null,
    }
  })

  watch(selectionSnapshot, snapshot => {
    options.internalSelectionSnapshot.value = snapshot
    if (!options.runtime.api.hasSelectionSupport()) {
      return
    }
    if (!snapshot) {
      options.runtime.api.clearSelection()
      return
    }
    options.runtime.api.setSelectionSnapshot(snapshot)
  }, { immediate: true, flush: "sync" })

  return {
    selectionEnabled,
    selectedRowKeySet,
    selectedRowKeys,
    selectedCount,
    resolveRowKey,
    isSelectedByKey,
    setSelectedByKey,
    toggleSelectedByKey,
    clearSelection,
    selectOnlyRow,
    selectAllRows,
    resolveSelectedRows,
    selectionSnapshot,
  }
}
