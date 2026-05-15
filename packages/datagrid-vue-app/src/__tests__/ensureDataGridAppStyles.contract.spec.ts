import { afterEach, describe, expect, it } from "vitest"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"

const STYLE_ID = "affino-datagrid-vue-app-styles"

afterEach(() => {
  document.getElementById(STYLE_ID)?.remove()
})

describe("ensureDataGridAppStyles", () => {
  it("installs a touch fallback for canvas chrome rendering", () => {
    ensureDataGridAppStyles()

    const style = document.getElementById(STYLE_ID)
    expect(style?.textContent).toContain("@media (hover: none) and (pointer: coarse)")
    expect(style?.textContent).toContain(".grid-stage--canvas-chrome .grid-chrome-canvas")
    expect(style?.textContent).toContain("display: none !important")
    expect(style?.textContent).toContain("border-right: var(--datagrid-column-divider-size) solid var(--datagrid-column-divider-color)")
    expect(style?.textContent).toContain("background: var(--datagrid-row-background-color) !important")
  })
})
