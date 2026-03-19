import { describe, expect, it } from "vitest"
import { resolveDataGridLayoutOptions } from "../config/dataGridLayout"

describe("resolveDataGridLayoutOptions contract", () => {
  it("resets row limits when fill layout is resolved", () => {
    expect(resolveDataGridLayoutOptions("fill", 3, 5)).toEqual({
      layoutMode: "fill",
      minRows: null,
      maxRows: null,
    })
  })

  it("normalizes auto-height row limits and clamps maxRows to minRows", () => {
    expect(resolveDataGridLayoutOptions("auto-height", 4.8, 2.1)).toEqual({
      layoutMode: "auto-height",
      minRows: 4,
      maxRows: 4,
    })
  })

  it("treats zero and negative row limits as unset", () => {
    expect(resolveDataGridLayoutOptions("auto-height", 0, -5)).toEqual({
      layoutMode: "auto-height",
      minRows: null,
      maxRows: null,
    })
  })

  it("ignores non-finite row limits", () => {
    expect(resolveDataGridLayoutOptions("auto-height", Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      layoutMode: "auto-height",
      minRows: null,
      maxRows: null,
    })
  })

  it("treats undefined layoutMode as fill", () => {
    expect(resolveDataGridLayoutOptions(undefined, 3, 6)).toEqual({
      layoutMode: "fill",
      minRows: null,
      maxRows: null,
    })
  })
})