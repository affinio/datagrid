import { describe, expect, it, vi } from "vitest"
import {
  createDataGridRowSelectionInteractionSnapshot,
  createDataGridRowSelectionModelSnapshot,
} from "@affino/datagrid-core"
import { createDataGridRowSelectionSessionController } from "../selection/createDataGridRowSelectionSessionController"

describe("createDataGridRowSelectionSessionController", () => {
  it("owns one session, publishes previews, and commits only on completion", () => {
    let selection = createDataGridRowSelectionModelSnapshot(["r5"])
    let interaction = createDataGridRowSelectionInteractionSnapshot("r2", "r2")
    const preview = vi.fn()
    const release = vi.fn()
    const controller = createDataGridRowSelectionSessionController({
      getSelection: () => selection,
      getInteraction: () => interaction,
      getProjectionRevision: () => 3,
      resolveRange: (_anchor, target) => ({
        status: "complete", projectionRevision: 3,
        rowIds: target === "r4" ? ["r2", "r3", "r4"] : ["r2", "r3"],
      }),
      commit: (nextSelection, nextInteraction) => {
        selection = nextSelection
        interaction = nextInteraction
      },
      publishPreview: preview,
      acquireInteractionOwner: () => release,
    })

    expect(controller.begin("r2", "replace")).toBe(true)
    expect(controller.begin("r2", "replace")).toBe(false)
    controller.update("r4")
    controller.update("r3")

    expect([...selection.selectedRowIds]).toEqual(["r5"])
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({
      selection: expect.objectContaining({ selectedRowIds: expect.anything() }),
      interaction: { anchorRowId: "r2", extentRowId: "r3" },
    }))

    const result = controller.commit()
    expect(result?.accepted).toBe(true)
    expect([...selection.selectedRowIds]).toEqual(["r2", "r3"])
    expect(interaction).toEqual({ anchorRowId: "r2", extentRowId: "r3" })
    expect(preview).toHaveBeenLastCalledWith(null)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("cancels preview and releases its owner without committing", () => {
    const selection = createDataGridRowSelectionModelSnapshot(["r1"])
    const publishPreview = vi.fn()
    const release = vi.fn()
    const commit = vi.fn()
    const controller = createDataGridRowSelectionSessionController({
      getSelection: () => selection,
      getInteraction: () => createDataGridRowSelectionInteractionSnapshot("r1"),
      getProjectionRevision: () => 1,
      resolveRange: (_anchor, target) => ({
        status: "complete", projectionRevision: 1, rowIds: ["r1", target],
      }),
      commit,
      publishPreview,
      acquireInteractionOwner: () => release,
    })

    controller.begin("r1", "replace")
    controller.update("r2")
    const result = controller.cancel()

    expect(result?.selection).toBe(selection)
    expect(commit).not.toHaveBeenCalled()
    expect(publishPreview).toHaveBeenLastCalledWith(null)
    expect(release).toHaveBeenCalledTimes(1)
    expect(controller.getSession()).toBeNull()
  })

  it("refuses ownership conflicts and releases ownership on invalidation", () => {
    const selection = createDataGridRowSelectionModelSnapshot()
    const acquireInteractionOwner = vi.fn(() => null)
    const controller = createDataGridRowSelectionSessionController({
      getSelection: () => selection,
      getInteraction: () => createDataGridRowSelectionInteractionSnapshot(),
      getProjectionRevision: () => 1,
      resolveRange: () => ({ status: "stale", projectionRevision: 0, rowIds: [] }),
      commit: vi.fn(),
      publishPreview: vi.fn(),
      acquireInteractionOwner,
    })

    expect(controller.begin("r1", "replace")).toBe(false)
    expect(controller.getSession()).toBeNull()
    expect(acquireInteractionOwner).toHaveBeenCalledWith("row-selection")
  })

  it("cancels and releases when projection changes during the session", () => {
    const selection = createDataGridRowSelectionModelSnapshot()
    let projectionRevision = 1
    const release = vi.fn()
    const publishPreview = vi.fn()
    const controller = createDataGridRowSelectionSessionController({
      getSelection: () => selection,
      getInteraction: () => createDataGridRowSelectionInteractionSnapshot("r1"),
      getProjectionRevision: () => projectionRevision,
      resolveRange: () => ({ status: "complete", projectionRevision: 1, rowIds: ["r1", "r2"] }),
      commit: vi.fn(),
      publishPreview,
      acquireInteractionOwner: () => release,
    })

    controller.begin("r1", "replace")
    controller.update("r2")
    projectionRevision = 2
    const result = controller.update("r3")

    expect(result).toMatchObject({ accepted: false, reason: "stale-projection" })
    expect(controller.getSession()).toBeNull()
    expect(publishPreview).toHaveBeenLastCalledWith(null)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("releases ownership if reading initial state fails", () => {
    const release = vi.fn()
    const controller = createDataGridRowSelectionSessionController({
      getSelection: () => { throw new Error("state unavailable") },
      getInteraction: () => createDataGridRowSelectionInteractionSnapshot(),
      getProjectionRevision: () => 1,
      resolveRange: () => ({ status: "complete", projectionRevision: 1, rowIds: [] }),
      commit: vi.fn(),
      publishPreview: vi.fn(),
      acquireInteractionOwner: () => release,
    })

    expect(() => controller.begin("r1", "replace")).toThrow("state unavailable")
    expect(controller.getSession()).toBeNull()
    expect(release).toHaveBeenCalledOnce()
  })
})
