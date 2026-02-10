import { computed } from "vue"
import {
  assembleAffinoDataGridResult,
  fallbackResolveRowKey,
  normalizeAffinoDataGridFeatures,
  useAffinoDataGridBindingSuite,
  useAffinoDataGridFeatureSuite,
  useAffinoDataGridRuntimeBootstrap,
  useAffinoDataGridSortActionSuite,
} from "./internal/useAffinoDataGrid"
import type {
  UseAffinoDataGridOptions,
  UseAffinoDataGridResult,
} from "./useAffinoDataGrid.types"
export type {
  AffinoDataGridEditMode,
  AffinoDataGridSelectionFeature,
  AffinoDataGridClipboardFeature,
  AffinoDataGridEditSession,
  AffinoDataGridEditingFeature,
  AffinoDataGridFeatures,
  AffinoDataGridFilteringFeature,
  AffinoDataGridSummaryFeature,
  AffinoDataGridVisibilityFeature,
  AffinoDataGridTreeFeature,
  UseAffinoDataGridOptions,
  AffinoDataGridActionId,
  AffinoDataGridRunActionOptions,
  AffinoDataGridActionResult,
  AffinoDataGridActionBindingOptions,
  UseAffinoDataGridResult,
} from "./useAffinoDataGrid.types"

export function useAffinoDataGrid<TRow>(
  options: UseAffinoDataGridOptions<TRow>,
): UseAffinoDataGridResult<TRow> {
  const runtimeBootstrap = useAffinoDataGridRuntimeBootstrap({
    rows: options.rows,
    columns: options.columns,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart,
  })
  const { rows, columns, runtime, internalSelectionSnapshot } = runtimeBootstrap
  const normalizedFeatures = normalizeAffinoDataGridFeatures(options.features)

  const featureSuite = useAffinoDataGridFeatureSuite({
    rows,
    columns,
    runtime,
    normalizedFeatures,
    fallbackResolveRowKey,
    internalSelectionSnapshot,
  })
  const {
    selectedRowKeySet,
    resolveRowKey,
    isSelectedByKey,
    toggleSelectedByKey,
    clearSelection,
    selectOnlyRow,
    selectAllRows,
    resolveSelectedRows,
    copySelectedRows,
    clearSelectedRows,
    cutSelectedRows,
    pasteRowsAppend,
    editingEnabled,
    activeSession,
    beginEdit,
    updateDraft,
    cancelEdit,
    commitEdit,
    isCellEditing,
    resolveCellDraft,
  } = featureSuite

  const {
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
    resolveColumnSortDirection,
    runAction,
  } = useAffinoDataGridSortActionSuite({
    initialSortState: options.initialSortState,
    onSortModelChange(nextSortState) {
      runtime.api.setSortModel(nextSortState)
    },
    selectedRowKeySet,
    clearSelection,
    selectAllRows,
    resolveSelectedRows,
    copySelectedRows,
    cutSelectedRows,
    pasteRowsAppend,
    clearSelectedRows,
  })

  const componentProps = computed(() => ({
    rows: rows.value,
    columns: columns.value,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  }))

  const bindingSuite = useAffinoDataGridBindingSuite({
    columns,
    resolveRowKey,
    resolveColumnSortDirection,
    toggleColumnSort,
    isSelectedByKey,
    toggleSelectedByKey,
    selectOnlyRow,
    editingEnabled,
    beginEdit,
    resolveCellDraft,
    isCellEditing,
    activeSession,
    updateDraft,
    cancelEdit,
    commitEdit,
    runAction,
  })

  return assembleAffinoDataGridResult({
    runtime,
    rows,
    columns,
    componentProps,
    sort: {
      sortState,
      setSortState,
      toggleColumnSort,
      clearSort,
    },
    runAction,
    featureSuite,
    bindingSuite,
  })
}
