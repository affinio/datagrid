import { describe, expect, it, vi } from "vitest"
import { useDataGridHeaderInteractionRouter } from "../useDataGridHeaderInteractionRouter"

describe("useDataGridHeaderInteractionRouter contract", () => {
  it("applies sort on click only for sortable columns", () => {
    const applySortFromHeader = vi.fn()
    const router = useDataGridHeaderInteractionRouter({
      isSortableColumn: columnKey => columnKey !== "select",
      applySortFromHeader,
      openHeaderContextMenu: vi.fn(),
    })

    router.onHeaderCellClick("service", { shiftKey: true } as MouseEvent)
    router.onHeaderCellClick("select", { shiftKey: true } as MouseEvent)

    expect(applySortFromHeader).toHaveBeenCalledTimes(1)
    expect(applySortFromHeader).toHaveBeenCalledWith("service", true)
  })

  it("opens context menu for keyboard context triggers", () => {
    const openHeaderContextMenu = vi.fn()
    const preventDefault = vi.fn()
    const router = useDataGridHeaderInteractionRouter({
      isSortableColumn: () => true,
      applySortFromHeader: vi.fn(),
      openHeaderContextMenu,
    })

    const target = {
      getBoundingClientRect() {
        return { left: 100, width: 120, bottom: 60 } as DOMRect
      },
    }

    router.onHeaderCellKeyDown("status", {
      key: "ContextMenu",
      shiftKey: false,
      preventDefault,
      currentTarget: target,
    } as unknown as KeyboardEvent)

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(openHeaderContextMenu).toHaveBeenCalledWith(160, 54, "status")
  })

  it("applies sort for Enter/Space and blocks unsupported keys", () => {
    const applySortFromHeader = vi.fn()
    const preventDefault = vi.fn()
    const router = useDataGridHeaderInteractionRouter({
      isSortableColumn: () => true,
      applySortFromHeader,
      openHeaderContextMenu: vi.fn(),
    })

    router.onHeaderCellKeyDown("service", {
      key: "Enter",
      shiftKey: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    router.onHeaderCellKeyDown("service", {
      key: " ",
      shiftKey: true,
      preventDefault,
    } as unknown as KeyboardEvent)

    router.onHeaderCellKeyDown("service", {
      key: "Escape",
      shiftKey: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(applySortFromHeader).toHaveBeenNthCalledWith(1, "service", false)
    expect(applySortFromHeader).toHaveBeenNthCalledWith(2, "service", true)
    expect(applySortFromHeader).toHaveBeenCalledTimes(2)
  })

  it("ignores context-menu shortcut for blocked column key", () => {
    const router = useDataGridHeaderInteractionRouter({
      isSortableColumn: () => true,
      applySortFromHeader: vi.fn(),
      openHeaderContextMenu: vi.fn(),
    })
    const preventDefault = vi.fn()

    router.onHeaderCellKeyDown("select", {
      key: "ContextMenu",
      shiftKey: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(preventDefault).not.toHaveBeenCalled()
  })
})
