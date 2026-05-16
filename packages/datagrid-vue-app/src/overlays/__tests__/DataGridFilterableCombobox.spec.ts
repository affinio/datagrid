import { nextTick } from "vue"
import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import DataGridFilterableCombobox from "../DataGridFilterableCombobox.vue"

const originalRequestAnimationFrame = window.requestAnimationFrame
const originalCancelAnimationFrame = window.cancelAnimationFrame
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

describe("DataGridFilterableCombobox", () => {
  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("batches viewport scroll reposition work through requestAnimationFrame", async () => {
    let frameCallback: FrameRequestCallback | null = null
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelAnimationFrame = vi.fn()
    window.requestAnimationFrame = requestAnimationFrame
    window.cancelAnimationFrame = cancelAnimationFrame
    HTMLElement.prototype.scrollIntoView = vi.fn()

    const wrapper = mount(DataGridFilterableCombobox, {
      props: {
        value: "open",
        options: [{ label: "Open", value: "open" }],
      },
      attachTo: document.body,
    })
    await nextTick()

    window.dispatchEvent(new Event("scroll"))
    window.dispatchEvent(new Event("scroll"))

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrame).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7)
    frameCallback?.(performance.now())
  })
})
