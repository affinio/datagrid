import { describe, expect, it } from "vitest"
import {
  createDataGridAdapterRuntime,
  resolveDataGridAdapterEventName,
  type DataGridAdapterDispatchPayload,
} from "../adapterRuntimeProtocol"

function createPluginContext() {
  return {
    getTableId: () => "grid-contract",
    getRootElement: () => null,
    getCapabilityMap: () => ({}),
  }
}

describe("cross-platform adapter runtime protocol", () => {
  it("maps host event names deterministically by adapter kind", () => {
    expect(resolveDataGridAdapterEventName("vue", "reachBottom")).toBe("reach-bottom")
    expect(resolveDataGridAdapterEventName("laravel", "rowClick")).toBe("row-click")
    expect(resolveDataGridAdapterEventName("web-component", "filtersReset")).toBe("filters-reset")
    expect(resolveDataGridAdapterEventName("react", "selectionChange")).toBe("selectionChange")
  })

  it("dispatches mapped events for vue/laravel/web-component and host names for react", () => {
    const vueEvents: Array<DataGridAdapterDispatchPayload<string>> = []
    const reactEvents: Array<DataGridAdapterDispatchPayload<string>> = []

    const vueRuntime = createDataGridAdapterRuntime({
      kind: "vue",
      emitAdapterEvent: payload => vueEvents.push(payload),
      pluginContext: createPluginContext(),
    })
    const reactRuntime = createDataGridAdapterRuntime({
      kind: "react",
      emitAdapterEvent: payload => reactEvents.push(payload),
      pluginContext: createPluginContext(),
    })

    vueRuntime.emit("reachBottom")
    reactRuntime.emit("reachBottom")

    expect(vueEvents[0]).toEqual({
      hostEvent: "reachBottom",
      adapterEvent: "reach-bottom",
      args: [],
    })
    expect(reactEvents[0]).toEqual({
      hostEvent: "reachBottom",
      adapterEvent: "reachBottom",
      args: [],
    })
  })

  it("keeps runtime capability contract (handlers + plugins + dispose) stable for adapters", () => {
    let reachBottomCalls = 0
    const emitted: Array<DataGridAdapterDispatchPayload<string>> = []
    const runtime = createDataGridAdapterRuntime({
      kind: "web-component",
      emitAdapterEvent: payload => emitted.push(payload),
      pluginContext: createPluginContext(),
      initialHandlers: {
        reachBottom: () => {
          reachBottomCalls += 1
        },
      },
    })

    runtime.emit("reachBottom")
    runtime.setHostHandlers({
      reachBottom: () => {
        reachBottomCalls += 10
      },
    })
    runtime.emit("reachBottom")

    expect(reachBottomCalls).toBe(11)
    expect(emitted).toHaveLength(2)
    expect(runtime.kind).toBe("web-component")
    expect(runtime.mapHostEventName("reachBottom")).toBe("reach-bottom")

    runtime.setPlugins([])
    runtime.dispose()
  })
})
