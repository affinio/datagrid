import { computed, ref, type Ref } from "vue"
import type {
  DataGridAdvancedFilterExpression,
  CreateDataGridCoreOptions,
  DataGridColumnDef,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridSelectionAggregationKind,
  DataGridSelectionSnapshot,
  DataGridSelectionSummaryColumnConfig,
  DataGridSelectionSummarySnapshot,
  DataGridSortDirection,
  DataGridSortState,
} from "@affino/datagrid-core"
import {
  useDataGridRuntime,
  type UseDataGridRuntimeOptions,
  type UseDataGridRuntimeResult,
} from "./useDataGridRuntime"
import {
  type DataGridContextMenuAction,
  type DataGridContextMenuActionId,
  type DataGridContextMenuState,
  type OpenDataGridContextMenuInput,
} from "./useDataGridContextMenu"
import {
  useAffinoDataGridClipboardFeature,
} from "./useAffinoDataGridClipboardFeature"
import {
  useAffinoDataGridEditingFeature,
} from "./useAffinoDataGridEditingFeature"
import {
  useAffinoDataGridFilteringFeature,
} from "./useAffinoDataGridFilteringFeature"
import {
  useAffinoDataGridSelectionFeature,
} from "./useAffinoDataGridSelectionFeature"
import {
  useAffinoDataGridSummaryFeature,
} from "./useAffinoDataGridSummaryFeature"
import {
  useAffinoDataGridVisibilityFeature,
} from "./useAffinoDataGridVisibilityFeature"
import {
  useAffinoDataGridTreeFeature,
} from "./useAffinoDataGridTreeFeature"
import { useAffinoDataGridSortingFeature } from "./useAffinoDataGridSortingFeature"
import {
  useAffinoDataGridActionRunner,
  type AffinoDataGridInternalActionId,
} from "./useAffinoDataGridActionRunner"
import { useAffinoDataGridBaseBindings } from "./useAffinoDataGridBaseBindings"
import { useAffinoDataGridContextMenuFeature } from "./useAffinoDataGridContextMenuFeature"
import {
  normalizeAffinoDataGridFeatures,
  type AffinoDataGridFeatureInput,
} from "./useAffinoDataGridFeatureNormalization"
import {
  fallbackResolveRowKey,
  toReadonlyRef,
  type MaybeRef,
} from "./useAffinoDataGridIdentity"

export type AffinoDataGridEditMode = "cell" | "row"

export interface AffinoDataGridSelectionFeature<TRow> {
  enabled?: boolean
  initialSelectedRowKeys?: readonly string[]
  resolveRowKey?: (row: TRow, index: number) => string
}

export interface AffinoDataGridClipboardFeature<TRow> {
  enabled?: boolean
  useSystemClipboard?: boolean
  serializeRows?: (rows: readonly TRow[]) => string
  parseRows?: (text: string) => readonly TRow[]
}

export interface AffinoDataGridEditSession {
  rowKey: string
  columnKey: string
  mode: AffinoDataGridEditMode
  draft: string
}

export interface AffinoDataGridEditingFeature<TRow> {
  enabled?: boolean
  mode?: AffinoDataGridEditMode
  enum?: boolean
  onCommit?: (session: AffinoDataGridEditSession, context: {
    rows: readonly TRow[]
    columns: readonly DataGridColumnDef[]
  }) => void | Promise<void>
}

export interface AffinoDataGridFeatures<TRow> extends AffinoDataGridFeatureInput<TRow> {}

export interface AffinoDataGridFilteringFeature {
  enabled?: boolean
  initialFilterModel?: DataGridFilterSnapshot | null
}

export interface AffinoDataGridSummaryFeature<TRow> {
  enabled?: boolean
  columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[]
  defaultAggregations?: readonly DataGridSelectionAggregationKind[]
}

export interface AffinoDataGridVisibilityFeature {
  enabled?: boolean
  hiddenColumnKeys?: readonly string[]
}

export interface AffinoDataGridTreeFeature {
  enabled?: boolean
  initialGroupBy?: DataGridGroupBySpec | null
}

export interface UseAffinoDataGridOptions<TRow> {
  rows: MaybeRef<readonly TRow[]>
  columns: MaybeRef<readonly DataGridColumnDef[]>
  services?: UseDataGridRuntimeOptions<TRow>["services"]
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
  autoStart?: boolean
  initialSortState?: readonly DataGridSortState[]
  features?: AffinoDataGridFeatures<TRow>
}

export type AffinoDataGridActionId = DataGridContextMenuActionId | "select-all" | "clear-selection"

export interface AffinoDataGridRunActionOptions {
  columnKey?: string | null
}

export interface AffinoDataGridActionResult {
  ok: boolean
  affected: number
  message: string
}

export interface AffinoDataGridActionBindingOptions {
  onResult?: (result: AffinoDataGridActionResult) => void
}

export interface UseAffinoDataGridResult<TRow> extends UseDataGridRuntimeResult<TRow> {
  rows: Ref<readonly TRow[]>
  columns: Ref<readonly DataGridColumnDef[]>
  componentProps: Ref<{
    rows: readonly TRow[]
    columns: readonly DataGridColumnDef[]
    services: UseAffinoDataGridOptions<TRow>["services"]
    startupOrder: UseAffinoDataGridOptions<TRow>["startupOrder"]
    autoStart: boolean
  }>
  sortState: Ref<readonly DataGridSortState[]>
  setSortState: (nextState: readonly DataGridSortState[]) => void
  toggleColumnSort: (columnKey: string, directionCycle?: readonly DataGridSortDirection[]) => void
  clearSort: () => void
  actions: {
    copySelectedRows: () => Promise<boolean>
    cutSelectedRows: () => Promise<number>
    pasteRowsAppend: () => Promise<number>
    clearSelectedRows: () => number
    selectAllRows: () => number
    runAction: (actionId: AffinoDataGridActionId, options?: AffinoDataGridRunActionOptions) => Promise<AffinoDataGridActionResult>
  }
  contextMenu: {
    state: Ref<DataGridContextMenuState>
    style: Ref<{ left: string; top: string }>
    actions: Ref<readonly DataGridContextMenuAction[]>
    contextMenuRef: Ref<HTMLElement | null>
    open: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void
    close: () => void
    onKeyDown: (event: KeyboardEvent, handlers?: { onEscape?: () => void }) => void
    runAction: (actionId: DataGridContextMenuActionId) => Promise<AffinoDataGridActionResult>
  }
  features: {
    selection: {
      enabled: Ref<boolean>
      selectedRowKeys: Ref<readonly string[]>
      selectedCount: Ref<number>
      isSelectedByKey: (rowKey: string) => boolean
      setSelectedByKey: (rowKey: string, selected: boolean) => void
      toggleSelectedByKey: (rowKey: string) => void
      clearSelection: () => void
      resolveRowKey: (row: TRow, index: number) => string
    }
    clipboard: {
      enabled: Ref<boolean>
      lastCopiedText: Ref<string>
      copyText: (text: string) => Promise<boolean>
      readText: () => Promise<string>
      copyRows: (rows?: readonly TRow[]) => Promise<boolean>
      parseRows: (text: string) => readonly TRow[]
    }
    editing: {
      enabled: Ref<boolean>
      mode: Ref<AffinoDataGridEditMode>
      enum: Ref<boolean>
      activeSession: Ref<AffinoDataGridEditSession | null>
      beginEdit: (session: Omit<AffinoDataGridEditSession, "mode"> & { mode?: AffinoDataGridEditMode }) => boolean
      updateDraft: (draft: string) => boolean
      cancelEdit: () => boolean
      commitEdit: () => Promise<boolean>
    }
    filtering: {
      enabled: Ref<boolean>
      model: Ref<DataGridFilterSnapshot | null>
      setModel: (nextModel: DataGridFilterSnapshot | null) => void
      clear: () => void
      setAdvancedExpression: (expression: DataGridAdvancedFilterExpression | null) => void
    }
    summary: {
      enabled: Ref<boolean>
      selected: Ref<DataGridSelectionSummarySnapshot | null>
      recomputeSelected: () => DataGridSelectionSummarySnapshot | null
    }
    visibility: {
      enabled: Ref<boolean>
      hiddenColumnKeys: Ref<readonly string[]>
      isColumnVisible: (columnKey: string) => boolean
      setColumnVisible: (columnKey: string, visible: boolean) => void
      toggleColumnVisible: (columnKey: string) => void
      setHiddenColumnKeys: (keys: readonly string[]) => void
      reset: () => void
    }
    tree: {
      enabled: Ref<boolean>
      groupBy: Ref<DataGridGroupBySpec | null>
      groupExpansion: Ref<DataGridGroupExpansionSnapshot>
      setGroupBy: (groupBy: DataGridGroupBySpec | null) => void
      clearGroupBy: () => void
      toggleGroup: (groupKey: string) => void
      isGroupExpanded: (groupKey: string) => boolean
      expandGroups: (groupKeys?: readonly string[]) => number
      collapseGroups: (groupKeys?: readonly string[]) => number
      expandAll: () => number
      collapseAll: () => number
    }
  }
  bindings: {
    getRowKey: (row: TRow, index: number) => string
    headerSort: (columnKey: string) => {
      role: "columnheader"
      tabindex: number
      "aria-sort": "none" | "ascending" | "descending"
      onClick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    rowSelection: (row: TRow, index: number) => {
      role: "row"
      tabindex: number
      "data-row-key": string
      "aria-selected": "true" | "false"
      onClick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    editableCell: (params: {
      row: TRow
      rowIndex: number
      columnKey: string
      editable?: boolean
      value?: unknown
    }) => {
      "data-row-key": string
      "data-column-key": string
      "data-inline-editable": "true" | "false"
      onDblclick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    isCellEditing: (rowKey: string, columnKey: string) => boolean
    inlineEditor: (params: {
      rowKey: string
      columnKey: string
      commitOnBlur?: boolean
    }) => {
      value: string
      onInput: (event: Event) => void
      onBlur: () => void
      onKeydown: (event: KeyboardEvent) => void
    }
    headerCell: (columnKey: string) => {
      role: "columnheader"
      tabindex: number
      "aria-sort": "none" | "ascending" | "descending"
      onClick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
      onContextmenu: (event: MouseEvent) => void
    }
    dataCell: (params: {
      row: TRow
      rowIndex: number
      columnKey: string
      editable?: boolean
      value?: unknown
    }) => {
      "data-row-key": string
      "data-column-key": string
      "data-inline-editable": "true" | "false"
      onDblclick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
      onContextmenu: (event: MouseEvent) => void
    }
    contextMenuRef: (element: Element | null) => void
    contextMenuRoot: (handlers?: { onEscape?: () => void }) => {
      role: "menu"
      tabindex: number
      onMousedown: (event: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    contextMenuAction: (
      actionId: DataGridContextMenuActionId,
      options?: AffinoDataGridActionBindingOptions,
    ) => {
      onClick: () => void
    }
    actionButton: (
      actionId: AffinoDataGridActionId,
      options?: AffinoDataGridActionBindingOptions & { actionOptions?: AffinoDataGridRunActionOptions },
    ) => {
      onClick: () => void
    }
  }
}

export function useAffinoDataGrid<TRow>(
  options: UseAffinoDataGridOptions<TRow>,
): UseAffinoDataGridResult<TRow> {
  const rows = toReadonlyRef(options.rows)
  const columns = toReadonlyRef(options.columns)

  const normalizedFeatures = normalizeAffinoDataGridFeatures(options.features)
  const {
    selection: normalizedSelectionFeature,
    clipboard: normalizedClipboardFeature,
    editing: normalizedEditingFeature,
    filtering: normalizedFilteringFeature,
    summary: normalizedSummaryFeature,
    visibility: normalizedVisibilityFeature,
    tree: normalizedTreeFeature,
  } = normalizedFeatures

  const internalSelectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
  const internalSelectionService: NonNullable<UseDataGridRuntimeOptions<TRow>["services"]>["selection"] = {
    name: "selection",
    getSelectionSnapshot() {
      return internalSelectionSnapshot.value
    },
    setSelectionSnapshot(snapshot) {
      internalSelectionSnapshot.value = snapshot
    },
    clearSelection() {
      internalSelectionSnapshot.value = null
    },
  }

  const runtimeServices: UseDataGridRuntimeOptions<TRow>["services"] = {
    ...options.services,
    selection: options.services?.selection ?? internalSelectionService,
  }

  const runtime = useDataGridRuntime<TRow>({
    rows,
    columns,
    services: runtimeServices,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  })

  const selectionFeature = useAffinoDataGridSelectionFeature({
    rows,
    runtime,
    feature: normalizedSelectionFeature,
    fallbackResolveRowKey,
    internalSelectionSnapshot,
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

  const {
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
    resolveColumnSortDirection,
  } = useAffinoDataGridSortingFeature({
    initialSortState: options.initialSortState,
    onSortModelChange(nextSortState) {
      runtime.api.setSortModel(nextSortState)
    },
  })

  const replaceRows = (nextRows: readonly TRow[]): boolean => {
    try {
      rows.value = nextRows
      return true
    } catch {
      return false
    }
  }

  const filteringFeature = useAffinoDataGridFilteringFeature({
    runtime,
    feature: normalizedFilteringFeature,
  })
  const {
    filteringEnabled,
    filterModel,
    setFilterModel,
    clearFilterModel,
    setAdvancedFilterExpression,
  } = filteringFeature

  const clipboardFeature = useAffinoDataGridClipboardFeature({
    rows,
    selectedRowKeySet,
    feature: normalizedClipboardFeature,
    resolveRowKey,
    replaceRows,
    clearSelection,
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
    rows,
    columns,
    feature: normalizedEditingFeature,
  })
  const {
    editingEnabled,
    editingMode,
    editingEnum,
    activeSession,
    beginEdit,
    updateDraft,
    cancelEdit,
    commitEdit,
    isCellEditing,
    resolveCellDraft,
  } = editingFeature

  const visibilityFeature = useAffinoDataGridVisibilityFeature({
    runtime,
    columns,
    feature: normalizedVisibilityFeature,
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
    runtime,
    feature: normalizedTreeFeature,
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
    runtime,
    feature: normalizedSummaryFeature,
    selectionEnabled,
    selectionSnapshot,
  })
  const {
    summaryEnabled,
    selectedSummary,
    recomputeSelectedSummary,
  } = summaryFeature

  const {
    createHeaderSortBindings,
    createRowSelectionBindings,
    createEditableCellBindings,
    createInlineEditorBindings,
  } = useAffinoDataGridBaseBindings({
    resolveColumnSortDirection,
    toggleColumnSort,
    resolveRowKey,
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
  })

  const componentProps = computed(() => ({
    rows: rows.value,
    columns: columns.value,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  }))

  const { runAction: runActionInternal } = useAffinoDataGridActionRunner({
    selectedRowKeySet,
    clearSelection,
    selectAllRows,
    resolveSelectedRows,
    copySelectedRows,
    cutSelectedRows,
    pasteRowsAppend,
    clearSelectedRows,
    setSortState,
    clearSort,
  })
  const runAction = (
    actionId: AffinoDataGridActionId,
    actionOptions: AffinoDataGridRunActionOptions = {},
  ): Promise<AffinoDataGridActionResult> => {
    return runActionInternal(
      actionId as AffinoDataGridInternalActionId,
      actionOptions,
    )
  }

  const contextMenuFeature = useAffinoDataGridContextMenuFeature<
    TRow,
    AffinoDataGridActionId,
    AffinoDataGridActionResult
  >({
    columns,
    resolveRowKey,
    createHeaderSortBindings,
    createEditableCellBindings,
    runAction,
  })
  const {
    contextMenuState,
    contextMenuStyle,
    contextMenuActions,
    contextMenuRef,
    openContextMenu,
    closeContextMenu,
    onContextMenuKeyDown,
    runContextMenuAction,
    createHeaderCellBindings,
    createDataCellBindings,
    setContextMenuRef,
    createContextMenuRootBindings,
    createContextMenuActionBinding,
    createActionButtonBinding,
  } = contextMenuFeature

  return {
    ...runtime,
    rows,
    columns,
    componentProps,
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
    actions: {
      copySelectedRows,
      cutSelectedRows,
      pasteRowsAppend,
      clearSelectedRows,
      selectAllRows,
      runAction,
    },
    contextMenu: {
      state: contextMenuState,
      style: contextMenuStyle,
      actions: contextMenuActions,
      contextMenuRef,
      open: openContextMenu,
      close: closeContextMenu,
      onKeyDown: onContextMenuKeyDown,
      runAction: runContextMenuAction,
    },
    features: {
      selection: {
        enabled: selectionEnabled,
        selectedRowKeys,
        selectedCount,
        isSelectedByKey,
        setSelectedByKey,
        toggleSelectedByKey,
        clearSelection,
        resolveRowKey,
      },
      clipboard: {
        enabled: clipboardEnabled,
        lastCopiedText,
        copyText,
        readText,
        copyRows,
        parseRows,
      },
      editing: {
        enabled: editingEnabled,
        mode: editingMode,
        enum: editingEnum,
        activeSession,
        beginEdit,
        updateDraft,
        cancelEdit,
        commitEdit,
      },
      filtering: {
        enabled: filteringEnabled,
        model: filterModel,
        setModel: setFilterModel,
        clear: clearFilterModel,
        setAdvancedExpression: setAdvancedFilterExpression,
      },
      summary: {
        enabled: summaryEnabled,
        selected: selectedSummary,
        recomputeSelected: recomputeSelectedSummary,
      },
      visibility: {
        enabled: visibilityEnabled,
        hiddenColumnKeys,
        isColumnVisible,
        setColumnVisible,
        toggleColumnVisible,
        setHiddenColumnKeys,
        reset: resetHiddenColumns,
      },
      tree: {
        enabled: treeEnabled,
        groupBy,
        groupExpansion,
        setGroupBy,
        clearGroupBy,
        toggleGroup,
        isGroupExpanded,
        expandGroups,
        collapseGroups,
        expandAll: expandAllGroups,
        collapseAll: collapseAllGroups,
      },
    },
    bindings: {
      getRowKey: resolveRowKey,
      headerSort: createHeaderSortBindings,
      rowSelection: createRowSelectionBindings,
      editableCell: createEditableCellBindings,
      isCellEditing,
      inlineEditor: createInlineEditorBindings,
      headerCell: createHeaderCellBindings,
      dataCell: createDataCellBindings,
      contextMenuRef: setContextMenuRef,
      contextMenuRoot: createContextMenuRootBindings,
      contextMenuAction: createContextMenuActionBinding,
      actionButton: createActionButtonBinding,
    },
  }
}
