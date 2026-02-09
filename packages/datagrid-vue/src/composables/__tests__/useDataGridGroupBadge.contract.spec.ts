import { describe, expect, it } from "vitest"
import { useDataGridGroupBadge } from "../useDataGridGroupBadge"

describe("useDataGridGroupBadge contract", () => {
  const badge = useDataGridGroupBadge<{ rowId: string }>({
    resolveRowId: row => row.rowId,
    isGroupedByColumn: columnKey => columnKey === "service",
    isGroupStartRowId: rowId => rowId === "r2",
    resolveGroupBadgeTextByRowId: rowId => `Group ${rowId}`,
  })

  it("resolves group start row and badge visibility", () => {
    expect(badge.isGroupStartRow({ rowId: "r2" })).toBe(true)
    expect(badge.isGroupStartRow({ rowId: "r3" })).toBe(false)
    expect(badge.shouldShowGroupBadge({ rowId: "r2" }, "service")).toBe(true)
    expect(badge.shouldShowGroupBadge({ rowId: "r2" }, "owner")).toBe(false)
  })

  it("resolves badge text by row id", () => {
    expect(badge.resolveGroupBadgeText({ rowId: "r2" })).toBe("Group r2")
  })
})
