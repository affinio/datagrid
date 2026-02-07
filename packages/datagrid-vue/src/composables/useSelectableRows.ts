import { computed, ref, watch } from "vue"
import type { ComputedRef } from "vue"

export type RowKey = string | number
export type RowData = Record<string, unknown>

interface UseSelectableRowsOptions<T extends RowData> {
  rows: ComputedRef<T[]>
  modelValue: ComputedRef<(T | RowKey)[] | undefined>
  controlled: ComputedRef<boolean>
  emitUpdate?: (rows: T[]) => void
  rowKey: (row: T) => RowKey
}

export interface UseSelectableRowsResult<T extends RowData> {
  selectedRows: ComputedRef<T[]>
  selectedKeySet: ComputedRef<Set<RowKey>>
  allSelected: ComputedRef<boolean>
  isIndeterminate: ComputedRef<boolean>
  setSelection: (rows: T[]) => void
  clearSelection: () => void
  selectAll: () => void
  toggleRow: (row: T) => void
  isRowSelected: (row: T) => boolean
}

function resolveModelKeySet<T extends RowData>(
  model: (T | RowKey)[] | undefined,
  rowKey: (row: T) => RowKey,
): Set<RowKey> {
  const keys = new Set<RowKey>()
  if (!Array.isArray(model)) {
    return keys
  }
  for (const item of model) {
    if (typeof item === "string" || typeof item === "number") {
      keys.add(item)
      continue
    }
    if (item && typeof item === "object") {
      keys.add(rowKey(item))
    }
  }
  return keys
}

export function useSelectableRows<T extends RowData>(
  options: UseSelectableRowsOptions<T>,
): UseSelectableRowsResult<T> {
  const internalKeySet = ref<Set<RowKey>>(new Set())

  const selectedKeySet = computed(() =>
    options.controlled.value
      ? resolveModelKeySet(options.modelValue.value, options.rowKey)
      : new Set(internalKeySet.value),
  )

  const selectedRows = computed(() => {
    const keys = selectedKeySet.value
    if (!keys.size) {
      return [] as T[]
    }
    return options.rows.value.filter(row => keys.has(options.rowKey(row)))
  })

  const allSelected = computed(() => {
    const rows = options.rows.value
    if (!rows.length) {
      return false
    }
    const keys = selectedKeySet.value
    for (const row of rows) {
      if (!keys.has(options.rowKey(row))) {
        return false
      }
    }
    return true
  })

  const isIndeterminate = computed(() => {
    const total = options.rows.value.length
    if (!total) {
      return false
    }
    const selected = selectedRows.value.length
    return selected > 0 && selected < total
  })

  function syncInternalSelection(rows: T[]) {
    internalKeySet.value = new Set(rows.map(row => options.rowKey(row)))
  }

  function commitSelection(rows: T[]) {
    if (!options.controlled.value) {
      syncInternalSelection(rows)
    }
    options.emitUpdate?.(rows)
  }

  function setSelection(rows: T[]) {
    commitSelection(rows)
  }

  function clearSelection() {
    commitSelection([])
  }

  function selectAll() {
    commitSelection(options.rows.value)
  }

  function isRowSelected(row: T) {
    return selectedKeySet.value.has(options.rowKey(row))
  }

  function toggleRow(row: T) {
    const key = options.rowKey(row)
    const nextKeys = new Set(selectedKeySet.value)
    if (nextKeys.has(key)) {
      nextKeys.delete(key)
    } else {
      nextKeys.add(key)
    }
    const nextRows = options.rows.value.filter(entry => nextKeys.has(options.rowKey(entry)))
    commitSelection(nextRows)
  }

  watch(
    () => options.rows.value,
    rows => {
      if (options.controlled.value) {
        return
      }
      const validKeys = new Set(rows.map(row => options.rowKey(row)))
      const next = new Set<RowKey>()
      for (const key of internalKeySet.value) {
        if (validKeys.has(key)) {
          next.add(key)
        }
      }
      internalKeySet.value = next
    },
    { deep: false },
  )

  return {
    selectedRows,
    selectedKeySet,
    allSelected,
    isIndeterminate,
    setSelection,
    clearSelection,
    selectAll,
    toggleRow,
    isRowSelected,
  }
}
