import { computed, defineComponent, h, type PropType } from "vue"
import type {
  CreateDataGridCoreOptions,
  DataGridColumnDef,
  DataGridCoreServiceRegistry,
} from "@affino/datagrid-core"
import { useDataGridRuntime } from "../composables/useDataGridRuntime"

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

export const DataGrid = defineComponent({
  name: "AffinoDataGrid",
  inheritAttrs: false,
  props: {
    rows: {
      type: Array as PropType<readonly unknown[]>,
      default: () => [],
    },
    columns: {
      type: Array as PropType<readonly DataGridColumnDef[]>,
      required: true,
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
  },
  setup(props, { attrs, slots, expose }) {
    const rowsRef = computed<readonly unknown[]>(() => props.rows ?? [])
    const columnsRef = computed<readonly DataGridColumnDef[]>(() => props.columns ?? [])

    const runtime = useDataGridRuntime({
      rows: rowsRef,
      columns: columnsRef,
      services: props.services,
      startupOrder: props.startupOrder,
      autoStart: props.autoStart,
    })

    expose({
      api: runtime.api,
      core: runtime.core,
      rowModel: runtime.rowModel,
      columnModel: runtime.columnModel,
      columnSnapshot: runtime.columnSnapshot,
      setRows: runtime.setRows,
      syncRowsInRange: runtime.syncRowsInRange,
      start: runtime.start,
      stop: runtime.stop,
    })

    return () => h(
      "section",
      {
        ...attrs,
        class: ["affino-datagrid", attrs.class],
        "data-affino-datagrid": "bridge",
      },
      slots.default
        ? slots.default({
            api: runtime.api,
            core: runtime.core,
            rowModel: runtime.rowModel,
            columnModel: runtime.columnModel,
            columnSnapshot: runtime.columnSnapshot.value,
            setRows: runtime.setRows,
            syncRowsInRange: runtime.syncRowsInRange,
          })
        : [],
    )
  },
})

export default DataGrid
