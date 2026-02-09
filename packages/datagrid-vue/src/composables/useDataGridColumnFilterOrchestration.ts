import { computed, onBeforeUnmount, ref, getCurrentInstance, type ComputedRef, type Ref } from "vue"
import type { DataGridFilterSnapshot } from "@affino/datagrid-core"
import {
  DATA_GRID_ENUM_FILTER_OPERATOR_OPTIONS,
  DATA_GRID_NUMBER_FILTER_OPERATOR_OPTIONS,
  DATA_GRID_TEXT_FILTER_OPERATOR_OPTIONS,
  useDataGridColumnFilterOrchestration as useDataGridColumnFilterOrchestrationCore,
  type DataGridAppliedColumnFilter,
  type DataGridColumnFilterDraft,
  type DataGridColumnFilterKind,
  type DataGridColumnFilterSnapshot,
  type DataGridFilterOperatorOption,
  type UseDataGridColumnFilterOrchestrationOptions as UseDataGridColumnFilterOrchestrationCoreOptions,
} from "@affino/datagrid-orchestration"

export type {
  DataGridColumnFilterKind,
  DataGridAppliedColumnFilter,
  DataGridColumnFilterDraft,
  DataGridFilterOperatorOption,
}

export interface UseDataGridColumnFilterOrchestrationOptions<TRow>
  extends UseDataGridColumnFilterOrchestrationCoreOptions<TRow> {}

export interface UseDataGridColumnFilterOrchestrationResult<TRow> {
  activeFilterColumnKey: Ref<string | null>
  columnFilterDraft: Ref<DataGridColumnFilterDraft | null>
  appliedColumnFilters: Ref<Record<string, DataGridAppliedColumnFilter>>
  activeColumnFilterCount: ComputedRef<number>
  hasColumnFilters: ComputedRef<boolean>
  activeFilterColumnLabel: ComputedRef<string>
  columnFilterOperatorOptions: ComputedRef<readonly DataGridFilterOperatorOption[]>
  activeColumnFilterEnumOptions: ComputedRef<string[]>
  canApplyActiveColumnFilter: ComputedRef<boolean>
  isColumnFilterActive: (columnKey: string) => boolean
  openColumnFilter: (columnKey: string) => void
  onHeaderFilterTriggerClick: (columnKey: string) => void
  closeColumnFilterPanel: () => void
  onFilterOperatorChange: (value: string | number) => void
  onFilterEnumValueChange: (value: string | number) => void
  onFilterValueInput: (value: string | number | Event) => void
  onFilterSecondValueInput: (value: string | number | Event) => void
  doesOperatorNeedSecondValue: (kind: DataGridColumnFilterKind, operator: string) => boolean
  doesFilterDraftHaveRequiredValues: (draft: DataGridColumnFilterDraft) => boolean
  applyActiveColumnFilter: () => void
  resetActiveColumnFilter: () => void
  clearAllColumnFilters: () => void
  buildFilterSnapshot: (filters: Record<string, DataGridAppliedColumnFilter>) => DataGridFilterSnapshot | null
  rowMatchesColumnFilters: (row: TRow, filters: Record<string, DataGridAppliedColumnFilter>) => boolean
}

export {
  DATA_GRID_TEXT_FILTER_OPERATOR_OPTIONS,
  DATA_GRID_ENUM_FILTER_OPERATOR_OPTIONS,
  DATA_GRID_NUMBER_FILTER_OPERATOR_OPTIONS,
}

export function useDataGridColumnFilterOrchestration<TRow>(
  options: UseDataGridColumnFilterOrchestrationOptions<TRow>,
): UseDataGridColumnFilterOrchestrationResult<TRow> {
  const core = useDataGridColumnFilterOrchestrationCore<TRow>(options)
  const snapshot = ref<DataGridColumnFilterSnapshot>(core.getSnapshot())
  const activeFilterColumnKey = ref<string | null>(snapshot.value.activeFilterColumnKey)
  const columnFilterDraft = ref<DataGridColumnFilterDraft | null>(snapshot.value.columnFilterDraft)
  const appliedColumnFilters = ref<Record<string, DataGridAppliedColumnFilter>>(snapshot.value.appliedColumnFilters)

  const unsubscribe = core.subscribe(nextSnapshot => {
    snapshot.value = nextSnapshot
    activeFilterColumnKey.value = nextSnapshot.activeFilterColumnKey
    columnFilterDraft.value = nextSnapshot.columnFilterDraft
    appliedColumnFilters.value = nextSnapshot.appliedColumnFilters
  })

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      unsubscribe()
    })
  }

  return {
    activeFilterColumnKey,
    columnFilterDraft,
    appliedColumnFilters,
    activeColumnFilterCount: computed(() => snapshot.value.activeColumnFilterCount),
    hasColumnFilters: computed(() => snapshot.value.hasColumnFilters),
    activeFilterColumnLabel: computed(() => snapshot.value.activeFilterColumnLabel),
    columnFilterOperatorOptions: computed(() => snapshot.value.columnFilterOperatorOptions),
    activeColumnFilterEnumOptions: computed(() => snapshot.value.activeColumnFilterEnumOptions),
    canApplyActiveColumnFilter: computed(() => snapshot.value.canApplyActiveColumnFilter),
    isColumnFilterActive: core.isColumnFilterActive,
    openColumnFilter: core.openColumnFilter,
    onHeaderFilterTriggerClick: core.onHeaderFilterTriggerClick,
    closeColumnFilterPanel: core.closeColumnFilterPanel,
    onFilterOperatorChange: core.onFilterOperatorChange,
    onFilterEnumValueChange: core.onFilterEnumValueChange,
    onFilterValueInput: core.onFilterValueInput as (value: string | number | Event) => void,
    onFilterSecondValueInput: core.onFilterSecondValueInput as (value: string | number | Event) => void,
    doesOperatorNeedSecondValue: core.doesOperatorNeedSecondValue,
    doesFilterDraftHaveRequiredValues: core.doesFilterDraftHaveRequiredValues,
    applyActiveColumnFilter: core.applyActiveColumnFilter,
    resetActiveColumnFilter: core.resetActiveColumnFilter,
    clearAllColumnFilters: core.clearAllColumnFilters,
    buildFilterSnapshot: core.buildFilterSnapshot,
    rowMatchesColumnFilters: core.rowMatchesColumnFilters,
  }
}
