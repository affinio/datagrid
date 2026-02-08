import type {
  DataGridEventMap,
  DataGridPluginCapabilityMap,
  DataGridPluginDefinition,
} from "../../plugins"
import type { DataGridEventHandlers } from "../types"
import {
  DATAGRID_HOST_EVENT_NAME_MAP,
  createDataGridRuntime,
  type DataGridHostEventMap,
  type DataGridHostEventName,
  type DataGridRuntime,
  type DataGridRuntimeInternalEventMap,
  type DataGridRuntimeInternalEventName,
  type DataGridRuntimePluginEventMap,
} from "../runtime/dataGridRuntime.js"

export type DataGridAdapterKind = "vue" | "react" | "laravel" | "web-component"
export type DataGridKebabHostEventName =
  (typeof DATAGRID_HOST_EVENT_NAME_MAP)[keyof typeof DATAGRID_HOST_EVENT_NAME_MAP]

export interface DataGridAdapterEventNameByKind {
  vue: DataGridKebabHostEventName
  react: DataGridHostEventName
  laravel: DataGridKebabHostEventName
  "web-component": DataGridKebabHostEventName
}

export interface DataGridAdapterRuntimePluginContext {
  getTableId: () => string
  getRootElement: () => HTMLElement | null
  getCapabilityMap: () => DataGridPluginCapabilityMap
}

export interface DataGridAdapterDispatchPayload<TAdapterEvent extends string = string> {
  hostEvent: DataGridHostEventName
  adapterEvent: TAdapterEvent
  args: readonly unknown[]
}

export interface CreateDataGridAdapterRuntimeOptions<
  TKind extends DataGridAdapterKind = DataGridAdapterKind,
  TPluginEvents extends DataGridEventMap = Record<never, never>,
  TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>,
> {
  kind: TKind
  emitAdapterEvent: (payload: DataGridAdapterDispatchPayload<DataGridAdapterEventNameByKind[TKind]>) => void
  mapHostEventName?: (hostEvent: DataGridHostEventName) => DataGridAdapterEventNameByKind[TKind]
  onInternalEvent?: <K extends DataGridRuntimeInternalEventName>(
    event: K,
    args: DataGridRuntimeInternalEventMap[K],
  ) => void
  onUnknownPluginEvent?: (event: string, args: readonly unknown[]) => void
  pluginContext: {
    getTableId: () => string
    getRootElement: () => HTMLElement | null
    getCapabilityMap: () => TPluginCapabilities
  }
  initialHandlers?: DataGridEventHandlers | undefined
  initialPlugins?: DataGridPluginDefinition<
    DataGridHostEventMap,
    DataGridRuntimePluginEventMap<TPluginEvents>,
    TPluginCapabilities
  >[] | undefined
}

export interface DataGridAdapterRuntime<
  TKind extends DataGridAdapterKind = DataGridAdapterKind,
  TPluginEvents extends DataGridEventMap = Record<never, never>,
  TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>,
> extends DataGridRuntime<TPluginEvents, TPluginCapabilities> {
  readonly kind: TKind
  readonly mapHostEventName: (hostEvent: DataGridHostEventName) => DataGridAdapterEventNameByKind[TKind]
}

export function resolveDataGridAdapterEventName<TKind extends DataGridAdapterKind>(
  kind: TKind,
  hostEvent: DataGridHostEventName,
): DataGridAdapterEventNameByKind[TKind] {
  if (kind === "react") {
    return hostEvent as DataGridAdapterEventNameByKind[TKind]
  }
  return DATAGRID_HOST_EVENT_NAME_MAP[hostEvent] as DataGridAdapterEventNameByKind[TKind]
}

export function createDataGridAdapterRuntime<
  TKind extends DataGridAdapterKind,
  TPluginEvents extends DataGridEventMap = Record<never, never>,
  TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>,
>(
  options: CreateDataGridAdapterRuntimeOptions<TKind, TPluginEvents, TPluginCapabilities>,
): DataGridAdapterRuntime<TKind, TPluginEvents, TPluginCapabilities> {
  const mapHostEventName =
    options.mapHostEventName ?? ((name: DataGridHostEventName) => resolveDataGridAdapterEventName(options.kind, name))

  const runtime = createDataGridRuntime<TPluginEvents, TPluginCapabilities>({
    onHostEvent: (hostEvent, args) => {
      options.emitAdapterEvent({
        hostEvent,
        adapterEvent: mapHostEventName(hostEvent),
        args,
      })
    },
    onInternalEvent: options.onInternalEvent,
    onUnknownPluginEvent: options.onUnknownPluginEvent,
    pluginContext: options.pluginContext,
    initialHandlers: options.initialHandlers,
    initialPlugins: options.initialPlugins,
  })

  return Object.assign(runtime, {
    kind: options.kind,
    mapHostEventName,
  })
}
