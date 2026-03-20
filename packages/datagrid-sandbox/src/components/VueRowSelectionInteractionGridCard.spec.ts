// @vitest-environment jsdom

import { mount } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { nextTick } from "vue"

async function flushUi(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe("VueRowSelectionInteractionGridCard", () => {
  beforeAll(() => {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverStub,
    })

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () => null,
    })
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("authors a focused row-selection sandbox with visible row filters", async () => {
    const { default: VueRowSelectionInteractionGridCard } = await import("./VueRowSelectionInteractionGridCard.vue")

    const wrapper = mount(VueRowSelectionInteractionGridCard, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUi()

    const grid = wrapper.findComponent({ name: "DataGrid" })
    expect(grid.props("rowSelection")).toBe(true)

    const initialRows = (grid.props("rows") ?? []) as Array<Record<string, unknown>>
    expect(initialRows).toHaveLength(6)

    const approvedFilter = wrapper.findAll("button").find(button => button.text() === "Approved")
    expect(approvedFilter).toBeDefined()

    await approvedFilter!.trigger("click")
    await flushUi()

    const filteredRows = (grid.props("rows") ?? []) as Array<Record<string, unknown>>
    expect(filteredRows).toHaveLength(2)
    expect(wrapper.text()).toContain("Selected visible:")

    wrapper.unmount()
  })
})