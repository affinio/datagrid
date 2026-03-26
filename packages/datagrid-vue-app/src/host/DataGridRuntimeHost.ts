import {
  computed,
  defineComponent,
  h,
  mergeProps,
  onBeforeUnmount,
  provide,
  ref,
  watch,
  type PropType,
  type VNode,
} from "vue"
import type {
  CreateDataGridCoreOptions,
  DataGridApiPluginDefinition,
  DataGridColumnInput,
  DataGridCoreServiceRegistry,
  DataGridPaginationInput,
  DataGridRowSelectionSnapshot,
  DataGridRowModel,
  DataGridRowNode,
  DataGridRowModelSnapshot,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-vue"
import { useDataGridRuntime } from "@affino/datagrid-vue"
import {
  applyDataGridTheme,
  type DataGridThemeProp,
} from "../theme/dataGridTheme"
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import type { DataGridLayoutMode } from "../config/dataGridLayout"

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

interface DataGridRowsChangedEvent {
  snapshot: DataGridRowModelSnapshot<unknown>
}

interface DataGridSelectionChangedEvent {
  snapshot: DataGridSelectionSnapshot | null
}

interface DataGridRowSelectionChangedEvent {
  snapshot: DataGridRowSelectionSnapshot | null
}

export default defineComponent({
  name: "DataGridRuntimeHost",
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
    columns: {
      type: Array as PropType<readonly DataGridColumnInput[]>,
      default: () => [],
    },
    theme: {
      type: [String, Object] as PropType<DataGridThemeProp>,
      default: undefined,
    },
    layoutMode: {
      type: String as PropType<DataGridLayoutMode>,
      default: "fill",
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
    renderMode: {
      type: String as PropType<"virtualization" | "pagination">,
      default: "virtualization",
    },
    pagination: {
      type: Object as PropType<DataGridPaginationInput | null>,
      default: null,
    },
  },
  emits: {
    "cell-change": (_payload: DataGridRowsChangedEvent) => true,
    "selection-change": (_payload: DataGridSelectionChangedEvent) => true,
    "row-selection-change": (_payload: DataGridRowSelectionChangedEvent) => true,
  },
  setup(props, { attrs, slots, emit, expose }) {
    const rootElementRef = ref<HTMLElement | null>(null)
    provide(dataGridAppRootElementKey, rootElementRef)
    let themeObserver: MutationObserver | null = null
    const runtime = useDataGridRuntime({
      rows: computed(() => props.rows),
      rowModel: props.rowModel,
      columns: computed(() => props.columns),
      plugins: props.plugins,
      services: props.services,
      startupOrder: props.startupOrder,
      autoStart: props.autoStart,
    })
    const bodyRuntime = runtime as typeof runtime & {
      getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<unknown> | null
      resolveBodyRowIndexById: (rowId: string | number) => number
      setVirtualWindowRange?: (range: { start: number; end: number }) => void
    }
    const publicRuntime = {
      api: runtime.api,
      syncBodyRowsInRange: runtime.syncBodyRowsInRange,
      setViewportRange: runtime.setViewportRange,
      setVirtualWindowRange: runtime.setVirtualWindowRange,
      rowPartition: runtime.rowPartition,
      virtualWindow: runtime.virtualWindow,
      columnSnapshot: runtime.columnSnapshot,
      getBodyRowAtIndex: bodyRuntime.getBodyRowAtIndex,
      resolveBodyRowIndexById: bodyRuntime.resolveBodyRowIndexById,
    }

    const syncPaginationState = (): void => {
      if (props.renderMode === "pagination") {
        const pagination = props.pagination ?? { pageSize: 100, currentPage: 0 }
        runtime.api.rows.setPagination({
          pageSize: Math.max(1, Math.trunc(pagination.pageSize)),
          currentPage: Math.max(0, Math.trunc(pagination.currentPage)),
        })
        return
      }
      runtime.api.rows.setPagination(null)
    }

    watch(
      () => props.renderMode,
      () => {
        syncPaginationState()
      },
      { immediate: true },
    )

    watch(
      () => props.pagination,
      () => {
        syncPaginationState()
      },
      { immediate: true, deep: true },
    )

    if (typeof document !== "undefined") {
      themeObserver = new MutationObserver(() => {
        const rootElement = rootElementRef.value
        if (!rootElement) {
          return
        }
        applyDataGridTheme(rootElement, props.theme)
      })
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      })
    }

    watch(
      [() => props.theme, rootElementRef],
      () => {
        const rootElement = rootElementRef.value
        if (!rootElement) {
          return
        }
        applyDataGridTheme(rootElement, props.theme)
      },
      { immediate: true, deep: true },
    )

    const unsubscribeRowsChanged = runtime.api.events.on("rows:changed", payload => {
      emit("cell-change", payload as DataGridRowsChangedEvent)
    })
    const unsubscribeSelectionChanged = runtime.api.events.on("selection:changed", payload => {
      emit("selection-change", payload as DataGridSelectionChangedEvent)
    })
    const unsubscribeRowSelectionChanged = runtime.api.events.on("row-selection:changed", payload => {
      emit("row-selection-change", payload as DataGridRowSelectionChangedEvent)
    })

    onBeforeUnmount(() => {
      unsubscribeRowsChanged()
      unsubscribeSelectionChanged()
      unsubscribeRowSelectionChanged()
      themeObserver?.disconnect()
      themeObserver = null
    })

    const slotVirtualWindow = computed(() => {
      const window = runtime.virtualWindow.value
      return {
        ...(window ?? {}),
        rowTotal: window?.rowTotal ?? runtime.rowPartition.value.bodyRowCount,
        colTotal: runtime.columnSnapshot.value.visibleColumns.length,
      }
    })

    expose({
      api: runtime.api,
      core: runtime.core,
      runtime: publicRuntime,
      rowModel: runtime.rowModel,
      columnModel: runtime.columnModel,
      columnSnapshot: runtime.columnSnapshot,
      rowPartition: runtime.rowPartition,
      setRows: runtime.setRows,
      syncBodyRowsInRange: runtime.syncBodyRowsInRange,
      getBodyRowAtIndex: bodyRuntime.getBodyRowAtIndex,
      resolveBodyRowIndexById: bodyRuntime.resolveBodyRowIndexById,
      virtualWindow: runtime.virtualWindow,
      start: runtime.start,
      stop: runtime.stop,
    })

    return (): VNode => h(
      "div",
      mergeProps(attrs, {
        ref: rootElementRef,
        class: [
          "affino-datagrid-app-root",
          props.layoutMode === "auto-height"
            ? "affino-datagrid-app-root--auto-height"
            : "affino-datagrid-app-root--fill",
        ],
        style: {
          display: "flex",
          width: "100%",
          minHeight: "0",
          minWidth: "0",
        },
      }),
      slots.default?.({
        api: runtime.api,
        core: runtime.core,
        runtime: publicRuntime,
        grid: publicRuntime,
        rowModel: runtime.rowModel,
        columnModel: runtime.columnModel,
        columnSnapshot: runtime.columnSnapshot.value,
        rowPartition: runtime.rowPartition.value,
        setRows: runtime.setRows,
        syncBodyRowsInRange: runtime.syncBodyRowsInRange,
        getBodyRowAtIndex: bodyRuntime.getBodyRowAtIndex,
        resolveBodyRowIndexById: bodyRuntime.resolveBodyRowIndexById,
        virtualWindow: slotVirtualWindow.value,
      }) ?? [],
    )
  },
})
