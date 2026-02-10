import { computed, ref, type ComputedRef, type Ref } from "vue"
import type {
  DataGridSelectionAggregationKind,
  DataGridSelectionSnapshot,
  DataGridSelectionSummaryColumnConfig,
  DataGridSelectionSummarySnapshot,
} from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"

export interface AffinoSummaryFeatureInput<TRow> {
  enabled?: boolean
  columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[]
  defaultAggregations?: readonly DataGridSelectionAggregationKind[]
}

export interface NormalizedAffinoSummaryFeature<TRow> {
  enabled: boolean
  columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[]
  defaultAggregations?: readonly DataGridSelectionAggregationKind[]
}

export interface UseAffinoDataGridSummaryFeatureOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  feature: NormalizedAffinoSummaryFeature<TRow>
  selectionEnabled: Ref<boolean>
  selectionSnapshot: ComputedRef<DataGridSelectionSnapshot | null>
}

export interface UseAffinoDataGridSummaryFeatureResult {
  summaryEnabled: Ref<boolean>
  selectedSummary: ComputedRef<DataGridSelectionSummarySnapshot | null>
  recomputeSelectedSummary: () => DataGridSelectionSummarySnapshot | null
}

export function normalizeSummaryFeature<TRow>(
  input: boolean | AffinoSummaryFeatureInput<TRow> | undefined,
): NormalizedAffinoSummaryFeature<TRow> {
  if (typeof input === "boolean") {
    return {
      enabled: input,
    }
  }
  if (!input) {
    return {
      enabled: false,
    }
  }
  return {
    enabled: input.enabled ?? true,
    columns: input.columns,
    defaultAggregations: input.defaultAggregations,
  }
}

export function useAffinoDataGridSummaryFeature<TRow>(
  options: UseAffinoDataGridSummaryFeatureOptions<TRow>,
): UseAffinoDataGridSummaryFeatureResult {
  const summaryEnabled = ref(options.feature.enabled)
  const selectedSummary = computed<DataGridSelectionSummarySnapshot | null>(() => {
    if (!summaryEnabled.value || !options.selectionEnabled.value) {
      return null
    }
    if (!options.selectionSnapshot.value) {
      return null
    }
    return options.runtime.api.summarizeSelection<TRow>({
      columns: options.feature.columns,
      defaultAggregations: options.feature.defaultAggregations,
    })
  })

  const recomputeSelectedSummary = (): DataGridSelectionSummarySnapshot | null => selectedSummary.value

  return {
    summaryEnabled,
    selectedSummary,
    recomputeSelectedSummary,
  }
}
