// src/datagrid/plugins/types.ts
// Shared plugin interfaces for DataGrid/DataGrid with typed event maps.

export type DataGridEventMap = Record<string, readonly unknown[]>
export type DataGridPluginCapability = (...args: readonly unknown[]) => unknown
export type DataGridPluginCapabilityMap = Record<string, DataGridPluginCapability>

export type DataGridEventName<TEventMap extends DataGridEventMap> = Extract<keyof TEventMap, string>
export type DataGridPluginCapabilityName<TCapabilities extends DataGridPluginCapabilityMap> =
  Extract<keyof TCapabilities, string>

export type DataGridEventArgs<
  TEventMap extends DataGridEventMap,
  TEvent extends DataGridEventName<TEventMap>,
> = TEventMap[TEvent] extends readonly unknown[] ? TEventMap[TEvent] : readonly unknown[]

export type DataGridPluginEventHandler<TArgs extends readonly unknown[] = readonly unknown[]> = (
  ...args: TArgs
) => void

export interface DataGridPluginSetupContext<
  THostEvents extends DataGridEventMap = DataGridEventMap,
  TPluginEvents extends DataGridEventMap = DataGridEventMap,
  TCapabilities extends DataGridPluginCapabilityMap = DataGridPluginCapabilityMap,
> {
  /** Unique identifier of the table instance installing the plugin. */
  tableId: string
  /** Returns the nearest theme/root element for DOM-based integrations. */
  getRootElement: () => HTMLElement | null
  /**
   * Returns `true` if capability is both declared by plugin and provided by host.
   * Plugins must never access host internals directly.
   */
  hasCapability: <TCapability extends DataGridPluginCapabilityName<TCapabilities>>(
    capability: TCapability,
  ) => boolean
  /** Returns capability function if allowed/provided; otherwise `null`. */
  requestCapability: <TCapability extends DataGridPluginCapabilityName<TCapabilities>>(
    capability: TCapability,
  ) => TCapabilities[TCapability] | null
  /**
   * Invokes allowed capability or throws on denied/missing access.
   * Use for fail-fast plugin contracts.
   */
  invokeCapability: <TCapability extends DataGridPluginCapabilityName<TCapabilities>>(
    capability: TCapability,
    ...args: Parameters<TCapabilities[TCapability]>
  ) => ReturnType<TCapabilities[TCapability]>
  /** Emits a host (component-level) event, mirroring `emit` + config handlers. */
  emitHostEvent: <TEvent extends DataGridEventName<THostEvents>>(
    event: TEvent,
    ...args: DataGridEventArgs<THostEvents, TEvent>
  ) => void
  /** Subscribes to plugin/local events. Returns an unsubscribe function. */
  on: <TEvent extends DataGridEventName<TPluginEvents>>(
    event: TEvent,
    handler: DataGridPluginEventHandler<DataGridEventArgs<TPluginEvents, TEvent>>,
  ) => () => void
  /** Emits a plugin/local event to other subscribers. */
  emit: <TEvent extends DataGridEventName<TPluginEvents>>(
    event: TEvent,
    ...args: DataGridEventArgs<TPluginEvents, TEvent>
  ) => void
  /** Registers a cleanup hook that runs when the plugin is disposed. */
  registerCleanup: (cleanup: () => void) => void
}

export interface DataGridPlugin<
  THostEvents extends DataGridEventMap = DataGridEventMap,
  TPluginEvents extends DataGridEventMap = DataGridEventMap,
  TCapabilities extends DataGridPluginCapabilityMap = DataGridPluginCapabilityMap,
> {
  id: string
  capabilities?: readonly DataGridPluginCapabilityName<TCapabilities>[]
  setup(context: DataGridPluginSetupContext<THostEvents, TPluginEvents, TCapabilities>): void | (() => void)
}

export type DataGridPluginDefinition<
  THostEvents extends DataGridEventMap = DataGridEventMap,
  TPluginEvents extends DataGridEventMap = DataGridEventMap,
  TCapabilities extends DataGridPluginCapabilityMap = DataGridPluginCapabilityMap,
> =
  | DataGridPlugin<THostEvents, TPluginEvents, TCapabilities>
  | (() => DataGridPlugin<THostEvents, TPluginEvents, TCapabilities>)
