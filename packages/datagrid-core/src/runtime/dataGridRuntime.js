import { DataGridPluginManager, } from "@affino/datagrid-plugins";
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
};
export function isHostEventName(value) {
    return value in HOST_EVENT_NAME_MAP;
}
class InternalDataGridRuntime {
    constructor(options) {
        Object.defineProperty(this, "handlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onHostEvent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onInternalEvent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onUnknownPluginEvent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pluginManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "getTableId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.handlers = options.initialHandlers ?? {};
        this.onHostEvent = options.onHostEvent;
        this.onInternalEvent = options.onInternalEvent;
        this.onUnknownPluginEvent = options.onUnknownPluginEvent;
        this.getTableId = options.pluginContext.getTableId;
        this.pluginManager = new DataGridPluginManager({
            getTableId: options.pluginContext.getTableId,
            getRootElement: options.pluginContext.getRootElement,
            getCapabilityMap: options.pluginContext.getCapabilityMap,
            onCapabilityDenied: (pluginId, capability, reason) => {
                this.emitInternal("plugin:capability-denied", { pluginId, capability, reason });
            },
            emitHostEvent: (event, ...args) => this.handlePluginHostEvent(event, args),
        });
        if (options.initialPlugins) {
            this.setPlugins(options.initialPlugins);
        }
        const tableId = this.getTableId();
        const runtimeInitArgs = [
            { tableId },
        ];
        this.pluginManager.emit("runtime:initialized", ...runtimeInitArgs);
        this.emitInternal("lifecycle:init", { tableId });
    }
    emitHost(name, ...args) {
        this.invokeHandlers(name, args);
    }
    emit(name, ...args) {
        this.emitHost(name, ...args);
    }
    emitPlugin(event, ...args) {
        this.pluginManager.emit(event, ...args);
    }
    onPlugin(event, handler) {
        return this.pluginManager.on(event, handler);
    }
    setHostHandlers(handlers) {
        this.handlers = handlers ?? {};
    }
    setPlugins(plugins) {
        this.pluginManager.setPlugins(Array.isArray(plugins) ? plugins : []);
    }
    dispose() {
        const tableId = this.getTableId();
        const runtimeDisposeArgs = [
            { tableId },
        ];
        this.pluginManager.emit("runtime:disposing", ...runtimeDisposeArgs);
        this.emitInternal("lifecycle:dispose", { tableId });
        this.pluginManager.destroy();
    }
    emitInternal(event, ...args) {
        this.onInternalEvent?.(event, args);
    }
    handlePluginHostEvent(event, args) {
        if (isHostEventName(event)) {
            this.invokeHandlers(event, args);
            return;
        }
        this.emitInternal("plugin:host-unknown", { event, args });
        this.onUnknownPluginEvent?.(event, args);
    }
    invokeHandlers(name, args) {
        const handler = this.handlers?.[name];
        if (typeof handler === "function") {
            handler(...args);
        }
        this.pluginManager.notify(name, ...args);
        this.onHostEvent(name, args);
        this.emitInternal("host:dispatched", { name, args });
    }
}
export function createDataGridRuntime(options) {
    return new InternalDataGridRuntime(options);
}
