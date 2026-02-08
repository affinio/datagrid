import { onBeforeUnmount, shallowRef, watch, type ComputedRef, type Ref } from "vue"
import {
  createDataGridAdapterRuntime,
  type DataGridAdapterRuntime,
  type DataGridHostEventArgs,
  type DataGridHostEventName,
  type DataGridKebabHostEventName,
  type DataGridRuntimeInternalEventMap,
} from "@affino/datagrid-core/advanced"
import type { NormalizedTableProps } from "@affino/datagrid-core/config/tableConfig"
import type { UiTableExposeBindings } from "../context"

type HostEventEmitName = DataGridKebabHostEventName

interface UseTableRuntimeOptions {
  normalizedProps: ComputedRef<NormalizedTableProps>
  emit: (event: HostEventEmitName, ...args: any[]) => void
  tableId: ComputedRef<string>
  tableRootRef: Ref<HTMLElement | null>
}

interface UseTableRuntimeResult {
  fireEvent: <K extends DataGridHostEventName>(name: K, ...args: DataGridHostEventArgs<K>) => void
  setTableExpose: (expose: UiTableExposeBindings) => void
}

type VuePluginCapabilityMap = {
  "table:get-selected-rows": () => unknown
  "table:select-all-rows": (...args: any[]) => unknown
  "table:clear-row-selection": (...args: any[]) => unknown
  "table:toggle-row-selection": (...args: any[]) => unknown
  "table:get-filter-state": (...args: any[]) => unknown
  "table:set-filter-state": (...args: any[]) => unknown
  "table:reset-all-filters": (...args: any[]) => unknown
}

export function useTableRuntime(options: UseTableRuntimeOptions): UseTableRuntimeResult {
  const tableExposeRef = shallowRef<UiTableExposeBindings | null>(null)
  const getCapabilityMap = (): VuePluginCapabilityMap => {
    return {
      "table:get-selected-rows": () => tableExposeRef.value?.getSelectedRows?.(),
      "table:select-all-rows": (...args: any[]) => tableExposeRef.value?.selectAllRows?.(...args),
      "table:clear-row-selection": (...args: any[]) => tableExposeRef.value?.clearRowSelection?.(...args),
      "table:toggle-row-selection": (...args: any[]) => tableExposeRef.value?.toggleRowSelection?.(...args),
      "table:get-filter-state": (...args: any[]) => tableExposeRef.value?.getFilterStateSnapshot?.(...args),
      "table:set-filter-state": (...args: any[]) => tableExposeRef.value?.setFilterStateSnapshot?.(...args),
      "table:reset-all-filters": (...args: any[]) => tableExposeRef.value?.resetAllFilters?.(...args),
    }
  }
  const runtime = shallowRef<DataGridAdapterRuntime<"vue", Record<never, never>, VuePluginCapabilityMap> | null>(
    createDataGridAdapterRuntime({
      kind: "vue",
      emitAdapterEvent: payload => {
        options.emit(payload.adapterEvent, ...payload.args)
      },
      onInternalEvent: (event, args) => {
        if (event !== "plugin:host-unknown") {
          return
        }
        const payload = args[0] as DataGridRuntimeInternalEventMap["plugin:host-unknown"][0]
        if (typeof console !== "undefined" && console.warn) {
          console.warn(`[UiTable] Plugin attempted to emit unknown host event "${payload.event}"`, payload.args)
        }
      },
      pluginContext: {
        getTableId: () => options.tableId.value,
        getRootElement: () =>
          ((options.tableRootRef.value?.closest?.(".ui-table-theme-root") as HTMLElement | null) ??
            options.tableRootRef.value),
        getCapabilityMap,
      },
      initialHandlers: options.normalizedProps.value.events,
      initialPlugins: options.normalizedProps.value.plugins,
    })
  )

  const fireEvent = <K extends DataGridHostEventName>(name: K, ...args: DataGridHostEventArgs<K>) => {
    runtime.value?.emit(name, ...args)
  }

  watch(
    () => options.normalizedProps.value.events,
    handlers => {
      runtime.value?.setHostHandlers(handlers)
    },
    { deep: true }
  )

  watch(
    () => options.normalizedProps.value.plugins,
    plugins => {
      runtime.value?.setPlugins(plugins)
    },
    { deep: true }
  )

  onBeforeUnmount(() => {
    runtime.value?.dispose()
    runtime.value = null
    tableExposeRef.value = null
  })

  const setTableExpose = (expose: UiTableExposeBindings) => {
    tableExposeRef.value = expose
  }

  return {
    fireEvent,
    setTableExpose,
  }
}
