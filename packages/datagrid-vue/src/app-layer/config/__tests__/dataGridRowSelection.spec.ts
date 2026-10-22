import { describe, expect, it, vi } from "vitest"
import { resolveDataGridRowHeader, resolveDataGridRowSelection } from "../dataGridRowSelection"

describe("DataGrid row selection configuration", () => {
  it("keeps cell selection as the row-header default and accepts record selection", () => {
    expect(resolveDataGridRowHeader(undefined)).toEqual({ action: "select-cells" })
    expect(resolveDataGridRowHeader({ action: "select-records" })).toEqual({ action: "select-records" })
    expect(resolveDataGridRowHeader({ action: "none" })).toEqual({ action: "none" })
  })

  it("preserves the selectable-row predicate while resolving row-selection options", () => {
    const isSelectable = vi.fn(() => true)
    expect(resolveDataGridRowSelection({ isSelectable })).toMatchObject({
      enabled: true,
      columnWidth: 48,
      isSelectable,
    })
    expect(resolveDataGridRowSelection({ columnWidth: 64 }).columnWidth).toBe(64)
    expect(resolveDataGridRowSelection(false).enabled).toBe(false)
  })
})
