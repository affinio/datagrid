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

  it("blocks commits while remote options are in a failed load state", async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn()
    const loadOptions = vi.fn().mockRejectedValue(new Error("offline"))
    const wrapper = mount(DataGridFilterableCombobox, {
      props: {
        value: "",
        options: [],
        loadOptions,
      },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(loadOptions).toHaveBeenCalled()
      expect(wrapper.get("input").attributes("aria-invalid")).toBe("true")
    })

    const input = wrapper.get("input")
    await input.trigger("keydown", { key: "Enter" })

    expect(wrapper.emitted("commit")).toBeUndefined()
  })

  it("does not commit or cancel while IME composition owns the key event", async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn()
    const wrapper = mount(DataGridFilterableCombobox, {
      props: {
        value: "open",
        options: [{ label: "Open", value: "open" }],
      },
      attachTo: document.body,
    })

    await nextTick()
    await wrapper.get("input").trigger("keydown", {
      key: "Enter",
      isComposing: true,
    })
    await wrapper.get("input").trigger("keydown", {
      key: "Escape",
      isComposing: true,
    })

    expect(wrapper.emitted("commit")).toBeUndefined()
    expect(wrapper.emitted("cancel")).toBeUndefined()
  })
})
