import { mount } from "@vue/test-utils"
import { defineComponent } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridEventBridge } from "../useDataGridEventBridge"

function mountEventBridge(options: Parameters<typeof useDataGridEventBridge>[0]) {
  return mount(defineComponent({
    setup() {
      useDataGridEventBridge(options)
      return () => null
    },
  }))
}

describe("useDataGridEventBridge contract", () => {
  it("forwards typed row-selection changes from core events and component aliases", () => {
    const apiListeners = new Map<string, Array<(payload: unknown) => void>>()
    const gridListeners = new Map<string, Array<(payload: unknown) => void>>()
    const emit = vi.fn()

    const wrapper = mountEventBridge({
      grid: {
        api: {
          events: {
            on(event, listener) {
              const listeners = apiListeners.get(event) ?? []
              listeners.push(listener as (payload: unknown) => void)
              apiListeners.set(event, listeners)
              return () => undefined
            },
          },
        },
        on(event, listener) {
          const listeners = gridListeners.get(event) ?? []
          listeners.push(listener as (payload: unknown) => void)
          gridListeners.set(event, listeners)
          return () => undefined
        },
      },
      emit,
    })

    apiListeners.get("row-selection:changed")?.forEach(listener => {
      listener({
        snapshot: {
          focusedRow: "r2",
          selectedRows: ["r1", "r2"],
        },
      })
    })

    gridListeners.get("row-selection-change")?.forEach(listener => {
      listener({
        snapshot: {
          focusedRow: null,
          selectedRows: ["r3"],
        },
      })
    })

    expect(emit).toHaveBeenCalledWith("row-selection-change", {
      snapshot: {
        focusedRow: "r2",
        selectedRows: ["r1", "r2"],
      },
    })
    expect(emit).toHaveBeenCalledWith("row-selection-change", {
      snapshot: {
        focusedRow: null,
        selectedRows: ["r3"],
      },
    })

    wrapper.unmount()
  })

  it("keeps row-select as a legacy alias", () => {
    const emit = vi.fn()
    const gridListeners = new Map<string, Array<(payload: unknown) => void>>()

    const wrapper = mountEventBridge({
      grid: {
        api: {
          events: {
            on() {
              return () => undefined
            },
          },
        },
        on(event, listener) {
          const listeners = gridListeners.get(event) ?? []
          listeners.push(listener as (payload: unknown) => void)
          gridListeners.set(event, listeners)
          return () => undefined
        },
      },
      emit,
    })

    gridListeners.get("row-select")?.forEach(listener => {
      listener({
        focusedRow: null,
        selectedRows: ["r1"],
      })
    })

    expect(emit).toHaveBeenCalledWith("row-select", {
      focusedRow: null,
      selectedRows: ["r1"],
    })

    wrapper.unmount()
  })
})
