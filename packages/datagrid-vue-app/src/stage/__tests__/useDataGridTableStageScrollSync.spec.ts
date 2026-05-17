import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridTableStageScrollSync } from "../useDataGridTableStageScrollSync"

function createViewport(scrollLeft: number): HTMLElement {
  const element = document.createElement("div")
  element.scrollLeft = scrollLeft
  return element
}

function createService(bodyViewport: HTMLElement | null) {
  const syncViewport = vi.fn()
  const stopColumnResize = vi.fn()
  const handleInteractionWindowContextMenuCapture = vi.fn(() => false)
  const service = useDataGridTableStageScrollSync({
    bodyViewportRef: ref(bodyViewport),
    isColumnResizing: ref(false),
    applyColumnResizeFromPointer: vi.fn(),
    stopColumnResize,
    handleInteractionWindowMouseMove: vi.fn(),
    handleInteractionWindowMouseUp: vi.fn(),
    handleInteractionWindowPointerUp: vi.fn(),
    handleInteractionWindowPointerCancel: vi.fn(),
    handleInteractionWindowBlur: vi.fn(),
    handleInteractionWindowContextMenuCapture,
    syncViewport,
  })
  return { service, syncViewport, stopColumnResize, handleInteractionWindowContextMenuCapture }
}

describe("useDataGridTableStageScrollSync", () => {
  it("does not synthesize a viewport sync when header scrollLeft is already aligned", () => {
    const bodyViewport = createViewport(48)
    const headerViewport = createViewport(48)
    const { service, syncViewport } = createService(bodyViewport)

    service.handleHeaderScroll({ target: headerViewport } as unknown as Event)

    expect(syncViewport).not.toHaveBeenCalled()
    expect(bodyViewport.scrollLeft).toBe(48)
  })

  it("synthesizes a viewport sync when header scrollLeft changes", () => {
    const bodyViewport = createViewport(12)
    const headerViewport = createViewport(96)
    const { service, syncViewport } = createService(bodyViewport)

    service.handleHeaderScroll({ target: headerViewport } as unknown as Event)

    expect(bodyViewport.scrollLeft).toBe(96)
    expect(syncViewport).toHaveBeenCalledTimes(1)
  })

  it("samples header scrollLeft once when syncing the body viewport", () => {
    const bodyViewport = createViewport(12)
    const headerViewport = createViewport(0)
    let headerScrollLeftReads = 0
    Object.defineProperty(headerViewport, "scrollLeft", {
      configurable: true,
      get() {
        headerScrollLeftReads += 1
        return 96
      },
    })
    const { service, syncViewport } = createService(bodyViewport)

    service.handleHeaderScroll({ target: headerViewport } as unknown as Event)

    expect(bodyViewport.scrollLeft).toBe(96)
    expect(syncViewport).toHaveBeenCalledTimes(1)
    expect(headerScrollLeftReads).toBe(1)
  })

  it("stops column resize before delegating pointer lifecycle cleanup", () => {
    const bodyViewport = createViewport(0)
    const stopColumnResize = vi.fn()
    const handleInteractionWindowPointerCancel = vi.fn()
    const isColumnResizing = ref(true)
    const service = useDataGridTableStageScrollSync({
      bodyViewportRef: ref(bodyViewport),
      isColumnResizing,
      applyColumnResizeFromPointer: vi.fn(),
      stopColumnResize,
      handleInteractionWindowMouseMove: vi.fn(),
      handleInteractionWindowMouseUp: vi.fn(),
      handleInteractionWindowPointerUp: vi.fn(),
      handleInteractionWindowPointerCancel,
      handleInteractionWindowBlur: vi.fn(),
      handleInteractionWindowContextMenuCapture: vi.fn(() => false),
      syncViewport: vi.fn(),
    })

    service.handleWindowPointerCancel(new Event("pointercancel") as PointerEvent)

    expect(stopColumnResize).toHaveBeenCalledTimes(1)
    expect(handleInteractionWindowPointerCancel).toHaveBeenCalledTimes(1)
  })

  it("prevents context menu while column resize owns the gesture", () => {
    const bodyViewport = createViewport(0)
    const stopColumnResize = vi.fn()
    const handleInteractionWindowContextMenuCapture = vi.fn(() => false)
    const service = useDataGridTableStageScrollSync({
      bodyViewportRef: ref(bodyViewport),
      isColumnResizing: ref(true),
      applyColumnResizeFromPointer: vi.fn(),
      stopColumnResize,
      handleInteractionWindowMouseMove: vi.fn(),
      handleInteractionWindowMouseUp: vi.fn(),
      handleInteractionWindowPointerUp: vi.fn(),
      handleInteractionWindowPointerCancel: vi.fn(),
      handleInteractionWindowBlur: vi.fn(),
      handleInteractionWindowContextMenuCapture,
      syncViewport: vi.fn(),
    })
    const event = new MouseEvent("contextmenu", { cancelable: true })

    expect(service.handleWindowContextMenuCapture(event)).toBe(true)

    expect(event.defaultPrevented).toBe(true)
    expect(stopColumnResize).toHaveBeenCalledTimes(1)
    expect(handleInteractionWindowContextMenuCapture).toHaveBeenCalledTimes(1)
  })
})
