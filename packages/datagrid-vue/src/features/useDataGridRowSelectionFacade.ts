import { computed, ref, watch, watchEffect } from "vue"
import type { ComputedRef, Ref, ComponentPublicInstance } from "vue"
import {
  useSelectableRows,
  type RowData,
  type RowKey,
} from "../composables/useSelectableRows"

type RowClassValue = string | string[] | Record<string, boolean> | undefined

export interface DataGridRowSelectionFacadeOptions<TRow extends RowData> {
  rows: ComputedRef<TRow[]>
  modelValue: ComputedRef<(TRow | RowKey)[] | undefined>
  controlled: ComputedRef<boolean>
  enabled: Ref<boolean> | ComputedRef<boolean>
  rowKey: (row: TRow) => RowKey
  isServerPlaceholderRow: (row: TRow) => boolean
  selectedRowClass: ComputedRef<RowClassValue>
  emitUpdateSelected: (rows: TRow[]) => void
}

export interface DataGridRowSelectionFacadeResult<TRow extends RowData> {
  rowSelection: ReturnType<typeof useSelectableRows<TRow>>
  selectedRowCount: ComputedRef<number>
  headerSelectionCheckboxRef: Ref<HTMLInputElement | null>
  setHeaderSelectionCheckboxRef: (element: Element | ComponentPublicInstance | null) => void
  isSelectableDataRow: (row: unknown) => row is TRow
  isCheckboxRowSelected: (row: unknown) => boolean
  handleRowCheckboxToggle: (row: unknown) => void
  rowGridClass: (row: unknown) => RowClassValue
}

export function useDataGridRowSelectionFacade<TRow extends RowData>(
  options: DataGridRowSelectionFacadeOptions<TRow>,
): DataGridRowSelectionFacadeResult<TRow> {
  const rowSelection = useSelectableRows<TRow>({
    rows: options.rows,
    modelValue: options.modelValue,
    controlled: options.controlled,
    emitUpdate: rows => {
      options.emitUpdateSelected(rows)
    },
    rowKey: options.rowKey,
  })

  watch(
    options.enabled,
    enabled => {
      if (!enabled) {
        rowSelection.clearSelection()
      }
    },
    { immediate: false },
  )

  const headerSelectionCheckboxRef = ref<HTMLInputElement | null>(null)
  const setHeaderSelectionCheckboxRef = (element: Element | ComponentPublicInstance | null) => {
    headerSelectionCheckboxRef.value = element instanceof HTMLInputElement ? element : null
  }

  watchEffect(() => {
    const checkbox = headerSelectionCheckboxRef.value
    if (!checkbox) {
      return
    }
    checkbox.indeterminate = options.enabled.value && rowSelection.isIndeterminate.value
  })

  const isSelectableDataRow = (row: unknown): row is TRow => {
    if (!options.enabled.value || !row || typeof row !== "object") {
      return false
    }
    if ((row as Record<string, unknown>).__group) {
      return false
    }
    return !options.isServerPlaceholderRow(row as TRow)
  }

  const isCheckboxRowSelected = (row: unknown): boolean => {
    if (!isSelectableDataRow(row)) {
      return false
    }
    return rowSelection.isRowSelected(row)
  }

  const handleRowCheckboxToggle = (row: unknown): void => {
    if (!isSelectableDataRow(row)) {
      return
    }
    rowSelection.toggleRow(row)
  }

  const rowGridClass = (row: unknown): RowClassValue => {
    if (!isSelectableDataRow(row)) {
      return undefined
    }
    if (!rowSelection.isRowSelected(row)) {
      return undefined
    }
    return options.selectedRowClass.value || undefined
  }

  return {
    rowSelection,
    selectedRowCount: computed(() => rowSelection.selectedKeySet.value.size),
    headerSelectionCheckboxRef,
    setHeaderSelectionCheckboxRef,
    isSelectableDataRow,
    isCheckboxRowSelected,
    handleRowCheckboxToggle,
    rowGridClass,
  }
}
