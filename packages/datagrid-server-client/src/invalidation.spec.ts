import { describe, expect, it } from "vitest"
import { normalizeDatasourceInvalidation } from "./invalidation"

describe("normalizeDatasourceInvalidation", () => {
  it.each([
    {
      label: "cell",
      input: {
        type: "cell",
        cells: [
          { rowId: " row-1 ", columnId: "name" },
          { rowId: "row-1", columnId: "status" },
          { rowId: 2, columnId: "name" },
          { rowId: "ignored" },
        ],
        reason: " edit ",
      },
      expected: {
        kind: "rows",
        rowIds: ["row-1", 2],
        reason: "edit",
      },
    },
    {
      label: "row",
      input: {
        type: "row",
        rows: [" row-3 ", 4, "", null],
        reason: "feed",
      },
      expected: {
        kind: "rows",
        rowIds: ["row-3", 4],
        reason: "feed",
      },
    },
    {
      label: "range",
      input: {
        type: "range",
        range: { startRow: 10.8, endRow: 12.2 },
      },
      expected: {
        kind: "range",
        range: { start: 10, end: 12 },
        reason: undefined,
      },
    },
    {
      label: "dataset",
      input: {
        type: "dataset",
        reason: "gap",
      },
      expected: {
        kind: "all",
        reason: "gap",
      },
    },
  ])("normalizes $label invalidation", ({ input, expected }) => {
    expect(normalizeDatasourceInvalidation(input)).toEqual(expected)
  })

  it.each([
    { type: "cell", cells: [] },
    { type: "row", rows: [] },
    { type: "rows", rowIds: [] },
  ])("falls back to dataset invalidation for empty narrow invalidation %#", input => {
    expect(normalizeDatasourceInvalidation(input)).toEqual({ kind: "all", reason: undefined })
  })

  it("returns null for malformed range invalidation", () => {
    expect(normalizeDatasourceInvalidation({ type: "range", range: { startRow: "bad", endRow: 2 } })).toBeNull()
  })
})
