import { UiTablePluginManager } from "../../plugins";
export const HOST_EVENT_NAME_MAP = {
    reachBottom: "reach-bottom",
    rowClick: "row-click",
    cellEdit: "cell-edit",
    batchEdit: "batch-edit",
    selectionChange: "selection-change",
    sortChange: "sort-change",
    filterChange: "filter-change",
    filtersReset: "filters-reset",
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
class InternalTableRuntime {
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
        this.handlers = options.initialHandlers ?? {};
        this.onHostEvent = options.onHostEvent;
        this.onUnknownPluginEvent = options.onUnknownPluginEvent;
        this.pluginManager = new UiTablePluginManager({
            getTableId: options.pluginContext.getTableId,
            getRootElement: options.pluginContext.getRootElement,
            getHostExpose: options.pluginContext.getHostExpose,
            emitHostEvent: (event, ...args) => this.handlePluginHostEvent(event, args),
        });
        if (options.initialPlugins) {
            this.setPlugins(options.initialPlugins);
        }
    }
    emit(name, ...args) {
        this.invokeHandlers(name, args);
    }
    setHostHandlers(handlers) {
        this.handlers = handlers ?? {};
    }
    setPlugins(plugins) {
        this.pluginManager.setPlugins(Array.isArray(plugins) ? plugins : []);
    }
    dispose() {
        this.pluginManager.destroy();
    }
    handlePluginHostEvent(event, args) {
        if (isHostEventName(event)) {
            this.invokeHandlers(event, args);
            return;
        }
        this.onUnknownPluginEvent?.(event, args);
    }
    invokeHandlers(name, args) {
        const handler = this.handlers?.[name];
        if (typeof handler === "function") {
            ;
            handler(...args);
        }
        this.pluginManager.notify(String(name), ...args);
        this.onHostEvent(name, args);
    }
}
export function createTableRuntime(options) {
    return new InternalTableRuntime(options);
}
