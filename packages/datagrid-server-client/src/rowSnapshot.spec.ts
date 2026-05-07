import { describe, expect, it } from "vitest"
import { normalizeRowSnapshots } from "./rowSnapshot"

describe("normalizeRowSnapshots", () => {
  it("normalizes raw rows", () => {
    const result = normalizeRowSnapshots([
      { id: "r1", index: 3, value: 10 },
    ])

    expect(result).toEqual([
      {
        index: 3,
        rowId: "r1",
        row: { id: "r1", index: 3, value: 10 },
      },
    ])
  })

  it("preserves entry rows", () => {
    const result = normalizeRowSnapshots([
      {
        rowId: "r2",
        index: 4,
        row: { id: "r2", index: 4, value: 20 },
        kind: "group",
        groupMeta: { groupKey: "g" },
        state: { selected: true },
      },
    ])

    expect(result).toEqual([
      {
        index: 4,
        rowId: "r2",
        row: { id: "r2", index: 4, value: 20 },
        kind: "group",
        groupMeta: { groupKey: "g" },
        state: { selected: true },
      },
    ])
  })

  it("filters invalid rows", () => {
    expect(normalizeRowSnapshots([
      null,
      { id: "missing-index" },
      { index: 2 },
      { rowId: "missing-row", index: 1 },
      { rowId: "ok", index: Number.NaN, row: { id: "ok", index: 1 } },
    ] as unknown as readonly unknown[])).toBeNull()
  })

  it("returns null for empty or null input", () => {
    expect(normalizeRowSnapshots(null)).toBeNull()
    expect(normalizeRowSnapshots(undefined)).toBeNull()
    expect(normalizeRowSnapshots([])).toBeNull()
  })
})
