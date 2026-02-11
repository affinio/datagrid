import type { Ref } from "vue"
import type { DataGridColumnDef } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"
import type { UseAffinoDataGridFeatureSuiteResult } from "./useAffinoDataGridFeatureSuite"
import type { UseAffinoDataGridBindingSuiteResult } from "./useAffinoDataGridBindingSuite"
import type { UseAffinoDataGridResult } from "../../useAffinoDataGrid.types"

export interface UseAffinoDataGridResultAssemblyOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  rows: Ref<readonly TRow[]>
  columns: Ref<readonly DataGridColumnDef[]>
  componentProps: UseAffinoDataGridResult<TRow>["componentProps"]
  sort: Pick<
    UseAffinoDataGridResult<TRow>,
    "sortState" | "setSortState" | "toggleColumnSort" | "clearSort"
  >
  runAction: UseAffinoDataGridResult<TRow>["actions"]["runAction"]
  filteringHelpers: UseAffinoDataGridResult<TRow>["features"]["filtering"]["helpers"]
  featureSuite: UseAffinoDataGridFeatureSuiteResult<TRow>
  bindingSuite: UseAffinoDataGridBindingSuiteResult<TRow>
}

type UseAffinoDataGridAssembledBaseResult<TRow> = Omit<
  UseAffinoDataGridResult<TRow>,
  "pagination" | "columnState" | "history" | "rowReorder" | "cellSelection" | "cellRange" | "bindings"
> & {
  bindings: Omit<UseAffinoDataGridResult<TRow>["bindings"], "cellSelection">
}

export function assembleAffinoDataGridResult<TRow>(
  options: UseAffinoDataGridResultAssemblyOptions<TRow>,
): UseAffinoDataGridAssembledBaseResult<TRow> {
  const { runtime, rows, columns, componentProps, sort, runAction } = options
  const features = options.featureSuite
  const bindings = options.bindingSuite

  return {
    ...runtime,
    rows,
    columns,
    componentProps,
    sortState: sort.sortState,
    setSortState: sort.setSortState,
    toggleColumnSort: sort.toggleColumnSort,
    clearSort: sort.clearSort,
    actions: {
      copySelectedRows: features.copySelectedRows,
      cutSelectedRows: features.cutSelectedRows,
      pasteRowsAppend: features.pasteRowsAppend,
      clearSelectedRows: features.clearSelectedRows,
      selectAllRows: features.selectAllRows,
      runAction,
    },
    contextMenu: {
      state: bindings.contextMenuState,
      style: bindings.contextMenuStyle,
      actions: bindings.contextMenuActions,
      contextMenuRef: bindings.contextMenuRef,
      open: bindings.openContextMenu,
      close: bindings.closeContextMenu,
      onKeyDown: bindings.onContextMenuKeyDown,
      runAction: bindings.runContextMenuAction,
    },
    features: {
      selection: {
        enabled: features.selectionEnabled,
        selectedRowKeys: features.selectedRowKeys,
        selectedCount: features.selectedCount,
        isSelectedByKey: features.isSelectedByKey,
        setSelectedByKey: features.setSelectedByKey,
        toggleSelectedByKey: features.toggleSelectedByKey,
        clearSelection: features.clearSelection,
        resolveRowKey: features.resolveRowKey,
      },
      clipboard: {
        enabled: features.clipboardEnabled,
        lastCopiedText: features.lastCopiedText,
        copyText: features.copyText,
        readText: features.readText,
        copyRows: features.copyRows,
        parseRows: features.parseRows,
      },
      editing: {
        enabled: features.editingEnabled,
        mode: features.editingMode,
        enum: features.editingEnum,
        activeSession: features.activeSession,
        beginEdit: features.beginEdit,
        updateDraft: features.updateDraft,
        cancelEdit: features.cancelEdit,
        commitEdit: features.commitEdit,
      },
      filtering: {
        enabled: features.filteringEnabled,
        model: features.filterModel,
        setModel: features.setFilterModel,
        clear: features.clearFilterModel,
        setAdvancedExpression: features.setAdvancedFilterExpression,
        helpers: options.filteringHelpers,
      },
      summary: {
        enabled: features.summaryEnabled,
        selected: features.selectedSummary,
        recomputeSelected: features.recomputeSelectedSummary,
      },
      visibility: {
        enabled: features.visibilityEnabled,
        hiddenColumnKeys: features.hiddenColumnKeys,
        isColumnVisible: features.isColumnVisible,
        setColumnVisible: features.setColumnVisible,
        toggleColumnVisible: features.toggleColumnVisible,
        setHiddenColumnKeys: features.setHiddenColumnKeys,
        reset: features.resetHiddenColumns,
      },
      tree: {
        enabled: features.treeEnabled,
        groupBy: features.groupBy,
        groupExpansion: features.groupExpansion,
        setGroupBy: features.setGroupBy,
        clearGroupBy: features.clearGroupBy,
        toggleGroup: features.toggleGroup,
        isGroupExpanded: features.isGroupExpanded,
        expandGroups: features.expandGroups,
        collapseGroups: features.collapseGroups,
        expandAll: features.expandAllGroups,
        collapseAll: features.collapseAllGroups,
      },
      rowHeight: {
        enabled: features.rowHeightEnabled,
        supported: features.rowHeightSupported,
        mode: features.rowHeightMode,
        base: features.baseRowHeight,
        setMode: features.setRowHeightMode,
        setBase: features.setBaseRowHeight,
        measureVisible: features.measureVisibleRowHeights,
        apply: features.applyRowHeightSettings,
      },
    },
    bindings: {
      getRowKey: features.resolveRowKey,
      headerSort: bindings.createHeaderSortBindings,
      rowSelection: bindings.createRowSelectionBindings,
      editableCell: bindings.createEditableCellBindings,
      isCellEditing: features.isCellEditing,
      inlineEditor: bindings.createInlineEditorBindings,
      headerCell: bindings.createHeaderCellBindings,
      headerReorder: bindings.createHeaderReorderBindings,
      rowReorder: bindings.createRowReorderBindings,
      dataCell: bindings.createDataCellBindings,
      contextMenuRef: bindings.setContextMenuRef,
      contextMenuRoot: bindings.createContextMenuRootBindings,
      contextMenuAction: bindings.createContextMenuActionBinding,
      actionButton: bindings.createActionButtonBinding,
    },
  }
}
