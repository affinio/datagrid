import { describe, expect, it } from "vitest"
import { resolveDataGridGridLines } from "../config/dataGridGridLines"

describe("resolveDataGridGridLines contract", () => {
  it("defaults to full spreadsheet-style grid lines", () => {
    expect(resolveDataGridGridLines(undefined)).toEqual({
      body: "all",
      header: "columns",
      pinnedSeparators: true,
      bodyRows: true,
      bodyColumns: true,
      headerColumns: true,
    })
  })

  it("maps row-only preset to horizontal body lines and no header columns", () => {
    expect(resolveDataGridGridLines("rows")).toEqual({
      body: "rows",
      header: "none",
      pinnedSeparators: true,
      bodyRows: true,
      bodyColumns: false,
      headerColumns: false,
    })
  })

  it("supports explicit object overrides for header and pane separators", () => {
    expect(resolveDataGridGridLines({
      body: "columns",
      header: "none",
      pinnedSeparators: false,
    })).toEqual({
      body: "columns",
      header: "none",
      pinnedSeparators: false,
      bodyRows: false,
      bodyColumns: true,
      headerColumns: false,
    })
  })

  it("turns everything off for the none preset", () => {
    expect(resolveDataGridGridLines("none")).toEqual({
      body: "none",
      header: "none",
      pinnedSeparators: false,
      bodyRows: false,
      bodyColumns: false,
      headerColumns: false,
    })
  })
})
