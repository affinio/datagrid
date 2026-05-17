import { describe, expect, it, vi } from "vitest"
import { useDataGridViewportBlurHandler } from "../useDataGridViewportBlurHandler"

describe("useDataGridViewportBlurHandler contract", () => {
  it("keeps interactions when focus stays inside viewport or menu", () => {
    const stopDragSelection = vi.fn()
    const stopFillSelection = vi.fn()
    const stopRangeMove = vi.fn()
    const stopColumnResize = vi.fn()
    const closeContextMenu = vi.fn()
    const commitInlineEdit = vi.fn(() => true)

    const viewport = document.createElement("div")
    const viewportChild = document.createElement("button")
    viewport.appendChild(viewportChild)

    const menu = document.createElement("div")
    const menuItem = document.createElement("button")
    menu.appendChild(menuItem)

    const handler = useDataGridViewportBlurHandler({
      resolveViewportElement: () => viewport,
      resolveContextMenuElement: () => menu,
      stopDragSelection,
      stopFillSelection,
      stopRangeMove,
      stopColumnResize,
      closeContextMenu,
      hasInlineEditor: () => true,
      commitInlineEdit,
    })

    const toViewportEvent = new FocusEvent("blur", { relatedTarget: viewportChild })
    expect(handler.handleViewportBlur(toViewportEvent)).toBe(false)

    const toMenuEvent = new FocusEvent("blur", { relatedTarget: menuItem })
    expect(handler.handleViewportBlur(toMenuEvent)).toBe(false)

    expect(stopDragSelection).not.toHaveBeenCalled()
    expect(stopFillSelection).not.toHaveBeenCalled()
    expect(stopRangeMove).not.toHaveBeenCalled()
    expect(stopColumnResize).not.toHaveBeenCalled()
    expect(closeContextMenu).not.toHaveBeenCalled()
    expect(commitInlineEdit).not.toHaveBeenCalled()
  })

  it("stops interactions and commits inline editor on external blur", () => {
    const stopDragSelection = vi.fn()
    const stopFillSelection = vi.fn()
    const stopRangeMove = vi.fn()
    const stopColumnResize = vi.fn()
    const closeContextMenu = vi.fn()
    const commitInlineEdit = vi.fn(() => true)

    const handler = useDataGridViewportBlurHandler({
      resolveViewportElement: () => document.createElement("div"),
      resolveContextMenuElement: () => document.createElement("div"),
      stopDragSelection,
      stopFillSelection,
      stopRangeMove,
      stopColumnResize,
      closeContextMenu,
      hasInlineEditor: () => true,
      commitInlineEdit,
    })

    const outside = document.createElement("input")
    const blurEvent = new FocusEvent("blur", { relatedTarget: outside })
    expect(handler.handleViewportBlur(blurEvent)).toBe(true)

    expect(stopDragSelection).toHaveBeenCalledTimes(1)
    expect(stopFillSelection).toHaveBeenCalledWith(false)
    expect(stopRangeMove).toHaveBeenCalledWith(false)
    expect(stopColumnResize).toHaveBeenCalledTimes(1)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(commitInlineEdit).toHaveBeenCalledTimes(1)
  })

  it("defers null-target blur cleanup and cancels it when focus returns to the viewport", () => {
    const stopDragSelection = vi.fn()
    const stopFillSelection = vi.fn()
    const stopRangeMove = vi.fn()
    const stopColumnResize = vi.fn()
    const closeContextMenu = vi.fn()
    const commitInlineEdit = vi.fn(() => true)
    const rafCallbacks: FrameRequestCallback[] = []
    const viewport = document.createElement("div")
    const viewportChild = document.createElement("button")
    viewport.appendChild(viewportChild)
    document.body.appendChild(viewport)
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })

    const handler = useDataGridViewportBlurHandler({
      resolveViewportElement: () => viewport,
      resolveContextMenuElement: () => document.createElement("div"),
      stopDragSelection,
      stopFillSelection,
      stopRangeMove,
      stopColumnResize,
      closeContextMenu,
      hasInlineEditor: () => true,
      commitInlineEdit,
    })

    expect(handler.handleViewportBlur(new FocusEvent("blur", { relatedTarget: null }))).toBe(true)
    viewportChild.focus()
    rafCallbacks[0]?.(0)
    rafCallbacks[1]?.(0)

    expect(stopDragSelection).not.toHaveBeenCalled()
    expect(stopFillSelection).not.toHaveBeenCalled()
    expect(stopRangeMove).not.toHaveBeenCalled()
    expect(stopColumnResize).not.toHaveBeenCalled()
    expect(closeContextMenu).not.toHaveBeenCalled()
    expect(commitInlineEdit).not.toHaveBeenCalled()

    rafSpy.mockRestore()
    viewport.remove()
  })
})
