import { describe, expect, it, vi } from "vitest"
import { useDataGridContextMenuActionRouter } from "../useDataGridContextMenuActionRouter"

describe("useDataGridContextMenuActionRouter contract", () => {
  it("routes cell/range actions to clipboard mutations", async () => {
    const copySelection = vi.fn(async () => true)
    const pasteSelection = vi.fn(async () => true)
    const cutSelection = vi.fn(async () => true)
    const clearCurrentSelection = vi.fn(async () => true)

    const router = useDataGridContextMenuActionRouter({
      resolveContextMenuState: () => ({ zone: "range", columnKey: "service" }),
      runHeaderContextAction: vi.fn(() => false),
      copySelection,
      pasteSelection,
      cutSelection,
      clearCurrentSelection,
      closeContextMenu: vi.fn(),
    })

    await expect(router.runContextMenuAction("copy")).resolves.toBe(true)
    await expect(router.runContextMenuAction("paste")).resolves.toBe(true)
    await expect(router.runContextMenuAction("cut")).resolves.toBe(true)
    await expect(router.runContextMenuAction("clear")).resolves.toBe(true)

    expect(copySelection).toHaveBeenCalledWith("context-menu")
    expect(pasteSelection).toHaveBeenCalledWith("context-menu")
    expect(cutSelection).toHaveBeenCalledWith("context-menu")
    expect(clearCurrentSelection).toHaveBeenCalledWith("context-menu")
  })

  it("routes header actions only when column key exists", async () => {
    const runHeaderContextAction = vi.fn(() => true)
    const closeContextMenu = vi.fn()

    const missingColumnRouter = useDataGridContextMenuActionRouter({
      resolveContextMenuState: () => ({ zone: "header", columnKey: null }),
      runHeaderContextAction,
      copySelection: vi.fn(async () => true),
      pasteSelection: vi.fn(async () => true),
      cutSelection: vi.fn(async () => true),
      clearCurrentSelection: vi.fn(async () => true),
      closeContextMenu,
    })

    await expect(missingColumnRouter.runContextMenuAction("sort-asc")).resolves.toBe(false)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(runHeaderContextAction).not.toHaveBeenCalled()

    const headerRouter = useDataGridContextMenuActionRouter({
      resolveContextMenuState: () => ({ zone: "header", columnKey: "latencyMs" }),
      runHeaderContextAction,
      copySelection: vi.fn(async () => true),
      pasteSelection: vi.fn(async () => true),
      cutSelection: vi.fn(async () => true),
      clearCurrentSelection: vi.fn(async () => true),
      closeContextMenu,
    })

    await expect(headerRouter.runContextMenuAction("sort-desc")).resolves.toBe(true)
    expect(runHeaderContextAction).toHaveBeenCalledWith("sort-desc", "latencyMs")
  })

  it("closes menu for unsupported action in non-header zones", async () => {
    const closeContextMenu = vi.fn()
    const router = useDataGridContextMenuActionRouter({
      resolveContextMenuState: () => ({ zone: "cell", columnKey: "service" }),
      runHeaderContextAction: vi.fn(() => false),
      copySelection: vi.fn(async () => true),
      pasteSelection: vi.fn(async () => true),
      cutSelection: vi.fn(async () => true),
      clearCurrentSelection: vi.fn(async () => true),
      closeContextMenu,
    })

    await expect(router.runContextMenuAction("sort-asc")).resolves.toBe(false)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
  })
})
