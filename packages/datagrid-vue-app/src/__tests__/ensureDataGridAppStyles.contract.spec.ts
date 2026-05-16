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

  it("keeps the grid viewport on native touch panning by default", () => {
    ensureDataGridAppStyles()

    const style = document.getElementById(STYLE_ID)
    expect(style?.textContent).toContain(".grid-body-viewport")
    expect(style?.textContent).toContain("overscroll-behavior: contain")
    expect(style?.textContent).toContain("touch-action: pan-x pan-y")
    expect(style?.textContent).toContain("-webkit-overflow-scrolling: touch")
    expect(style?.textContent).toContain(".cell-fill-handle")
    expect(style?.textContent).toContain(".col-resize")
    expect(style?.textContent).toContain("touch-action: none")
    expect(style?.textContent).toContain("width: 28px")
    expect(style?.textContent).toContain("height: 28px")
    expect(style?.textContent).toContain("min-width: 28px")
    expect(style?.textContent).toContain(".cell-fill-handle::after")
    expect(style?.textContent).toContain(".grid-stage--scrolling .grid-cell--select")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .grid-cell--date")
    expect(style?.textContent).toContain(".grid-stage--scrolling .grid-cell--clipboard-pending::after")
    expect(style?.textContent).toContain("animation-play-state: paused")
  })
})
