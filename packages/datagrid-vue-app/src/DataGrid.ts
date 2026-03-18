import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  toRef,
  watch,
  type PropType,
  type VNode,
} from "vue"
import {
  type CreateDataGridCoreOptions,
  type DataGridApi,
  type DataGridApiPluginDefinition,
  type DataGridAggregationModel,
  type DataGridColumnModel,
  type DataGridColumnPin,
  type DataGridComputedFieldDefinition,
  type DataGridCoreServiceRegistry,
  type DataGridFilterSnapshot,
  type DataGridFormulaFieldDefinition,
  type DataGridFormulaFunctionRegistry,
  type DataGridGroupBySpec,
  type DataGridMigrateStateOptions,
  type DataGridRowNode,
  type DataGridRowSelectionSnapshot,
  type DataGridRowModel,
  type DataGridRowNodeInput,
  type DataGridSetStateOptions,
  type DataGridSortState,
  type DataGridUnifiedColumnState,
  type DataGridUnifiedState,
  type DataGridPivotSpec,
  type UseDataGridRuntimeResult,
  useDataGridAppRowSelection,
  useDataGridAppSelection,
} from "@affino/datagrid-vue"
import DataGridDefaultRenderer from "./host/DataGridDefaultRenderer"
import {
  resolveDataGridColumns,
  resolveDataGridFormulaRowModelOptions,
  type DataGridAppClientRowModelOptions,
  type DataGridAppColumnInput,
} from "./config/dataGridFormulaOptions"
import { type DataGridThemeProp } from "./theme/dataGridTheme"
import {
  resolveDataGridGroupBy,
  resolveDataGridPagination,
  resolveDataGridRenderMode,
  type DataGridGroupByProp,
  type DataGridPaginationProp,
} from "./config/dataGridPublicProps"
import {
  resolveDataGridAdvancedFilter,
  type DataGridAdvancedFilterOptions,
  type DataGridAdvancedFilterProp,
} from "./config/dataGridAdvancedFilter"
import {
  migrateDataGridSavedView,
  type DataGridSavedViewSnapshot,
} from "./config/dataGridSavedView"
import {
  resolveDataGridColumnLayout,
  type DataGridColumnLayoutOptions,
  type DataGridColumnLayoutProp,
} from "./config/dataGridColumnLayout"
import {
  resolveDataGridAggregations,
  type DataGridAggregationsOptions,
  type DataGridAggregationsProp,
} from "./config/dataGridAggregations"
import {
  resolveDataGridColumnMenu,
  type DataGridColumnMenuOptions,
  type DataGridColumnMenuProp,
} from "./overlays/dataGridColumnMenu"
import {
  resolveDataGridCellMenu,
  resolveDataGridRowIndexMenu,
  type DataGridCellMenuOptions,
  type DataGridCellMenuProp,
  type DataGridRowIndexMenuOptions,
  type DataGridRowIndexMenuProp,
} from "./overlays/dataGridContextMenu"
import { type DataGridVirtualizationProp, resolveDataGridVirtualization } from "./config/dataGridVirtualization"
import DataGridRuntimeHost from "./host/DataGridRuntimeHost"
import {
  useDataGridAppControlledState,
  type UseDataGridAppControlledStateOptions,
} from "./useDataGridAppControlledState"
import { useDataGridAppRowModel } from "./useDataGridAppRowModel"
import type { DataGridCellEditablePredicate } from "./dataGridEditability"
import type {
  DataGridAppViewMode,
  DataGridGanttProp,
} from "./gantt/dataGridGantt"

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

type DataGridSelectionService = NonNullable<DataGridRuntimeOverrides["selection"]>

type DataGridBodyAwareRuntime = Pick<
  UseDataGridRuntimeResult<Record<string, unknown>>,
  "api" | "syncBodyRowsInRange" | "rowPartition" | "virtualWindow" | "columnSnapshot"
> & {
  getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<Record<string, unknown>> | null
  resolveBodyRowIndexById: (rowId: string | number) => number
}

function createDisabledRowSelectionService(): DataGridSelectionService {
  return {
    name: "selection",
    getRowSelectionSnapshot: () => null,
    setRowSelectionSnapshot: () => undefined,
    clearRowSelection: () => undefined,
    getFocusedRow: () => null,
    setFocusedRow: () => undefined,
    getSelectedRows: () => [],
    isRowSelected: () => false,
    setRowSelected: () => undefined,
    selectRows: () => undefined,
    deselectRows: () => undefined,
    clearSelectedRows: () => undefined,
  }
}

function composeSelectionLifecycle(
  hook: "init" | "start" | "stop" | "dispose",
  services: readonly (DataGridSelectionService | undefined)[],
): DataGridSelectionService[typeof hook] {
  const handlers = services
    .map(service => service?.[hook])
    .filter((handler): handler is NonNullable<DataGridSelectionService[typeof hook]> => typeof handler === "function")
  if (handlers.length === 0) {
    return undefined
  }
  return async context => {
    for (const handler of handlers) {
      await handler(context)
    }
  }
}

function composeSelectionService(options: {
  userSelectionService?: DataGridSelectionService
  cellSelectionService: DataGridSelectionService
  rowSelectionService: DataGridSelectionService
}): DataGridSelectionService {
  const {
    userSelectionService,
    cellSelectionService,
    rowSelectionService,
  } = options
  return {
    name: "selection",
    init: composeSelectionLifecycle("init", [userSelectionService, cellSelectionService, rowSelectionService]),
    start: composeSelectionLifecycle("start", [userSelectionService, cellSelectionService, rowSelectionService]),
    stop: composeSelectionLifecycle("stop", [userSelectionService, cellSelectionService, rowSelectionService]),
    dispose: composeSelectionLifecycle("dispose", [userSelectionService, cellSelectionService, rowSelectionService]),
    getSelectionSnapshot: cellSelectionService.getSelectionSnapshot,
    setSelectionSnapshot: cellSelectionService.setSelectionSnapshot,
    clearSelection: cellSelectionService.clearSelection,
    getRowSelectionSnapshot: rowSelectionService.getRowSelectionSnapshot,
    setRowSelectionSnapshot: rowSelectionService.setRowSelectionSnapshot,
    clearRowSelection: rowSelectionService.clearRowSelection,
    getFocusedRow: rowSelectionService.getFocusedRow,
    setFocusedRow: rowSelectionService.setFocusedRow,
    getSelectedRows: rowSelectionService.getSelectedRows,
    isRowSelected: rowSelectionService.isRowSelected,
    setRowSelected: rowSelectionService.setRowSelected,
    selectRows: rowSelectionService.selectRows,
    deselectRows: rowSelectionService.deselectRows,
    clearSelectedRows: rowSelectionService.clearSelectedRows,
  }
}

interface LowLevelGridExpose {
  api: DataGridApi<Record<string, unknown>>
  core: unknown
  runtime: DataGridBodyAwareRuntime
  rowModel: DataGridRowModel<Record<string, unknown>>
  columnModel: DataGridColumnModel
  columnSnapshot: unknown
  rowPartition: DataGridBodyAwareRuntime["rowPartition"]
  setRows: (rows: readonly Record<string, unknown>[]) => void
  syncBodyRowsInRange: (range: { start: number; end: number }) => readonly unknown[]
  getBodyRowAtIndex: DataGridBodyAwareRuntime["getBodyRowAtIndex"]
  resolveBodyRowIndexById: DataGridBodyAwareRuntime["resolveBodyRowIndexById"]
  virtualWindow: unknown
  start: () => Promise<void>
  stop: () => void
}

interface DataGridRuntimeHostSlotProps {
  runtime: LowLevelGridExpose["runtime"]
  rowModel: LowLevelGridExpose["rowModel"]
  defaultRendererProps?: Record<string, unknown>
  [key: string]: unknown
}

type DataGridDefaultRendererRuntime = Pick<
  DataGridBodyAwareRuntime,
  "api" | "syncBodyRowsInRange" | "getBodyRowAtIndex" | "resolveBodyRowIndexById" | "rowPartition" | "virtualWindow" | "columnSnapshot"
>

export default defineComponent({
  name: "DataGrid",
  inheritAttrs: false,
  props: {
    rows: {
      type: Array as PropType<readonly unknown[]>,
      default: () => [],
    },
    rowModel: {
      type: Object as PropType<DataGridRowModel<unknown> | undefined>,
      default: undefined,
    },
    clientRowModelOptions: {
      type: Object as PropType<DataGridAppClientRowModelOptions<unknown> | undefined>,
      default: undefined,
    },
    computedFields: {
      type: Array as PropType<readonly DataGridComputedFieldDefinition<unknown>[] | null | undefined>,
      default: undefined,
    },
    formulas: {
      type: Array as PropType<readonly DataGridFormulaFieldDefinition[] | null | undefined>,
      default: undefined,
    },
    formulaFunctions: {
      type: Object as PropType<DataGridFormulaFunctionRegistry | null | undefined>,
      default: undefined,
    },
    columns: {
      type: Array as PropType<readonly DataGridAppColumnInput[]>,
      default: () => [],
    },
    theme: {
      type: [String, Object] as PropType<DataGridThemeProp>,
      default: undefined,
    },
    aggregationModel: {
      type: Object as PropType<DataGridAggregationModel<Record<string, unknown>> | null | undefined>,
      default: undefined,
    },
    renderMode: {
      type: String as PropType<"virtualization" | "pagination" | undefined>,
      default: undefined,
    },
    virtualization: {
      type: [Boolean, Object] as PropType<DataGridVirtualizationProp | undefined>,
      default: undefined,
    },
    pagination: {
      type: [Boolean, Object] as PropType<DataGridPaginationProp | undefined>,
      default: undefined,
    },
    columnMenu: {
      type: [Boolean, Object] as PropType<DataGridColumnMenuProp | undefined>,
      default: undefined,
    },
    cellMenu: {
      type: [Boolean, Object] as PropType<DataGridCellMenuProp | undefined>,
      default: undefined,
    },
    rowIndexMenu: {
      type: [Boolean, Object] as PropType<DataGridRowIndexMenuProp | undefined>,
      default: undefined,
    },
    columnLayout: {
      type: [Boolean, Object] as PropType<DataGridColumnLayoutProp | undefined>,
      default: undefined,
    },
    aggregations: {
      type: [Boolean, Object] as PropType<DataGridAggregationsProp | undefined>,
      default: undefined,
    },
    advancedFilter: {
      type: [Boolean, Object] as PropType<DataGridAdvancedFilterProp | undefined>,
      default: undefined,
    },
    showRowIndex: {
      type: Boolean,
      default: true,
    },
    rowSelection: {
      type: Boolean,
      default: true,
    },
    pageSize: {
      type: Number as PropType<number | undefined>,
      default: undefined,
    },
    currentPage: {
      type: Number as PropType<number | undefined>,
      default: undefined,
    },
    plugins: {
      type: Array as PropType<readonly DataGridApiPluginDefinition<unknown>[]>,
      default: () => [],
    },
    services: {
      type: Object as PropType<DataGridRuntimeOverrides | undefined>,
      default: undefined,
    },
    startupOrder: {
      type: Array as PropType<CreateDataGridCoreOptions["startupOrder"] | undefined>,
      default: undefined,
    },
    autoStart: {
      type: Boolean,
      default: true,
    },
    sortModel: {
      type: Array as PropType<readonly DataGridSortState[] | undefined>,
      default: undefined,
    },
    filterModel: {
      type: Object as PropType<DataGridFilterSnapshot | null | undefined>,
      default: undefined,
    },
    groupBy: {
      type: [String, Array, Object] as PropType<DataGridGroupByProp | undefined>,
      default: undefined,
    },
    pivotModel: {
      type: Object as PropType<DataGridPivotSpec | null | undefined>,
      default: undefined,
    },
    columnState: {
      type: Object as PropType<DataGridUnifiedColumnState | null | undefined>,
      default: undefined,
    },
    columnOrder: {
      type: Array as PropType<readonly string[] | null | undefined>,
      default: undefined,
    },
    hiddenColumnKeys: {
      type: Array as PropType<readonly string[] | null | undefined>,
      default: undefined,
    },
    columnWidths: {
      type: Object as PropType<Readonly<Record<string, number | null>> | null | undefined>,
      default: undefined,
    },
    columnPins: {
      type: Object as PropType<Readonly<Record<string, DataGridColumnPin>> | null | undefined>,
      default: undefined,
    },
    state: {
      type: Object as PropType<DataGridUnifiedState<Record<string, unknown>> | null | undefined>,
      default: undefined,
    },
    stateOptions: {
      type: Object as PropType<DataGridSetStateOptions | null | undefined>,
      default: undefined,
    },
    rowHeightMode: {
      type: String as PropType<"fixed" | "auto">,
      default: "fixed",
    },
    baseRowHeight: {
      type: Number,
      default: 31,
    },
    rowHover: {
      type: Boolean,
      default: false,
    },
    stripedRows: {
      type: Boolean,
      default: false,
    },
    isCellEditable: {
      type: Function as PropType<DataGridCellEditablePredicate<Record<string, unknown>> | undefined>,
      default: undefined,
    },
    viewMode: {
      type: String as PropType<DataGridAppViewMode | undefined>,
      default: undefined,
    },
    gantt: {
      type: [Boolean, Object] as PropType<DataGridGanttProp | undefined>,
      default: undefined,
    },
  },
  emits: [
    "cell-change",
    "selection-change",
    "row-select",
    "update:columnState",
    "update:columnOrder",
    "update:hiddenColumnKeys",
    "update:columnWidths",
    "update:columnPins",
    "update:groupBy",
    "update:viewMode",
    "update:state",
    "ready",
  ],
  setup(props, { attrs, slots, emit, expose }) {
    const dataGridRef = ref<LowLevelGridExpose | null>(null)
    const currentViewMode = ref<DataGridAppViewMode>("table")
    const resolvedRenderMode = computed(() => {
      return resolveDataGridRenderMode(props.renderMode, props.pagination)
    })
    const resolvedPagination = computed(() => {
      return resolveDataGridPagination(
        props.pagination,
        resolvedRenderMode.value,
        props.pageSize,
        props.currentPage,
      )
    })
    const resolvedColumnMenu = computed<DataGridColumnMenuOptions>(() => {
      return resolveDataGridColumnMenu(props.columnMenu)
    })
    const resolvedCellMenu = computed<DataGridCellMenuOptions>(() => {
      return resolveDataGridCellMenu(props.cellMenu)
    })
    const resolvedRowIndexMenu = computed<DataGridRowIndexMenuOptions>(() => {
      return resolveDataGridRowIndexMenu(props.rowIndexMenu)
    })
    const resolvedColumnLayout = computed<DataGridColumnLayoutOptions>(() => {
      return resolveDataGridColumnLayout(props.columnLayout)
    })
    const resolvedAggregations = computed<DataGridAggregationsOptions>(() => {
      return resolveDataGridAggregations(props.aggregations)
    })
    const resolvedAdvancedFilter = computed<DataGridAdvancedFilterOptions>(() => {
      return resolveDataGridAdvancedFilter(props.advancedFilter)
    })
    const resolvedGroupBy = computed(() => {
      return resolveDataGridGroupBy(props.groupBy)
    })
    const resolvedVirtualization = computed(() => {
      return resolveDataGridVirtualization(props.virtualization, resolvedRenderMode.value)
    })
    const resolvedClientRowModelOptions = computed(() => {
      return resolveDataGridFormulaRowModelOptions({
        columns: props.columns,
        clientRowModelOptions: props.clientRowModelOptions,
        computedFields: props.computedFields,
        formulas: props.formulas,
        formulaFunctions: props.formulaFunctions,
      })
    })
    const resolvedColumns = computed(() => resolveDataGridColumns(props.columns))
    const controlledProps: UseDataGridAppControlledStateOptions["props"] = {
      get state() {
        return props.state
      },
      get stateOptions() {
        return props.stateOptions
      },
      get columnState() {
        return props.columnState
      },
      get columnOrder() {
        return props.columnOrder
      },
      get hiddenColumnKeys() {
        return props.hiddenColumnKeys
      },
      get columnWidths() {
        return props.columnWidths
      },
      get columnPins() {
        return props.columnPins
      },
      get sortModel() {
        return props.sortModel
      },
      get filterModel() {
        return props.filterModel
      },
      get groupBy() {
        return resolvedGroupBy.value
      },
      get aggregationModel() {
        return props.aggregationModel
      },
      get pivotModel() {
        return props.pivotModel
      },
      get rowHeightMode() {
        return props.rowHeightMode
      },
      get baseRowHeight() {
        return props.baseRowHeight
      },
      get columns() {
        return props.columns
      },
    }
    const inferredMode = computed<"base" | "tree" | "pivot">(() => {
      if (props.pivotModel) {
        return "pivot"
      }
      if (resolvedClientRowModelOptions.value && "initialTreeData" in resolvedClientRowModelOptions.value) {
        return "tree"
      }
      return "base"
    })
    const visibleColumns = computed(() => dataGridRef.value?.api.columns.getSnapshot().visibleColumns ?? [])
    const totalRows = computed(() => dataGridRef.value?.api.rows.getCount() ?? 0)
    const selectionOptions = {
      mode: computed(() => inferredMode.value),
      resolveRuntime: () => dataGridRef.value,
      visibleColumns,
      totalRows,
      showRowSelection: computed(() => props.rowSelection),
    } as Parameters<typeof useDataGridAppSelection<unknown>>[0]

    const {
      selectionSnapshot,
      selectionAnchor,
      syncSelectionSnapshotFromRuntime,
      selectionService,
      selectionAggregatesLabel,
    } = useDataGridAppSelection<unknown>(selectionOptions)
    const {
      rowSelectionSnapshot,
      syncRowSelectionSnapshotFromRuntime,
      reconcileRowSelectionFromRuntime,
      selectionService: rowSelectionService,
    } = useDataGridAppRowSelection<unknown>({
      resolveRuntime: () => dataGridRef.value,
    })
    const resolvedRowSelectionService = computed<DataGridSelectionService>(() => {
      return props.rowSelection ? rowSelectionService : createDisabledRowSelectionService()
    })
    const resolvedServices = computed<DataGridRuntimeOverrides>(() => ({
      ...(props.services ?? {}),
      selection: composeSelectionService({
        userSelectionService: props.services?.selection,
        cellSelectionService: selectionService,
        rowSelectionService: resolvedRowSelectionService.value,
      }),
    }))
    const {
      dataGridInstanceKey,
      resolvedRowModel,
    } = useDataGridAppRowModel({
      rows: toRef(props, "rows"),
      rowModel: toRef(props, "rowModel"),
      clientRowModelOptions: resolvedClientRowModelOptions,
      onOwnedRowModelRecreated: () => {
        controlledState.dispose()
      },
    })

    const controlledState = useDataGridAppControlledState({
      gridRef: dataGridRef,
      props: controlledProps,
      emit: {
        columnState: payload => emit("update:columnState", payload),
        columnOrder: payload => emit("update:columnOrder", payload),
        hiddenColumnKeys: payload => emit("update:hiddenColumnKeys", payload),
        columnWidths: payload => emit("update:columnWidths", payload),
        columnPins: payload => emit("update:columnPins", payload),
        groupBy: payload => emit("update:groupBy", payload as DataGridGroupBySpec | null),
        state: payload => emit("update:state", payload),
        ready: payload => emit("ready", {
          api: payload.api,
          rowModel: resolvedRowModel.value,
        }),
      },
    })

    const handleCellChange = (payload: unknown): void => {
      reconcileRowSelectionFromRuntime()
      emit("cell-change", payload)
      controlledState.emitSnapshotUpdates()
    }

    const handleSelectionChange = (payload: unknown): void => {
      emit("selection-change", payload)
    }

    watch(
      rowSelectionSnapshot,
      (snapshot: DataGridRowSelectionSnapshot | null) => {
        emit("row-select", snapshot)
      },
      { deep: true },
    )

    watch(
      () => props.rowSelection,
      enabled => {
        if (enabled) {
          syncRowSelectionSnapshotFromRuntime()
          return
        }
        rowSelectionService.clearRowSelection?.()
      },
      { immediate: true },
    )

    watch(
      () => props.viewMode,
      nextViewMode => {
        currentViewMode.value = nextViewMode === "gantt" ? "gantt" : "table"
      },
      { immediate: true },
    )

    const setView = (nextViewMode: DataGridAppViewMode): void => {
      const normalized = nextViewMode === "gantt" ? "gantt" : "table"
      currentViewMode.value = normalized
      emit("update:viewMode", normalized)
    }

    const getSavedView = (): DataGridSavedViewSnapshot<Record<string, unknown>> | null => {
      const state = controlledState.getState()
      if (!state) {
        return null
      }
      return {
        state,
        viewMode: currentViewMode.value,
      }
    }

    const migrateSavedView = (
      savedView: unknown,
      options?: DataGridMigrateStateOptions,
    ): DataGridSavedViewSnapshot<Record<string, unknown>> | null => {
      return migrateDataGridSavedView(savedView, controlledState.migrateState, options)
    }

    const applySavedView = (
      savedView: DataGridSavedViewSnapshot<Record<string, unknown>>,
      options?: DataGridSetStateOptions,
    ): boolean => {
      const applied = controlledState.applyState(savedView.state, options)
      if (!applied) {
        return false
      }
      if (savedView.viewMode) {
        setView(savedView.viewMode)
      }
      return true
    }

    onBeforeUnmount(() => {
      controlledState.dispose()
    })

    expose({
      grid: dataGridRef,
      rowModel: resolvedRowModel,
      getApi: () => dataGridRef.value?.api ?? null,
      getRuntime: () => dataGridRef.value?.runtime ?? null,
      getCore: () => dataGridRef.value?.core ?? null,
      getColumnState: () => controlledState.getColumnState(),
      getColumnSnapshot: () => dataGridRef.value?.api.columns.getSnapshot() ?? null,
      getSelectionAggregatesLabel: () => selectionAggregatesLabel.value,
      getSelectionSummary: () => dataGridRef.value?.api.selection.summarize() ?? null,
      getView: () => currentViewMode.value,
      setView,
      getSavedView,
      migrateSavedView,
      applySavedView,
      applyColumnState: controlledState.applyColumnState,
      getState: controlledState.getState,
      migrateState: controlledState.migrateState,
      applyState: controlledState.applyState,
      exportPivotLayout: controlledState.exportPivotLayout,
      exportPivotInterop: controlledState.exportPivotInterop,
      importPivotLayout: controlledState.importPivotLayout,
      expandAllGroups: controlledState.expandAllGroups,
      collapseAllGroups: controlledState.collapseAllGroups,
      insertRowsAt: (index: number, rows: readonly DataGridRowNodeInput<Record<string, unknown>>[]) =>
        dataGridRef.value?.api.rows.insertDataAt(index, rows) ?? false,
      insertRowBefore: (rowId: string | number, rows: readonly DataGridRowNodeInput<Record<string, unknown>>[]) =>
        dataGridRef.value?.api.rows.insertDataBefore(rowId, rows) ?? false,
      insertRowAfter: (rowId: string | number, rows: readonly DataGridRowNodeInput<Record<string, unknown>>[]) =>
        dataGridRef.value?.api.rows.insertDataAfter(rowId, rows) ?? false,
      insertColumnsAt: (index: number, columns: readonly DataGridAppColumnInput[]) =>
        dataGridRef.value?.api.columns.insertAt(index, columns) ?? false,
      insertColumnBefore: (columnKey: string, columns: readonly DataGridAppColumnInput[]) =>
        dataGridRef.value?.api.columns.insertBefore(columnKey, columns) ?? false,
      insertColumnAfter: (columnKey: string, columns: readonly DataGridAppColumnInput[]) =>
        dataGridRef.value?.api.columns.insertAfter(columnKey, columns) ?? false,
    })

    return (): VNode => {
      const defaultRendererProps = {
        mode: inferredMode.value,
        rows: props.rows as readonly Record<string, unknown>[],
        runtime: dataGridRef.value?.runtime ?? null,
        runtimeRowModel: dataGridRef.value?.rowModel ?? null,
        selectionSnapshot,
        selectionAnchor,
        rowSelectionSnapshot,
        syncSelectionSnapshotFromRuntime,
        syncRowSelectionSnapshotFromRuntime,
        sortModel: props.sortModel,
        filterModel: props.filterModel,
        groupBy: resolvedGroupBy.value,
        pivotModel: props.pivotModel,
        renderMode: resolvedRenderMode.value,
        virtualization: resolvedVirtualization.value,
        columnMenu: resolvedColumnMenu.value,
        cellMenu: resolvedCellMenu.value,
        rowIndexMenu: resolvedRowIndexMenu.value,
        columnLayout: resolvedColumnLayout.value,
        aggregations: resolvedAggregations.value,
        advancedFilter: resolvedAdvancedFilter.value,
        rowHeightMode: props.rowHeightMode,
        baseRowHeight: props.baseRowHeight,
        rowHover: props.rowHover,
        stripedRows: props.stripedRows,
        isCellEditable: props.isCellEditable,
        showRowIndex: props.showRowIndex,
        rowSelection: props.rowSelection,
        viewMode: currentViewMode.value,
        gantt: props.gantt,
      }
      return h(
        DataGridRuntimeHost,
        {
          ...attrs,
          ref: dataGridRef,
          key: dataGridInstanceKey.value,
          rows: props.rows,
          rowModel: resolvedRowModel.value,
          columns: resolvedColumns.value,
          theme: props.theme,
          renderMode: resolvedRenderMode.value,
          pagination: resolvedPagination.value,
          plugins: props.plugins,
          services: resolvedServices.value,
          startupOrder: props.startupOrder,
          autoStart: props.autoStart,
          onCellChange: handleCellChange,
          onSelectionChange: handleSelectionChange,
        },
        slots.default
          ? {
              default: (slotProps: DataGridRuntimeHostSlotProps) => slots.default?.({
                ...slotProps,
                defaultRendererProps: {
                  ...defaultRendererProps,
                  runtime: slotProps.runtime as DataGridDefaultRendererRuntime,
                  runtimeRowModel: slotProps.rowModel as Pick<DataGridRowModel<Record<string, unknown>>, "subscribe" | "getSnapshot">,
                },
              }),
            }
          : {
              default: (slotProps: DataGridRuntimeHostSlotProps) => h(DataGridDefaultRenderer, {
                ...defaultRendererProps,
                runtime: slotProps.runtime as DataGridDefaultRendererRuntime,
                runtimeRowModel: slotProps.rowModel as Pick<DataGridRowModel<Record<string, unknown>>, "subscribe" | "getSnapshot">,
              }),
            },
      )
    }
  },
})
