import type { Component, Ref } from "vue"
import type {
  DataGridAdvancedFilterExpression,
  DataGridAdvancedFilterCondition,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  CreateDataGridCoreOptions,
  DataGridColumnDef,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridSelectionAggregationKind,
  DataGridSelectionSummaryColumnConfig,
  DataGridSelectionSummarySnapshot,
  DataGridSortDirection,
  DataGridSortState,
} from "@affino/datagrid-core"
import type { DataGridTransactionSnapshot } from "@affino/datagrid-core/advanced"
import type {
  UseDataGridRuntimeOptions,
  UseDataGridRuntimeResult,
} from "./useDataGridRuntime"
import type {
  DataGridContextMenuAction,
  DataGridContextMenuActionId,
  DataGridContextMenuState,
  OpenDataGridContextMenuInput,
} from "./useDataGridContextMenu"
import type { AffinoDataGridFeatureInput, MaybeRef } from "./internal/useAffinoDataGrid"

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
  enumEditor?: {
    enabled?: boolean
    resolveOptions?: (context: {
      row: TRow
      rowKey: string
      columnKey: string
      value: unknown
      rows: readonly TRow[]
      columns: readonly DataGridColumnDef[]
    }) => readonly { label: string; value: unknown }[]
    primitive?: "affino-listbox" | "affino-menu"
  }
  onCommit?: (session: AffinoDataGridEditSession, context: {
    rows: readonly TRow[]
    columns: readonly DataGridColumnDef[]
  }) => void | Promise<void>
}

export interface AffinoDataGridFeatures<TRow> extends AffinoDataGridFeatureInput<TRow> {
  interactions?: boolean | AffinoDataGridInteractionsFeature
  headerFilters?: boolean | AffinoDataGridHeaderFiltersFeature
  feedback?: boolean | AffinoDataGridFeedbackFeature
  statusBar?: boolean | AffinoDataGridStatusBarFeature
}

export interface AffinoDataGridRangeInteractionsFeature {
  enabled?: boolean
  fill?: boolean
  move?: boolean
}

export interface AffinoDataGridInteractionsFeature {
  enabled?: boolean
  range?: boolean | AffinoDataGridRangeInteractionsFeature
}

export interface AffinoDataGridHeaderFiltersFeature {
  enabled?: boolean
  maxUniqueValues?: number
}

export interface AffinoDataGridFeedbackFeature {
  enabled?: boolean
  maxEvents?: number
}

export interface AffinoDataGridStatusBarFeature {
  enabled?: boolean
}

export interface AffinoDataGridLayoutProfile {
  id: string
  name: string
  createdAt: number
  sortState: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
  columnState: DataGridColumnModelSnapshot
}

export interface AffinoDataGridFeedbackEvent {
  id: number
  action: string
  message: string
  timestamp: number
  source: "action" | "context-menu" | "range" | "history" | "layout" | "header-filter"
  affected?: number
  ok?: boolean
  meta?: Record<string, unknown>
}

export interface AffinoDataGridHeaderFilterValueEntry {
  key: string
  value: unknown
  label: string
  count: number
  selected: boolean
}

export interface AffinoDataGridHeaderFilterOperatorEntry {
  value: string
  label: string
}

export interface AffinoDataGridStatusBarMetrics<TRow = unknown> {
  rowsTotal: number
  rowsFiltered: number
  columnsVisible: number
  selectedCells: number
  selectedRows: number
  activeCell: { rowKey: string; columnKey: string } | null
  anchorCell: { rowKey: string; columnKey: string } | null
  summary: DataGridSelectionSummarySnapshot | null
  format: (columnKey: string, fallback?: string) => string
  getAggregate: (
    columnKey: string,
    aggregation: DataGridSelectionAggregationKind,
  ) => number | null
  resolveRowByKey: (rowKey: string) => TRow | null
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

export interface AffinoDataGridRowHeightFeature {
  enabled?: boolean
  mode?: "fixed" | "auto"
  base?: number
}

export interface AffinoDataGridKeyboardNavigationFeature {
  enabled?: boolean
}

export type AffinoDataGridFilterMergeMode = "replace" | "merge-and" | "merge-or"
export type AffinoDataGridSetFilterValueMode = "replace" | "append" | "remove"

export interface AffinoDataGridFilteringHelpers {
  condition: (condition: Omit<DataGridAdvancedFilterCondition, "kind">) => DataGridAdvancedFilterCondition
  and: (...children: readonly (DataGridAdvancedFilterExpression | null | undefined)[]) => DataGridAdvancedFilterExpression | null
  or: (...children: readonly (DataGridAdvancedFilterExpression | null | undefined)[]) => DataGridAdvancedFilterExpression | null
  not: (child: DataGridAdvancedFilterExpression | null | undefined) => DataGridAdvancedFilterExpression | null
  apply: (
    expression: DataGridAdvancedFilterExpression | null,
    options?: { mergeMode?: AffinoDataGridFilterMergeMode },
  ) => DataGridAdvancedFilterExpression | null
  clearByKey: (columnKey: string) => DataGridAdvancedFilterExpression | null
  setText: (
    columnKey: string,
    options: {
      operator?: string
      value?: unknown
      mergeMode?: AffinoDataGridFilterMergeMode
    },
  ) => DataGridAdvancedFilterExpression | null
  setNumber: (
    columnKey: string,
    options: {
      operator?: string
      value?: unknown
      value2?: unknown
      mergeMode?: AffinoDataGridFilterMergeMode
    },
  ) => DataGridAdvancedFilterExpression | null
  setDate: (
    columnKey: string,
    options: {
      operator?: string
      value?: unknown
      value2?: unknown
      mergeMode?: AffinoDataGridFilterMergeMode
    },
  ) => DataGridAdvancedFilterExpression | null
  setSet: (
    columnKey: string,
    values: readonly unknown[],
    options?: {
      operator?: string
      mergeMode?: AffinoDataGridFilterMergeMode
      valueMode?: AffinoDataGridSetFilterValueMode
    },
  ) => DataGridAdvancedFilterExpression | null
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

export interface AffinoDataGridCellCoord {
  rowIndex: number
  columnIndex: number
}

export interface AffinoDataGridCellRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseAffinoDataGridResult<TRow> extends UseDataGridRuntimeResult<TRow> {
  DataGrid: Component
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
  pagination: {
    snapshot: Ref<DataGridPaginationSnapshot>
    set: (pagination: DataGridPaginationInput | null) => void
    setPageSize: (pageSize: number | null) => void
    setCurrentPage: (page: number) => void
    goToNextPage: () => void
    goToPreviousPage: () => void
    goToFirstPage: () => void
    goToLastPage: () => void
    refresh: () => DataGridPaginationSnapshot
  }
  columnState: {
    snapshot: Ref<DataGridColumnModelSnapshot>
    setOrder: (keys: readonly string[]) => void
    setVisibility: (columnKey: string, visible: boolean) => void
    setWidth: (columnKey: string, width: number | null) => void
    setPin: (columnKey: string, pin: DataGridColumnPin) => void
    capture: () => DataGridColumnModelSnapshot
    apply: (snapshot: DataGridColumnModelSnapshot) => void
    refresh: () => DataGridColumnModelSnapshot
  }
  history: {
    supported: Ref<boolean>
    snapshot: Ref<DataGridTransactionSnapshot | null>
    canUndo: Ref<boolean>
    canRedo: Ref<boolean>
    refresh: () => DataGridTransactionSnapshot | null
    undo: () => Promise<string | null>
    redo: () => Promise<string | null>
  }
  rowReorder: {
    supported: Ref<boolean>
    canReorder: Ref<boolean>
    reason: Ref<string | null>
    moveByIndex: (fromIndex: number, toIndex: number, count?: number) => Promise<boolean>
    moveByKey: (
      sourceRowKey: string,
      targetRowKey: string,
      position?: "before" | "after",
    ) => Promise<boolean>
  }
  cellSelection: {
    activeCell: Ref<{
      rowKey: string
      columnKey: string
      rowIndex: number
      columnIndex: number
    } | null>
    anchorCell: Ref<{
      rowKey: string
      columnKey: string
      rowIndex: number
      columnIndex: number
    } | null>
    focusCell: Ref<{
      rowKey: string
      columnKey: string
      rowIndex: number
      columnIndex: number
    } | null>
    range: Ref<{
      startRow: number
      endRow: number
      startColumn: number
      endColumn: number
    } | null>
    ranges: Ref<readonly {
      startRow: number
      endRow: number
      startColumn: number
      endColumn: number
    }[]>
    isCellSelected: (rowIndex: number, columnIndex: number) => boolean
    setCellByKey: (rowKey: string, columnKey: string, options?: { extend?: boolean }) => boolean
    clear: () => void
  }
  cellRange: {
    copiedRange: Ref<AffinoDataGridCellRange | null>
    fillPreviewRange: Ref<AffinoDataGridCellRange | null>
    rangeMovePreviewRange: Ref<AffinoDataGridCellRange | null>
    lastAction: Ref<string>
    copy: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
    paste: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
    cut: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
    clear: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
    setFillPreviewRange: (range: AffinoDataGridCellRange | null) => void
    setRangeMovePreviewRange: (range: AffinoDataGridCellRange | null) => void
    applyFillPreview: () => void
    applyRangeMove: () => boolean
  }
  actions: {
    copySelectedRows: () => Promise<boolean>
    cutSelectedRows: () => Promise<number>
    pasteRowsAppend: () => Promise<number>
    clearSelectedRows: () => Promise<number>
    selectAllRows: () => number
    runAction: (actionId: AffinoDataGridActionId, options?: AffinoDataGridRunActionOptions) => Promise<AffinoDataGridActionResult>
  }
  feedback?: {
    enabled: Ref<boolean>
    lastAction: Ref<string>
    events: Ref<readonly AffinoDataGridFeedbackEvent[]>
    clear: () => void
  }
  layoutProfiles?: {
    profiles: Ref<readonly AffinoDataGridLayoutProfile[]>
    capture: (name: string, options?: { id?: string }) => AffinoDataGridLayoutProfile
    apply: (idOrProfile: string | AffinoDataGridLayoutProfile) => boolean
    remove: (id: string) => boolean
    clear: () => void
  }
  statusBar?: {
    enabled: Ref<boolean>
    metrics: Ref<AffinoDataGridStatusBarMetrics<TRow>>
    refresh: () => AffinoDataGridStatusBarMetrics<TRow>
  }
  contextMenu: {
    state: Ref<DataGridContextMenuState>
    style: Ref<{ left: string; top: string }>
    actions: Ref<readonly DataGridContextMenuAction[]>
    groupedActions?: Ref<
      readonly {
        id: "clipboard" | "sorting" | "filters" | "column"
        label: string
        actions: readonly DataGridContextMenuAction[]
      }[]
    >
    contextMenuRef: Ref<HTMLElement | null>
    open: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void
    openForActiveCell?: (options?: { zone?: "cell" | "range"; clientX?: number; clientY?: number }) => boolean
    openForHeader?: (columnKey: string, options?: { clientX?: number; clientY?: number }) => boolean
    isActionDisabled?: (actionId: DataGridContextMenuActionId) => boolean
    getActionDisabledReason?: (actionId: DataGridContextMenuActionId) => string | null
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
      enumEditor?: {
        enabled: Ref<boolean>
        primitive: Ref<"affino-listbox" | "affino-menu">
        resolveOptions: (params: {
          row: TRow
          rowKey: string
          columnKey: string
          value: unknown
        }) => readonly { label: string; value: unknown }[]
      }
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
      helpers: AffinoDataGridFilteringHelpers
    }
    interactions?: {
      enabled: Ref<boolean>
      range: {
        enabled: Ref<boolean>
        fillEnabled: Ref<boolean>
        moveEnabled: Ref<boolean>
        pointerMode: Ref<"idle" | "fill" | "move">
        stop: () => void
      }
    }
    headerFilters?: {
      enabled: Ref<boolean>
      state: Ref<{
        open: boolean
        columnKey: string | null
        query: string
        operator: string
        type: "text" | "number" | "date" | "set"
      }>
      open: (columnKey: string) => boolean
      close: () => void
      toggle: (columnKey: string) => boolean
      setQuery: (query: string) => void
      setOperator: (operator: string) => void
      getOperators: (columnKey: string) => readonly AffinoDataGridHeaderFilterOperatorEntry[]
      getUniqueValues: (columnKey: string) => readonly AffinoDataGridHeaderFilterValueEntry[]
      setValueSelected: (
        columnKey: string,
        value: unknown,
        selected: boolean,
        options?: { mode?: AffinoDataGridSetFilterValueMode },
      ) => DataGridAdvancedFilterExpression | null
      selectOnlyValue: (columnKey: string, value: unknown) => DataGridAdvancedFilterExpression | null
      selectAllValues: (columnKey: string) => DataGridAdvancedFilterExpression | null
      clearValues: (columnKey: string) => DataGridAdvancedFilterExpression | null
      applyText: (
        columnKey: string,
        options: { operator?: string; value?: unknown; mergeMode?: AffinoDataGridFilterMergeMode },
      ) => DataGridAdvancedFilterExpression | null
      applyNumber: (
        columnKey: string,
        options: {
          operator?: string
          value?: unknown
          value2?: unknown
          mergeMode?: AffinoDataGridFilterMergeMode
        },
      ) => DataGridAdvancedFilterExpression | null
      applyDate: (
        columnKey: string,
        options: {
          operator?: string
          value?: unknown
          value2?: unknown
          mergeMode?: AffinoDataGridFilterMergeMode
        },
      ) => DataGridAdvancedFilterExpression | null
      clear: (columnKey: string) => DataGridAdvancedFilterExpression | null
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
    rowHeight: {
      enabled: Ref<boolean>
      supported: Ref<boolean>
      mode: Ref<"fixed" | "auto">
      base: Ref<number>
      setMode: (mode: "fixed" | "auto") => void
      setBase: (height: number) => void
      measureVisible: () => boolean
      apply: () => boolean
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
    rowReorder: (row: TRow, index: number) => {
      draggable: true
      "data-row-key": string
      onDragstart: (event: DragEvent) => void
      onDragover: (event: DragEvent) => void
      onDrop: (event: DragEvent) => void
      onDragend: (event?: DragEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    cellSelection: (params: {
      row: TRow
      rowIndex: number
      columnKey: string
    }) => {
      "data-row-key": string
      "data-column-key": string
      onMousedown: (event: MouseEvent) => void
      onMouseenter: (event: MouseEvent) => void
      onMouseup: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    rangeHandle?: (params: {
      rowIndex: number
      columnKey: string
      mode?: "fill" | "move"
    }) => {
      "data-row-index": number
      "data-column-key": string
      "data-range-mode": "fill" | "move"
      onMousedown: (event: MouseEvent) => void
    }
    rangeSurface?: (params: {
      rowIndex: number
      columnKey: string
    }) => {
      "data-row-index": number
      "data-column-key": string
      onMouseenter: (event?: MouseEvent) => void
      onMouseup: (event?: MouseEvent) => void
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
      draggable: true
      "data-column-key": string
      onClick: (event?: MouseEvent) => void
      onDragstart: (event: DragEvent) => void
      onDragover: (event: DragEvent) => void
      onDrop: (event: DragEvent) => void
      onDragend: (event?: DragEvent) => void
      onKeydown: (event: KeyboardEvent) => void
      onContextmenu: (event: MouseEvent) => void
    }
    headerReorder: (columnKey: string) => {
      draggable: true
      "data-column-key": string
      onDragstart: (event: DragEvent) => void
      onDragover: (event: DragEvent) => void
      onDrop: (event: DragEvent) => void
      onDragend: (event?: DragEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    columnResizeHandle?: (columnKey: string) => {
      role: "separator"
      tabindex: number
      "aria-orientation": "vertical"
      "data-column-key": string
      onMousedown: (event: MouseEvent) => void
      onDblclick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    rowResizeHandle?: (rowKey: string) => {
      role: "separator"
      tabindex: number
      "aria-orientation": "horizontal"
      "data-row-key": string
      onMousedown: (event: MouseEvent) => void
      onDblclick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
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
