import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const viewportShim = readFileSync(new URL("../UiTableViewport.vue", import.meta.url), "utf8")
const viewportSimpleShim = readFileSync(new URL("../UiTableViewportSimple.vue", import.meta.url), "utf8")
const rowShim = readFileSync(new URL("../UiTableRow.vue", import.meta.url), "utf8")
const componentsIndex = readFileSync(new URL("../index.ts", import.meta.url), "utf8")

describe("legacy shim paths contract", () => {
  it("maps UiTableViewport to canonical DataGridViewport without duplicate runtime logic", () => {
    expect(viewportShim).toMatch(/import DataGridViewport from "\.\/DataGridViewport\.vue"/)
    expect(viewportShim).toMatch(/export default DataGridViewport/)
    expect(viewportSimpleShim).toMatch(/import DataGridViewport from "\.\/DataGridViewport\.vue"/)
    expect(viewportSimpleShim).toMatch(/export default DataGridViewport/)
  })

  it("maps UiTableRow to canonical UiTableRowSurface without duplicate runtime logic", () => {
    expect(rowShim).toMatch(/import UiTableRowSurface from "\.\/UiTableRowSurface\.vue"/)
    expect(rowShim).toMatch(/export default UiTableRowSurface/)
  })

  it("keeps explicit deprecation window for UiTable compatibility shims", () => {
    expect(componentsIndex).toContain("supported-until: 2026-08-31")
    expect(componentsIndex).toContain("removal-date: 2026-09-01")
  })
})
