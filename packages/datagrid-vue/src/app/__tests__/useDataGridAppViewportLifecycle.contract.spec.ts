import { mount } from "@vue/test-utils"
import { defineComponent, h, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridAppViewportLifecycle } from "../useDataGridAppViewportLifecycle"

describe("useDataGridAppViewportLifecycle contract", () => {
  it("wires pointer cancellation, contextmenu capture, blur, and unmount cleanup", async () => {
    const syncViewport = vi.fn()
    const handleWindowMouseMove = vi.fn()
    const handleWindowMouseUp = vi.fn()
    const handleWindowPointerUp = vi.fn()
    const handleWindowPointerCancel = vi.fn()
    const handleWindowBlur = vi.fn()
    const handleWindowContextMenuCapture = vi.fn()
    const dispose = vi.fn()
    const Host = defineComponent({
      setup() {
        const bodyViewportRef = ref<HTMLElement | null>(null)
        useDataGridAppViewportLifecycle({
          bodyViewportRef,
          syncViewport,
          handleWindowMouseMove,
          handleWindowMouseUp,
          handleWindowPointerUp,
          handleWindowPointerCancel,
          handleWindowBlur,
          handleWindowContextMenuCapture,
          dispose: [dispose],
        })
        return () => h("div", {
          ref: element => {
            bodyViewportRef.value = element as HTMLElement | null
          },
        })
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    await wrapper.vm.$nextTick()

    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 1, clientY: 2 }))
    window.dispatchEvent(new Event("pointerup"))
    window.dispatchEvent(new Event("pointercancel"))
    window.dispatchEvent(new Event("blur"))
    window.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))

    expect(handleWindowMouseMove).toHaveBeenCalledTimes(1)
    expect(handleWindowPointerUp).toHaveBeenCalledTimes(1)
    expect(handleWindowPointerCancel).toHaveBeenCalledTimes(1)
    expect(handleWindowBlur).toHaveBeenCalledTimes(1)
    expect(handleWindowContextMenuCapture).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    expect(dispose).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 3, clientY: 4 }))
    window.dispatchEvent(new Event("pointercancel"))
    window.dispatchEvent(new Event("blur"))
    window.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))

    expect(handleWindowMouseMove).toHaveBeenCalledTimes(1)
    expect(handleWindowPointerCancel).toHaveBeenCalledTimes(1)
    expect(handleWindowBlur).toHaveBeenCalledTimes(1)
    expect(handleWindowContextMenuCapture).toHaveBeenCalledTimes(1)
  })
})
