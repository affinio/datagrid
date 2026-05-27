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
    const mediaStart = style?.textContent?.indexOf("@media (hover: none) and (pointer: coarse)") ?? -1
    const coarseFallbackStart = style?.textContent?.indexOf(
      ".grid-stage--canvas-chrome .grid-header-shell .grid-cell,",
      mediaStart,
    ) ?? -1
    const coarseFallbackEnd = style?.textContent?.indexOf(".grid-stage--canvas-chrome .grid-row--hoverable", coarseFallbackStart) ?? -1
    const headerFallbackRule = coarseFallbackStart >= 0 && coarseFallbackEnd > coarseFallbackStart
      ? style?.textContent?.slice(coarseFallbackStart, coarseFallbackEnd)
      : ""
    expect(headerFallbackRule).not.toContain("border-bottom:")
  })

  it("keeps canvas chrome body cells transparent outside coarse fallback", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const pinnedOverrideStart = styleText.indexOf(".grid-stage--canvas-chrome .grid-body-shell .grid-cell--pinned-left")
    const pinnedOverrideEnd = styleText.indexOf("@media (hover: none) and (pointer: coarse)", pinnedOverrideStart)
    const pinnedOverrideRule = pinnedOverrideStart >= 0 && pinnedOverrideEnd > pinnedOverrideStart
      ? styleText.slice(pinnedOverrideStart, pinnedOverrideEnd)
      : ""

    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-row--striped .grid-cell")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-row--hoverable.grid-row--hovered .grid-cell")
    expect(styleText).toContain("background-image: none")
    expect(pinnedOverrideRule).toContain("background: transparent")
    expect(pinnedOverrideRule).toContain("box-shadow: none")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-cell--pinned-divider-right")
    expect(styleText).toContain("box-shadow: inset calc(-1 * var(--datagrid-column-divider-size))")
  })

  it("keeps the grid viewport on native touch panning by default", () => {
    ensureDataGridAppStyles()

    const style = document.getElementById(STYLE_ID)
    const styleText = style?.textContent ?? ""
    const bodyViewportStart = styleText.indexOf(".grid-body-viewport {")
    const bodyViewportEnd = styleText.indexOf(".grid-body-viewport--pinned-bottom", bodyViewportStart)
    const bodyViewportRule = bodyViewportStart >= 0 && bodyViewportEnd > bodyViewportStart
      ? styleText.slice(bodyViewportStart, bodyViewportEnd)
      : ""

    expect(styleText).toContain(".grid-body-viewport")
    expect(bodyViewportRule).not.toContain("overscroll-behavior")
    expect(styleText).toContain("touch-action: pan-x pan-y")
    expect(styleText).toContain("-webkit-overflow-scrolling: touch")
    expect(styleText).toContain("content-visibility: auto")
    expect(styleText).toContain("contain-intrinsic-size: auto var(--datagrid-base-row-height, 31px)")
    expect(style?.textContent).toContain(".cell-fill-handle")
    expect(style?.textContent).toContain(".col-resize")
    expect(style?.textContent).toContain("touch-action: none")
    expect(style?.textContent).toContain("width: 28px")
    expect(style?.textContent).toContain("height: 28px")
    expect(style?.textContent).toContain("min-width: 28px")
    expect(style?.textContent).toContain(".cell-fill-handle::after")
    expect(style?.textContent).toContain(".grid-stage--scrolling .grid-cell--select")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .grid-cell--date")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .cell-fill-handle")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .grid-fill-action__trigger")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .row-resize-handle")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .col-resize")
    expect(style?.textContent).toContain(".datagrid-app-status")
    expect(style?.textContent).toContain("clip: rect(0 0 0 0)")
    expect(style?.textContent).toContain(".grid-stage--scrolling .grid-cell--clipboard-pending::after")
    expect(style?.textContent).toContain("animation-play-state: paused")
  })
})
