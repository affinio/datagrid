import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridTableStageScrollSync } from "../useDataGridTableStageScrollSync"

function createService(options: { isColumnResizing?: boolean } = {}) {
  const stopColumnResize = vi.fn()
  const handleInteractionWindowContextMenuCapture = vi.fn(() => false)
  const service = useDataGridTableStageScrollSync({
    isColumnResizing: ref(options.isColumnResizing === true),
    applyColumnResizeFromPointer: vi.fn(),
    stopColumnResize,
    handleInteractionWindowMouseMove: vi.fn(),
    handleInteractionWindowMouseUp: vi.fn(),
    handleInteractionWindowPointerUp: vi.fn(),
    handleInteractionWindowPointerCancel: vi.fn(),
    handleInteractionWindowBlur: vi.fn(),
    handleInteractionWindowContextMenuCapture,
  })
  return { service, stopColumnResize, handleInteractionWindowContextMenuCapture }
}

describe("useDataGridTableStageScrollSync", () => {
  it("stops column resize before delegating pointer lifecycle cleanup", () => {
    const handleInteractionWindowPointerCancel = vi.fn()
    const stopColumnResize = vi.fn()
    const service = useDataGridTableStageScrollSync({
      isColumnResizing: ref(true),
      applyColumnResizeFromPointer: vi.fn(),
      stopColumnResize,
      handleInteractionWindowMouseMove: vi.fn(),
      handleInteractionWindowMouseUp: vi.fn(),
      handleInteractionWindowPointerUp: vi.fn(),
      handleInteractionWindowPointerCancel,
      handleInteractionWindowBlur: vi.fn(),
      handleInteractionWindowContextMenuCapture: vi.fn(() => false),
    })

    service.handleWindowPointerCancel(new Event("pointercancel") as PointerEvent)

    expect(stopColumnResize).toHaveBeenCalledTimes(1)
    expect(handleInteractionWindowPointerCancel).toHaveBeenCalledTimes(1)
  })

  it("routes mouse move into column resize while resize owns the gesture", () => {
    const applyColumnResizeFromPointer = vi.fn()
    const handleInteractionWindowMouseMove = vi.fn()
    const service = useDataGridTableStageScrollSync({
      isColumnResizing: ref(true),
      applyColumnResizeFromPointer,
      stopColumnResize: vi.fn(),
      handleInteractionWindowMouseMove,
      handleInteractionWindowMouseUp: vi.fn(),
      handleInteractionWindowPointerUp: vi.fn(),
      handleInteractionWindowPointerCancel: vi.fn(),
      handleInteractionWindowBlur: vi.fn(),
      handleInteractionWindowContextMenuCapture: vi.fn(() => false),
    })

    service.handleWindowMouseMove(new MouseEvent("mousemove", { clientX: 148 }))

    expect(applyColumnResizeFromPointer).toHaveBeenCalledWith(148)
    expect(handleInteractionWindowMouseMove).not.toHaveBeenCalled()
  })

  it("delegates mouse move when column resize is idle", () => {
    const applyColumnResizeFromPointer = vi.fn()
    const handleInteractionWindowMouseMove = vi.fn()
    const service = useDataGridTableStageScrollSync({
      isColumnResizing: ref(false),
      applyColumnResizeFromPointer,
      stopColumnResize: vi.fn(),
      handleInteractionWindowMouseMove,
      handleInteractionWindowMouseUp: vi.fn(),
      handleInteractionWindowPointerUp: vi.fn(),
      handleInteractionWindowPointerCancel: vi.fn(),
      handleInteractionWindowBlur: vi.fn(),
      handleInteractionWindowContextMenuCapture: vi.fn(() => false),
    })
    const event = new MouseEvent("mousemove", { clientX: 148 })

    service.handleWindowMouseMove(event)

    expect(applyColumnResizeFromPointer).not.toHaveBeenCalled()
    expect(handleInteractionWindowMouseMove).toHaveBeenCalledWith(event)
  })

  it("prevents context menu while column resize owns the gesture", () => {
    const { service, stopColumnResize, handleInteractionWindowContextMenuCapture } = createService({
      isColumnResizing: true,
    })
    const event = new MouseEvent("contextmenu", { cancelable: true })

    expect(service.handleWindowContextMenuCapture(event)).toBe(true)

    expect(event.defaultPrevented).toBe(true)
    expect(stopColumnResize).toHaveBeenCalledTimes(1)
    expect(handleInteractionWindowContextMenuCapture).toHaveBeenCalledTimes(1)
  })

  it("delegates context menu when column resize is idle", () => {
    const { service, stopColumnResize, handleInteractionWindowContextMenuCapture } = createService()
    const event = new MouseEvent("contextmenu", { cancelable: true })

    expect(service.handleWindowContextMenuCapture(event)).toBe(false)

    expect(event.defaultPrevented).toBe(false)
    expect(stopColumnResize).not.toHaveBeenCalled()
    expect(handleInteractionWindowContextMenuCapture).toHaveBeenCalledTimes(1)
  })
})
