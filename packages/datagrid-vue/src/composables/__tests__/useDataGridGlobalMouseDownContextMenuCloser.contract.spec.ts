import { describe, expect, it, vi } from "vitest"
import { useDataGridGlobalMouseDownContextMenuCloser } from "../useDataGridGlobalMouseDownContextMenuCloser"

describe("useDataGridGlobalMouseDownContextMenuCloser contract", () => {
  it("does nothing when context menu is not visible", () => {
    const closeContextMenu = vi.fn()
    const closer = useDataGridGlobalMouseDownContextMenuCloser({
      isContextMenuVisible: () => false,
      resolveContextMenuElement: () => null,
      closeContextMenu,
    })

    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    expect(closer.dispatchGlobalMouseDown(event)).toBe(false)
    expect(closeContextMenu).not.toHaveBeenCalled()
  })

  it("keeps menu open for clicks inside menu", () => {
    const closeContextMenu = vi.fn()
    const menu = document.createElement("div")
    const child = document.createElement("button")
    menu.appendChild(child)

    const closer = useDataGridGlobalMouseDownContextMenuCloser({
      isContextMenuVisible: () => true,
      resolveContextMenuElement: () => menu,
      closeContextMenu,
    })

    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "target", { value: child })
    expect(closer.dispatchGlobalMouseDown(event)).toBe(false)
    expect(closeContextMenu).not.toHaveBeenCalled()
  })

  it("closes menu for outside click", () => {
    const closeContextMenu = vi.fn()
    const menu = document.createElement("div")
    const outside = document.createElement("div")

    const closer = useDataGridGlobalMouseDownContextMenuCloser({
      isContextMenuVisible: () => true,
      resolveContextMenuElement: () => menu,
      closeContextMenu,
    })

    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "target", { value: outside })
    expect(closer.dispatchGlobalMouseDown(event)).toBe(true)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
  })
})
