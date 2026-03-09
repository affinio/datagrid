import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  toRef,
  type PropType,
  type VNode,
} from "vue"
import {
  type CreateClientRowModelOptions,
  type CreateDataGridCoreOptions,
  type DataGridApi,
  type DataGridApiPluginDefinition,
  type DataGridAggregationModel,
  type DataGridClientComputeMode,
  type DataGridColumnModel,
  type DataGridColumnPin,
  type DataGridComputedFieldDefinition,
  type DataGridCoreServiceRegistry,
  type DataGridFilterSnapshot,
  type DataGridFormulaFieldDefinition,
  type DataGridFormulaFunctionRegistry,
  type DataGridRowModel,
  type DataGridSetStateOptions,
  type DataGridSortState,
  type DataGridUnifiedColumnState,
  type DataGridUnifiedState,
  type UseDataGridRuntimeResult,
  useDataGridAppSelection,
} from "@affino/datagrid-vue"
import type {
  DataGridPivotSpec,
} from "@affino/datagrid-vue"
import DataGridDefaultRenderer from "./DataGridDefaultRenderer"
import {
  resolveDataGridColumns,
  resolveDataGridFormulaRowModelOptions,
  type DataGridAppColumnDef,
} from "./dataGridFormulaOptions"
import { type DataGridThemeProp } from "./dataGridTheme"
import {
  resolveDataGridGroupBy,
  resolveDataGridPagination,
  resolveDataGridRenderMode,
  type DataGridGroupByProp,
  type DataGridPaginationProp,
} from "./dataGridPublicProps"
import { type DataGridVirtualizationProp, resolveDataGridVirtualization } from "./dataGridVirtualization"
import DataGridRuntimeHost from "./DataGridRuntimeHost"
import {
  useDataGridAppControlledState,
  type UseDataGridAppControlledStateOptions,
} from "./useDataGridAppControlledState"
import { useDataGridAppRowModel } from "./useDataGridAppRowModel"

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

interface LowLevelGridExpose {
  api: DataGridApi<unknown>
  core: unknown
  runtime: unknown
  rowModel: DataGridRowModel<unknown>
  columnModel: DataGridColumnModel
  columnSnapshot: unknown
  setRows: (rows: readonly unknown[]) => void
  syncRowsInRange: (range: { start: number; end: number }) => readonly unknown[]
  virtualWindow: unknown
  start: () => Promise<void>
  stop: () => void
}

interface DataGridRuntimeHostSlotProps {
  runtime: LowLevelGridExpose["runtime"]
  rowModel: LowLevelGridExpose["rowModel"]
  [key: string]: unknown
}

type DataGridDefaultRendererRuntime = Pick<
  UseDataGridRuntimeResult<Record<string, unknown>>,
  "api" | "syncRowsInRange" | "virtualWindow" | "columnSnapshot"
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
      type: Object as PropType<Omit<CreateClientRowModelOptions<unknown>, "rows"> | undefined>,
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
    computeMode: {
      type: String as PropType<DataGridClientComputeMode | null | undefined>,
      default: undefined,
    },
    formulaColumnCacheMaxColumns: {
      type: Number as PropType<number | null | undefined>,
      default: undefined,
    },
    columns: {
      type: Array as PropType<readonly DataGridAppColumnDef[]>,
      default: () => [],
    },
    theme: {
      type: [String, Object] as PropType<DataGridThemeProp>,
      default: undefined,
    },
    aggregationModel: {
      type: Object as PropType<DataGridAggregationModel<unknown> | null | undefined>,
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
      type: Object as PropType<DataGridUnifiedState<unknown> | null | undefined>,
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
    "update:state",
    "ready",
  ],
  setup(props, { attrs, slots, emit, expose }) {
    const dataGridRef = ref<LowLevelGridExpose | null>(null)
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
        computeMode: props.computeMode,
        formulaColumnCacheMaxColumns: props.formulaColumnCacheMaxColumns,
      })
    })
    const resolvedColumns = computed(() => resolveDataGridColumns(props.columns))
    const controlledProps = new Proxy(props, {
      get(target, key, receiver) {
        if (key === "groupBy") {
          return resolvedGroupBy.value
        }
        return Reflect.get(target, key, receiver)
      },
    }) as UseDataGridAppControlledStateOptions["props"]
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
    const {
      runtimeServices,
      selectionAggregatesLabel,
    } = useDataGridAppSelection<unknown>({
      mode: computed(() => inferredMode.value),
      resolveRuntime: () => dataGridRef.value,
      visibleColumns,
      totalRows,
    })
    const resolvedServices = computed<DataGridRuntimeOverrides>(() => ({
      ...(props.services ?? {}),
      ...(runtimeServices as DataGridRuntimeOverrides),
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
        state: payload => emit("update:state", payload),
        ready: payload => emit("ready", {
          api: payload.api,
          rowModel: resolvedRowModel.value,
        }),
      },
    })

    const handleCellChange = (payload: unknown): void => {
      emit("cell-change", payload)
      controlledState.emitSnapshotUpdates()
    }

    const handleSelectionChange = (payload: unknown): void => {
      emit("selection-change", payload)
      controlledState.emitSnapshotUpdates()
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
      applyColumnState: controlledState.applyColumnState,
      getState: controlledState.getState,
      migrateState: controlledState.migrateState,
      applyState: controlledState.applyState,
      exportPivotLayout: controlledState.exportPivotLayout,
      exportPivotInterop: controlledState.exportPivotInterop,
      importPivotLayout: controlledState.importPivotLayout,
      expandAllGroups: controlledState.expandAllGroups,
      collapseAllGroups: controlledState.collapseAllGroups,
    })

    return (): VNode => {
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
              default: (slotProps: DataGridRuntimeHostSlotProps) => slots.default?.(slotProps),
            }
          : {
              default: (slotProps: DataGridRuntimeHostSlotProps) => h(DataGridDefaultRenderer, {
                mode: inferredMode.value,
                rows: props.rows as readonly Record<string, unknown>[],
                runtime: slotProps.runtime as DataGridDefaultRendererRuntime,
                runtimeRowModel: slotProps.rowModel as { subscribe: (listener: () => void) => () => void },
                sortModel: props.sortModel,
                filterModel: props.filterModel,
                groupBy: resolvedGroupBy.value,
                pivotModel: props.pivotModel,
                renderMode: resolvedRenderMode.value,
                virtualization: resolvedVirtualization.value,
                rowHeightMode: props.rowHeightMode,
                baseRowHeight: props.baseRowHeight,
              }),
            },
      )
    }
  },
})
