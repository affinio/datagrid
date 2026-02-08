// src/datagrid/plugins/eventBus.ts
// Lightweight event bus used by the DataGrid plugin manager.

import type {
  DataGridEventArgs,
  DataGridEventMap,
  DataGridEventName,
  DataGridPluginEventHandler,
} from "./types"

type UntypedHandler = DataGridPluginEventHandler<readonly unknown[]>

export class DataGridPluginEventBus<TEventMap extends DataGridEventMap = DataGridEventMap> {
  private listeners = new Map<string, Set<UntypedHandler>>()

  on<TEvent extends DataGridEventName<TEventMap>>(
    event: TEvent,
    handler: DataGridPluginEventHandler<DataGridEventArgs<TEventMap, TEvent>>,
  ) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as UntypedHandler)
  }

  off<TEvent extends DataGridEventName<TEventMap>>(
    event: TEvent,
    handler: DataGridPluginEventHandler<DataGridEventArgs<TEventMap, TEvent>>,
  ) {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.delete(handler as UntypedHandler)
    if (!handlers.size) {
      this.listeners.delete(event)
    }
  }

  emit<TEvent extends DataGridEventName<TEventMap>>(
    event: TEvent,
    ...args: DataGridEventArgs<TEventMap, TEvent>
  ) {
    const handlers = this.listeners.get(event)
    if (!handlers?.size) return
    for (const handler of [...handlers]) {
      try {
        ;(handler as DataGridPluginEventHandler<DataGridEventArgs<TEventMap, TEvent>>)(...args)
      } catch (error) {
        if (typeof console !== "undefined" && console.error) {
          console.error(`[DataGridPluginEventBus] handler for "${event}" threw`, error)
        }
      }
    }
  }

  clear() {
    this.listeners.clear()
  }
}
