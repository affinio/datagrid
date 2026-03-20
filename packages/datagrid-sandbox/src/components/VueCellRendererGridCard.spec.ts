// @vitest-environment jsdom

import { mount } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { nextTick } from "vue"

async function flushUi(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe("VueCellRendererGridCard", () => {
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

  it("authors an interactive approval action column", async () => {
    const { default: VueCellRendererGridCard } = await import("./VueCellRendererGridCard.vue")

    const wrapper = mount(VueCellRendererGridCard, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUi()

    const grid = wrapper.findComponent({ name: "DataGrid" })
    const columns = (grid.props("columns") ?? []) as Array<Record<string, unknown>>
    const actionColumn = columns.find(column => column.key === "approvalAction")

    expect(actionColumn).toMatchObject({
      capabilities: expect.objectContaining({ editable: false }),
      cellInteraction: expect.objectContaining({
        click: true,
        keyboard: ["enter", "space"],
        role: "button",
        onInvoke: expect.any(Function),
      }),
      cellRenderer: expect.any(Function),
    })

    wrapper.unmount()
  })
})