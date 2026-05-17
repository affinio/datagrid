import { describe, expect, it } from "vitest"
import { resolveDataGridAppInteractionOwnerSnapshot } from "../dataGridInteractionOwner"

describe("dataGridInteractionOwner", () => {
  it("reports no owner when every interaction is idle", () => {
    expect(resolveDataGridAppInteractionOwnerSnapshot({})).toEqual({
      owner: null,
      activeOwners: [],
      hasConflict: false,
    })
  })

  it("reports the single active owner", () => {
    expect(resolveDataGridAppInteractionOwnerSnapshot({ fill: true })).toEqual({
      owner: "fill",
      activeOwners: ["fill"],
      hasConflict: false,
    })
  })

  it("reports a conflict when multiple owners are active", () => {
    expect(resolveDataGridAppInteractionOwnerSnapshot({
      dragSelection: true,
      rowResize: true,
    })).toEqual({
      owner: null,
      activeOwners: ["drag-selection", "row-resize"],
      hasConflict: true,
    })
  })
})
