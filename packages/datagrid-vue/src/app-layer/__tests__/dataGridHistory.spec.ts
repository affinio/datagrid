import { describe, expect, it } from "vitest"
import { resolveDataGridHistory } from "../dataGridHistory"

describe("DataGrid history retention defaults", () => {
  it("uses a finite default while preserving explicit depths and disabled history", () => {
    expect(resolveDataGridHistory(undefined).depth).toBe(100)
    expect(resolveDataGridHistory({ depth: 24 }).depth).toBe(24)
    expect(resolveDataGridHistory({ depth: Number.POSITIVE_INFINITY }).depth).toBe(Number.POSITIVE_INFINITY)
    expect(resolveDataGridHistory(false)).toMatchObject({ enabled: false, depth: undefined })
  })
})
