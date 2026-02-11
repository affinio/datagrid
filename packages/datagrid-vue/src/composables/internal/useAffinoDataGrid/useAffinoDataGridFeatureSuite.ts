import { type Ref } from "vue"
import type { DataGridColumnDef, DataGridSelectionSnapshot } from "@affino/datagrid-core"
import type { DataGridTransactionAffectedRange } from "@affino/datagrid-core/advanced"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"
import {
  useAffinoDataGridSelectionFeature,
  type UseAffinoDataGridSelectionFeatureResult,
} from "./useAffinoDataGridSelectionFeature"
import {
  useAffinoDataGridClipboardFeature,
  type UseAffinoDataGridClipboardFeatureResult,
} from "./useAffinoDataGridClipboardFeature"
import {
  useAffinoDataGridEditingFeature,
  type UseAffinoDataGridEditingFeatureResult,
} from "./useAffinoDataGridEditingFeature"
import {
  useAffinoDataGridFilteringFeature,
  type UseAffinoDataGridFilteringFeatureResult,
} from "./useAffinoDataGridFilteringFeature"
import {
  useAffinoDataGridVisibilityFeature,
  type UseAffinoDataGridVisibilityFeatureResult,
} from "./useAffinoDataGridVisibilityFeature"
import {
  useAffinoDataGridTreeFeature,
  type UseAffinoDataGridTreeFeatureResult,
} from "./useAffinoDataGridTreeFeature"
import {
  useAffinoDataGridSummaryFeature,
  type UseAffinoDataGridSummaryFeatureResult,
} from "./useAffinoDataGridSummaryFeature"
import {
  useAffinoDataGridRowHeightFeature,
  type UseAffinoDataGridRowHeightFeatureResult,
} from "./useAffinoDataGridRowHeightFeature"
import type { NormalizedAffinoDataGridFeatures } from "./useAffinoDataGridFeatureNormalization"

export interface UseAffinoDataGridFeatureSuiteOptions<TRow> {
  rows: Ref<readonly TRow[]>
  columns: Ref<readonly DataGridColumnDef[]>
  runtime: UseDataGridRuntimeResult<TRow>
  normalizedFeatures: NormalizedAffinoDataGridFeatures<TRow>
  fallbackResolveRowKey: (row: TRow, index: number) => string
  internalSelectionSnapshot: Ref<DataGridSelectionSnapshot | null>
}

export interface UseAffinoDataGridFeatureSuiteResult<TRow>
  extends UseAffinoDataGridSelectionFeatureResult<TRow>,
    UseAffinoDataGridClipboardFeatureResult<TRow>,
    UseAffinoDataGridEditingFeatureResult<TRow>,
    UseAffinoDataGridFilteringFeatureResult,
    UseAffinoDataGridVisibilityFeatureResult,
    UseAffinoDataGridTreeFeatureResult,
    UseAffinoDataGridSummaryFeatureResult,
    UseAffinoDataGridRowHeightFeatureResult {
  replaceRows: (
    nextRows: readonly TRow[],
    options?: AffinoDataGridRowMutationOptions,
  ) => Promise<boolean>
}

export interface AffinoDataGridRowMutationOptions {
  intent?: string
  label?: string
  clearSelection?: boolean
  affectedRange?: DataGridTransactionAffectedRange | null
}

export function useAffinoDataGridFeatureSuite<TRow>(
  options: UseAffinoDataGridFeatureSuiteOptions<TRow>,
): UseAffinoDataGridFeatureSuiteResult<TRow> {
  const selectionFeature = useAffinoDataGridSelectionFeature({
    rows: options.rows,
    runtime: options.runtime,
    feature: options.normalizedFeatures.selection,
    fallbackResolveRowKey: options.fallbackResolveRowKey,
    internalSelectionSnapshot: options.internalSelectionSnapshot,
  })
  const {
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
  } = selectionFeature

  const replaceRows = async (
    nextRows: readonly TRow[],
    mutationOptions: AffinoDataGridRowMutationOptions = {},
  ): Promise<boolean> => {
    const previousRows = options.rows.value
    const previousSelection = options.runtime.api.getSelectionSnapshot()
    const shouldClearSelection = mutationOptions.clearSelection ?? false

    try {
      options.rows.value = nextRows
      if (shouldClearSelection) {
        clearSelection()
      }
    } catch {
      return false
    }

    const nextSelection = shouldClearSelection ? null : options.runtime.api.getSelectionSnapshot()
    if (!options.runtime.api.hasTransactionSupport()) {
      return true
    }

    const intent = mutationOptions.intent?.trim() || "rows-replace"
    const label = mutationOptions.label?.trim() || "Replace rows"
    const meta = {
      intent,
      affectedRange: mutationOptions.affectedRange ?? null,
    }

    try {
      await options.runtime.api.applyTransaction({
        label,
        meta,
        commands: [
          {
            type: `rows.${intent}`,
            payload: {
              rows: nextRows,
              selection: nextSelection,
            },
            rollbackPayload: {
              rows: previousRows,
              selection: previousSelection,
            },
            meta,
          },
        ],
      })
      return true
    } catch {
      try {
        options.rows.value = previousRows
        if (previousSelection) {
          options.runtime.api.setSelectionSnapshot(previousSelection)
        } else {
          options.runtime.api.clearSelection()
        }
      } catch {
        // Keep failure deterministic for caller; best-effort rollback only.
      }
      return false
    }
  }

  const filteringFeature = useAffinoDataGridFilteringFeature({
    runtime: options.runtime,
    feature: options.normalizedFeatures.filtering,
  })
  const {
    filteringEnabled,
    filterModel,
    setFilterModel,
    clearFilterModel,
    setAdvancedFilterExpression,
  } = filteringFeature

  const clipboardFeature = useAffinoDataGridClipboardFeature({
    rows: options.rows,
    selectedRowKeySet,
    feature: options.normalizedFeatures.clipboard,
    resolveRowKey,
    replaceRows,
  })
  const {
    clipboardEnabled,
    lastCopiedText,
    copyText,
    readText,
    copyRows,
    parseRows,
    copySelectedRows,
    clearSelectedRows,
    cutSelectedRows,
    pasteRowsAppend,
  } = clipboardFeature

  const editingFeature = useAffinoDataGridEditingFeature({
    rows: options.rows,
    columns: options.columns,
    feature: options.normalizedFeatures.editing,
  })
  const {
    editingEnabled,
    editingMode,
    editingEnum,
    enumEditorEnabled,
    enumEditorPrimitive,
    resolveEnumEditorOptions,
    activeSession,
    beginEdit,
    updateDraft,
    cancelEdit,
    commitEdit,
    isCellEditing,
    resolveCellDraft,
  } = editingFeature

  const visibilityFeature = useAffinoDataGridVisibilityFeature({
    runtime: options.runtime,
    columns: options.columns,
    feature: options.normalizedFeatures.visibility,
  })
  const {
    visibilityEnabled,
    hiddenColumnKeys,
    isColumnVisible,
    setColumnVisible,
    toggleColumnVisible,
    setHiddenColumnKeys,
    resetHiddenColumns,
  } = visibilityFeature

  const treeFeature = useAffinoDataGridTreeFeature({
    runtime: options.runtime,
    feature: options.normalizedFeatures.tree,
  })
  const {
    treeEnabled,
    groupBy,
    groupExpansion,
    setGroupBy,
    clearGroupBy,
    toggleGroup,
    isGroupExpanded,
    expandGroups,
    collapseGroups,
    expandAllGroups,
    collapseAllGroups,
  } = treeFeature

  const summaryFeature = useAffinoDataGridSummaryFeature({
    runtime: options.runtime,
    feature: options.normalizedFeatures.summary,
    selectionEnabled,
    selectionSnapshot,
  })
  const {
    summaryEnabled,
    selectedSummary,
    recomputeSelectedSummary,
  } = summaryFeature

  const rowHeightFeature = useAffinoDataGridRowHeightFeature({
    runtime: options.runtime,
    feature: options.normalizedFeatures.rowHeight,
  })
  const {
    rowHeightEnabled,
    rowHeightMode,
    baseRowHeight,
    rowHeightSupported,
    setRowHeightMode,
    setBaseRowHeight,
    measureVisibleRowHeights,
    applyRowHeightSettings,
  } = rowHeightFeature

  return {
    replaceRows,
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
    clipboardEnabled,
    lastCopiedText,
    copyText,
    readText,
    copyRows,
    parseRows,
    copySelectedRows,
    clearSelectedRows,
    cutSelectedRows,
    pasteRowsAppend,
    editingEnabled,
    editingMode,
    editingEnum,
    enumEditorEnabled,
    enumEditorPrimitive,
    resolveEnumEditorOptions,
    activeSession,
    beginEdit,
    updateDraft,
    cancelEdit,
    commitEdit,
    isCellEditing,
    resolveCellDraft,
    filteringEnabled,
    filterModel,
    setFilterModel,
    clearFilterModel,
    setAdvancedFilterExpression,
    visibilityEnabled,
    hiddenColumnKeys,
    isColumnVisible,
    setColumnVisible,
    toggleColumnVisible,
    setHiddenColumnKeys,
    resetHiddenColumns,
    treeEnabled,
    groupBy,
    groupExpansion,
    setGroupBy,
    clearGroupBy,
    toggleGroup,
    isGroupExpanded,
    expandGroups,
    collapseGroups,
    expandAllGroups,
    collapseAllGroups,
    summaryEnabled,
    selectedSummary,
    recomputeSelectedSummary,
    rowHeightEnabled,
    rowHeightMode,
    baseRowHeight,
    rowHeightSupported,
    setRowHeightMode,
    setBaseRowHeight,
    measureVisibleRowHeights,
    applyRowHeightSettings,
  }
}
