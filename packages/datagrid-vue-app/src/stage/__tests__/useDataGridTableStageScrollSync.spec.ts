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
  const service = useDataGridTableStageScrollSync({
    bodyViewportRef: ref(bodyViewport),
    isColumnResizing: ref(false),
    applyColumnResizeFromPointer: vi.fn(),
    stopColumnResize: vi.fn(),
    handleInteractionWindowMouseMove: vi.fn(),
    handleInteractionWindowMouseUp: vi.fn(),
    syncViewport,
  })
  return { service, syncViewport }
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
})
