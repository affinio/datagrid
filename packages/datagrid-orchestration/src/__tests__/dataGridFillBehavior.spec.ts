import { describe, expect, it } from "vitest"
import {
  buildDataGridFillMatrix,
  canToggleDataGridFillBehavior,
  resolveDataGridDefaultFillBehavior,
} from "../fill/dataGridFillBehavior"

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

  it("detects text values with trailing digits as series by default", () => {
    expect(resolveDataGridDefaultFillBehavior({
      baseRange: { startRow: 0, endRow: 1, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      sourceMatrix: [["Item 01"], ["Item 02"]],
    })).toBe("series")
  })

  it("extends text values with trailing digits in series mode", () => {
    expect(buildDataGridFillMatrix({
      baseRange: { startRow: 0, endRow: 1, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      sourceMatrix: [["Item 01"], ["Item 02"]],
      behavior: "series",
    })).toEqual([["Item 01"], ["Item 02"], ["Item 03"], ["Item 04"]])
  })

  it("does not offer fill behavior toggle for plain text values", () => {
    expect(canToggleDataGridFillBehavior({
      baseRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      sourceMatrix: [["Atlas"]],
    })).toBe(false)
  })

  it("offers fill behavior toggle for trailing-digit text series", () => {
    expect(canToggleDataGridFillBehavior({
      baseRange: { startRow: 0, endRow: 1, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      sourceMatrix: [["Week 1"], ["Week 2"]],
    })).toBe(true)
  })
})