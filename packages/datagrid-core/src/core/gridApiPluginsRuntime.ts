import type {
  DataGridApiEventMap,
  DataGridApiEventName,
  DataGridApiEventPayload,
  DataGridApiEventsNamespace,
  DataGridApiPluginDefinition,
} from "./gridApiContracts"

export interface DataGridApiPluginsRuntime<TRow = unknown> {
  registerPlugin: (plugin: DataGridApiPluginDefinition<TRow>) => boolean
  unregisterPlugin: (id: string) => boolean
  hasPlugin: (id: string) => boolean
  listPlugins: () => readonly string[]
  clearPlugins: () => void
  dispose: () => void
}

export interface CreateDataGridApiPluginsRuntimeInput<TRow = unknown> {
  events: DataGridApiEventsNamespace<TRow>
  initialPlugins?: readonly DataGridApiPluginDefinition<TRow>[]
}

function normalizePluginId(rawId: string): string {
  const id = rawId.trim()
  if (id.length === 0) {
    throw new Error('[DataGridApi] plugin.id must be a non-empty string.')
  }
  return id
}

const DATAGRID_API_EVENT_NAMES: readonly DataGridApiEventName[] = [
  "rows:changed",
  "columns:changed",
  "projection:recomputed",
  "selection:changed",
  "pivot:changed",
  "transaction:changed",
  "viewport:changed",
  "state:imported",
]

export function createDataGridApiPluginsRuntime<TRow = unknown>(
  input: CreateDataGridApiPluginsRuntimeInput<TRow>,
): DataGridApiPluginsRuntime<TRow> {
  const plugins = new Map<string, DataGridApiPluginDefinition<TRow>>()

  const dispatchEvent = <K extends keyof DataGridApiEventMap<TRow>>(
    event: K,
    payload: DataGridApiEventMap<TRow>[K],
  ): void => {
    if (plugins.size === 0) {
      return
    }
    const eventName = event as DataGridApiEventName<TRow>
    const eventPayload = payload as DataGridApiEventPayload<TRow>
    for (const plugin of plugins.values()) {
      plugin.onEvent?.(eventName, eventPayload)
    }
  }

  const unsubscribeEvents = DATAGRID_API_EVENT_NAMES.map(event =>
    input.events.on(event as keyof DataGridApiEventMap<TRow>, (payload) => {
      dispatchEvent(event as keyof DataGridApiEventMap<TRow>, payload)
    }),
  )

  const registerPlugin = (plugin: DataGridApiPluginDefinition<TRow>): boolean => {
    const id = normalizePluginId(plugin.id)
    if (plugins.has(id)) {
      return false
    }
    plugins.set(id, { ...plugin, id })
    plugin.onRegister?.()
    return true
  }

  const unregisterPlugin = (id: string): boolean => {
    const normalizedId = normalizePluginId(id)
    const plugin = plugins.get(normalizedId)
    if (!plugin) {
      return false
    }
    plugins.delete(normalizedId)
    plugin.onDispose?.()
    return true
  }

  if (Array.isArray(input.initialPlugins)) {
    for (const plugin of input.initialPlugins) {
      registerPlugin(plugin)
    }
  }

  return {
    registerPlugin,
    unregisterPlugin,
    hasPlugin(id: string) {
      return plugins.has(normalizePluginId(id))
    },
    listPlugins() {
      return Array.from(plugins.keys())
    },
    clearPlugins() {
      for (const plugin of plugins.values()) {
        plugin.onDispose?.()
      }
      plugins.clear()
    },
    dispose() {
      for (const unsubscribe of unsubscribeEvents) {
        unsubscribe()
      }
      for (const plugin of plugins.values()) {
        plugin.onDispose?.()
      }
      plugins.clear()
    },
  }
}
