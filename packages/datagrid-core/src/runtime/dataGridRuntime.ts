import {
  DataGridPluginManager,
  type DataGridEventArgs as PluginEventArgs,
  type DataGridEventMap,
  type DataGridEventName,
  type DataGridPluginCapabilityMap,
  type DataGridPluginDefinition,
} from "@affino/datagrid-plugins"
import type { DataGridEventHandlers } from "../types"

export const HOST_EVENT_NAME_MAP = {
  reachBottom: "reach-bottom",
  rowClick: "row-click",
  cellEdit: "cell-edit",
  batchEdit: "batch-edit",
  selectionChange: "selection-change",
  sortChange: "sort-change",
  filterChange: "filter-change",
  filtersReset: "filters-reset",
  groupByChange: "group-by-change",
  groupExpansionChange: "group-expansion-change",
  zoomChange: "zoom-change",
  columnResize: "column-resize",
  groupFilterToggle: "group-filter-toggle",
  rowsDelete: "rows-delete",
  lazyLoad: "lazy-load",
  lazyLoadComplete: "lazy-load-complete",
  lazyLoadError: "lazy-load-error",
  autoResizeApplied: "auto-resize-applied",
  selectAllRequest: "select-all-request",
} as const

export type DataGridHostEventName = keyof typeof HOST_EVENT_NAME_MAP

export type DataGridHostEventArgs<K extends DataGridHostEventName> = NonNullable<
  DataGridEventHandlers[K]
> extends (...args: infer P) => any
  ? Readonly<P>
  : readonly []

export type DataGridHostEventMap = DataGridEventMap & {
  [K in DataGridHostEventName]: DataGridHostEventArgs<K>
}

export type DataGridRuntimeBasePluginEventMap = DataGridEventMap & {
  "runtime:initialized": readonly [{ tableId: string }]
  "runtime:disposing": readonly [{ tableId: string }]
}

export type DataGridRuntimePluginEventMap<
  TPluginEvents extends DataGridEventMap = Record<never, never>,
> = DataGridHostEventMap & DataGridRuntimeBasePluginEventMap & TPluginEvents

export interface DataGridRuntimeInternalEventMap {
  "lifecycle:init": readonly [{ tableId: string }]
  "lifecycle:dispose": readonly [{ tableId: string }]
  "host:dispatched": readonly [{ name: DataGridHostEventName; args: readonly unknown[] }]
  "plugin:host-unknown": readonly [{ event: string; args: readonly unknown[] }]
  "plugin:capability-denied": readonly [
    { pluginId: string; capability: string; reason: "not-declared" | "not-provided" },
  ]
}

export type DataGridRuntimeInternalEventName = keyof DataGridRuntimeInternalEventMap

export function isHostEventName(value: string): value is DataGridHostEventName {
  return value in HOST_EVENT_NAME_MAP
}

export interface DataGridRuntimeOptions<
  TPluginEvents extends DataGridEventMap = Record<never, never>,
  TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>,
> {
  onHostEvent: <K extends DataGridHostEventName>(name: K, args: DataGridHostEventMap[K]) => void
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

export interface DataGridRuntime<
  TPluginEvents extends DataGridEventMap = Record<never, never>,
  TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>,
> {
  emitHost<K extends DataGridHostEventName>(name: K, ...args: DataGridHostEventMap[K]): void
  emit<K extends DataGridHostEventName>(name: K, ...args: DataGridHostEventMap[K]): void
  emitPlugin<K extends DataGridEventName<DataGridRuntimePluginEventMap<TPluginEvents>>>(
    event: K,
    ...args: PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, K>
  ): void
  onPlugin<K extends DataGridEventName<DataGridRuntimePluginEventMap<TPluginEvents>>>(
    event: K,
    handler: (
      ...args: PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, K>
    ) => void,
  ): () => void
  setHostHandlers(handlers: DataGridEventHandlers | undefined): void
  setPlugins(
    plugins:
      | DataGridPluginDefinition<
          DataGridHostEventMap,
          DataGridRuntimePluginEventMap<TPluginEvents>,
          TPluginCapabilities
        >[]
      | undefined,
  ): void
  dispose(): void
}

class InternalDataGridRuntime<
  TPluginEvents extends DataGridEventMap = Record<never, never>,
  TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>,
> implements DataGridRuntime<TPluginEvents, TPluginCapabilities> {
  private handlers: DataGridEventHandlers
  private readonly onHostEvent: DataGridRuntimeOptions<TPluginEvents, TPluginCapabilities>["onHostEvent"]
  private readonly onInternalEvent?: DataGridRuntimeOptions<TPluginEvents, TPluginCapabilities>["onInternalEvent"]
  private readonly onUnknownPluginEvent?: (event: string, args: readonly unknown[]) => void
  private readonly pluginManager: DataGridPluginManager<
    DataGridHostEventMap,
    DataGridRuntimePluginEventMap<TPluginEvents>,
    TPluginCapabilities
  >
  private readonly getTableId: () => string

  constructor(options: DataGridRuntimeOptions<TPluginEvents, TPluginCapabilities>) {
    this.handlers = options.initialHandlers ?? {}
    this.onHostEvent = options.onHostEvent
    this.onInternalEvent = options.onInternalEvent
    this.onUnknownPluginEvent = options.onUnknownPluginEvent
    this.getTableId = options.pluginContext.getTableId

    this.pluginManager = new DataGridPluginManager<
      DataGridHostEventMap,
      DataGridRuntimePluginEventMap<TPluginEvents>,
      TPluginCapabilities
    >({
      getTableId: options.pluginContext.getTableId,
      getRootElement: options.pluginContext.getRootElement,
      getCapabilityMap: options.pluginContext.getCapabilityMap,
      onCapabilityDenied: (pluginId, capability, reason) => {
        this.emitInternal("plugin:capability-denied", { pluginId, capability, reason })
      },
      emitHostEvent: (event, ...args) => this.handlePluginHostEvent(event, args),
    })

    if (options.initialPlugins) {
      this.setPlugins(options.initialPlugins)
    }

    const tableId = this.getTableId()
    const runtimeInitArgs = [
      { tableId },
    ] as unknown as PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, "runtime:initialized">
    this.pluginManager.emit("runtime:initialized", ...runtimeInitArgs)
    this.emitInternal("lifecycle:init", { tableId })
  }

  emitHost<K extends DataGridHostEventName>(name: K, ...args: DataGridHostEventMap[K]): void {
    this.invokeHandlers(name, args)
  }

  emit<K extends DataGridHostEventName>(name: K, ...args: DataGridHostEventMap[K]): void {
    this.emitHost(name, ...args)
  }

  emitPlugin<K extends DataGridEventName<DataGridRuntimePluginEventMap<TPluginEvents>>>(
    event: K,
    ...args: PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, K>
  ): void {
    this.pluginManager.emit(event, ...args)
  }

  onPlugin<K extends DataGridEventName<DataGridRuntimePluginEventMap<TPluginEvents>>>(
    event: K,
    handler: (
      ...args: PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, K>
    ) => void,
  ): () => void {
    return this.pluginManager.on(event, handler)
  }

  setHostHandlers(handlers: DataGridEventHandlers | undefined): void {
    this.handlers = handlers ?? {}
  }

  setPlugins(
    plugins:
      | DataGridPluginDefinition<
          DataGridHostEventMap,
          DataGridRuntimePluginEventMap<TPluginEvents>,
          TPluginCapabilities
        >[]
      | undefined,
  ): void {
    this.pluginManager.setPlugins(Array.isArray(plugins) ? plugins : [])
  }

  dispose(): void {
    const tableId = this.getTableId()
    const runtimeDisposeArgs = [
      { tableId },
    ] as unknown as PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, "runtime:disposing">
    this.pluginManager.emit("runtime:disposing", ...runtimeDisposeArgs)
    this.emitInternal("lifecycle:dispose", { tableId })
    this.pluginManager.destroy()
  }

  private emitInternal<K extends DataGridRuntimeInternalEventName>(
    event: K,
    ...args: DataGridRuntimeInternalEventMap[K]
  ): void {
    this.onInternalEvent?.(event, args)
  }

  private handlePluginHostEvent(event: string, args: readonly unknown[]): void {
    if (isHostEventName(event)) {
      this.invokeHandlers(event, args as DataGridHostEventMap[typeof event])
      return
    }
    this.emitInternal("plugin:host-unknown", { event, args })
    this.onUnknownPluginEvent?.(event, args)
  }

  private invokeHandlers<K extends DataGridHostEventName>(name: K, args: DataGridHostEventMap[K]): void {
    const handler = this.handlers?.[name] as ((...params: DataGridHostEventMap[K]) => void) | undefined
    if (typeof handler === "function") {
      handler(...args)
    }
    this.pluginManager.notify(
      name,
      ...(args as PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, typeof name>),
    )
    this.onHostEvent(name, args)
    this.emitInternal("host:dispatched", { name, args })
  }
}

export function createDataGridRuntime<
  TPluginEvents extends DataGridEventMap = Record<never, never>,
  TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>,
>(
  options: DataGridRuntimeOptions<TPluginEvents, TPluginCapabilities>,
): DataGridRuntime<TPluginEvents, TPluginCapabilities> {
  return new InternalDataGridRuntime(options)
}
