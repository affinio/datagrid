import { type DataGridEventArgs as PluginEventArgs, type DataGridEventMap, type DataGridEventName, type DataGridPluginCapabilityMap, type DataGridPluginDefinition } from "@affino/datagrid-plugins";
import type { DataGridEventHandlers } from "../types";
export declare const HOST_EVENT_NAME_MAP: {
    readonly reachBottom: "reach-bottom";
    readonly rowClick: "row-click";
    readonly cellEdit: "cell-edit";
    readonly batchEdit: "batch-edit";
    readonly selectionChange: "selection-change";
    readonly sortChange: "sort-change";
    readonly filterChange: "filter-change";
    readonly filtersReset: "filters-reset";
    readonly groupByChange: "group-by-change";
    readonly groupExpansionChange: "group-expansion-change";
    readonly zoomChange: "zoom-change";
    readonly columnResize: "column-resize";
    readonly groupFilterToggle: "group-filter-toggle";
    readonly rowsDelete: "rows-delete";
    readonly lazyLoad: "lazy-load";
    readonly lazyLoadComplete: "lazy-load-complete";
    readonly lazyLoadError: "lazy-load-error";
    readonly autoResizeApplied: "auto-resize-applied";
    readonly selectAllRequest: "select-all-request";
};
export type DataGridHostEventName = keyof typeof HOST_EVENT_NAME_MAP;
export type DataGridHostEventArgs<K extends DataGridHostEventName> = NonNullable<DataGridEventHandlers[K]> extends (...args: infer P) => any ? Readonly<P> : readonly [];
export type DataGridHostEventMap = DataGridEventMap & {
    [K in DataGridHostEventName]: DataGridHostEventArgs<K>;
};
export type DataGridRuntimeBasePluginEventMap = DataGridEventMap & {
    "runtime:initialized": readonly [{
        tableId: string;
    }];
    "runtime:disposing": readonly [{
        tableId: string;
    }];
};
export type DataGridRuntimePluginEventMap<TPluginEvents extends DataGridEventMap = Record<never, never>> = DataGridHostEventMap & DataGridRuntimeBasePluginEventMap & TPluginEvents;
export interface DataGridRuntimeInternalEventMap {
    "lifecycle:init": readonly [{
        tableId: string;
    }];
    "lifecycle:dispose": readonly [{
        tableId: string;
    }];
    "host:dispatched": readonly [{
        name: DataGridHostEventName;
        args: readonly unknown[];
    }];
    "plugin:host-unknown": readonly [{
        event: string;
        args: readonly unknown[];
    }];
    "plugin:capability-denied": readonly [
        {
            pluginId: string;
            capability: string;
            reason: "not-declared" | "not-provided";
        }
    ];
}
export type DataGridRuntimeInternalEventName = keyof DataGridRuntimeInternalEventMap;
export declare function isHostEventName(value: string): value is DataGridHostEventName;
export interface DataGridRuntimeOptions<TPluginEvents extends DataGridEventMap = Record<never, never>, TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>> {
    onHostEvent: <K extends DataGridHostEventName>(name: K, args: DataGridHostEventMap[K]) => void;
    onInternalEvent?: <K extends DataGridRuntimeInternalEventName>(event: K, args: DataGridRuntimeInternalEventMap[K]) => void;
    onUnknownPluginEvent?: (event: string, args: readonly unknown[]) => void;
    pluginContext: {
        getTableId: () => string;
        getRootElement: () => HTMLElement | null;
        getCapabilityMap: () => TPluginCapabilities;
    };
    initialHandlers?: DataGridEventHandlers | undefined;
    initialPlugins?: DataGridPluginDefinition<DataGridHostEventMap, DataGridRuntimePluginEventMap<TPluginEvents>, TPluginCapabilities>[] | undefined;
}
export interface DataGridRuntime<TPluginEvents extends DataGridEventMap = Record<never, never>, TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>> {
    emitHost<K extends DataGridHostEventName>(name: K, ...args: DataGridHostEventMap[K]): void;
    emit<K extends DataGridHostEventName>(name: K, ...args: DataGridHostEventMap[K]): void;
    emitPlugin<K extends DataGridEventName<DataGridRuntimePluginEventMap<TPluginEvents>>>(event: K, ...args: PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, K>): void;
    onPlugin<K extends DataGridEventName<DataGridRuntimePluginEventMap<TPluginEvents>>>(event: K, handler: (...args: PluginEventArgs<DataGridRuntimePluginEventMap<TPluginEvents>, K>) => void): () => void;
    setHostHandlers(handlers: DataGridEventHandlers | undefined): void;
    setPlugins(plugins: DataGridPluginDefinition<DataGridHostEventMap, DataGridRuntimePluginEventMap<TPluginEvents>, TPluginCapabilities>[] | undefined): void;
    dispose(): void;
}
export declare function createDataGridRuntime<TPluginEvents extends DataGridEventMap = Record<never, never>, TPluginCapabilities extends DataGridPluginCapabilityMap = Record<never, never>>(options: DataGridRuntimeOptions<TPluginEvents, TPluginCapabilities>): DataGridRuntime<TPluginEvents, TPluginCapabilities>;
//# sourceMappingURL=dataGridRuntime.d.ts.map