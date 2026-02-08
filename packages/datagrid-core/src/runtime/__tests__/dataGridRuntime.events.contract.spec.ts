import { describe, expect, it } from "vitest"
import {
  createDataGridRuntime,
  type DataGridRuntimeInternalEventMap,
} from "../dataGridRuntime"

function createPluginContext(tableId = "grid-events-test") {
  return {
    getTableId: () => tableId,
    getRootElement: () => null,
    getCapabilityMap: () => ({}),
  }
}

describe("table runtime typed event routing", () => {
  it("dispatches host events in deterministic order: handler -> plugins -> host callback", () => {
    const calls: string[] = []

    const runtime = createDataGridRuntime({
      onHostEvent: (name, args) => {
        const payload = args[0] as { rowId: string | number }
        calls.push(`host:${name}:${payload.rowId}`)
      },
      pluginContext: createPluginContext(),
      initialHandlers: {
        rowClick: payload => {
          calls.push(`handler:${payload.rowId}`)
        },
      },
      initialPlugins: [
        {
          id: "row-click-observer",
          setup(context) {
            context.on("rowClick", payload => {
              calls.push(`plugin:${payload.rowId}`)
            })
          },
        },
      ],
    })

    runtime.emit("rowClick", {
      row: { id: 7 },
      rowId: 7,
      rowIndex: 0,
    })

    expect(calls).toEqual([
      "handler:7",
      "plugin:7",
      "host:rowClick:7",
    ])

    runtime.dispose()
  })

  it("separates internal lifecycle and unknown-plugin-host events", () => {
    const internalEvents: Array<{ name: string; payload: unknown }> = []
    const legacyUnknownEvents: string[] = []
    let pluginContext: any

    const runtime = createDataGridRuntime({
      onHostEvent: () => {},
      onInternalEvent: (name, args) => {
        internalEvents.push({ name, payload: args[0] })
      },
      onUnknownPluginEvent: event => {
        legacyUnknownEvents.push(event)
      },
      pluginContext: createPluginContext("grid-internal"),
      initialPlugins: [
        {
          id: "js-like-plugin",
          setup(context) {
            pluginContext = context
          },
        },
      ],
    })

    runtime.emit("reachBottom")
    ;(pluginContext as any).emitHostEvent("not-a-host-event", 42)
    runtime.dispose()

    expect(internalEvents.some(event => event.name === "lifecycle:init")).toBe(true)
    expect(internalEvents.some(event => event.name === "host:dispatched")).toBe(true)
    expect(internalEvents.some(event => event.name === "plugin:host-unknown")).toBe(true)
    expect(internalEvents.some(event => event.name === "lifecycle:dispose")).toBe(true)
    expect(legacyUnknownEvents).toEqual(["not-a-host-event"])
  })

  it("routes custom plugin events with strict domain separation", () => {
    interface CustomPluginEvents {
      "metrics:tick": readonly [number]
    }

    const seen: number[] = []
    let pluginEmit: ((value: number) => void) | null = null

    const runtime = createDataGridRuntime<CustomPluginEvents>({
      onHostEvent: () => {},
      pluginContext: createPluginContext("grid-custom-events"),
      initialPlugins: [
        {
          id: "metrics-plugin",
          setup(context) {
            pluginEmit = value => {
              context.emit("metrics:tick", value)
            }
          },
        },
      ],
    })

    const off = runtime.onPlugin("metrics:tick", value => {
      seen.push(value)
    })

    pluginEmit?.(3)
    runtime.emitPlugin("metrics:tick", 5)
    off()
    runtime.dispose()

    expect(seen).toEqual([3, 5])
  })

  it("emits typed plugin lifecycle events around runtime lifecycle", () => {
    const lifecycle: string[] = []
    const runtime = createDataGridRuntime({
      onHostEvent: () => {},
      pluginContext: createPluginContext("grid-lifecycle"),
      initialPlugins: [
        {
          id: "lifecycle-plugin",
          setup(context) {
            context.on("runtime:initialized", payload => {
              lifecycle.push(`init:${payload.tableId}`)
            })
            context.on("runtime:disposing", payload => {
              lifecycle.push(`dispose:${payload.tableId}`)
            })
          },
        },
      ],
    })

    runtime.dispose()

    expect(lifecycle).toEqual([
      "init:grid-lifecycle",
      "dispose:grid-lifecycle",
    ])
  })

  it("keeps internal payload map stable for compile-time guard", () => {
    const capture: Array<DataGridRuntimeInternalEventMap["host:dispatched"][0]> = []
    const runtime = createDataGridRuntime({
      onHostEvent: () => {},
      onInternalEvent: (name, args) => {
        if (name === "host:dispatched") {
          capture.push(args[0])
        }
      },
      pluginContext: createPluginContext("grid-guard"),
    })

    runtime.emit("filtersReset")
    runtime.dispose()

    expect(capture).toHaveLength(1)
    expect(capture[0]?.name).toBe("filtersReset")
  })

  it("allows plugins to use declared capabilities only", () => {
    const calls: number[] = []
    const runtime = createDataGridRuntime<
      Record<never, never>,
      { "metrics:increment": (value: number) => void }
    >({
      onHostEvent: () => {},
      pluginContext: {
        ...createPluginContext("grid-cap-ok"),
        getCapabilityMap: () => ({
          "metrics:increment": value => {
            calls.push(value)
          },
        }),
      },
      initialPlugins: [
        {
          id: "metrics-plugin",
          capabilities: ["metrics:increment"],
          setup(context) {
            context.invokeCapability("metrics:increment", 2)
            const increment = context.requestCapability("metrics:increment")
            increment?.(3)
          },
        },
      ],
    })

    runtime.dispose()
    expect(calls).toEqual([2, 3])
  })

  it("emits internal denial event when plugin uses undeclared capability", () => {
    const denied: Array<DataGridRuntimeInternalEventMap["plugin:capability-denied"][0]> = []
    const runtime = createDataGridRuntime<
      Record<never, never>,
      { "metrics:increment": (value: number) => void }
    >({
      onHostEvent: () => {},
      onInternalEvent: (name, args) => {
        if (name === "plugin:capability-denied") {
          denied.push(args[0])
        }
      },
      pluginContext: {
        ...createPluginContext("grid-cap-deny"),
        getCapabilityMap: () => ({
          "metrics:increment": () => {},
        }),
      },
      initialPlugins: [
        {
          id: "unsafe-plugin",
          setup(context) {
            context.invokeCapability("metrics:increment", 1)
          },
        },
      ],
    })

    runtime.dispose()
    expect(denied).toEqual([
      {
        pluginId: "unsafe-plugin",
        capability: "metrics:increment",
        reason: "not-declared",
      },
    ])
  })

  it("emits internal denial event when declared capability is not provided by host", () => {
    const denied: Array<DataGridRuntimeInternalEventMap["plugin:capability-denied"][0]> = []
    const runtime = createDataGridRuntime<
      Record<never, never>,
      { "table:reset": () => void }
    >({
      onHostEvent: () => {},
      onInternalEvent: (name, args) => {
        if (name === "plugin:capability-denied") {
          denied.push(args[0])
        }
      },
      pluginContext: {
        ...createPluginContext("grid-cap-missing"),
        getCapabilityMap: () => ({}),
      },
      initialPlugins: [
        {
          id: "reset-plugin",
          capabilities: ["table:reset"],
          setup(context) {
            context.invokeCapability("table:reset")
          },
        },
      ],
    })

    runtime.dispose()
    expect(denied).toEqual([
      {
        pluginId: "reset-plugin",
        capability: "table:reset",
        reason: "not-provided",
      },
    ])
  })
})
