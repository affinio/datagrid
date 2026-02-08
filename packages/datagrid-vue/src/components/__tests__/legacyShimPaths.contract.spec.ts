import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const viewportShim = readFileSync(new URL("../UiTableViewport.vue", import.meta.url), "utf8")
const viewportSimpleShim = readFileSync(new URL("../UiTableViewportSimple.vue", import.meta.url), "utf8")
const rowShim = readFileSync(new URL("../UiTableRow.vue", import.meta.url), "utf8")
const rowSurfaceShim = readFileSync(new URL("../UiTableRowSurface.vue", import.meta.url), "utf8")
const cellShim = readFileSync(new URL("../UiTableCell.vue", import.meta.url), "utf8")
const columnHeaderShim = readFileSync(new URL("../UiTableColumnHeader.vue", import.meta.url), "utf8")
const columnVisibilityShim = readFileSync(new URL("../UiTableColumnVisibility.vue", import.meta.url), "utf8")
const zoomControlShim = readFileSync(new URL("../UiTableZoomControl.vue", import.meta.url), "utf8")
const headerShim = readFileSync(new URL("../UiTableHeader.vue", import.meta.url), "utf8")
const virtualBodyRegionShim = readFileSync(new URL("../UiTableVirtualBodyRegion.vue", import.meta.url), "utf8")
const summaryShim = readFileSync(new URL("../UiTableSummary.vue", import.meta.url), "utf8")
const statusBarShim = readFileSync(new URL("../UiTableStatusBar.vue", import.meta.url), "utf8")
const toolbarShim = readFileSync(new URL("../UiTableToolbar.vue", import.meta.url), "utf8")
const modalsShim = readFileSync(new URL("../UiTableModals.vue", import.meta.url), "utf8")
const headerGroupShim = readFileSync(new URL("../UiTableHeaderGroup.vue", import.meta.url), "utf8")
const canonicalSources = [
  readFileSync(new URL("../DataGridCell.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridColumnHeader.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridColumnVisibility.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridHeader.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridHeaderGroup.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridModals.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridRowSurface.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridStatusBar.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridSummary.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridToolbar.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridVirtualBodyRegion.vue", import.meta.url), "utf8"),
  readFileSync(new URL("../DataGridZoomControl.vue", import.meta.url), "utf8"),
]
const componentsIndex = readFileSync(new URL("../index.ts", import.meta.url), "utf8")
const legacyComponentsIndex = readFileSync(new URL("../legacy.ts", import.meta.url), "utf8")

describe("legacy shim paths contract", () => {
  it("maps UiTableViewport to canonical DataGridViewport without duplicate runtime logic", () => {
    expect(viewportShim).toMatch(/import DataGridViewport from "\.\/DataGridViewport\.vue"/)
    expect(viewportShim).toMatch(/export default DataGridViewport/)
    expect(viewportSimpleShim).toMatch(/import DataGridViewport from "\.\/DataGridViewport\.vue"/)
    expect(viewportSimpleShim).toMatch(/export default DataGridViewport/)
  })

  it("maps UiTableRow to canonical DataGridRowSurface without duplicate runtime logic", () => {
    expect(rowShim).toMatch(/import DataGridRowSurface from "\.\/DataGridRowSurface\.vue"/)
    expect(rowShim).toMatch(/export default DataGridRowSurface/)
  })

  it("maps UiTable cell/column/row-surface/zoom shims to canonical DataGrid components", () => {
    expect(rowSurfaceShim).toMatch(/import DataGridRowSurface from "\.\/DataGridRowSurface\.vue"/)
    expect(rowSurfaceShim).toMatch(/export default DataGridRowSurface/)
    expect(cellShim).toMatch(/import DataGridCell from "\.\/DataGridCell\.vue"/)
    expect(cellShim).toMatch(/export default DataGridCell/)
    expect(columnHeaderShim).toMatch(/import DataGridColumnHeader from "\.\/DataGridColumnHeader\.vue"/)
    expect(columnHeaderShim).toMatch(/export default DataGridColumnHeader/)
    expect(columnVisibilityShim).toMatch(/import DataGridColumnVisibility from "\.\/DataGridColumnVisibility\.vue"/)
    expect(columnVisibilityShim).toMatch(/export default DataGridColumnVisibility/)
    expect(zoomControlShim).toMatch(/import DataGridZoomControl from "\.\/DataGridZoomControl\.vue"/)
    expect(zoomControlShim).toMatch(/export default DataGridZoomControl/)
  })

  it("maps UiTable header/body/summary/status shims to canonical DataGrid components", () => {
    expect(headerShim).toMatch(/import DataGridHeader from "\.\/DataGridHeader\.vue"/)
    expect(headerShim).toMatch(/export default DataGridHeader/)
    expect(virtualBodyRegionShim).toMatch(/import DataGridVirtualBodyRegion from "\.\/DataGridVirtualBodyRegion\.vue"/)
    expect(virtualBodyRegionShim).toMatch(/export default DataGridVirtualBodyRegion/)
    expect(summaryShim).toMatch(/import DataGridSummary from "\.\/DataGridSummary\.vue"/)
    expect(summaryShim).toMatch(/export default DataGridSummary/)
    expect(statusBarShim).toMatch(/import DataGridStatusBar from "\.\/DataGridStatusBar\.vue"/)
    expect(statusBarShim).toMatch(/export default DataGridStatusBar/)
  })

  it("maps UiTable toolbar/modals/header-group shims to canonical DataGrid components", () => {
    expect(toolbarShim).toMatch(/import DataGridToolbar from "\.\/DataGridToolbar\.vue"/)
    expect(toolbarShim).toMatch(/export default DataGridToolbar/)
    expect(modalsShim).toMatch(/import DataGridModals from "\.\/DataGridModals\.vue"/)
    expect(modalsShim).toMatch(/export default DataGridModals/)
    expect(headerGroupShim).toMatch(/import DataGridHeaderGroup from "\.\/DataGridHeaderGroup\.vue"/)
    expect(headerGroupShim).toMatch(/export default DataGridHeaderGroup/)
  })

  it("keeps explicit deprecation window for UiTable compatibility shims", () => {
    expect(legacyComponentsIndex).toContain("supported-until: 2026-08-31")
    expect(legacyComponentsIndex).toContain("removal-date: 2026-09-01")
  })

  it("keeps canonical components barrel free from Ui* legacy exports", () => {
    expect(componentsIndex).not.toMatch(/export\s+\{\s*default\s+as\s+UiTable/)
    expect(componentsIndex).not.toMatch(/export\s+\{\s*default\s+as\s+Ui/)
    expect(componentsIndex).not.toContain("./UiTable")
  })

  it("keeps canonical DataGrid SFCs free from local UiTable component imports", () => {
    canonicalSources.forEach(source => {
      expect(source).not.toContain("./UiTable")
    })
  })
})
