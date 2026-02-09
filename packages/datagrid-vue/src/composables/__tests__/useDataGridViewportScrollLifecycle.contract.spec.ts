import { describe, expect, it, vi } from "vitest"
import { useDataGridViewportScrollLifecycle } from "../useDataGridViewportScrollLifecycle"

describe("useDataGridViewportScrollLifecycle contract", () => {
  it("syncs viewport scroll position and closes context menu", () => {
    let top = 0
    let left = 0
    const closeContextMenu = vi.fn()
    const commitInlineEdit = vi.fn()
    const lifecycle = useDataGridViewportScrollLifecycle({
      isContextMenuVisible: () => true,
      closeContextMenu,
      resolveScrollTop: () => top,
      resolveScrollLeft: () => left,
      setScrollTop(value) {
        top = value
      },
      setScrollLeft(value) {
        left = value
      },
      hasInlineEditor: () => true,
      commitInlineEdit,
    })

    lifecycle.onViewportScroll({
      currentTarget: { scrollTop: 120, scrollLeft: 35 },
    } as unknown as Event)

    expect(top).toBe(120)
    expect(left).toBe(35)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(commitInlineEdit).toHaveBeenCalledTimes(1)
  })

  it("does not write unchanged scroll values", () => {
    const setScrollTop = vi.fn()
    const setScrollLeft = vi.fn()
    const lifecycle = useDataGridViewportScrollLifecycle({
      isContextMenuVisible: () => false,
      closeContextMenu: vi.fn(),
      resolveScrollTop: () => 10,
      resolveScrollLeft: () => 20,
      setScrollTop,
      setScrollLeft,
      hasInlineEditor: () => false,
      commitInlineEdit: vi.fn(),
    })

    lifecycle.onViewportScroll({
      currentTarget: { scrollTop: 10, scrollLeft: 20 },
    } as unknown as Event)

    expect(setScrollTop).not.toHaveBeenCalled()
    expect(setScrollLeft).not.toHaveBeenCalled()
  })
})
