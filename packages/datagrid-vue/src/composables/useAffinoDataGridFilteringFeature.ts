import { ref, watch, type Ref } from "vue"
import {
  cloneDataGridFilterSnapshot,
  type DataGridAdvancedFilterExpression,
  type DataGridFilterSnapshot,
} from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "./useDataGridRuntime"

export interface AffinoFilteringFeatureInput {
  enabled?: boolean
  initialFilterModel?: DataGridFilterSnapshot | null
}

export interface NormalizedAffinoFilteringFeature {
  enabled: boolean
  initialFilterModel: DataGridFilterSnapshot | null
}

export interface UseAffinoDataGridFilteringFeatureOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  feature: NormalizedAffinoFilteringFeature
}

export interface UseAffinoDataGridFilteringFeatureResult {
  filteringEnabled: Ref<boolean>
  filterModel: Ref<DataGridFilterSnapshot | null>
  setFilterModel: (nextModel: DataGridFilterSnapshot | null) => void
  clearFilterModel: () => void
  setAdvancedFilterExpression: (expression: DataGridAdvancedFilterExpression | null) => void
}

export function normalizeFilteringFeature(
  input: boolean | AffinoFilteringFeatureInput | undefined,
): NormalizedAffinoFilteringFeature {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      initialFilterModel: null,
    }
  }
  if (!input) {
    return {
      enabled: false,
      initialFilterModel: null,
    }
  }
  return {
    enabled: input.enabled ?? true,
    initialFilterModel: cloneDataGridFilterSnapshot(input.initialFilterModel ?? null),
  }
}

export function useAffinoDataGridFilteringFeature<TRow>(
  options: UseAffinoDataGridFilteringFeatureOptions<TRow>,
): UseAffinoDataGridFilteringFeatureResult {
  const filteringEnabled = ref(options.feature.enabled)
  const filterModel = ref<DataGridFilterSnapshot | null>(
    cloneDataGridFilterSnapshot(options.feature.initialFilterModel),
  )

  const setFilterModel = (nextModel: DataGridFilterSnapshot | null) => {
    filterModel.value = cloneDataGridFilterSnapshot(nextModel)
  }

  const clearFilterModel = () => {
    if (!filterModel.value) {
      return
    }
    filterModel.value = null
  }

  const setAdvancedFilterExpression = (expression: DataGridAdvancedFilterExpression | null) => {
    const current = cloneDataGridFilterSnapshot(filterModel.value) ?? {
      columnFilters: {},
      advancedFilters: {},
    }
    current.advancedExpression = expression
    filterModel.value = current
  }

  watch([filterModel, filteringEnabled], ([nextFilterModel, enabled]) => {
    options.runtime.api.setFilterModel(enabled ? cloneDataGridFilterSnapshot(nextFilterModel) : null)
  }, { immediate: true, deep: true })

  return {
    filteringEnabled,
    filterModel,
    setFilterModel,
    clearFilterModel,
    setAdvancedFilterExpression,
  }
}
