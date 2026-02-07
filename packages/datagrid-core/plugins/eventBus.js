// src/ui-table/plugins/eventBus.ts
// Lightweight event bus used by the UiTable plugin manager.
export class UiTablePluginEventBus {
    constructor() {
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
    }
    off(event, handler) {
        const handlers = this.listeners.get(event);
        if (!handlers)
            return;
        handlers.delete(handler);
        if (!handlers.size) {
            this.listeners.delete(event);
        }
    }
    emit(event, ...args) {
        const handlers = this.listeners.get(event);
        if (!handlers?.size)
            return;
        for (const handler of [...handlers]) {
            try {
                handler(...args);
            }
            catch (error) {
                if (typeof console !== "undefined" && console.error) {
                    console.error(`[UiTablePluginEventBus] handler for "${event}" threw`, error);
                }
            }
        }
    }
    clear() {
        this.listeners.clear();
    }
}
