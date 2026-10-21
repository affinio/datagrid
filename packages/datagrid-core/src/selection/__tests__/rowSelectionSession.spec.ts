import { describe, expect, it } from "vitest"
import {
  createDataGridRowSelectionModelSnapshot,
  toggleDataGridRowSelectionModelRow,
} from "../rowSelectionModel.js"
import {
  beginDataGridRowSelectionSession,
  cancelDataGridRowSelectionSession,
  commitDataGridRowSelectionSession,
  updateDataGridRowSelectionSession,
} from "../rowSelectionSession.js"
import { createDataGridRowSelectionInteractionSnapshot } from "../rowSelectionInteraction.js"

describe("row selection interaction session", () => {
  it("recomputes drag previews from the initial selection and commits once", () => {
    const selection = createDataGridRowSelectionModelSnapshot(["r5"])
    const interaction = createDataGridRowSelectionInteractionSnapshot("r2", "r2")
    const session = beginDataGridRowSelectionSession({
      sessionId: "drag-1", projectionRevision: 4, selection, interaction,
      targetRowId: "r2", operation: "replace",
    })
    const widePreview = updateDataGridRowSelectionSession(session, selection, 4, "r4", {
      status: "complete", projectionRevision: 4, rowIds: ["r2", "r3", "r4"],
    })
    const narrowPreview = updateDataGridRowSelectionSession(widePreview.session!, selection, 4, "r3", {
      status: "complete", projectionRevision: 4, rowIds: ["r2", "r3"],
    })
    const committed = commitDataGridRowSelectionSession(narrowPreview.session!, selection, 4)

    expect([...widePreview.session!.previewSelection!.selectedRowIds]).toEqual(["r2", "r3", "r4"])
    expect([...narrowPreview.session!.previewSelection!.selectedRowIds]).toEqual(["r2", "r3"])
    expect([...selection.selectedRowIds]).toEqual(["r5"])
    expect(committed.selection.revision).toBe(selection.revision + 1)
    expect([...committed.selection.selectedRowIds]).toEqual(["r2", "r3"])
    expect(committed.interaction).toEqual({ anchorRowId: "r2", extentRowId: "r3" })
  })

  it("keeps additive drag previews based on the original selection", () => {
    const selection = createDataGridRowSelectionModelSnapshot(["r1", "r5"])
    const session = beginDataGridRowSelectionSession({
      sessionId: "drag-add", projectionRevision: 2, selection,
      interaction: createDataGridRowSelectionInteractionSnapshot("r2"),
      targetRowId: "r2", operation: "add",
    })
    const first = updateDataGridRowSelectionSession(session, selection, 2, "r3", {
      status: "complete", projectionRevision: 2, rowIds: ["r2", "r3"],
    })
    const second = updateDataGridRowSelectionSession(first.session!, selection, 2, "r4", {
      status: "complete", projectionRevision: 2, rowIds: ["r2", "r3", "r4"],
    })

    expect([...second.session!.previewSelection!.selectedRowIds]).toEqual(["r1", "r5", "r2", "r3", "r4"])
    expect([...selection.selectedRowIds]).toEqual(["r1", "r5"])
  })

  it("cancels without changing the committed selection and restores interaction anchor", () => {
    const selection = createDataGridRowSelectionModelSnapshot(["r1"])
    const interaction = createDataGridRowSelectionInteractionSnapshot("r1", "r1")
    const session = beginDataGridRowSelectionSession({
      sessionId: "drag-cancel", projectionRevision: 1, selection, interaction,
      targetRowId: "r1", operation: "replace",
    })
    const cancelled = cancelDataGridRowSelectionSession(session, selection)

    expect(cancelled.selection).toBe(selection)
    expect(cancelled.interaction).toBe(interaction)
    expect(cancelled.session).toBeNull()
  })

  it("invalidates a session after projection or committed-selection changes", () => {
    const selection = createDataGridRowSelectionModelSnapshot(["r1"])
    const session = beginDataGridRowSelectionSession({
      sessionId: "drag-stale", projectionRevision: 1, selection,
      interaction: createDataGridRowSelectionInteractionSnapshot("r1"),
      targetRowId: "r1", operation: "replace",
    })
    const staleProjection = updateDataGridRowSelectionSession(session, selection, 2, "r2", {
      status: "complete", projectionRevision: 1, rowIds: ["r1", "r2"],
    })
    const changedSelection = toggleDataGridRowSelectionModelRow(selection, "r3")
    const conflict = updateDataGridRowSelectionSession(session, changedSelection, 1, "r2", {
      status: "complete", projectionRevision: 1, rowIds: ["r1", "r2"],
    })

    expect(staleProjection).toMatchObject({ accepted: false, reason: "stale-projection", session: null })
    expect(conflict).toMatchObject({ accepted: false, reason: "selection-conflict", session: null })
  })
})
