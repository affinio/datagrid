import { HOST_EVENT_NAME_MAP, createDataGridRuntime, } from "../runtime/dataGridRuntime.js";
export function resolveDataGridAdapterEventName(kind, hostEvent) {
    if (kind === "react") {
        return hostEvent;
    }
    return HOST_EVENT_NAME_MAP[hostEvent];
}
export function createDataGridAdapterRuntime(options) {
    const mapHostEventName = options.mapHostEventName ?? ((name) => resolveDataGridAdapterEventName(options.kind, name));
    const runtime = createDataGridRuntime({
        onHostEvent: (hostEvent, args) => {
            options.emitAdapterEvent({
                hostEvent,
                adapterEvent: mapHostEventName(hostEvent),
                args,
            });
        },
        onInternalEvent: options.onInternalEvent,
        onUnknownPluginEvent: options.onUnknownPluginEvent,
        pluginContext: options.pluginContext,
        initialHandlers: options.initialHandlers,
        initialPlugins: options.initialPlugins,
    });
    return Object.assign(runtime, {
        kind: options.kind,
        mapHostEventName,
    });
}
