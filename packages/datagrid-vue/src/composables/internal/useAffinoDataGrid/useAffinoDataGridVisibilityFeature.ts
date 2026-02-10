import { computed, ref, watch, type ComputedRef, type Ref } from "vue"
import type { DataGridColumnDef } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"

export interface AffinoVisibilityFeatureInput {
  enabled?: boolean
  hiddenColumnKeys?: readonly string[]
}

export interface NormalizedAffinoVisibilityFeature {
  enabled: boolean
  hiddenColumnKeys: readonly string[]
}

export interface UseAffinoDataGridVisibilityFeatureOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  columns: Ref<readonly DataGridColumnDef[]>
  feature: NormalizedAffinoVisibilityFeature
}

export interface UseAffinoDataGridVisibilityFeatureResult {
  visibilityEnabled: Ref<boolean>
  hiddenColumnKeys: ComputedRef<readonly string[]>
  isColumnVisible: (columnKey: string) => boolean
  setColumnVisible: (columnKey: string, visible: boolean) => void
  toggleColumnVisible: (columnKey: string) => void
  setHiddenColumnKeys: (keys: readonly string[]) => void
  resetHiddenColumns: () => void
}

export function normalizeVisibilityFeature(
  input: boolean | AffinoVisibilityFeatureInput | undefined,
): NormalizedAffinoVisibilityFeature {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      hiddenColumnKeys: [],
    }
  }
  if (!input) {
    return {
      enabled: false,
      hiddenColumnKeys: [],
    }
  }
  return {
    enabled: input.enabled ?? true,
    hiddenColumnKeys: Array.isArray(input.hiddenColumnKeys) ? [...input.hiddenColumnKeys] : [],
  }
}

export function useAffinoDataGridVisibilityFeature<TRow>(
  options: UseAffinoDataGridVisibilityFeatureOptions<TRow>,
): UseAffinoDataGridVisibilityFeatureResult {
  const visibilityEnabled = ref(options.feature.enabled)
  const hiddenColumnKeySet = ref<Set<string>>(new Set(options.feature.hiddenColumnKeys))
  const hiddenColumnKeys = computed<readonly string[]>(() => Array.from(hiddenColumnKeySet.value))

  const isColumnVisible = (columnKey: string): boolean => (
    !hiddenColumnKeySet.value.has(columnKey)
  )

  const setColumnVisible = (columnKey: string, visible: boolean): void => {
    const next = new Set(hiddenColumnKeySet.value)
    if (visible) {
      next.delete(columnKey)
    } else {
      next.add(columnKey)
    }
    hiddenColumnKeySet.value = next
  }

  const toggleColumnVisible = (columnKey: string): void => {
    setColumnVisible(columnKey, !isColumnVisible(columnKey))
  }

  const setHiddenColumnKeys = (keys: readonly string[]): void => {
    hiddenColumnKeySet.value = new Set(keys)
  }

  const resetHiddenColumns = (): void => {
    hiddenColumnKeySet.value = new Set()
  }

  watch([options.columns, hiddenColumnKeys, visibilityEnabled], ([nextColumns, nextHiddenColumnKeys, enabled]) => {
    const hidden = new Set(nextHiddenColumnKeys)
    nextColumns.forEach(column => {
      options.runtime.api.setColumnVisibility(column.key, !enabled || !hidden.has(column.key))
    })
  }, { immediate: true })

  return {
    visibilityEnabled,
    hiddenColumnKeys,
    isColumnVisible,
    setColumnVisible,
    toggleColumnVisible,
    setHiddenColumnKeys,
    resetHiddenColumns,
  }
}
