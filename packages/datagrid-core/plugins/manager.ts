// src/ui-table/plugins/manager.ts
// Runtime manager responsible for installing, updating, and disposing UiTable plugins.

import { UiTablePluginEventBus } from "./eventBus"
import type {
  DataGridEventArgs,
  DataGridEventMap,
  DataGridEventName,
  DataGridPluginCapabilityMap,
  UiTablePlugin,
  UiTablePluginDefinition,
  UiTablePluginSetupContext,
} from "./types"

type HostEmit = (event: string, ...args: readonly unknown[]) => void

type CleanupFn = () => void

interface ManagerOptions<TCapabilities extends DataGridPluginCapabilityMap> {
  getTableId: () => string
  getRootElement: () => HTMLElement | null
  getCapabilityMap: () => TCapabilities
  onCapabilityDenied?: (
    pluginId: string,
    capability: string,
    reason: "not-declared" | "not-provided",
  ) => void
  emitHostEvent: HostEmit
}

interface ActivePlugin<
  THostEvents extends DataGridEventMap,
  TPluginEvents extends DataGridEventMap,
  TCapabilities extends DataGridPluginCapabilityMap,
> {
  plugin: UiTablePlugin<THostEvents, TPluginEvents, TCapabilities>
  cleanup: CleanupFn
}

function isUiTablePlugin<
  THostEvents extends DataGridEventMap,
  TPluginEvents extends DataGridEventMap,
  TCapabilities extends DataGridPluginCapabilityMap,
>(value: unknown): value is UiTablePlugin<THostEvents, TPluginEvents, TCapabilities> {
  if (!value || typeof value !== "object") {
    return false
  }
  const plugin = value as UiTablePlugin<THostEvents, TPluginEvents, TCapabilities>
  return typeof plugin.id === "string" && plugin.id.trim().length > 0 && typeof plugin.setup === "function"
}

function normalizeDefinition<
  THostEvents extends DataGridEventMap,
  TPluginEvents extends DataGridEventMap,
  TCapabilities extends DataGridPluginCapabilityMap,
>(
  definition: UiTablePluginDefinition<THostEvents, TPluginEvents, TCapabilities> | null | undefined,
): UiTablePlugin<THostEvents, TPluginEvents, TCapabilities> | null {
  if (!definition) return null

  let candidate: UiTablePlugin<THostEvents, TPluginEvents, TCapabilities> | null = null

  if (typeof definition === "function") {
    try {
      candidate = definition()
    } catch (error) {
      if (typeof console !== "undefined" && console.error) {
        console.error("[UiTablePluginManager] Failed to instantiate plugin factory", error)
      }
      return null
    }
  } else {
    candidate = definition
  }

  if (!isUiTablePlugin<THostEvents, TPluginEvents, TCapabilities>(candidate)) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[UiTablePluginManager] Ignoring invalid plugin definition", definition)
    }
    return null
  }

  return candidate
}

export class UiTablePluginManager<
  THostEvents extends DataGridEventMap = DataGridEventMap,
  TPluginEvents extends DataGridEventMap = DataGridEventMap,
  TCapabilities extends DataGridPluginCapabilityMap = DataGridPluginCapabilityMap,
> {
  private readonly bus = new UiTablePluginEventBus<TPluginEvents>()
  private readonly instances = new Map<string, ActivePlugin<THostEvents, TPluginEvents, TCapabilities>>()
  private readonly options: ManagerOptions<TCapabilities>

  constructor(options: ManagerOptions<TCapabilities>) {
    this.options = options
  }

  setPlugins(definitions: Array<UiTablePluginDefinition<THostEvents, TPluginEvents, TCapabilities> | null | undefined>) {
    const normalized = new Map<string, UiTablePlugin<THostEvents, TPluginEvents, TCapabilities>>()
    for (const definition of definitions ?? []) {
      const plugin = normalizeDefinition<THostEvents, TPluginEvents, TCapabilities>(definition)
      if (!plugin) continue
      if (normalized.has(plugin.id)) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(`[UiTablePluginManager] Duplicate plugin id "${plugin.id}" ignored`)
        }
        continue
      }
      normalized.set(plugin.id, plugin)
    }

    for (const [id, active] of [...this.instances]) {
      const next = normalized.get(id)
      if (!next || next !== active.plugin) {
        this.disposePlugin(id)
      }
    }

    for (const plugin of normalized.values()) {
      const existing = this.instances.get(plugin.id)
      if (existing && existing.plugin === plugin) {
        continue
      }
      this.installPlugin(plugin)
    }
  }

  on<TEvent extends DataGridEventName<TPluginEvents>>(
    event: TEvent,
    handler: (
      ...args: DataGridEventArgs<TPluginEvents, TEvent>
    ) => void,
  ): () => void {
    this.bus.on(event, handler)
    return () => this.bus.off(event, handler)
  }

  notify<TEvent extends DataGridEventName<TPluginEvents>>(
    event: TEvent,
    ...args: DataGridEventArgs<TPluginEvents, TEvent>
  ) {
    this.bus.emit(event, ...args)
  }

  emit<TEvent extends DataGridEventName<TPluginEvents>>(
    event: TEvent,
    ...args: DataGridEventArgs<TPluginEvents, TEvent>
  ) {
    this.bus.emit(event, ...args)
  }

  destroy() {
    for (const [id] of [...this.instances]) {
      this.disposePlugin(id)
    }
    this.bus.clear()
  }

  private installPlugin(plugin: UiTablePlugin<THostEvents, TPluginEvents, TCapabilities>) {
    const cleanupFns: CleanupFn[] = []
    const declaredCapabilities = new Set<string>(plugin.capabilities ?? [])

    const registerCleanup = (cleanup: CleanupFn) => {
      if (typeof cleanup !== "function") return
      cleanupFns.push(cleanup)
    }

    const resolveCapability = (
      capability: string,
      reportDenied: boolean,
    ): ((...args: readonly unknown[]) => unknown) | null => {
      if (!declaredCapabilities.has(capability)) {
        if (reportDenied) {
          this.options.onCapabilityDenied?.(plugin.id, capability, "not-declared")
        }
        return null
      }

      const capabilityMap = this.options.getCapabilityMap()
      const candidate = capabilityMap[capability]
      if (typeof candidate !== "function") {
        if (reportDenied) {
          this.options.onCapabilityDenied?.(plugin.id, capability, "not-provided")
        }
        return null
      }
      return candidate
    }

    const context: UiTablePluginSetupContext<THostEvents, TPluginEvents, TCapabilities> = {
      tableId: this.options.getTableId(),
      getRootElement: this.options.getRootElement,
      hasCapability: capability => resolveCapability(capability, false) !== null,
      requestCapability: capability => {
        return resolveCapability(capability, true) as TCapabilities[typeof capability] | null
      },
      invokeCapability: (capability, ...args) => {
        const handler = resolveCapability(capability, true)
        if (!handler) {
          throw new Error(
            `[UiTablePluginManager] Plugin "${plugin.id}" attempted forbidden capability "${String(capability)}"`,
          )
        }
        return handler(...args) as ReturnType<TCapabilities[typeof capability]>
      },
      emitHostEvent: (event, ...args) => {
        this.options.emitHostEvent(event, ...args)
      },
      on: (event, handler) => {
        this.bus.on(event, handler)
        const off = () => this.bus.off(event, handler)
        registerCleanup(off)
        return off
      },
      emit: (event, ...args) => {
        this.bus.emit(event, ...args)
      },
      registerCleanup,
    }

    try {
      const teardown = plugin.setup(context)
      if (typeof teardown === "function") {
        registerCleanup(teardown)
      }
    } catch (error) {
      if (typeof console !== "undefined" && console.error) {
        console.error(`[UiTablePluginManager] Plugin "${plugin.id}" setup failed`, error)
      }
    }

    const cleanup: CleanupFn = () => {
      while (cleanupFns.length) {
        const fn = cleanupFns.pop()
        try {
          fn?.()
        } catch (error) {
          if (typeof console !== "undefined" && console.error) {
            console.error(`[UiTablePluginManager] Plugin "${plugin.id}" cleanup failed`, error)
          }
        }
      }
    }

    this.instances.set(plugin.id, { plugin, cleanup })
  }

  private disposePlugin(id: string) {
    const active = this.instances.get(id)
    if (!active) return
    try {
      active.cleanup()
    } finally {
      this.instances.delete(id)
    }
  }
}
