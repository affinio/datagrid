// src/ui-table/plugins/manager.ts
// Runtime manager responsible for installing, updating, and disposing UiTable plugins.
import { UiTablePluginEventBus } from "./eventBus";
function isUiTablePlugin(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const plugin = value;
    return typeof plugin.id === "string" && plugin.id.trim().length > 0 && typeof plugin.setup === "function";
}
function normalizeDefinition(definition) {
    if (!definition)
        return null;
    let candidate = null;
    if (typeof definition === "function") {
        try {
            candidate = definition();
        }
        catch (error) {
            if (typeof console !== "undefined" && console.error) {
                console.error("[UiTablePluginManager] Failed to instantiate plugin factory", error);
            }
            return null;
        }
    }
    else {
        candidate = definition;
    }
    if (!isUiTablePlugin(candidate)) {
        if (typeof console !== "undefined" && console.warn) {
            console.warn("[UiTablePluginManager] Ignoring invalid plugin definition", definition);
        }
        return null;
    }
    return candidate;
}
export class UiTablePluginManager {
    constructor(options) {
        Object.defineProperty(this, "bus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new UiTablePluginEventBus()
        });
        Object.defineProperty(this, "instances", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.options = options;
    }
    setPlugins(definitions) {
        const normalized = new Map();
        for (const definition of definitions ?? []) {
            const plugin = normalizeDefinition(definition);
            if (!plugin)
                continue;
            if (normalized.has(plugin.id)) {
                if (typeof console !== "undefined" && console.warn) {
                    console.warn(`[UiTablePluginManager] Duplicate plugin id "${plugin.id}" ignored`);
                }
                continue;
            }
            normalized.set(plugin.id, plugin);
        }
        for (const [id, active] of [...this.instances]) {
            const next = normalized.get(id);
            if (!next || next !== active.plugin) {
                this.disposePlugin(id);
            }
        }
        for (const plugin of normalized.values()) {
            const existing = this.instances.get(plugin.id);
            if (existing && existing.plugin === plugin) {
                continue;
            }
            this.installPlugin(plugin);
        }
    }
    notify(event, ...args) {
        this.bus.emit(event, ...args);
    }
    emit(event, ...args) {
        this.bus.emit(event, ...args);
    }
    destroy() {
        for (const [id] of [...this.instances]) {
            this.disposePlugin(id);
        }
        this.bus.clear();
    }
    installPlugin(plugin) {
        const cleanupFns = [];
        const registerCleanup = (cleanup) => {
            if (typeof cleanup !== "function")
                return;
            cleanupFns.push(cleanup);
        };
        const context = {
            tableId: this.options.getTableId(),
            getRootElement: this.options.getRootElement,
            getHostExpose: this.options.getHostExpose,
            emitHostEvent: (event, ...args) => {
                this.options.emitHostEvent(event, ...args);
            },
            on: (event, handler) => {
                this.bus.on(event, handler);
                const off = () => this.bus.off(event, handler);
                registerCleanup(off);
                return off;
            },
            emit: (event, ...args) => {
                this.bus.emit(event, ...args);
            },
            registerCleanup,
        };
        try {
            const teardown = plugin.setup(context);
            if (typeof teardown === "function") {
                registerCleanup(teardown);
            }
        }
        catch (error) {
            if (typeof console !== "undefined" && console.error) {
                console.error(`[UiTablePluginManager] Plugin "${plugin.id}" setup failed`, error);
            }
        }
        const cleanup = () => {
            while (cleanupFns.length) {
                const fn = cleanupFns.pop();
                try {
                    fn?.();
                }
                catch (error) {
                    if (typeof console !== "undefined" && console.error) {
                        console.error(`[UiTablePluginManager] Plugin "${plugin.id}" cleanup failed`, error);
                    }
                }
            }
        };
        this.instances.set(plugin.id, { plugin, cleanup });
    }
    disposePlugin(id) {
        const active = this.instances.get(id);
        if (!active)
            return;
        try {
            active.cleanup();
        }
        finally {
            this.instances.delete(id);
        }
    }
}
