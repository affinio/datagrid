import { describe, expect, it } from "vitest"
import { createDataGridRowSelectionModelSnapshot } from "../rowSelectionModel.js"
import {
  applyDataGridRowSelectionIntent,
  createDataGridRowSelectionInteractionSnapshot,
  type DataGridSelectableRowRangeResolution,
} from "../rowSelectionInteraction.js"

function resolvedRange(
  rowIds: readonly string[],
  projectionRevision = 1,
): DataGridSelectableRowRangeResolution {
  return { status: "complete", projectionRevision, rowIds }
}

describe("row selection interaction semantics", () => {
  it("keeps row selection interaction state separate from focus and cell selection", () => {
    const selection = createDataGridRowSelectionModelSnapshot(["r1"])
    const interaction = createDataGridRowSelectionInteractionSnapshot("r1", "r1")

    expect([...selection.selectedRowIds]).toEqual(["r1"])
    expect(interaction).toEqual({ anchorRowId: "r1", extentRowId: "r1" })
    expect("focusedRow" in selection).toBe(false)
  })

  it("replaces selection on click and toggles only the target row on additive click", () => {
    const initial = createDataGridRowSelectionModelSnapshot(["r1", "r3"])
    const interaction = createDataGridRowSelectionInteractionSnapshot("r1")

    const replaced = applyDataGridRowSelectionIntent(initial, interaction, { type: "replace", targetRowId: "r2" })
    const toggled = applyDataGridRowSelectionIntent(replaced.selection, replaced.interaction, { type: "toggle", targetRowId: "r2" })

    expect([...replaced.selection.selectedRowIds]).toEqual(["r2"])
    expect(replaced.interaction).toEqual({ anchorRowId: "r2", extentRowId: "r2" })
    expect([...toggled.selection.selectedRowIds]).toEqual([])
    expect(toggled.interaction).toEqual({ anchorRowId: "r2", extentRowId: "r2" })
  })

  it("extends from the row anchor and resets to the target if the anchor left the projection", () => {
    const initial = createDataGridRowSelectionModelSnapshot(["outside"])
    const interaction = createDataGridRowSelectionInteractionSnapshot("r2", "r2")
    const extended = applyDataGridRowSelectionIntent(initial, interaction, {
      type: "extend",
      targetRowId: "r4",
      projectionRevision: 7,
      range: resolvedRange(["r2", "r3", "r4"], 7),
    })
    const missingAnchor = applyDataGridRowSelectionIntent(extended.selection, extended.interaction, {
      type: "extend",
      targetRowId: "r5",
      projectionRevision: 8,
      range: { status: "anchor-missing", projectionRevision: 8, rowIds: ["r5"] },
    })

    expect([...extended.selection.selectedRowIds]).toEqual(["r2", "r3", "r4"])
    expect(extended.interaction).toEqual({ anchorRowId: "r2", extentRowId: "r4" })
    expect([...missingAnchor.selection.selectedRowIds]).toEqual(["r5"])
    expect(missingAnchor.interaction).toEqual({ anchorRowId: "r5", extentRowId: "r5" })
  })

  it("adds each additive range from the session baseline instead of accumulating previous previews", () => {
    const baseline = createDataGridRowSelectionModelSnapshot(["r1", "r5"])
    const interaction = createDataGridRowSelectionInteractionSnapshot("r2", "r2")
    const first = applyDataGridRowSelectionIntent(baseline, interaction, {
      type: "add-range",
      targetRowId: "r3",
      projectionRevision: 2,
      range: resolvedRange(["r2", "r3"], 2),
      baseSelection: baseline,
    })
    const second = applyDataGridRowSelectionIntent(first.selection, first.interaction, {
      type: "add-range",
      targetRowId: "r4",
      projectionRevision: 2,
      range: resolvedRange(["r2", "r3", "r4"], 2),
      baseSelection: baseline,
    })

    expect([...first.selection.selectedRowIds]).toEqual(["r1", "r5", "r2", "r3"])
    expect([...second.selection.selectedRowIds]).toEqual(["r1", "r5", "r2", "r3", "r4"])
  })

  it("rejects incomplete, stale, and unresolved ranges without mutating state", () => {
    const selection = createDataGridRowSelectionModelSnapshot(["r1"])
    const interaction = createDataGridRowSelectionInteractionSnapshot("r1")
    const incomplete = applyDataGridRowSelectionIntent(selection, interaction, {
      type: "extend", targetRowId: "r3", projectionRevision: 3,
      range: { status: "incomplete", projectionRevision: 3, rowIds: ["r1", "r2"] },
    })
    const stale = applyDataGridRowSelectionIntent(selection, interaction, {
      type: "extend", targetRowId: "r3", projectionRevision: 4,
      range: resolvedRange(["r1", "r2", "r3"], 3),
    })
    const unselectable = applyDataGridRowSelectionIntent(selection, interaction, {
      type: "extend", targetRowId: "r3", projectionRevision: 4,
      range: { status: "target-unselectable", projectionRevision: 4, rowIds: ["r1", "r2"] },
    })

    expect(incomplete).toMatchObject({ accepted: false, reason: "incomplete-range" })
    expect(stale).toMatchObject({ accepted: false, reason: "stale-projection" })
    expect(unselectable).toMatchObject({ accepted: false, reason: "target-unselectable" })
    expect(incomplete.selection).toBe(selection)
    expect(stale.interaction).toBe(interaction)
    expect(unselectable.selection).toBe(selection)
  })

  it("rejects a transition when the committed selection changed during the interaction", () => {
    const selection = createDataGridRowSelectionModelSnapshot(["r1"])
    const interaction = createDataGridRowSelectionInteractionSnapshot("r1")
    const conflicted = applyDataGridRowSelectionIntent(selection, interaction, {
      type: "extend",
      targetRowId: "r2",
      projectionRevision: 1,
      expectedSelectionRevision: 3,
      range: resolvedRange(["r1", "r2"], 1),
    })

    expect(conflicted).toMatchObject({ accepted: false, reason: "selection-conflict" })
    expect(conflicted.selection).toBe(selection)
  })
})
