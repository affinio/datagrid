import { describe, expect, it } from "vitest"
import { selectDataGridRows } from "../rowSelection"

describe("rowSelection bulk helpers", () => {
  it("merges bulk row ids without duplicating existing selections", () => {
    const snapshot = selectDataGridRows({
      focusedRow: "r1",
      selectedRows: ["r1", "r2"],
    }, ["r2", "r3", "r3", "r4"])

    expect(snapshot).toEqual({
      focusedRow: "r1",
      selectedRows: ["r1", "r2", "r3", "r4"],
    })
  })

  it("handles 1k bulk row ids within a coarse runtime budget", () => {
    const rowIds = Array.from({ length: 1000 }, (_unused, index) => `r${index}`)
    const startedAt = performance.now()
    const snapshot = selectDataGridRows(null, rowIds)
    const durationMs = performance.now() - startedAt

    expect(snapshot.selectedRows).toHaveLength(1000)
    expect(durationMs).toBeLessThan(50)
  })

  it("handles 10k bulk row ids within a coarse runtime budget", () => {
    const rowIds = Array.from({ length: 10000 }, (_unused, index) => `r${index}`)
    const startedAt = performance.now()
    const snapshot = selectDataGridRows(null, rowIds)
    const durationMs = performance.now() - startedAt

    expect(snapshot.selectedRows).toHaveLength(10000)
    expect(durationMs).toBeLessThan(250)
  })
})