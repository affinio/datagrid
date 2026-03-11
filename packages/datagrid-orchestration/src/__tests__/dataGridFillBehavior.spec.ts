import { describe, expect, it } from "vitest"
import {
  buildDataGridFillMatrix,
  resolveDataGridDefaultFillBehavior,
} from "../dataGridFillBehavior"

describe("dataGridFillBehavior", () => {
  it("detects numeric vertical fills as series by default", () => {
    expect(resolveDataGridDefaultFillBehavior({
      baseRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      sourceMatrix: [["1"]],
    })).toBe("series")
  })

  it("extends vertical series values beyond the base range", () => {
    expect(buildDataGridFillMatrix({
      baseRange: { startRow: 0, endRow: 1, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      sourceMatrix: [["4"], ["6"]],
      behavior: "series",
    })).toEqual([["4"], ["6"], ["8"], ["10"]])
  })

  it("repeats source values in copy mode", () => {
    expect(buildDataGridFillMatrix({
      baseRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 2, startColumn: 0, endColumn: 0 },
      sourceMatrix: [["7"]],
      behavior: "copy",
    })).toEqual([["7"], ["7"], ["7"]])
  })
})