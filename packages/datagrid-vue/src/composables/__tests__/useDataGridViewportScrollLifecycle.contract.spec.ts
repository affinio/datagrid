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

  it("skips closing the context menu when disabled", () => {
    const closeContextMenu = vi.fn()
    const lifecycle = useDataGridViewportScrollLifecycle({
      isContextMenuVisible: () => true,
      shouldCloseContextMenuOnScroll: () => false,
      closeContextMenu,
      resolveScrollTop: () => 0,
      resolveScrollLeft: () => 0,
      setScrollTop: vi.fn(),
      setScrollLeft: vi.fn(),
      hasInlineEditor: () => false,
      commitInlineEdit: vi.fn(),
    })

    lifecycle.onViewportScroll({
      currentTarget: { scrollTop: 40, scrollLeft: 10 },
    } as unknown as Event)

    expect(closeContextMenu).not.toHaveBeenCalled()
  })

  it("batches updates in raf mode", () => {
    let top = 0
    let left = 0
    const setScrollTop = vi.fn((value: number) => {
      top = value
    })
    const setScrollLeft = vi.fn((value: number) => {
      left = value
    })
    const frames: FrameRequestCallback[] = []

    const lifecycle = useDataGridViewportScrollLifecycle({
      isContextMenuVisible: () => false,
      closeContextMenu: vi.fn(),
      resolveScrollTop: () => top,
      resolveScrollLeft: () => left,
      setScrollTop,
      setScrollLeft,
      hasInlineEditor: () => false,
      commitInlineEdit: vi.fn(),
      scrollUpdateMode: "raf",
      requestAnimationFrame(callback) {
        frames.push(callback)
        return frames.length
      },
      cancelAnimationFrame: vi.fn(),
    })

    lifecycle.onViewportScroll({
      currentTarget: { scrollTop: 10, scrollLeft: 20 },
    } as unknown as Event)
    lifecycle.onViewportScroll({
      currentTarget: { scrollTop: 30, scrollLeft: 40 },
    } as unknown as Event)

    expect(setScrollTop).not.toHaveBeenCalled()
    expect(setScrollLeft).not.toHaveBeenCalled()
    expect(frames.length).toBe(1)

    const callback = frames[0]
    expect(callback).toBeDefined()
    if (!callback) {
      throw new Error("Expected a scheduled animation frame callback")
    }
    callback(0)

    expect(setScrollTop).toHaveBeenCalledTimes(1)
    expect(setScrollLeft).toHaveBeenCalledTimes(1)
    expect(top).toBe(30)
    expect(left).toBe(40)
  })
})
