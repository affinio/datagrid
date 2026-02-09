import { computed, isRef, ref, watch, type Ref } from "vue"
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
  useDataGridContextMenu,
  type DataGridContextMenuAction,
  type DataGridContextMenuActionId,
  type DataGridContextMenuState,
  type OpenDataGridContextMenuInput,
} from "./useDataGridContextMenu"
import {
  normalizeClipboardFeature,
  useAffinoDataGridClipboardFeature,
} from "./useAffinoDataGridClipboardFeature"
import {
  normalizeEditingFeature,
  useAffinoDataGridEditingFeature,
} from "./useAffinoDataGridEditingFeature"
import {
  normalizeFilteringFeature,
  useAffinoDataGridFilteringFeature,
} from "./useAffinoDataGridFilteringFeature"
import {
  normalizeSelectionFeature,
  useAffinoDataGridSelectionFeature,
} from "./useAffinoDataGridSelectionFeature"
import {
  normalizeSummaryFeature,
  useAffinoDataGridSummaryFeature,
} from "./useAffinoDataGridSummaryFeature"
import {
  normalizeVisibilityFeature,
  useAffinoDataGridVisibilityFeature,
} from "./useAffinoDataGridVisibilityFeature"
import {
  normalizeTreeFeature,
  useAffinoDataGridTreeFeature,
} from "./useAffinoDataGridTreeFeature"

type MaybeRef<T> = T | Ref<T>

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

export interface AffinoDataGridFeatures<TRow> {
  selection?: boolean | AffinoDataGridSelectionFeature<TRow>
  clipboard?: boolean | AffinoDataGridClipboardFeature<TRow>
  editing?: boolean | AffinoDataGridEditingFeature<TRow>
  filtering?: boolean | AffinoDataGridFilteringFeature
  summary?: boolean | AffinoDataGridSummaryFeature<TRow>
  visibility?: boolean | AffinoDataGridVisibilityFeature
  tree?: boolean | AffinoDataGridTreeFeature
}

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

function toReadonlyRef<T>(source: MaybeRef<T>): Ref<T> {
  if (isRef(source)) {
    return source as Ref<T>
  }
  return ref(source) as Ref<T>
}

function fallbackResolveRowKey<TRow>(row: TRow, index: number): string {
  const candidate = row as { rowId?: unknown; id?: unknown; key?: unknown }
  if (typeof candidate.rowId === "string" || typeof candidate.rowId === "number") {
    return String(candidate.rowId)
  }
  if (typeof candidate.id === "string" || typeof candidate.id === "number") {
    return String(candidate.id)
  }
  if (typeof candidate.key === "string" || typeof candidate.key === "number") {
    return String(candidate.key)
  }
  return `row-${index}`
}

function toAriaSortDirection(
  direction: DataGridSortDirection | null,
): "none" | "ascending" | "descending" {
  if (direction === "asc") {
    return "ascending"
  }
  if (direction === "desc") {
    return "descending"
  }
  return "none"
}

export function useAffinoDataGrid<TRow>(
  options: UseAffinoDataGridOptions<TRow>,
): UseAffinoDataGridResult<TRow> {
  const rows = toReadonlyRef(options.rows)
  const columns = toReadonlyRef(options.columns)

  const normalizedSelectionFeature = normalizeSelectionFeature(options.features?.selection)
  const normalizedClipboardFeature = normalizeClipboardFeature(options.features?.clipboard)
  const normalizedEditingFeature = normalizeEditingFeature(options.features?.editing)
  const normalizedFilteringFeature = normalizeFilteringFeature(options.features?.filtering)
  const normalizedSummaryFeature = normalizeSummaryFeature(options.features?.summary)
  const normalizedVisibilityFeature = normalizeVisibilityFeature(options.features?.visibility)
  const normalizedTreeFeature = normalizeTreeFeature(options.features?.tree)

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

  const sortState = ref<readonly DataGridSortState[]>(options.initialSortState ?? [])
  const setSortState = (nextState: readonly DataGridSortState[]) => {
    sortState.value = nextState.map(entry => ({ ...entry }))
  }

  const toggleColumnSort = (
    columnKey: string,
    directionCycle: readonly DataGridSortDirection[] = ["asc", "desc"],
  ) => {
    const current = sortState.value.find(entry => entry.key === columnKey)
    if (!current) {
      setSortState([{ key: columnKey, direction: directionCycle[0] ?? "asc" }])
      return
    }

    const currentIndex = directionCycle.indexOf(current.direction)
    if (currentIndex < 0 || currentIndex === directionCycle.length - 1) {
      setSortState(sortState.value.filter(entry => entry.key !== columnKey))
      return
    }

    setSortState(
      sortState.value.map(entry => (
        entry.key === columnKey
          ? { key: columnKey, direction: directionCycle[currentIndex + 1] ?? "asc" }
          : { ...entry }
      )),
    )
  }

  const clearSort = () => {
    if (sortState.value.length === 0) {
      return
    }
    sortState.value = []
  }

  const replaceRows = (nextRows: readonly TRow[]): boolean => {
    try {
      rows.value = nextRows
      return true
    } catch {
      return false
    }
  }

  const resolveColumnSortDirection = (columnKey: string): DataGridSortDirection | null => {
    const entry = sortState.value.find(item => item.key === columnKey)
    return entry?.direction ?? null
  }

  watch(sortState, nextSortState => {
    runtime.api.setSortModel(nextSortState)
  }, { immediate: true })
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

  const createHeaderSortBindings = (columnKey: string) => ({
    role: "columnheader" as const,
    tabindex: 0,
    "aria-sort": toAriaSortDirection(resolveColumnSortDirection(columnKey)),
    onClick: (_event?: MouseEvent) => {
      toggleColumnSort(columnKey)
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      event.preventDefault()
      toggleColumnSort(columnKey)
    },
  })

  const createRowSelectionBindings = (row: TRow, index: number) => {
    const rowKey = resolveRowKey(row, index)
    return {
      role: "row" as const,
      tabindex: 0,
      "data-row-key": rowKey,
      "aria-selected": (isSelectedByKey(rowKey) ? "true" : "false") as "true" | "false",
      onClick: (event?: MouseEvent) => {
        const shouldToggle = Boolean(event?.metaKey || event?.ctrlKey)
        if (shouldToggle) {
          toggleSelectedByKey(rowKey)
          return
        }
        selectOnlyRow(rowKey)
      },
      onKeydown: (event: KeyboardEvent) => {
        if (event.key !== " " && event.key !== "Enter") {
          return
        }
        event.preventDefault()
        const shouldToggle = event.metaKey || event.ctrlKey
        if (shouldToggle) {
          toggleSelectedByKey(rowKey)
          return
        }
        selectOnlyRow(rowKey)
      },
    }
  }

  const createEditableCellBindings = (params: {
    row: TRow
    rowIndex: number
    columnKey: string
    editable?: boolean
    value?: unknown
  }) => {
    const rowKey = resolveRowKey(params.row, params.rowIndex)
    const editable = params.editable ?? true
    const startEdit = (): void => {
      if (!editable || !editingEnabled.value) {
        return
      }
      beginEdit({
        rowKey,
        columnKey: params.columnKey,
        draft: resolveCellDraft({
          row: params.row,
          columnKey: params.columnKey,
          value: params.value,
        }),
      })
    }

    return {
      "data-row-key": rowKey,
      "data-column-key": params.columnKey,
      "data-inline-editable": editable ? ("true" as const) : ("false" as const),
      onDblclick: (_event?: MouseEvent) => {
        startEdit()
      },
      onKeydown: (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== "F2") {
          return
        }
        event.preventDefault()
        startEdit()
      },
    }
  }

  const createInlineEditorBindings = (params: {
    rowKey: string
    columnKey: string
    commitOnBlur?: boolean
  }) => ({
    value: isCellEditing(params.rowKey, params.columnKey)
      ? (activeSession.value?.draft ?? "")
      : "",
    onInput: (event: Event) => {
      const target = event.target as HTMLInputElement | null
      updateDraft(target?.value ?? "")
    },
    onBlur: () => {
      if (params.commitOnBlur === false) {
        return
      }
      void commitEdit()
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        cancelEdit()
        return
      }
      if (event.key !== "Enter") {
        return
      }
      event.preventDefault()
      void commitEdit()
    },
  })

  const componentProps = computed(() => ({
    rows: rows.value,
    columns: columns.value,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  }))

  const runAction = async (
    actionId: AffinoDataGridActionId,
    actionOptions: AffinoDataGridRunActionOptions = {},
  ): Promise<AffinoDataGridActionResult> => {
    switch (actionId) {
      case "copy": {
        const ok = await copySelectedRows()
        const affected = resolveSelectedRows().length
        return {
          ok,
          affected: ok ? affected : 0,
          message: ok ? `Copied ${affected} selected row(s)` : "Copy failed",
        }
      }
      case "cut": {
        const affected = await cutSelectedRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Cut ${affected} row(s)` : "Nothing was cut",
        }
      }
      case "paste": {
        const affected = await pasteRowsAppend()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Pasted ${affected} row(s)` : "Nothing to paste",
        }
      }
      case "clear": {
        const affected = clearSelectedRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Cleared ${affected} row(s)` : "Nothing to clear",
        }
      }
      case "sort-asc":
      case "sort-desc": {
        const columnKey = actionOptions.columnKey ?? null
        if (!columnKey) {
          return {
            ok: false,
            affected: 0,
            message: "Missing column key for sort action",
          }
        }
        setSortState([{ key: columnKey, direction: actionId === "sort-asc" ? "asc" : "desc" }])
        return {
          ok: true,
          affected: 1,
          message: `Sorted ${columnKey} ${actionId === "sort-asc" ? "ascending" : "descending"}`,
        }
      }
      case "sort-clear": {
        clearSort()
        return {
          ok: true,
          affected: 1,
          message: "Sort cleared",
        }
      }
      case "select-all": {
        const affected = selectAllRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Selected ${affected} row(s)` : "Nothing to select",
        }
      }
      case "clear-selection": {
        const affected = selectedRowKeySet.value.size
        clearSelection()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? "Selection cleared" : "Selection already empty",
        }
      }
      case "filter":
      case "auto-size":
      default:
        return {
          ok: false,
          affected: 0,
          message: `Action "${actionId}" is not mapped in useAffinoDataGrid`,
        }
    }
  }

  const contextMenuBridge = useDataGridContextMenu({
    isColumnResizable(columnKey) {
      return columns.value.some(column => column.key === columnKey)
    },
  })

  const runContextMenuAction = async (
    actionId: DataGridContextMenuActionId,
  ): Promise<AffinoDataGridActionResult> => {
    const result = await runAction(actionId, {
      columnKey: contextMenuBridge.contextMenu.value.columnKey,
    })
    contextMenuBridge.closeContextMenu()
    return result
  }

  const createHeaderCellBindings = (columnKey: string) => ({
    ...createHeaderSortBindings(columnKey),
    onContextmenu: (event: MouseEvent) => {
      event.preventDefault()
      contextMenuBridge.openContextMenu(event.clientX, event.clientY, {
        zone: "header",
        columnKey,
      })
    },
  })

  const createDataCellBindings = (params: {
    row: TRow
    rowIndex: number
    columnKey: string
    editable?: boolean
    value?: unknown
  }) => {
    const base = createEditableCellBindings(params)
    return {
      ...base,
      onContextmenu: (event: MouseEvent) => {
        event.preventDefault()
        contextMenuBridge.openContextMenu(event.clientX, event.clientY, {
          zone: "cell",
          rowId: String(resolveRowKey(params.row, params.rowIndex)),
          columnKey: params.columnKey,
        })
      },
    }
  }

  const setContextMenuRef = (element: Element | null) => {
    contextMenuBridge.contextMenuRef.value = element as HTMLElement | null
  }

  const createContextMenuRootBindings = (handlers?: { onEscape?: () => void }) => ({
    role: "menu" as const,
    tabindex: -1,
    onMousedown: (event: MouseEvent) => {
      event.stopPropagation()
    },
    onKeydown: (event: KeyboardEvent) => {
      contextMenuBridge.onContextMenuKeyDown(event, handlers)
    },
  })

  const createContextMenuActionBinding = (
    actionId: DataGridContextMenuActionId,
    options: AffinoDataGridActionBindingOptions = {},
  ) => ({
    onClick: () => {
      void runContextMenuAction(actionId).then(result => {
        options.onResult?.(result)
      })
    },
  })

  const createActionButtonBinding = (
    actionId: AffinoDataGridActionId,
    options: AffinoDataGridActionBindingOptions & { actionOptions?: AffinoDataGridRunActionOptions } = {},
  ) => ({
    onClick: () => {
      void runAction(actionId, options.actionOptions).then(result => {
        options.onResult?.(result)
      })
    },
  })

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
      state: contextMenuBridge.contextMenu,
      style: contextMenuBridge.contextMenuStyle,
      actions: contextMenuBridge.contextMenuActions,
      contextMenuRef: contextMenuBridge.contextMenuRef,
      open: contextMenuBridge.openContextMenu,
      close: contextMenuBridge.closeContextMenu,
      onKeyDown: contextMenuBridge.onContextMenuKeyDown,
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
