import { type UiTablePluginDefinition } from "../../plugins";
import type { UiTableEventHandlers } from "../types";
export declare const HOST_EVENT_NAME_MAP: {
    readonly reachBottom: "reach-bottom";
    readonly rowClick: "row-click";
    readonly cellEdit: "cell-edit";
    readonly batchEdit: "batch-edit";
    readonly selectionChange: "selection-change";
    readonly sortChange: "sort-change";
    readonly filterChange: "filter-change";
    readonly filtersReset: "filters-reset";
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
export type HostEventName = keyof typeof HOST_EVENT_NAME_MAP;
export type EventArgs<K extends HostEventName> = NonNullable<UiTableEventHandlers[K]> extends (...args: infer P) => any ? P : [];
export declare function isHostEventName(value: string): value is HostEventName;
export interface TableRuntimeOptions {
    onHostEvent: (name: HostEventName, args: readonly unknown[]) => void;
    onUnknownPluginEvent?: (event: string, args: readonly unknown[]) => void;
    pluginContext: {
        getTableId: () => string;
        getRootElement: () => HTMLElement | null;
        getHostExpose: () => Record<string, unknown>;
    };
    initialHandlers?: UiTableEventHandlers | undefined;
    initialPlugins?: UiTablePluginDefinition[] | undefined;
}
export interface TableRuntime {
    emit<K extends HostEventName>(name: K, ...args: EventArgs<K>): void;
    setHostHandlers(handlers: UiTableEventHandlers | undefined): void;
    setPlugins(plugins: UiTablePluginDefinition[] | undefined): void;
    dispose(): void;
}
export declare function createTableRuntime(options: TableRuntimeOptions): TableRuntime;
//# sourceMappingURL=tableRuntime.d.ts.map